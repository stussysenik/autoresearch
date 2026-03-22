/**
 * 5-Minute Autoresearch Loop: Produce the Universal Playbook
 *
 * 4 iterations using claude -p:
 *   1. Draft playbook from all context
 *   2. Self-identify gaps ("what's missing?")
 *   3. Refine with gaps addressed
 *   4. Final polish for copy-paste readiness
 *
 * Each iteration saved to data/playbook/. Final output → AUTORESEARCH_PLAYBOOK.md
 */

import fs from 'fs/promises'
import path from 'path'
import { research } from './src/llm.js'

const PLAYBOOK_DIR = path.join(import.meta.dir, 'data', 'playbook')
const OUTPUT_PATH = path.join(import.meta.dir, 'AUTORESEARCH_PLAYBOOK.md')
const RESULTS_DIR = path.join(import.meta.dir, 'data', 'results')

function timestamp(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

async function gatherContext(): Promise<string> {
  // Read a few key research artifacts for grounding
  const files = [
    'phase-0-seed-questions.md',
    'phase-1-cv-pipeline-architecture.md',
    'phase-3-music-analysis-keyframe-sync.md',
    'phase-5-integration-architecture.md',
  ]

  const summaries: string[] = []
  for (const file of files) {
    try {
      const content = await fs.readFile(path.join(RESULTS_DIR, file), 'utf-8')
      // Take first 2000 chars of each as summary
      summaries.push(`--- ${file} (excerpt) ---\n${content.slice(0, 2000)}\n`)
    } catch { /* skip missing files */ }
  }

  return summaries.join('\n')
}

async function main() {
  console.log('\n══════════════════════════════════════════════════')
  console.log('  Autoresearch Playbook Loop (4 iterations)')
  console.log('══════════════════════════════════════════════════\n')

  await fs.mkdir(PLAYBOOK_DIR, { recursive: true })
  const loopStart = Date.now()

  // Gather experiment context
  const experimentContext = await gatherContext()

  // ─── ITERATION 1: Draft ─────────────────────────────────────────
  console.log(`[${timestamp()}] Iteration 1/4: Drafting playbook...`)

  const draftPrompt = `You are writing a universal autoresearch playbook — a document someone can copy-paste into ANY LLM (Claude, ChatGPT, Gemini, Codex CLI) to set up a self-optimizing autonomous coding loop on any project.

## What you know from real experiments:

### Experiment 1: Breakdancing Battle Analysis (overnight research)
- Used claude -p headless with 6 research phases chained via Bun/TypeScript
- 5-minute timeout was TOO SHORT — calls died at exactly 5 min (exit code 143/SIGTERM)
- Context accumulation: 500KB+ across phases caused timeouts. 80KB truncation helped.
- Self-identification loop worked brilliantly: Phase 3 found 3 gaps it didn't know about
- Checkpoint/resume with JSON files saved the run from total failure
- Output: 578KB of research across 16 .md files, compiled into 54KB ANALYSIS.md
- Fix needed: 10-15 min timeout, summarize context instead of concatenating

### Experiment 2: Design Constraint Engine (ablation study)
- 9 ablation variants testing which CSS dimensions matter for UI fidelity
- Used claude -p with 300s timeout — worked because prompts were focused/small
- Provider pattern: BUILDER_PROVIDER=claude|codex|openai — swappable without code changes
- Key flags: claude -p --output-format text --tools "" --model sonnet

### Experiment 3: Tag Optimization (+29% improvement)
- 4 prompt variants tested on 23 items from production database
- Winner: Platform-Aware prompting (context > structure > abstract reasoning)
- 4 hours total → permanent production improvement
- Small datasets (23 items!) are enough to validate a winner

### From the broader community:
- Karpathy's autoresearch: 3 files (program.md, prepare.py, train.py). ~12 experiments/hour. 100+ overnight. Shopify got 53% faster rendering from 93 automated commits.
- pi-autoresearch: Adds persistent sessions, live dashboard, confidence scoring (Median Absolute Deviation after 3+ runs), backpressure checks (tests/types/lint must pass)
- ARIS: Chains idea discovery → experiments → paper writing overnight. Cross-model adversarial review (Claude writes, GPT critiques). Papers scored 7-8/10 at AAAI.
- GOAL.md: Generalizes to features via composite 0-100 scores from weighted checks (tests 40%, typecheck 20%, lighthouse 20%, etc.)
- TDD as evaluation: Write failing tests → agent implements → 94.3% success rate with human-written tests
- Ralph: Circuit breakers (3 no-progress loops = stop), dual-condition exit detection
- LLM-as-visual-judge: Screenshot → Claude vision → 0-10 rubric scores. 80-90% agreement with human evaluators. ~$0.15/eval.
- UI/UX testing: axe-core for a11y, Playwright CSS assertions for design tokens, animation timing checks (200-350ms, transform+opacity only), gremlins.js chaos testing
- Key rule: Agent CANNOT edit tests or evaluation. Lock the eval, free the implementation.

### Timeout lessons:
- 5 min: OK for focused code gen with <50KB context
- 10 min: Research prompts with moderate context
- 15 min: Heavy context (>100KB) or synthesis tasks
- 20 min: Compilation of multiple large documents

### Context management lessons:
- <50KB: Feed directly
- 50-100KB: Works but expect slower responses
- 100-200KB: MUST summarize, don't concatenate raw docs
- >200KB: Split into sections, process separately, then merge

## Your task:

Write a COMPLETE, SELF-CONTAINED playbook in markdown that covers:

1. **Mode A: Metric Optimization** (Karpathy loop) — with exact file templates, launch commands
2. **Mode B: Feature Development** (TDD loop) — tests as fitness function, GOAL.md scoring
3. **Mode C: Pure Research** (overnight synthesis) — phased research with self-identification
4. **UI/UX Visual Quality Scoring** — Playwright tests + LLM visual judge as eval layers
5. **Configuration cheat sheet** — timeouts, context limits, circuit breakers
6. **Common mistakes** — the 10 things that break overnight runs
7. **Quick reference table** — what pattern for what task

The playbook must be COPY-PASTEABLE into any LLM. It should give the LLM everything it needs to set up and run the loop. Include exact shell commands, file templates, and scoring scripts.

Be practical and concrete. No theory — just patterns that work.`

  const draft = await research(draftPrompt, 600_000)
  await fs.writeFile(path.join(PLAYBOOK_DIR, '01-draft.md'), draft)
  console.log(`[${timestamp()}] Draft complete (${(draft.length / 1024).toFixed(1)} KB)`)

  // ─── ITERATION 2: Gap Analysis ──────────────────────────────────
  console.log(`[${timestamp()}] Iteration 2/4: Finding gaps...`)

  const gapPrompt = `You are reviewing a draft autoresearch playbook. Your job is to find everything that's MISSING, WRONG, or CONFUSING.

## The Draft:

${draft.slice(0, 80_000)}

## Find gaps in these categories:

1. **Missing patterns**: Are there use cases the playbook doesn't cover? (e.g., mobile dev, API optimization, database tuning, CI/CD pipelines, design systems)
2. **Missing practical details**: Can someone ACTUALLY run these commands? Are there missing prerequisites, missing file paths, missing environment setup?
3. **Confusing sections**: What would trip up someone copy-pasting this cold into ChatGPT or Claude?
4. **Wrong advice**: Any recommendations that contradict the real experiment data? (e.g., timeout values, context limits)
5. **Missing the "why"**: Does the playbook explain WHY each pattern works, or just WHAT to do?
6. **Copy-paste readiness**: Would an LLM receiving this actually know how to proceed? Or would it need to ask clarifying questions?
7. **Missing examples**: Are the code templates complete enough to actually run?
8. **Platform coverage**: Does it work for Python, TypeScript/Bun, shell, and other stacks?

For each gap, explain:
- What's missing
- Why it matters
- What should be added

Be harsh. This needs to be production-grade.`

  const gaps = await research(gapPrompt, 300_000)
  await fs.writeFile(path.join(PLAYBOOK_DIR, '02-gaps.md'), gaps)
  console.log(`[${timestamp()}] Gap analysis complete (${(gaps.length / 1024).toFixed(1)} KB)`)

  // ─── ITERATION 3: Refined Version ───────────────────────────────
  console.log(`[${timestamp()}] Iteration 3/4: Refining with gaps addressed...`)

  const refinePrompt = `You previously wrote a draft autoresearch playbook, then identified gaps. Now produce the REFINED version that addresses every gap.

## Original Draft (key sections):

${draft.slice(0, 60_000)}

## Gaps Found:

${gaps.slice(0, 30_000)}

## Task:

Rewrite the playbook from scratch, incorporating all the gap fixes. The refined version must:

1. Be SELF-CONTAINED — no references to "the draft" or "the gaps"
2. Start with a one-paragraph summary of what autoresearch is and why it works
3. Cover all three modes (A: metric optimization, B: feature/TDD, C: research)
4. Include COMPLETE, RUNNABLE code templates (not snippets)
5. Include the UI/UX visual scoring system
6. Include the configuration cheat sheet with correct timeout values
7. Include circuit breakers and git-as-memory patterns
8. End with common mistakes and a quick reference table
9. Be formatted so someone can COPY-PASTE the entire thing into any LLM and it works

Write the complete refined playbook now.`

  const refined = await research(refinePrompt, 600_000)
  await fs.writeFile(path.join(PLAYBOOK_DIR, '03-refined.md'), refined)
  console.log(`[${timestamp()}] Refined version complete (${(refined.length / 1024).toFixed(1)} KB)`)

  // ─── ITERATION 4: Final Polish ──────────────────────────────────
  console.log(`[${timestamp()}] Iteration 4/4: Final polish...`)

  const polishPrompt = `You have a near-final autoresearch playbook. Do a final polish pass.

## Current Version:

${refined.slice(0, 80_000)}

## Polish Checklist:

1. Remove any meta-commentary ("this section covers...", "as mentioned above...")
2. Ensure every code block has a language tag and is copy-pasteable
3. Verify all shell commands are complete (no "..." or "[fill in]")
4. Add a HEADER that explains what this document is in 2 sentences
5. Ensure the document starts with "# Autoresearch Playbook"
6. Make sure the "Common Mistakes" section has exactly 10 items
7. Verify the quick reference table covers at least 8 task types
8. Remove duplicate content between sections
9. Ensure consistent formatting (headers, code blocks, tables)
10. End with the one-liner: "You stop writing code and start writing specifications."

Output the FINAL playbook. This is what gets saved and distributed. Make it perfect.`

  const final = await research(polishPrompt, 600_000)
  await fs.writeFile(path.join(PLAYBOOK_DIR, '04-final.md'), final)
  console.log(`[${timestamp()}] Final version complete (${(final.length / 1024).toFixed(1)} KB)`)

  // ─── Save Output ────────────────────────────────────────────────
  const header = `<!-- Generated by autoresearch loop: ${new Date().toISOString()} | 4 iterations | ${((Date.now() - loopStart) / 1000).toFixed(0)}s total -->\n\n`
  await fs.writeFile(OUTPUT_PATH, header + final)

  const totalTime = ((Date.now() - loopStart) / 1000).toFixed(1)
  console.log(`\n══════════════════════════════════════════════════`)
  console.log(`  LOOP COMPLETE`)
  console.log(`══════════════════════════════════════════════════`)
  console.log(`  Iterations: 4`)
  console.log(`  Total time: ${totalTime}s`)
  console.log(`  Draft: ${(draft.length / 1024).toFixed(1)} KB`)
  console.log(`  Gaps found: ${(gaps.length / 1024).toFixed(1)} KB`)
  console.log(`  Refined: ${(refined.length / 1024).toFixed(1)} KB`)
  console.log(`  Final: ${(final.length / 1024).toFixed(1)} KB`)
  console.log(`  Output: AUTORESEARCH_PLAYBOOK.md`)
  console.log(`══════════════════════════════════════════════════\n`)
}

main().catch(err => {
  console.error('Loop failed:', err.message)
  process.exit(1)
})
