/**
 * Multi-Agent Scenario Research Loop: TRIVIUM v0.2 Design Thinking
 *
 * For each of 12 breaking scenarios, dispatches a team of 5 agents:
 *   Physics (claude) → Musicality (codex) → Phase (claude) → Contact (codex) → Synthesis (claude)
 *
 * Each agent reads the scenario + its domain prompt + previous agents' output.
 * The Synthesis agent combines all 4 signatures into a complete scenario blueprint.
 *
 * Output: per-scenario markdown blueprints with states, properties, validation, tests, pseudo-code.
 *
 * Usage: cd overnight-v2 && bun run run-loop.ts 2>&1 | tee run.log
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'

// ── Configuration ──
const TIMEOUT_SEC = 600  // 10 min per agent call
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'sonnet'
const CODEX_MODEL = process.env.CODEX_MODEL || ''  // empty = default from ~/.codex/config.toml

// Agent definitions: name, prompt file, provider
const AGENTS = [
  { name: 'physics',     prompt: 'prompt-physics.md',     provider: 'claude' },
  { name: 'musicality',  prompt: 'prompt-musicality.md',  provider: 'codex'  },
  { name: 'phase',       prompt: 'prompt-phase.md',       provider: 'claude' },
  { name: 'contact',     prompt: 'prompt-contact.md',     provider: 'codex'  },
  { name: 'synthesis',   prompt: 'prompt-synthesis.md',    provider: 'claude' },
]

// ── LLM Provider ──
async function callLLM(prompt: string, provider: string): Promise<string> {
  const promptFile = `/tmp/v2-prompt-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`
  const outputFile = `/tmp/v2-output-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`
  writeFileSync(promptFile, prompt)

  try {
    let cmd: string
    // Use full paths — macOS doesn't have `timeout`, Bun.spawn handles our own timeout
    const CLAUDE_BIN = process.env.CLAUDE_BIN || '/Users/s3nik/.local/bin/claude'
    const CODEX_BIN = process.env.CODEX_BIN || '/Users/s3nik/.bun/bin/codex'
    if (provider === 'claude') {
      cmd = `${CLAUDE_BIN} -p --output-format text --tools "" --model ${CLAUDE_MODEL} < ${promptFile} > ${outputFile}`
    } else if (provider === 'codex') {
      const modelFlag = CODEX_MODEL ? `-m ${CODEX_MODEL}` : ''
      cmd = `${CODEX_BIN} exec ${modelFlag} --sandbox read-only -o ${outputFile} - < ${promptFile}`
    } else {
      throw new Error(`Unknown provider: ${provider}`)
    }

    return await new Promise((resolve, reject) => {
      const proc = Bun.spawn(['bash', '-c', cmd], {
        env: { ...process.env },
        stdout: 'pipe',
        stderr: 'pipe',
      })

      const timeoutId = setTimeout(() => {
        proc.kill()
        reject(new Error(`Timeout after ${TIMEOUT_SEC}s`))
      }, (TIMEOUT_SEC + 60) * 1000)

      proc.exited.then((code) => {
        clearTimeout(timeoutId)
        let result = ''
        try { result = readFileSync(outputFile, 'utf-8') } catch {}
        if (result.trim()) resolve(result)
        else reject(new Error(`Exit ${code}, no output`))
      })
    })
  } finally {
    try { require('fs').unlinkSync(promptFile) } catch {}
    try { require('fs').unlinkSync(outputFile) } catch {}
  }
}

// ── Load Scenarios ──
interface Scenario {
  id: string
  video_path: string
  audio_path: string
  tags: string[]
  notes: string
}

function loadScenarios(): Scenario[] {
  const data = JSON.parse(readFileSync('scenarios.json', 'utf-8'))
  return data.scenarios
}

// ── Main Loop ──
async function main() {
  const scenarios = loadScenarios()
  const startTime = Date.now()

  // Load all agent prompts
  const agentPrompts: Record<string, string> = {}
  for (const agent of AGENTS) {
    agentPrompts[agent.name] = readFileSync(agent.prompt, 'utf-8')
  }

  mkdirSync('results', { recursive: true })
  mkdirSync('debug', { recursive: true })

  console.log(`\n━━━ TRIVIUM v0.2 Multi-Agent Research Loop ━━━`)
  console.log(`Scenarios: ${scenarios.length}`)
  console.log(`Agents: ${AGENTS.map(a => `${a.name}(${a.provider})`).join(', ')}`)
  console.log(`Started: ${new Date().toISOString()}\n`)

  // Accumulate cross-scenario context for feed-forward
  let crossContext = ''
  const scenarioSummaries: string[] = []

  for (let si = 0; si < scenarios.length; si++) {
    const scenario = scenarios[si]
    const scenarioDir = `results/${scenario.id}`
    mkdirSync(scenarioDir, { recursive: true })

    const elapsed = ((Date.now() - startTime) / 60_000).toFixed(1)
    console.log(`\n━━━ Scenario ${si + 1}/${scenarios.length}: ${scenario.id} (${elapsed}min elapsed) ━━━`)
    console.log(`  Tags: ${scenario.tags.join(', ')}`)
    console.log(`  Notes: ${scenario.notes}`)

    // Agent signatures accumulate within this scenario
    const signatures: Record<string, string> = {}

    for (const agent of AGENTS) {
      console.log(`  ┌─ Agent: ${agent.name} (${agent.provider})`)
      const agentStart = Date.now()

      // Build the full prompt for this agent
      let prompt = `# Scenario Analysis Request\n\n`
      prompt += `## Scenario\n`
      prompt += `- **ID**: ${scenario.id}\n`
      prompt += `- **Tags**: ${scenario.tags.join(', ')}\n`
      prompt += `- **Notes**: ${scenario.notes}\n\n`

      // Add cross-scenario context (what we learned from previous scenarios)
      if (crossContext) {
        prompt += `## Context from Previous Scenarios\n`
        prompt += `The following patterns have been identified in earlier scenarios. Build on them where relevant, note differences where this scenario diverges.\n\n`
        prompt += crossContext + '\n\n'
      }

      // For synthesis agent, include all 4 prior signatures
      if (agent.name === 'synthesis') {
        prompt += `## Agent Signatures to Integrate\n\n`
        for (const prevAgent of AGENTS.filter(a => a.name !== 'synthesis')) {
          if (signatures[prevAgent.name]) {
            prompt += `### ${prevAgent.name.toUpperCase()} AGENT OUTPUT:\n\n`
            prompt += signatures[prevAgent.name] + '\n\n'
          }
        }
      }
      // For non-first agents (not physics), include signatures from previous agents
      else if (agent.name !== 'physics') {
        const prevAgentNames = AGENTS
          .filter(a => a.name !== 'synthesis' && a.name !== agent.name)
          .filter(a => signatures[a.name])
          .map(a => a.name)

        if (prevAgentNames.length > 0) {
          prompt += `## Signatures from Other Agents (for reference)\n\n`
          for (const name of prevAgentNames) {
            prompt += `### ${name.toUpperCase()} says:\n${signatures[name]}\n\n`
          }
        }
      }

      // Add the agent's own system prompt
      prompt += `## Your Instructions\n\n`
      prompt += agentPrompts[agent.name]

      // Save debug prompt
      writeFileSync(`debug/${scenario.id}-${agent.name}-prompt.txt`, prompt)

      // Call LLM
      try {
        const response = await callLLM(prompt, agent.provider)
        signatures[agent.name] = response

        // Save agent output
        writeFileSync(`${scenarioDir}/${agent.name}.md`, response)
        writeFileSync(`debug/${scenario.id}-${agent.name}-response.txt`, response)

        const agentTime = ((Date.now() - agentStart) / 1000).toFixed(0)
        const lines = response.split('\n').length
        console.log(`  └─ Done: ${lines} lines, ${agentTime}s`)

      } catch (e) {
        const msg = (e as Error).message.slice(0, 200)
        console.error(`  └─ FAILED: ${msg}`)
        signatures[agent.name] = `[AGENT FAILED: ${msg}]`
        writeFileSync(`${scenarioDir}/${agent.name}.md`, `# FAILED\n\n${msg}`)
        writeFileSync(`debug/${scenario.id}-${agent.name}-error.txt`, msg)
      }
    }

    // Save the complete blueprint (synthesis output is the blueprint)
    if (signatures.synthesis && !signatures.synthesis.startsWith('[AGENT FAILED')) {
      writeFileSync(`${scenarioDir}/BLUEPRINT.md`, signatures.synthesis)
    }

    // Extract a brief summary for cross-scenario feed-forward
    // Take the first 30 lines of the synthesis output as context
    const synthSummary = (signatures.synthesis || '')
      .split('\n').slice(0, 30).join('\n')
    scenarioSummaries.push(`### ${scenario.id} (${scenario.tags.join(', ')})\n${synthSummary}`)

    // Keep cross-context to last 3 scenarios to avoid prompt bloat
    crossContext = scenarioSummaries.slice(-3).join('\n\n---\n\n')

    // Save running progress
    writeFileSync('results/PROGRESS.jsonl',
      JSON.stringify({
        scenario: scenario.id,
        index: si + 1,
        total: scenarios.length,
        elapsed_min: parseFloat(((Date.now() - startTime) / 60_000).toFixed(1)),
        agents_completed: Object.keys(signatures).filter(k => !signatures[k].startsWith('[AGENT FAILED')).length,
        timestamp: new Date().toISOString(),
      }) + '\n',
      { flag: 'a' }
    )
  }

  // ── Final Compilation ──
  console.log(`\n━━━ Compiling Results ━━━`)

  // Compile all blueprints into one document
  let allBlueprints = `# TRIVIUM v0.2 Scenario Blueprints\n\n`
  allBlueprints += `Generated: ${new Date().toISOString()}\n`
  allBlueprints += `Scenarios: ${scenarios.length}\n`
  allBlueprints += `Agents: ${AGENTS.map(a => `${a.name}(${a.provider})`).join(', ')}\n\n`
  allBlueprints += `---\n\n`

  for (const scenario of scenarios) {
    const blueprintPath = `results/${scenario.id}/BLUEPRINT.md`
    if (existsSync(blueprintPath)) {
      const content = readFileSync(blueprintPath, 'utf-8')
      allBlueprints += content + '\n\n---\n\n'
    } else {
      allBlueprints += `# ${scenario.id}\n\n[NO BLUEPRINT GENERATED]\n\n---\n\n`
    }
  }

  writeFileSync('results/SCENARIO_BLUEPRINTS.md', allBlueprints)

  // Final report
  const totalElapsed = ((Date.now() - startTime) / 60_000).toFixed(1)
  console.log(`\n━━━ FINAL REPORT ━━━`)
  console.log(`Scenarios processed: ${scenarios.length}`)
  console.log(`Total elapsed: ${totalElapsed} minutes`)
  console.log(`Results in: results/`)
  console.log(`  - Per-scenario: results/{scenario_id}/`)
  console.log(`  - Combined: results/SCENARIO_BLUEPRINTS.md`)
  console.log(`  - Progress: results/PROGRESS.jsonl`)
  console.log(`  - Debug: debug/`)
  console.log(`━━━━━━━━━━━━━━━━━━━━\n`)
}

main().catch(e => {
  console.error('Loop crashed:', e)
  process.exit(1)
})
