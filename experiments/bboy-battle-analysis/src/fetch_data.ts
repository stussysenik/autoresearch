/**
 * Phase 0: Seed Question Discovery
 *
 * Instead of fetching data from a database, this phase uses claude -p to
 * discover the complete research landscape for breakdancing battle analysis.
 * The discovered questions are merged with hardcoded seed questions and
 * saved for subsequent phases.
 */

import fs from 'fs/promises'
import path from 'path'
import { research } from './llm.js'
import { loadState, saveCheckpoint, isPhaseComplete } from './checkpoint.js'
import { isStorageSafe } from './storage.js'
import { phases } from './variants.js'

const RESULTS_DIR = path.join(import.meta.dir, '..', 'data', 'results')

async function main() {
  console.log('\n╔══════════════════════════════════════════════════╗')
  console.log('║  Phase 0: Seed Question Discovery                ║')
  console.log('╚══════════════════════════════════════════════════╝\n')

  const state = await loadState()
  const phase = phases[0]

  // Resume check
  if (isPhaseComplete(state, phase.id)) {
    console.log('Phase 0 already complete — skipping.')
    return
  }

  if (!isStorageSafe()) {
    console.error('Insufficient disk space. Aborting.')
    process.exit(1)
  }

  await saveCheckpoint(state, phase.id, {
    phaseId: phase.id,
    status: 'in_progress',
    startedAt: new Date().toISOString(),
    completedAt: null,
    followupsCompleted: 0,
    artifacts: [],
    bytesWritten: 0,
  })

  // Build the seed discovery prompt
  const questionsBlock = phase.seedQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')
  const prompt = phase.promptTemplate.replace('{questions}', questionsBlock)

  console.log(`Sending seed discovery prompt (${prompt.length} chars)...`)
  const startTime = Date.now()

  try {
    const result = await research(prompt)
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`Got response in ${elapsed}s (${result.length} chars)`)

    // Save the research output
    await fs.mkdir(RESULTS_DIR, { recursive: true })
    const outputPath = path.join(RESULTS_DIR, 'phase-0-seed-questions.md')
    const header = `# Phase 0: Seed Question Discovery\n\n_Generated: ${new Date().toISOString()}_\n_Duration: ${elapsed}s_\n\n---\n\n`
    await fs.writeFile(outputPath, header + result)

    const bytesWritten = Buffer.byteLength(header + result)
    console.log(`Saved to ${outputPath} (${(bytesWritten / 1024).toFixed(1)} KB)`)

    await saveCheckpoint(state, phase.id, {
      phaseId: phase.id,
      status: 'complete',
      startedAt: state.phases[phase.id]?.startedAt || new Date().toISOString(),
      completedAt: new Date().toISOString(),
      followupsCompleted: 0,
      artifacts: [outputPath],
      bytesWritten,
    })

    console.log('\nPhase 0 complete.\n')
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`Phase 0 failed: ${msg}`)

    await saveCheckpoint(state, phase.id, {
      phaseId: phase.id,
      status: 'failed',
      startedAt: state.phases[phase.id]?.startedAt || new Date().toISOString(),
      completedAt: null,
      followupsCompleted: 0,
      artifacts: [],
      bytesWritten: 0,
      error: msg,
    })

    process.exit(1)
  }
}

main()
