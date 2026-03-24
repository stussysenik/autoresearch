/**
 * Karpathy Optimization Loop: TRIVIUM Engine Code Generation
 *
 * Generate → Evaluate → Keep if better → Repeat
 * Provider: codex (gpt-5.4)
 * Locked eval: evaluate.sh (agent cannot modify)
 *
 * Usage: cd overnight && bun run run-loop.ts 2>&1 | tee run.log
 */

import { spawn } from 'child_process'
import { readFileSync, writeFileSync, mkdirSync, existsSync, cpSync, rmSync } from 'fs'

// ── Configuration ──
const DIRECTION: 'higher' | 'lower' = 'higher'
const MAX_VARIANTS = 100
const STALE_LIMIT = 8
const RESULTS_FILE = 'results.jsonl'
const PROVIDER = process.env.LLM_PROVIDER || 'codex'
const MODEL = process.env.LLM_MODEL || ''  // empty = use default from ~/.codex/config.toml (gpt-5.4)
const TIMEOUT_SEC = 900  // 15 min per generation

// ── File extraction ──
const FILE_OUTPUT_INSTRUCTIONS = `
## Output Format
Output each file using this EXACT format:

--- FILE: path/to/file.py ---
<file contents here>
--- END FILE ---

Rules:
- Output exactly TWO files: analyze_motion.py and match_beats.py
- Include COMPLETE file contents (no ellipsis, no "rest stays the same")
- Output ONLY files. No explanations before or after.
- Every file you output will overwrite any existing file at that path.
`

function extractFiles(output: string): Array<{path: string, content: string}> {
  const files: Array<{path: string, content: string}> = []
  const pattern = /---\s*FILE:\s*(.+?)\s*---\n([\s\S]*?)(?=---\s*(?:END FILE|FILE:)|$)/g
  let match
  while ((match = pattern.exec(output)) !== null) {
    const content = match[2].replace(/---\s*END FILE\s*---\s*$/, '').trim()
    files.push({ path: match[1].trim(), content: content + '\n' })
  }
  return files
}

// ── LLM Provider ──
async function callLLM(prompt: string): Promise<string> {
  const promptFile = `/tmp/trivium-prompt-${Date.now()}.txt`
  const outputFile = `/tmp/trivium-output-${Date.now()}.txt`
  writeFileSync(promptFile, prompt)

  try {
    let cmd: string, args: string[]
    if (PROVIDER === 'codex') {
      // codex exec: reads prompt from file, writes output to file
      // --sandbox read-only prevents codex from modifying our files
      cmd = 'codex'
      args = ['exec', '-m', MODEL, '--sandbox', 'read-only', '-o', outputFile, '-', '<', promptFile]
      // Actually use bash to handle the stdin redirect
      cmd = 'bash'
      const modelFlag = MODEL ? `-m ${MODEL}` : ''
      args = ['-c', `cat ${promptFile} | codex exec ${modelFlag} --sandbox read-only -o ${outputFile} -`]
    } else if (PROVIDER === 'claude') {
      cmd = 'bash'
      args = ['-c', `claude -p --output-format text --tools "" --model ${MODEL || 'sonnet'} < ${promptFile} > ${outputFile}`]
    } else {
      throw new Error(`Unknown provider: ${PROVIDER}`)
    }

    return await new Promise((resolve, reject) => {
      let stdout = ''
      let stderr = ''
      const proc = spawn(cmd, args, {
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: TIMEOUT_SEC * 1000,
      })
      proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
      proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })
      proc.on('close', (code) => {
        // Read from output file if it exists (codex -o and claude > redirect)
        let result = ''
        try { result = readFileSync(outputFile, 'utf-8') } catch {}
        if (!result.trim()) result = stdout

        if (result.trim()) resolve(result)
        else reject(new Error(`Exit ${code}: ${stderr.slice(0, 300)}`))
      })
      proc.on('error', reject)
    })
  } finally {
    try { require('fs').unlinkSync(promptFile) } catch {}
    try { require('fs').unlinkSync(outputFile) } catch {}
  }
}

// ── Results tracking ──
interface Result {
  variant: string
  score: number | null
  error?: string
  timestamp: string
  details?: Record<string, unknown>
}

function loadResults(): Result[] {
  if (!existsSync(RESULTS_FILE)) return []
  return readFileSync(RESULTS_FILE, 'utf-8')
    .trim().split('\n').filter(Boolean)
    .map(l => JSON.parse(l))
}

function bestResult(results: Result[]): Result | null {
  const valid = results.filter(r => r.score !== null)
  if (valid.length === 0) return null
  return valid.reduce((best, r) =>
    r.score! > best.score! ? r : best
  )
}

