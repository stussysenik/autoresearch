/**
 * Phases 1-5: Research Execution Loop with Self-Identification
 *
 * For each research phase:
 * 1. Gather context from dependency phases
 * 2. Send initial research prompt to claude -p
 * 3. Run self-identification loop (discover gaps → research them)
 * 4. Checkpoint progress for resume capability
 *
 * Overnight-safe: per-phase isolation, retries, graceful degradation.
 */

import fs from 'fs/promises'
import path from 'path'
import { research } from './llm.js'
import { loadState, saveCheckpoint, isPhaseComplete } from './checkpoint.js'
import { isStorageSafe } from './storage.js'
import { phases, GAP_ANALYSIS_PROMPT } from './variants.js'

const RESULTS_DIR = path.join(import.meta.dir, '..', 'data', 'results')

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function timestamp(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

/**
 * Gather context from completed dependency phases.
 * v2: Summarizes large contexts to <30KB to prevent timeout issues.
 * v1 concatenated raw .md files which caused 500KB+ prompts and timeouts.
 */
async function gatherContext(dependencies: string[]): Promise<string> {
  const parts: string[] = []

  for (const depId of dependencies) {
    try {
      const files = await fs.readdir(RESULTS_DIR)
      const depFiles = files
        .filter(f => f.startsWith(depId) && f.endsWith('.md'))
        .sort()

      for (const file of depFiles) {
        const content = await fs.readFile(path.join(RESULTS_DIR, file), 'utf-8')
        parts.push(`--- ${file} ---\n${content}`)
      }
    } catch {
      // Dependency phase may not have completed — graceful degradation
    }
  }

  if (parts.length === 0) {
    return '(No prior research context available — this phase has no completed dependencies.)'
  }

  const raw = parts.join('\n\n')

  // If context is small enough, use it directly
  if (raw.length < 30_000) {
    return raw
  }

  // Otherwise, summarize via claude -p to prevent timeout from large context
  console.log(`  Context too large (${(raw.length / 1024).toFixed(1)} KB). Summarizing...`)
  try {
    const summary = await research(
      `Summarize the following research findings into a concise summary (max 8000 words). Preserve: key conclusions, specific numbers/metrics, mathematical formulas, model recommendations, and architecture decisions. Drop: verbose explanations, repeated content, examples.\n\n${raw.slice(0, 100_000)}`,
      300_000, // 5 min timeout for summarization
    )
    console.log(`  Summarized to ${(summary.length / 1024).toFixed(1)} KB`)
    return summary
  } catch {
    // If summarization fails, truncate to last 30KB
    console.log(`  Summarization failed. Truncating to last 30KB.`)
    return raw.slice(-30_000)
  }
}

/**
 * Parse gap analysis response to extract follow-up questions.
 * Returns empty array if response is "NO_GAPS" or unparseable.
 */
function parseGaps(response: string): string[] {
  if (response.trim() === 'NO_GAPS' || response.includes('NO_GAPS')) {
    return []
  }

  const gaps: string[] = []
  const gapRegex = /\*\*Missing\*\*:\s*(.+?)(?:\n|$)/g
  let match
  while ((match = gapRegex.exec(response)) !== null) {
    gaps.push(match[1].trim())
  }

  // Fallback: if no structured gaps found, check if there are numbered items
  if (gaps.length === 0) {
    const lines = response.split('\n').filter(l => /^###?\s*Gap/.test(l))
    for (const line of lines) {
      gaps.push(line.replace(/^###?\s*Gap\s*\d+:\s*/, '').trim())
    }
  }

  return gaps
}

/**
 * Execute a single research phase with self-identification loop.
 */
async function executePhase(
  phaseIndex: number,
  startFollowup = 0,
): Promise<void> {
  const phase = phases[phaseIndex]
  const state = await loadState()

  console.log(`\n╔══════════════════════════════════════════════════╗`)
  console.log(`║  ${phase.id}: ${phase.name.padEnd(40)}║`)
  console.log(`╚══════════════════════════════════════════════════╝`)
  console.log(`  Dependencies: ${phase.dependencies.join(', ') || 'none'}`)
  console.log(`  Time budget: ${phase.timeBudgetMinutes}min | Max followups: ${phase.maxFollowups}`)
  console.log()

  const phaseStart = Date.now()
  const artifacts: string[] = state.phases[phase.id]?.artifacts || []
  let bytesWritten = state.phases[phase.id]?.bytesWritten || 0
  let followupsCompleted = startFollowup

  await saveCheckpoint(state, phase.id, {
    phaseId: phase.id,
    status: 'in_progress',
    startedAt: state.phases[phase.id]?.startedAt || new Date().toISOString(),
    completedAt: null,
    followupsCompleted,
    artifacts,
    bytesWritten,
  })

  // Step 1: Gather context from dependencies
  console.log(`  [${timestamp()}] Gathering context from dependencies...`)
  const context = await gatherContext(phase.dependencies)
  console.log(`  Context: ${(Buffer.byteLength(context) / 1024).toFixed(1)} KB from ${phase.dependencies.length} phases`)

  // Step 2: Initial research (skip if resuming past it)
  const initialPath = path.join(RESULTS_DIR, `${phase.id}-${slugify(phase.name)}.md`)

  if (startFollowup === 0) {
    console.log(`  [${timestamp()}] Sending initial research prompt...`)

    const questionsBlock = phase.seedQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')
    const prompt = phase.promptTemplate
      .replace('{context}', context)
      .replace('{questions}', questionsBlock)

    const result = await research(prompt)
    const header = `# ${phase.id}: ${phase.name}\n\n_Generated: ${new Date().toISOString()}_\n\n---\n\n`
    const content = header + result

    await fs.mkdir(RESULTS_DIR, { recursive: true })
    await fs.writeFile(initialPath, content)
    const bytes = Buffer.byteLength(content)
    bytesWritten += bytes
    artifacts.push(initialPath)

    console.log(`  [${timestamp()}] Initial research saved (${(bytes / 1024).toFixed(1)} KB)`)
  } else {
    console.log(`  [${timestamp()}] Resuming from followup ${startFollowup}...`)
  }

  // Step 3: Self-identification loop
  for (let i = followupsCompleted; i < phase.maxFollowups; i++) {
    // Time budget check
    const elapsedMin = (Date.now() - phaseStart) / 60_000
    if (elapsedMin > phase.timeBudgetMinutes) {
      console.log(`  [${timestamp()}] Time budget exhausted (${elapsedMin.toFixed(1)}min). Moving on.`)
      break
    }

    // Storage check
    if (!isStorageSafe()) {
      console.log(`  [${timestamp()}] Storage low. Stopping followups.`)
      break
    }

    // Read current research output for gap analysis
    let currentResearch: string
    try {
      currentResearch = await fs.readFile(initialPath, 'utf-8')
      // Also include any prior followups
      for (const art of artifacts) {
        if (art !== initialPath) {
          currentResearch += '\n\n' + await fs.readFile(art, 'utf-8')
        }
      }
    } catch {
      break
    }

    // Truncate context if too long (avoid hitting token limits)
    if (currentResearch.length > 80_000) {
      currentResearch = currentResearch.slice(-80_000)
    }

    console.log(`  [${timestamp()}] Self-identification loop ${i + 1}/${phase.maxFollowups}...`)

    const gapPrompt = GAP_ANALYSIS_PROMPT.replace('{research}', currentResearch)
    const gapResponse = await research(gapPrompt, 120_000)
    const gaps = parseGaps(gapResponse)

    if (gaps.length === 0) {
      console.log(`  [${timestamp()}] No meaningful gaps found. Research is thorough.`)
      break
    }

    console.log(`  [${timestamp()}] Found ${gaps.length} gap(s). Researching...`)

    // Research each gap
    for (let g = 0; g < gaps.length; g++) {
      const gap = gaps[g]
      console.log(`    Gap ${g + 1}: ${gap.slice(0, 80)}${gap.length > 80 ? '...' : ''}`)

      const followupPrompt = `You are continuing research on ${phase.name} for a breakdancing battle analysis system.

## Prior Research Context

${currentResearch.slice(-40_000)}

## Specific Question to Address

${gap}

## Requirements

- Provide mathematical formulations where applicable
- Include concrete numerical estimates
- Reference specific models, algorithms, or papers
- Address this gap thoroughly — it was identified as critical or important

Depth over breadth.`

      const followupResult = await research(followupPrompt)
      const followupPath = path.join(RESULTS_DIR, `${phase.id}-${slugify(phase.name)}-followup-${i + 1}-${g + 1}.md`)
      const followupHeader = `# ${phase.id} Follow-up ${i + 1}.${g + 1}: ${gap.slice(0, 100)}\n\n_Generated: ${new Date().toISOString()}_\n\n---\n\n`
      const followupContent = followupHeader + followupResult

      await fs.writeFile(followupPath, followupContent)
      const bytes = Buffer.byteLength(followupContent)
      bytesWritten += bytes
      artifacts.push(followupPath)

      console.log(`    Saved (${(bytes / 1024).toFixed(1)} KB)`)
    }

    followupsCompleted = i + 1

    // Update checkpoint after each followup round
    await saveCheckpoint(state, phase.id, {
      phaseId: phase.id,
      status: 'in_progress',
      startedAt: state.phases[phase.id]?.startedAt || new Date().toISOString(),
      completedAt: null,
      followupsCompleted,
      artifacts,
      bytesWritten,
    })
  }

  // Mark phase complete
  const totalMin = ((Date.now() - phaseStart) / 60_000).toFixed(1)
  await saveCheckpoint(state, phase.id, {
    phaseId: phase.id,
    status: 'complete',
    startedAt: state.phases[phase.id]?.startedAt || new Date().toISOString(),
    completedAt: new Date().toISOString(),
    followupsCompleted,
    artifacts,
    bytesWritten,
  })

  console.log(`  [${timestamp()}] Phase complete: ${totalMin}min, ${artifacts.length} artifacts, ${(bytesWritten / 1024).toFixed(1)} KB`)
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

/**
 * Execute a phase with retries and error isolation.
 */
async function safeExecutePhase(phaseIndex: number): Promise<void> {
  const phase = phases[phaseIndex]
  const maxRetries = 2

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Reload state to get latest followup count for resume
      const state = await loadState()
      const startFollowup = state.phases[phase.id]?.followupsCompleted || 0
      await executePhase(phaseIndex, startFollowup)
      return
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error(`  [${timestamp()}] Phase ${phase.id} attempt ${attempt + 1} failed: ${msg}`)

      if (attempt < maxRetries) {
        const waitMs = 30_000 * Math.pow(3, attempt)
        console.log(`  Retrying in ${(waitMs / 1000).toFixed(0)}s...`)
        await sleep(waitMs)
      } else {
        const state = await loadState()
        await saveCheckpoint(state, phase.id, {
          phaseId: phase.id,
          status: 'failed',
          startedAt: state.phases[phase.id]?.startedAt || null,
          completedAt: null,
          followupsCompleted: state.phases[phase.id]?.followupsCompleted || 0,
          artifacts: state.phases[phase.id]?.artifacts || [],
          bytesWritten: state.phases[phase.id]?.bytesWritten || 0,
          error: msg,
        })
        console.error(`  Phase ${phase.id} failed after ${maxRetries + 1} attempts. Moving to next phase.`)
      }
    }
  }
}

// ─── Main ──────────────────────────────────────────────────────────

async function main() {
  console.log('\n════════════════════════════════════════════════════')
  console.log('  Breakdancing Battle Analysis — Research Phases 1-5')
  console.log('════════════════════════════════════════════════════\n')

  // Heartbeat interval — log progress every 5 minutes
  const heartbeat = setInterval(() => {
    console.log(`  [${timestamp()}] ♥ Heartbeat — experiment still running`)
  }, 5 * 60_000)

  try {
    // Execute phases 1-5 (index 1-5 in the phases array)
    for (let i = 1; i <= 5; i++) {
      const state = await loadState()
      const phase = phases[i]

      if (isPhaseComplete(state, phase.id)) {
        console.log(`\n  ${phase.id} already complete — skipping.`)
        continue
      }

      if (!isStorageSafe()) {
        console.error(`\n  Storage critically low. Stopping at ${phase.id}.`)
        break
      }

      await safeExecutePhase(i)
    }

    console.log(`\n  [${timestamp()}] All research phases complete.`)
  } finally {
    clearInterval(heartbeat)
  }
}

main()
