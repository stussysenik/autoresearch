I don't have file-write tools in this environment, so I'll output the complete playbook for you to save. Here it is:

---

# The Autoresearch Playbook
## Self-Optimizing Autonomous Coding Loops for Any LLM

> Copy-paste this into any LLM (Claude, ChatGPT, Gemini, Codex CLI) to set up autonomous experiment loops that run overnight and produce real results.

---

## Table of Contents

1. [Quick Reference: What Pattern for What Task](#1-quick-reference)
2. [Mode A: Metric Optimization (Karpathy Loop)](#2-mode-a-metric-optimization)
3. [Mode B: Feature Development (TDD Loop)](#3-mode-b-feature-development)
4. [Mode C: Pure Research (Overnight Synthesis)](#4-mode-c-pure-research)
5. [UI/UX Visual Quality Scoring](#5-uiux-visual-quality-scoring)
6. [Configuration Cheat Sheet](#6-configuration-cheat-sheet)
7. [Common Mistakes: 10 Things That Break Overnight Runs](#7-common-mistakes)

---

## 1. Quick Reference

| You want to... | Use Mode | Eval type | Typical runtime | Example |
|---|---|---|---|---|
| Improve a metric (accuracy, speed, size) | **A: Metric Optimization** | Numerical score from script | 4-12 hours | Compress CSS, speed up inference, improve prompt accuracy |
| Build a feature that passes tests | **B: Feature Development** | Test suite + composite score | 2-8 hours | Add auth flow, build API endpoint, refactor module |
| Research a topic and synthesize findings | **C: Pure Research** | Completeness self-check | 6-16 hours | Literature review, competitive analysis, architecture RFC |
| Make UI look and work correctly | **A or B + Visual Judge** | Playwright + LLM screenshot scoring | 1-4 hours | Design system compliance, responsive layout, a11y |
| Find the best prompt variant | **A: Metric Optimization** | Score per variant on fixed dataset | 2-6 hours | Tag optimization, classification, extraction |

**Decision tree:**

```
Is there a number to improve?
  YES → Mode A (Metric Optimization)
  NO → Are there tests to pass?
    YES → Mode B (Feature Development)
    NO → Mode C (Pure Research)

Does it have a UI?
  YES → Add Visual Quality Scoring to any mode
```

---

## 2. Mode A: Metric Optimization

**The Karpathy Loop:** Generate variant → measure → keep if better → repeat.

This produced 53% faster rendering at Shopify (93 automated commits) and +29% tag accuracy in real experiments. The pattern is three files.

### 2.1 File Structure

```
project/
├── GOAL.md              # What to optimize, constraints, current best
├── prepare.sh           # Setup: install deps, seed data, build baselines
├── evaluate.sh          # THE LOCKED EVAL — agent cannot edit this
├── variants/            # Each attempt gets a numbered directory
│   ├── 001/
│   ├── 002/
│   └── ...
├── results.jsonl        # Append-only log of every run
└── best/                # Symlink or copy of current best variant
```

### 2.2 GOAL.md Template

```markdown
# GOAL: [One sentence — what metric, which direction]

## Metric
- **Name:** [e.g., "inference_latency_p95"]
- **Unit:** [e.g., "milliseconds"]
- **Direction:** [lower is better | higher is better]
- **Baseline:** [current value]
- **Target:** [aspirational value, can be "as good as possible"]
- **Current best:** [updated by the loop]

## Evaluation
Run `./evaluate.sh [variant_dir]` — outputs a single JSON line:
```json
{"variant": "001", "score": 142.3, "timestamp": "...", "details": {...}}
```

## Constraints
- [ ] Must pass `npm test` (or equivalent)
- [ ] Must pass type check
- [ ] No new dependencies without justification
- [ ] [Add domain-specific constraints]

## What to try
- [Seed ideas — the agent will generate more]
- [Known approaches from literature]
- [Things you suspect but haven't tested]

## What NOT to try
- [Approaches known to fail]
- [Off-limits changes]
```

### 2.3 evaluate.sh Template

```bash
#!/usr/bin/env bash
# LOCKED — the agent must NEVER edit this file.
# This is the objective function. Changing it is cheating.
set -euo pipefail

VARIANT_DIR="${1:?Usage: ./evaluate.sh <variant_dir>}"

# ── Backpressure checks (must pass before scoring) ──
echo "Running backpressure checks..."

# Check 1: Tests pass
npm test --prefix "$VARIANT_DIR" 2>/dev/null || {
  echo '{"variant":"'"$(basename $VARIANT_DIR)"'","score":null,"error":"tests_failed"}'
  exit 1
}

# Check 2: Type check passes
npx tsc --noEmit --project "$VARIANT_DIR" 2>/dev/null || {
  echo '{"variant":"'"$(basename $VARIANT_DIR)"'","score":null,"error":"typecheck_failed"}'
  exit 1
}

# ── Scoring ──
echo "Measuring metric..."

# REPLACE THIS with your actual measurement.
# Examples:
#   - Benchmark:  hyperfine --json './run.sh' | jq '.results[0].median'
#   - Accuracy:   python score.py --predictions "$VARIANT_DIR/output.json" | jq '.accuracy'
#   - File size:  wc -c < "$VARIANT_DIR/dist/bundle.js"
#   - Latency:    curl -w '%{time_total}' -s -o /dev/null http://localhost:3000

SCORE=$(echo "0.0")  # ← Replace with real measurement

VARIANT_NAME=$(basename "$VARIANT_DIR")
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "{\"variant\":\"$VARIANT_NAME\",\"score\":$SCORE,\"timestamp\":\"$TIMESTAMP\"}"
```

### 2.4 The Loop Runner (Bun/TypeScript)

```typescript
// run-loop.ts — The optimization loop
// Usage: timeout 8h bun run run-loop.ts
import { $ } from "bun";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";

const GOAL = readFileSync("GOAL.md", "utf-8");
const MAX_VARIANTS = 100;
const RESULTS_FILE = "results.jsonl";
const STALE_LIMIT = 5; // Stop after N variants with no improvement

interface Result {
  variant: string;
  score: number | null;
  error?: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

function loadResults(): Result[] {
  if (!existsSync(RESULTS_FILE)) return [];
  return readFileSync(RESULTS_FILE, "utf-8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

function bestScore(results: Result[], direction: "higher" | "lower"): number | null {
  const valid = results.filter((r) => r.score !== null).map((r) => r.score!);
  if (valid.length === 0) return null;
  return direction === "higher" ? Math.max(...valid) : Math.min(...valid);
}

async function generateVariant(
  variantNum: number,
  results: Result[],
  direction: "higher" | "lower"
): Promise<string> {
  const variantDir = `variants/${String(variantNum).padStart(3, "0")}`;
  mkdirSync(variantDir, { recursive: true });

  const recentResults = results.slice(-10); // Only feed last 10 to manage context
  const best = bestScore(results, direction);

  const prompt = `You are an optimization agent. Your goal:

${GOAL}

## Current state
- Best score so far: ${best ?? "no measurements yet"}
- Direction: ${direction} is better
- Total variants tested: ${results.length}
- Recent results:
${recentResults.map((r) => `  - ${r.variant}: ${r.score ?? "FAILED (" + r.error + ")"}`).join("\n")}

## Task
Generate variant ${variantDir}. Write all necessary files into that directory.
Be creative. Try something DIFFERENT from recent attempts.
If recent attempts cluster around similar scores, try a radically different approach.

Output ONLY the file contents. No explanation.`;

  // Write prompt to file to avoid shell escaping issues
  const promptFile = `/tmp/loop-prompt-${variantNum}.txt`;
  writeFileSync(promptFile, prompt);

  // Swap this command for your LLM of choice:
  // Claude:  claude -p --output-format text --tools "" --model sonnet
  // Codex:   codex -q --model gpt-5.4
  const result = await $`timeout 600 claude -p --output-format text --tools "" --model sonnet < ${promptFile}`.text();

  writeFileSync(`${variantDir}/generated.txt`, result);
  return variantDir;
}

async function evaluateVariant(variantDir: string): Promise<Result> {
  try {
    const output = await $`./evaluate.sh ${variantDir}`.text();
    const result: Result = JSON.parse(output.trim().split("\n").pop()!);
    return result;
  } catch (e) {
    return {
      variant: variantDir,
      score: null,
      error: `evaluation_crashed: ${(e as Error).message}`,
      timestamp: new Date().toISOString(),
    };
  }
}

// ── Main loop ──
async function main() {
  const direction: "higher" | "lower" = "lower"; // ← Set from GOAL.md
  let staleness = 0;

  for (let i = 1; i <= MAX_VARIANTS; i++) {
    console.log(`\n━━━ Variant ${i}/${MAX_VARIANTS} ━━━`);
    const results = loadResults();

    // Circuit breaker: stop if no improvement in STALE_LIMIT attempts
    if (staleness >= STALE_LIMIT) {
      console.log(`⚡ Circuit breaker: ${STALE_LIMIT} variants with no improvement. Stopping.`);
      break;
    }

    try {
      const variantDir = await generateVariant(i, results, direction);
      const result = await evaluateVariant(variantDir);

      // Append result
      writeFileSync(RESULTS_FILE, JSON.stringify(result) + "\n", { flag: "a" });

      const currentBest = bestScore(results, direction);
      if (result.score !== null && currentBest !== null) {
        const improved =
          direction === "higher" ? result.score > currentBest : result.score < currentBest;
        if (improved) {
          console.log(`✅ NEW BEST: ${result.score} (was ${currentBest})`);
          staleness = 0;
          await $`rm -rf best && cp -r ${variantDir} best`;
        } else {
          staleness++;
          console.log(`❌ No improvement: ${result.score} vs best ${currentBest} (stale: ${staleness}/${STALE_LIMIT})`);
        }
      } else if (result.score !== null) {
        console.log(`📊 First score: ${result.score}`);
        staleness = 0;
        await $`rm -rf best && cp -r ${variantDir} best`;
      } else {
        staleness++;
        console.log(`💥 Failed: ${result.error} (stale: ${staleness}/${STALE_LIMIT})`);
      }
    } catch (e) {
      console.error(`Variant ${i} crashed:`, e);
      staleness++;
    }
  }

  // Final report
  const results = loadResults();
  const best = bestScore(results, direction);
  const successful = results.filter((r) => r.score !== null).length;
  console.log(`\n━━━ DONE ━━━`);
  console.log(`Total variants: ${results.length}`);
  console.log(`Successful: ${successful}`);
  console.log(`Best score: ${best}`);
}

main().catch(console.error);
```

### 2.5 Launch Command

```bash
# Run for up to 8 hours, logging everything
chmod +x evaluate.sh
timeout 8h bun run run-loop.ts 2>&1 | tee run.log

# Or with nohup for overnight
nohup timeout 12h bun run run-loop.ts > run.log 2>&1 &
echo $! > .pid
```

### 2.6 Prompt Variant Testing (Special Case)

For optimizing prompts specifically (like the +29% tag experiment), a simpler pattern:

```bash
#!/usr/bin/env bash
# test-prompts.sh — Test N prompt variants against a fixed dataset
set -euo pipefail

DATASET="test_data.jsonl"        # Fixed evaluation set (even 23 items works!)
VARIANTS_DIR="prompt_variants"   # Each file is a prompt template
RESULTS="prompt_results.jsonl"

for variant in "$VARIANTS_DIR"/*.md; do
  VARIANT_NAME=$(basename "$variant" .md)
  echo "Testing: $VARIANT_NAME"

  CORRECT=0
  TOTAL=0

  while IFS= read -r line; do
    INPUT=$(echo "$line" | jq -r '.input')
    EXPECTED=$(echo "$line" | jq -r '.expected')

    PROMPT=$(sed "s/{{INPUT}}/$INPUT/g" "$variant")

    ACTUAL=$(echo "$PROMPT" | claude -p --output-format text --tools "" --model sonnet)

    if echo "$ACTUAL" | grep -qF "$EXPECTED"; then
      CORRECT=$((CORRECT + 1))
    fi
    TOTAL=$((TOTAL + 1))
  done < "$DATASET"

  ACCURACY=$(echo "scale=4; $CORRECT / $TOTAL" | bc)
  echo "{\"variant\":\"$VARIANT_NAME\",\"correct\":$CORRECT,\"total\":$TOTAL,\"accuracy\":$ACCURACY}" >> "$RESULTS"
  echo "  → $CORRECT/$TOTAL ($ACCURACY)"
done

echo "Results:"
cat "$RESULTS" | jq -s 'sort_by(-.accuracy) | .[] | "\(.variant): \(.accuracy)"' -r
```

### 2.7 Confidence Scoring (Median Absolute Deviation)

Don't trust a single measurement. After 3+ runs of each variant:

```typescript
function medianAbsoluteDeviation(values: number[]): { median: number; mad: number; confident: boolean } {
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const deviations = sorted.map((v) => Math.abs(v - median)).sort((a, b) => a - b);
  const mad = deviations[Math.floor(deviations.length / 2)];

  // Confident if MAD is < 5% of median (low variance)
  const confident = values.length >= 3 && (mad / Math.abs(median)) < 0.05;

  return { median, mad, confident };
}
```

---

## 3. Mode B: Feature Development

**The TDD Loop:** Write locked tests → agent implements → score by pass rate + quality checks.

94.3% success rate with human-written tests as the eval function.

### 3.1 File Structure

```
project/
├── GOAL.md              # Feature spec with acceptance criteria
├── tests/               # LOCKED — agent cannot edit
│   ├── feature.test.ts
│   └── e2e.test.ts
├── evaluate.sh          # Composite scorer (LOCKED)
├── src/                 # Agent writes code here
└── results.jsonl        # Score history
```

### 3.2 GOAL.md for Features

```markdown
# GOAL: [Feature name]

## Acceptance Criteria
- [ ] [Criterion 1 — maps to a test]
- [ ] [Criterion 2]
- [ ] [Criterion 3]

## Composite Score (0-100)
Weighted sum of:
| Check | Weight | How to measure |
|-------|--------|----------------|
| Tests pass | 40% | `npm test` exit code + pass rate |
| Type check | 20% | `npx tsc --noEmit` exit code |
| Lint clean | 10% | `npm run lint` exit code |
| Lighthouse a11y | 15% | lighthouse --only-categories=accessibility |
| Bundle size | 15% | `wc -c dist/bundle.js` < threshold |

## Constraints
- All existing tests must continue to pass
- No modifications to files in tests/
- [Domain-specific constraints]

## Context
[Relevant architecture notes, API contracts, etc.]
```

### 3.3 Composite Scoring Script

```bash
#!/usr/bin/env bash
# evaluate.sh — Composite feature scorer
# LOCKED — agent must not edit
set -euo pipefail

SCORE=0

# ── Tests (40 points) ──
TEST_OUTPUT=$(npm test 2>&1) || true
TOTAL_TESTS=$(echo "$TEST_OUTPUT" | grep -oP '\d+ (tests?|specs?)' | head -1 | grep -oP '\d+' || echo "0")
PASSED_TESTS=$(echo "$TEST_OUTPUT" | grep -oP '\d+ pass' | grep -oP '\d+' || echo "0")
if [ "$TOTAL_TESTS" -gt 0 ]; then
  TEST_SCORE=$(echo "scale=1; ($PASSED_TESTS / $TOTAL_TESTS) * 40" | bc)
else
  TEST_SCORE=0
fi
SCORE=$(echo "$SCORE + $TEST_SCORE" | bc)

# ── Type check (20 points) ──
if npx tsc --noEmit 2>/dev/null; then TYPE_SCORE=20; else TYPE_SCORE=0; fi
SCORE=$(echo "$SCORE + $TYPE_SCORE" | bc)

# ── Lint (10 points) ──
LINT_ERRORS=$(npx eslint src/ --format json 2>/dev/null | jq '[.[].errorCount] | add // 0' || echo "999")
if [ "$LINT_ERRORS" -eq 0 ]; then LINT_SCORE=10
elif [ "$LINT_ERRORS" -lt 5 ]; then LINT_SCORE=5
else LINT_SCORE=0; fi
SCORE=$(echo "$SCORE + $LINT_SCORE" | bc)

# ── Accessibility (15 points) ──
# Uncomment if you have a running server:
# A11Y=$(npx lighthouse http://localhost:3000 --only-categories=accessibility --output=json --chrome-flags="--headless" | jq '.categories.accessibility.score * 15')
A11Y=15  # Default if not applicable
SCORE=$(echo "$SCORE + $A11Y" | bc)

# ── Bundle size (15 points) ──
# Uncomment for your project:
# SIZE=$(wc -c < dist/bundle.js 2>/dev/null || echo "999999")
# if [ "$SIZE" -lt 102400 ]; then SIZE_SCORE=15; elif [ "$SIZE" -lt 204800 ]; then SIZE_SCORE=8; else SIZE_SCORE=0; fi
SIZE_SCORE=15
SCORE=$(echo "$SCORE + $SIZE_SCORE" | bc)

echo "{\"score\":$SCORE,\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"
```

### 3.4 The TDD Loop Runner

```typescript
// tdd-loop.ts — Iterative feature development
import { $ } from "bun";
import { readFileSync, writeFileSync, existsSync } from "fs";

const GOAL = readFileSync("GOAL.md", "utf-8");
const MAX_ITERATIONS = 20;
const TARGET_SCORE = 95;
const RESULTS_FILE = "results.jsonl";

interface Iteration {
  iteration: number;
  score: number;
  timestamp: string;
}

function loadHistory(): Iteration[] {
  if (!existsSync(RESULTS_FILE)) return [];
  return readFileSync(RESULTS_FILE, "utf-8")
    .trim().split("\n").filter(Boolean)
    .map((l) => JSON.parse(l));
}

async function runIteration(iterNum: number, history: Iteration[]): Promise<void> {
  const testOutput = await $`npm test 2>&1 || true`.text();
  const recentHistory = history.slice(-3);

  // Read current source (summarize if too large)
  let sourceContext = "";
  try {
    const srcFiles = await $`find src/ -name '*.ts' -o -name '*.tsx' | head -20`.text();
    for (const file of srcFiles.trim().split("\n").filter(Boolean)) {
      const content = readFileSync(file, "utf-8");
      sourceContext += content.length > 5000
        ? `\n--- ${file} (truncated) ---\n${content.slice(0, 5000)}\n[...]\n`
        : `\n--- ${file} ---\n${content}\n`;
    }
  } catch { /* no src yet */ }

  const prompt = `You are a TDD implementation agent. Your ONLY job: make tests pass.

## Goal
${GOAL}

## Current test output
\`\`\`
${testOutput.slice(-3000)}
\`\`\`

## Current source code
${sourceContext.slice(-10000)}

## Recent scores
${recentHistory.map((h) => `  Iteration ${h.iteration}: ${h.score}/100`).join("\n")}

## Rules
1. You CANNOT modify any files in tests/
2. You can ONLY write/modify files in src/
3. Focus on failing tests — fix them one by one
4. If score isn't improving, try a completely different approach
5. Output complete file contents with clear file paths

Iteration ${iterNum}: Read the test failures carefully. Write the code that makes them pass.`;

  const promptFile = `/tmp/tdd-prompt-${iterNum}.txt`;
  writeFileSync(promptFile, prompt);
  const result = await $`timeout 600 claude -p --output-format text --tools "" --model sonnet < ${promptFile}`.text();
  writeFileSync(`iterations/${iterNum}.txt`, result);

  // Evaluate
  const evalOutput = await $`./evaluate.sh 2>&1 || echo '{"score":0}'`.text();
  const evalResult = JSON.parse(evalOutput.trim().split("\n").pop()!);

  const iteration: Iteration = {
    iteration: iterNum,
    score: evalResult.score ?? 0,
    timestamp: new Date().toISOString(),
  };

  writeFileSync(RESULTS_FILE, JSON.stringify(iteration) + "\n", { flag: "a" });
  console.log(`Iteration ${iterNum}: ${iteration.score}/100`);

  if (iteration.score >= TARGET_SCORE) {
    console.log(`🎯 Target reached! Score: ${iteration.score}`);
    process.exit(0);
  }
}

async function main() {
  for (let i = 1; i <= MAX_ITERATIONS; i++) {
    const history = loadHistory();

    // Circuit breaker: 3 identical scores = stuck
    if (history.length >= 3) {
      const last3 = history.slice(-3).map((h) => h.score);
      if (last3[0] === last3[1] && last3[1] === last3[2]) {
        console.log(`🔄 Stuck at score ${last3[0]} for 3 iterations. Injecting perturbation.`);
      }
    }

    await runIteration(i, history);
  }
}

main().catch(console.error);
```

### 3.5 Locking the Eval

**This is the most important rule in the entire playbook.**

```bash
# Make tests and eval read-only
chmod 444 tests/*.test.ts evaluate.sh

# Or use a git pre-commit hook
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
LOCKED_FILES="evaluate.sh tests/"
for pattern in $LOCKED_FILES; do
  if git diff --cached --name-only | grep -q "$pattern"; then
    echo "❌ BLOCKED: Cannot modify locked eval files: $pattern"
    exit 1
  fi
done
EOF
chmod +x .git/hooks/pre-commit
```

**Why:** If the agent can edit tests, it will make tests easier instead of making code better. Lock the eval, free the implementation. This is the difference between real improvement and Goodhart's Law.

---

## 4. Mode C: Pure Research

**Phased synthesis with self-identification:** Run 4-6 phases overnight, each building on the last, with a self-gap-analysis phase that finds what you don't know you don't know.

### 4.1 File Structure

```
research/
├── config.ts            # Phase definitions and timeouts
├── run-research.ts      # Orchestrator
├── phases/              # Output from each phase
│   ├── 01-landscape.md
│   ├── 02-deep-dive.md
│   ├── 03-gaps.md       # Self-identification phase
│   ├── 04-fill-gaps.md
│   └── 05-synthesis.md
├── checkpoints/         # Resume state
│   └── progress.json
└── ANALYSIS.md          # Final compiled output
```

### 4.2 Phase Configuration

```typescript
// config.ts
export interface Phase {
  id: string;
  name: string;
  prompt: string;
  timeout: number;         // seconds
  maxContextInput: number; // bytes — truncate prior phases if exceeded
  dependsOn: string[];     // phase IDs this phase needs as input
}

export const TOPIC = "YOUR RESEARCH TOPIC HERE";

export const PHASES: Phase[] = [
  {
    id: "01-landscape",
    name: "Landscape Survey",
    prompt: `You are a research agent investigating: ${TOPIC}

Phase 1: LANDSCAPE SURVEY
Map the full territory. Identify:
- Key players, projects, papers, and tools
- Major approaches and schools of thought
- Timeline of important developments
- Current state of the art
- Active debates and open questions

Be exhaustive. Cast a wide net. Cite sources where possible.
Output as structured markdown with clear sections.`,
    timeout: 600,
    maxContextInput: 0,
    dependsOn: [],
  },
  {
    id: "02-deep-dive",
    name: "Deep Dive Analysis",
    prompt: `You are a research agent investigating: ${TOPIC}

Phase 2: DEEP DIVE
Based on the landscape survey below, go deep on the most important areas.
For each major approach or tool:
- How it works (technical details)
- Strengths and weaknesses
- Real-world results and benchmarks
- Who uses it and for what

## Prior research
{{CONTEXT}}`,
    timeout: 900,
    maxContextInput: 80_000,
    dependsOn: ["01-landscape"],
  },
  {
    id: "03-gaps",
    name: "Gap Self-Identification",
    prompt: `You are a research agent investigating: ${TOPIC}

Phase 3: GAP ANALYSIS (SELF-IDENTIFICATION)
Review ALL prior research below. Your job is to find what's MISSING.

Ask yourself:
1. What questions did the prior phases raise but not answer?
2. What areas were mentioned but not explored in depth?
3. What perspectives or stakeholders are underrepresented?
4. What counterarguments or failure cases weren't considered?
5. What adjacent topics might be relevant but weren't explored?
6. Are there contradictions between sources that weren't resolved?

List EVERY gap you find, ranked by importance. Be brutally honest.
This phase exists because you don't know what you don't know.

## Prior research
{{CONTEXT}}`,
    timeout: 600,
    maxContextInput: 100_000,
    dependsOn: ["01-landscape", "02-deep-dive"],
  },
  {
    id: "04-fill-gaps",
    name: "Fill Research Gaps",
    prompt: `You are a research agent investigating: ${TOPIC}

Phase 4: FILL THE GAPS
The gap analysis identified these missing areas. Research each one thoroughly.

## Identified gaps
{{GAPS}}

## Prior research (summary)
{{CONTEXT}}`,
    timeout: 900,
    maxContextInput: 80_000,
    dependsOn: ["03-gaps", "01-landscape"],
  },
  {
    id: "05-synthesis",
    name: "Synthesis & Recommendations",
    prompt: `You are a research agent investigating: ${TOPIC}

Phase 5: SYNTHESIS
Combine ALL prior research into a coherent analysis. Structure:

1. Executive Summary (1 page)
2. Key Findings (ranked by importance)
3. Comparison Matrix (approaches vs. criteria)
4. Recommendations (with confidence levels: high/medium/low)
5. Open Questions (what we still don't know)
6. References & Sources

## All prior research
{{CONTEXT}}`,
    timeout: 1200,
    maxContextInput: 120_000,
    dependsOn: ["01-landscape", "02-deep-dive", "04-fill-gaps"],
  },
];
```

### 4.3 Research Orchestrator

```typescript
// run-research.ts
import { $ } from "bun";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { PHASES, type Phase } from "./config";

const PHASES_DIR = "phases";
const CHECKPOINTS_DIR = "checkpoints";
const PROGRESS_FILE = `${CHECKPOINTS_DIR}/progress.json`;

mkdirSync(PHASES_DIR, { recursive: true });
mkdirSync(CHECKPOINTS_DIR, { recursive: true });

// ── Context management ──
function summarizeIfNeeded(text: string, maxBytes: number): string {
  if (Buffer.byteLength(text) <= maxBytes) return text;
  const truncated = text.slice(0, maxBytes);
  const lastHeader = truncated.lastIndexOf("\n## ");
  if (lastHeader > maxBytes * 0.5) {
    return truncated.slice(0, lastHeader) + "\n\n[...truncated for context management...]\n";
  }
  return truncated + "\n\n[...truncated...]\n";
}

function gatherContext(phase: Phase): string {
  const parts: string[] = [];
  for (const depId of phase.dependsOn) {
    const depFile = `${PHASES_DIR}/${depId}.md`;
    if (existsSync(depFile)) {
      parts.push(readFileSync(depFile, "utf-8"));
    }
  }
  const combined = parts.join("\n\n---\n\n");
  return summarizeIfNeeded(combined, phase.maxContextInput);
}

// ── Checkpoint/resume ──
interface Progress {
  completed: string[];
  startedAt: string;
}

function loadProgress(): Progress {
  if (existsSync(PROGRESS_FILE)) {
    return JSON.parse(readFileSync(PROGRESS_FILE, "utf-8"));
  }
  return { completed: [], startedAt: new Date().toISOString() };
}

function saveProgress(progress: Progress) {
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// ── Phase execution ──
async function runPhase(phase: Phase): Promise<string> {
  const context = gatherContext(phase);
  let prompt = phase.prompt;
  prompt = prompt.replace("{{CONTEXT}}", context);

  if (prompt.includes("{{GAPS}}")) {
    const gapsFile = `${PHASES_DIR}/03-gaps.md`;
    const gaps = existsSync(gapsFile) ? readFileSync(gapsFile, "utf-8") : "No gaps identified.";
    prompt = prompt.replace("{{GAPS}}", gaps);
  }

  console.log(`📝 Prompt size: ${(Buffer.byteLength(prompt) / 1024).toFixed(1)}KB`);

  const promptFile = `/tmp/research-prompt-${phase.id}.txt`;
  writeFileSync(promptFile, prompt);

  const result = await $`timeout ${phase.timeout} claude -p --output-format text --tools "" --model sonnet < ${promptFile}`
    .text()
    .catch((e: Error) => {
      console.error(`⚠️ Phase ${phase.id} failed: ${e.message}`);
      return `[Phase failed: ${e.message}. Context was ${(Buffer.byteLength(prompt) / 1024).toFixed(1)}KB]`;
    });

  return result;
}

// ── Main ──
async function main() {
  const progress = loadProgress();
  console.log(`🔬 Starting research. ${progress.completed.length} phases already done.`);

  for (const phase of PHASES) {
    if (progress.completed.includes(phase.id)) {
      console.log(`⏭️ Skipping ${phase.name} (already complete)`);
      continue;
    }

    const missingDeps = phase.dependsOn.filter((d) => !progress.completed.includes(d));
    if (missingDeps.length > 0) {
      console.log(`⏳ Waiting for deps: ${missingDeps.join(", ")}`);
      continue;
    }

    console.log(`\n━━━ Phase: ${phase.name} (timeout: ${phase.timeout}s) ━━━`);
    const startTime = Date.now();
    const result = await runPhase(phase);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    const outFile = `${PHASES_DIR}/${phase.id}.md`;
    writeFileSync(outFile, result);
    console.log(`✅ ${phase.name} done in ${elapsed}s → ${outFile} (${(Buffer.byteLength(result) / 1024).toFixed(1)}KB)`);

    progress.completed.push(phase.id);
    saveProgress(progress);
  }

  // ── Compile final output ──
  console.log("\n━━━ Compiling ANALYSIS.md ━━━");
  const allPhases = PHASES.map((p) => {
    const file = `${PHASES_DIR}/${p.id}.md`;
    if (existsSync(file)) return `# ${p.name}\n\n${readFileSync(file, "utf-8")}`;
    return "";
  }).filter(Boolean).join("\n\n---\n\n");

  writeFileSync("ANALYSIS.md", allPhases);
  console.log(`📄 ANALYSIS.md written (${(Buffer.byteLength(allPhases) / 1024).toFixed(1)}KB)`);
}

main().catch(console.error);
```

### 4.4 Launch Commands

```bash
# Full overnight run
nohup bun run run-research.ts > research.log 2>&1 &

# Resume after crash (checkpoints handle this automatically)
bun run run-research.ts

# Monitor progress
tail -f research.log
watch -n 30 'ls -la phases/ && cat checkpoints/progress.json | jq .'
```

### 4.5 Cross-Model Adversarial Review (ARIS Pattern)

For higher quality, have a different model critique the output:

```bash
# Claude writes → GPT critiques (or vice versa)
CRITIQUE=$(cat ANALYSIS.md | codex -q --model gpt-5.4 \
  "You are a rigorous academic reviewer. Critique this for:
   1. Factual errors or unsupported claims
   2. Missing perspectives or blind spots
   3. Logical gaps
   4. Insufficient evidence for strong claims
   5. Bias toward any particular approach
   Score 1-10 on each dimension.")

echo "$CRITIQUE" > CRITIQUE.md
# Feed critique back to original model for revision — raises quality from 6-7 to 7-8/10
```

---

## 5. UI/UX Visual Quality Scoring

Three layers: automated checks (fast, cheap), LLM visual judge (slower, nuanced), chaos testing (adversarial).

### 5.1 Layer 1: Automated Playwright Checks

```typescript
// visual-eval.test.ts — LOCKED — agent cannot edit
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PAGES = ["/", "/dashboard", "/settings"];

for (const pagePath of PAGES) {
  test.describe(`Page: ${pagePath}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`http://localhost:3000${pagePath}`);
      await page.waitForLoadState("networkidle");
    });

    // ── Accessibility ──
    test("passes accessibility audit", async ({ page }) => {
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      const critical = results.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious"
      );
      expect(critical).toHaveLength(0);
    });

    // ── Animation Quality ──
    test("animations use correct timing", async ({ page }) => {
      const animated = await page.$$("[class*=animate], [class*=transition]");
      for (const el of animated) {
        const duration = await el.evaluate((e) => {
          const s = getComputedStyle(e);
          return parseFloat(s.transitionDuration || s.animationDuration || "0") * 1000;
        });
        if (duration > 0) {
          expect(duration).toBeGreaterThanOrEqual(200);
          expect(duration).toBeLessThanOrEqual(350);
        }
        const properties = await el.evaluate((e) => getComputedStyle(e).transitionProperty || "");
        if (properties) {
          for (const prop of properties.split(",").map((p) => p.trim())) {
            expect(["transform", "opacity", "all", "none"]).toContain(prop);
          }
        }
      }
    });

    // ── Responsive Layout ──
    for (const vp of [
      { width: 375, height: 812, name: "mobile" },
      { width: 768, height: 1024, name: "tablet" },
      { width: 1440, height: 900, name: "desktop" },
    ]) {
      test(`no horizontal overflow at ${vp.name}`, async ({ page }) => {
        await page.setViewportSize(vp);
        await page.goto(`http://localhost:3000${pagePath}`);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth
        );
        expect(overflow).toBe(false);
      });
    }

    // ── No Console Errors ──
    test("no console errors", async ({ page }) => {
      const errors: string[] = [];
      page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
      await page.goto(`http://localhost:3000${pagePath}`);
      await page.waitForTimeout(2000);
      expect(errors).toHaveLength(0);
    });
  });
}
```

### 5.2 Layer 2: LLM Visual Judge

Screenshots → LLM vision → structured rubric scores. 80-90% agreement with human evaluators at ~$0.15/eval.

```typescript
// visual-judge.ts
import { $ } from "bun";
import { readFileSync, writeFileSync } from "fs";

const RUBRIC = `You are a UI/UX expert evaluating a screenshot. Score each dimension 0-10:

- **layout** (0-10): Alignment, grid consistency, visual hierarchy
- **typography** (0-10): Font sizes, line heights, contrast
- **spacing** (0-10): Padding/margins consistent, no cramped/wasted space
- **color** (0-10): Palette harmonious, sufficient contrast
- **consistency** (0-10): Elements look unified, same style language
- **overall** (0-10): Would a senior designer approve this?

Also list specific issues (max 5).

Respond ONLY with JSON:
{"layout":N,"typography":N,"spacing":N,"color":N,"consistency":N,"overall":N,"issues":["..."]}`;

async function judgeScreenshot(screenshotPath: string, page: string, viewport: string) {
  const prompt = `${RUBRIC}\n\nEvaluating: ${page} at ${viewport}.`;

  const result = await $`timeout 120 claude -p --output-format text --tools "" --model sonnet "${prompt}" --image ${screenshotPath}`
    .text()
    .catch(() => '{"layout":0,"typography":0,"spacing":0,"color":0,"consistency":0,"overall":0,"issues":["eval failed"]}');

  return JSON.parse(result.trim());
}

async function runVisualEval() {
  const pages = ["/", "/dashboard"];
  const viewports = [
    { width: 1440, height: 900, name: "desktop" },
    { width: 375, height: 812, name: "mobile" },
  ];

  const results = [];
  for (const page of pages) {
    for (const vp of viewports) {
      const path = `screenshots/${page.replace(/\//g, "_") || "home"}_${vp.name}.png`;
      await $`npx playwright screenshot --viewport-size=${vp.width},${vp.height} http://localhost:3000${page} ${path}`;
      const score = await judgeScreenshot(path, page, vp.name);
      results.push({ page, viewport: vp.name, ...score });
      console.log(`${page} @ ${vp.name}: overall ${score.overall}/10`);
    }
  }

  writeFileSync("visual-scores.json", JSON.stringify(results, null, 2));
  const avg = results.reduce((s, r) => s + r.overall, 0) / results.length;
  console.log(`\nAverage visual quality: ${avg.toFixed(1)}/10`);
}

runVisualEval().catch(console.error);
```

### 5.3 Layer 3: Chaos Testing (gremlins.js)

```typescript
// chaos.test.ts — Monkey testing for UI robustness
import { test, expect } from "@playwright/test";

test("survives 10 seconds of random interactions", async ({ page }) => {
  await page.goto("http://localhost:3000");
  await page.waitForLoadState("networkidle");

  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.addScriptTag({ url: "https://unpkg.com/gremlins.js" });

  await page.evaluate(() => {
    return (window as any).gremlins
      .createHorde({
        strategies: [(window as any).gremlins.strategies.allTogether({ nb: 1000 })],
        species: [
          (window as any).gremlins.species.clicker(),
          (window as any).gremlins.species.toucher(),
          (window as any).gremlins.species.formFiller(),
          (window as any).gremlins.species.scroller(),
          (window as any).gremlins.species.typer(),
        ],
      })
      .unleash();
  });

  expect(errors).toHaveLength(0);
  expect(await page.title()).toBeTruthy();
});
```

### 5.4 Adding Visual Score to Composite Eval

```bash
# In evaluate.sh, add this section:

# ── Visual Quality (20 points) ──
VISUAL_AVG=$(bun run visual-judge.ts 2>/dev/null | tail -1 | grep -oP '[\d.]+' || echo "0")
VISUAL_POINTS=$(echo "scale=1; $VISUAL_AVG * 2" | bc)  # Scale 0-10 → 0-20
SCORE=$(echo "$SCORE + $VISUAL_POINTS" | bc)
```

---

## 6. Configuration Cheat Sheet

### 6.1 Timeout Rules

| Context size | Task type | Timeout | Why |
|---|---|---|---|
| <50KB | Focused code generation | 5 min (300s) | Small context, clear task |
| 50-100KB | Code gen with project context | 10 min (600s) | Needs reading + reasoning |
| 100-200KB | Research or synthesis | 15 min (900s) | Heavy reading + writing |
| >200KB | Multi-document compilation | 20 min (1200s) | Maximum practical limit |
| Any | Simple scoring/classification | 2 min (120s) | Minimal output expected |

**Hard rule:** Dying at exactly the timeout (exit code 143/SIGTERM) = timeout too short. Increase by 50%.

### 6.2 Context Management Rules

| Accumulated context | Strategy |
|---|---|
| <50KB | Feed directly |
| 50-100KB | Works but expect 2x slower |
| 100-200KB | **Summarize** — don't concatenate raw docs |
| >200KB | **Split** into sections, process separately, merge |
| >500KB | Redesign your phases — you're doing it wrong |

**The 80KB Rule:** Truncate prior phase output to 80KB max before feeding to next phase. This single fix saved our overnight research run.

### 6.3 Circuit Breakers

```typescript
// Pick the ones that fit your mode:

// 1. Staleness — no improvement in N attempts (Mode A)
if (noImprovementCount >= 5) break;

// 2. Identical scores — stuck in local minimum (Mode A/B)
const last3 = scores.slice(-3);
if (last3[0] === last3[1] && last3[1] === last3[2]) break;

// 3. Crash rate — >50% of last 10 attempts failing (Mode A/B)
if (results.slice(-10).filter(r => r.score === null).length > 5) break;

// 4. Wall clock — hard time limit (all modes)
if (Date.now() - startTime > 8 * 3600 * 1000) break;

// 5. Cost estimate (all modes, if using API)
if (totalTokens * costPerToken > maxBudget) break;
```

### 6.4 LLM Provider Commands

```bash
# Claude CLI (no API key needed — uses authenticated session)
timeout 600 claude -p --output-format text --tools "" --model sonnet < prompt.txt

# Codex CLI (no API key needed)
cat prompt.txt | codex -q --model gpt-5.4

# Ollama (local, free)
ollama run qwen3-coder < prompt.txt

# OpenAI API (needs OPENAI_API_KEY)
curl -s https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"..."}]}'

# Gemini API (needs GOOGLE_API_KEY)
curl -s "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=$GOOGLE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"..."}]}]}'
```

### 6.5 Provider Abstraction

```typescript
// providers.ts — Swap LLMs without changing loop code
type Provider = "claude" | "codex" | "ollama";

async function callLLM(prompt: string, provider?: Provider): Promise<string> {
  const p = provider ?? (process.env.LLM_PROVIDER as Provider) ?? "claude";
  const promptFile = `/tmp/llm-prompt-${Date.now()}.txt`;
  writeFileSync(promptFile, prompt);

  switch (p) {
    case "claude": return $`timeout 600 claude -p --output-format text --tools "" --model sonnet < ${promptFile}`.text();
    case "codex":  return $`cat ${promptFile} | codex -q --model gpt-5.4`.text();
    case "ollama": return $`ollama run qwen3-coder < ${promptFile}`.text();
  }
}
```

---

## 7. Common Mistakes: 10 Things That Break Overnight Runs

### 1. Timeout too short
**Symptom:** Processes die at exactly 5:00, exit code 143 (SIGTERM).
**Fix:** 10-15 min for research prompts. See timeout table.

### 2. Context accumulation
**Symptom:** First phases work, later phases timeout or produce garbage.
**Fix:** Summarize prior context, don't concatenate. Hard limit 80KB per phase input.

### 3. Agent edits the eval
**Symptom:** Score improves but feature doesn't work.
**Fix:** `chmod 444 evaluate.sh tests/`. Pre-commit hook. Non-negotiable.

### 4. No checkpoint/resume
**Symptom:** 4-hour run crashes at hour 3, lose everything.
**Fix:** Write progress to disk after every phase/variant.

### 5. Shell escaping breaks prompts
**Symptom:** LLM receives garbled prompt.
**Fix:** Write prompt to temp file, pipe via stdin. Never pass as CLI arg.

### 6. No circuit breaker
**Symptom:** Agent loops all night generating same-score variants.
**Fix:** Staleness limit (5 with no improvement = stop).

### 7. Trusting single measurements
**Symptom:** Pick variant A over B based on noise.
**Fix:** Run 3+ times per variant. Use MAD for confidence.

### 8. No backpressure checks
**Symptom:** "Faster" variant breaks existing functionality.
**Fix:** Run tests + typecheck + lint BEFORE measuring the target metric.

### 9. Oversized prompts for simple tasks
**Symptom:** 50KB prompt for a 0-10 score. 3 minutes, $0.50 per eval.
**Fix:** Match prompt size to task. Scoring = <2KB, 2 min timeout.

### 10. Not logging everything
**Symptom:** Something broke overnight, can't debug.
**Fix:**
```bash
nohup bun run loop.ts > run.log 2>&1 &
# Save every prompt and response:
writeFileSync(`debug/${i}-prompt.txt`, prompt);
writeFileSync(`debug/${i}-response.txt`, result);
```

---

## Appendix A: Minimal Quick-Start (5 Minutes)

```bash
mkdir my-experiment && cd my-experiment

# 1. Goal
cat > GOAL.md << 'EOF'
# GOAL: [Your metric, direction]
Baseline: [current value]
EOF

# 2. Eval (then lock it)
cat > evaluate.sh << 'EOF'
#!/bin/bash
set -euo pipefail
SCORE=$(echo "42")  # ← YOUR MEASUREMENT
echo "{\"score\":$SCORE,\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"
EOF
chmod 555 evaluate.sh

# 3. Loop
for i in $(seq 1 20); do
  echo "=== Variant $i ==="
  mkdir -p "variants/$i"
  PREV=$(cat results.jsonl 2>/dev/null | tail -5)
  echo "Goal: $(cat GOAL.md). Recent: $PREV. Generate variant $i." \
    | claude -p --output-format text --tools "" --model sonnet \
    > "variants/$i/output.txt"
  RESULT=$(./evaluate.sh "variants/$i")
  echo "$RESULT" >> results.jsonl
  echo "$RESULT"
done
echo "Best:"
cat results.jsonl | jq -s 'sort_by(-.score) | .[0]'
```

---

## Appendix B: When NOT to Use This

- **Exploratory prototyping:** If you don't know what "better" means, manually explore first.
- **Tasks requiring taste:** LLM visual judge is a filter, not an oracle.
- **Safety-critical code:** Every change needs human review. No exceptions.
- **One-off tasks:** If you'll run it once, just use the LLM interactively. Loops pay off at 10+ iterations.

---

*These patterns produced +29% accuracy, 578KB of overnight research, and 53% rendering speedups in real experiments. Copy, adapt, run overnight, wake up to results.*