// ── Main loop ──
async function main() {
  const goal = readFileSync('GOAL.md', 'utf-8')
  const context = readFileSync('prompt-context.md', 'utf-8')
  const startTime = Date.now()

  mkdirSync('variants', { recursive: true })
  mkdirSync('debug', { recursive: true })
  mkdirSync('best', { recursive: true })

  console.log(`\n━━━ TRIVIUM Karpathy Loop ━━━`)
  console.log(`Provider: ${PROVIDER} (${MODEL})`)
  console.log(`Max variants: ${MAX_VARIANTS}, Stale limit: ${STALE_LIMIT}`)
  console.log(`Started: ${new Date().toISOString()}\n`)

  let staleness = 0

  for (let i = 1; i <= MAX_VARIANTS; i++) {
    const results = loadResults()
    const best = bestResult(results)

    // Circuit breakers
    if (staleness >= STALE_LIMIT) {
      console.log(`\n⚡ Circuit breaker: No improvement in ${STALE_LIMIT} attempts.`)
      break
    }
    if (results.length >= 10) {
      const recentFails = results.slice(-10).filter(r => r.score === null).length
      if (recentFails >= 7) {
        console.log(`\n⚡ Circuit breaker: ${recentFails}/10 recent failures.`)
        break
      }
    }

    console.log(`\n━━━ Variant ${i}/${MAX_VARIANTS} (best: ${best?.score ?? 'none'}, stale: ${staleness}/${STALE_LIMIT}) ━━━`)

    const variantDir = `variants/${String(i).padStart(3, '0')}`
    mkdirSync(variantDir, { recursive: true })

    // Build prompt
    const recentResults = results.slice(-10)
    const failures = results.filter(r => r.error).map(r => r.error)
    const uniqueFailures = [...new Set(failures)].slice(-5)

    const prompt = `You are an expert Python developer building a TRIVIUM breakdancing scoring engine.

## Goal
${goal}

## Technical Context
${context}

## Current State
- Best score: ${best ? `${best.score}/100 (variant ${best.variant})` : 'no measurements yet'}
- Variants tested: ${results.length}
- Recent results:
${recentResults.map(r => `  ${r.variant}: ${r.score ?? `FAILED (${r.error})`}`).join('\n') || '  (none yet)'}
${uniqueFailures.length > 0 ? `\n- Common failures to AVOID:\n${uniqueFailures.map(f => `  - ${f}`).join('\n')}` : ''}
${results.length > 5 ? '\nRecent attempts may cluster. Try a DIFFERENT approach or architecture.' : ''}

## Task
Generate variant ${i}. Write both analyze_motion.py and match_beats.py.

Key requirements:
1. analyze_motion.py: extract_features(joints_3d, fps=30) returns (features_9xN, metadata_dict)
2. match_beats.py: has spectral_cross_correlation() and match_accents_to_beats() functions
3. All TRIVIUM sub-scores that are computable from kinematics must be implemented
4. Theoretical components (creativity, battle response) should be stubbed returning 0.5
5. Both files must run standalone with --test mode using synthetic data

${FILE_OUTPUT_INSTRUCTIONS}`

    writeFileSync(`debug/${i}-prompt.txt`, prompt)

    // Generate
    try {
      console.log(`  Generating with ${PROVIDER}...`)
      const llmOutput = await callLLM(prompt)
      writeFileSync(`debug/${i}-response.txt`, llmOutput)

      // Extract files
      const files = extractFiles(llmOutput)
      if (files.length === 0) {
        console.log(`  ⚠️ No files extracted. Saving raw output.`)
        writeFileSync(`${variantDir}/generated.txt`, llmOutput)
      } else {
        for (const f of files) {
          writeFileSync(`${variantDir}/${f.path}`, f.content)
        }
        console.log(`  Extracted ${files.length} files: ${files.map(f => f.path).join(', ')}`)
      }

      // Evaluate
      console.log(`  Evaluating...`)
      const evalProc = Bun.spawnSync(['bash', './evaluate.sh', variantDir], {
        timeout: 60_000,
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const evalOutput = evalProc.stdout.toString().trim()
      const evalLines = evalOutput.split('\n').filter(Boolean)

      let result: Result = {
        variant: String(i).padStart(3, '0'),
        score: null,
        error: 'no_json_in_eval',
        timestamp: new Date().toISOString(),
      }

      for (let j = evalLines.length - 1; j >= 0; j--) {
        try {
          const parsed = JSON.parse(evalLines[j])
          result = { ...result, ...parsed, variant: String(i).padStart(3, '0') }
          break
        } catch {}
      }

      // Log result
      writeFileSync(RESULTS_FILE, JSON.stringify(result) + '\n', { flag: 'a' })

      if (result.score !== null) {
        const improved = !best || result.score > best.score!
        if (improved) {
          console.log(`  ✅ NEW BEST: ${result.score}/100 (was ${best?.score ?? 'none'})`)
          staleness = 0
          try { rmSync('best', { recursive: true }) } catch {}
          cpSync(variantDir, 'best', { recursive: true })
        } else {
          staleness++
          console.log(`  ❌ No improvement: ${result.score} vs best ${best!.score} (stale: ${staleness}/${STALE_LIMIT})`)
        }
      } else {
        staleness++
        console.log(`  💥 Failed: ${result.error} (stale: ${staleness}/${STALE_LIMIT})`)
      }

    } catch (e) {
      const msg = (e as Error).message.slice(0, 200)
      console.error(`  💥 Generation crashed: ${msg}`)
      writeFileSync(RESULTS_FILE, JSON.stringify({
        variant: String(i).padStart(3, '0'),
        score: null,
        error: `gen_crash: ${msg}`,
        timestamp: new Date().toISOString(),
      }) + '\n', { flag: 'a' })
      staleness++
    }

    // Heartbeat
    const elapsed = ((Date.now() - startTime) / 60_000).toFixed(1)
    console.log(`  ⏱ Elapsed: ${elapsed}min`)
  }

  // Final report
  const results = loadResults()
  const best = bestResult(results)
  const successful = results.filter(r => r.score !== null).length
  const elapsed = ((Date.now() - startTime) / 60_000).toFixed(1)

  console.log(`\n━━━ FINAL REPORT ━━━`)
  console.log(`Total variants: ${results.length}`)
  console.log(`Successful: ${successful} (${results.length > 0 ? ((successful / results.length) * 100).toFixed(0) : 0}%)`)
  console.log(`Best score: ${best?.score ?? 'none'}/100 (variant ${best?.variant ?? 'none'})`)
  console.log(`Elapsed: ${elapsed} minutes`)
  console.log(`Best variant saved in: best/`)
  console.log(`━━━━━━━━━━━━━━━━━━━━\n`)
}

main().catch(e => {
  console.error('Loop crashed:', e)
  process.exit(1)
})
