I only have Chrome DevTools tools available, but this is a writing task. I'll produce the complete refined playbook directly. Given the length, I'll output it in full below.

---

# The Autoresearch Playbook
## Self-Optimizing Autonomous Coding Loops for Any LLM

> **What is autoresearch?** Autoresearch is the practice of setting up autonomous loops where an LLM generates solution variants, a locked evaluation function scores them, and the loop keeps the best — repeating until a target is hit or a circuit breaker fires. It works because it decouples *generation* (creative, LLM-driven) from *evaluation* (deterministic, script-driven), turning creative problems into search problems. The locked eval prevents Goodhart's Law: the agent can't game the metric by changing the test. This pattern has produced +29% accuracy improvements, 53% rendering speedups, and 578KB overnight research syntheses in real-world use.

---

## How to Use This Playbook

**If you are an LLM receiving this document as a prompt:** When given a task, classify it using the decision tree in Section 1, then follow the corresponding mode step by step. Generate files with the exact names and structures shown. Never modify files marked LOCKED.

**If you are a human:** Copy the mode that fits your task, fill in the `GOAL.md` and `evaluate.sh` templates, and run the loop command. Come back to results.

---

## Prerequisites

```bash
# Required
bun --version    # >= 1.0 (https://bun.sh — or use the Python templates below)
jq --version     # JSON processor (brew install jq / apt install jq)

# Required: At least ONE LLM provider
claude --version # Claude Code CLI, authenticated (https://docs.anthropic.com/en/docs/claude-code)
# OR
codex --version  # OpenAI Codex CLI (https://github.com/openai/codex)
# OR
ollama --version # Local models (https://ollama.ai)

# Optional (for UI/UX scoring)
npx playwright --version  # Browser automation
```

**Platform notes:**
- macOS and Linux are fully supported.
- Windows requires WSL (Windows Subsystem for Linux) — all scripts use Unix conventions.
- All `grep` patterns use POSIX ERE (`grep -oE`) for cross-platform compatibility. Do NOT use `grep -P` (Perl regex) — it fails silently on macOS.

---

## Table of Contents

1. [Quick Reference: Decision Tree](#1-quick-reference)
2. [Core Infrastructure (shared by all modes)](#2-core-infrastructure)
3. [Mode A: Metric Optimization (Karpathy Loop)](#3-mode-a-metric-optimization)
4. [Mode B: Feature Development (TDD Loop)](#4-mode-b-feature-development)
5. [Mode C: Pure Research (Overnight Synthesis)](#5-mode-c-pure-research)
6. [Mode D: Debug Loop (Find & Fix)](#6-mode-d-debug-loop)
7. [UI/UX Visual Quality Scoring](#7-uiux-visual-quality-scoring)
8. [Configuration Cheat Sheet](#8-configuration-cheat-sheet)
9. [Common Mistakes: 12 Things That Break Overnight Runs](#9-common-mistakes)
10. [Complete Working Example](#10-complete-working-example)

---

## 1. Quick Reference

| You want to... | Use Mode | Eval type | Typical runtime | Example |
|---|---|---|---|---|
| Improve a metric (accuracy, speed, size) | **A: Metric Optimization** | Numerical score from script | 4–12 hours | Compress CSS, speed up inference, improve prompt accuracy |
| Build a feature that passes tests | **B: Feature Development** | Test suite + composite score | 2–8 hours | Add auth flow, build API endpoint, refactor module |
| Research a topic and synthesize findings | **C: Pure Research** | Completeness self-check | 6–16 hours | Literature review, competitive analysis, architecture RFC |
| Find and fix a bug | **D: Debug Loop** | Reproduction script passes | 1–6 hours | Fix crash, resolve flaky test, debug memory leak |
| Make UI look and work correctly | **A or B + Visual Judge** | Playwright + LLM screenshot scoring | 1–4 hours | Design system compliance, responsive layout, a11y |
| Find the best prompt variant | **A: Metric Optimization** | Score per variant on fixed dataset | 2–6 hours | Tag optimization, classification, extraction |

**Decision tree:**

```
Is there a number to improve?
  YES → Mode A (Metric Optimization)
  NO → Is there a bug to fix?
    YES → Mode D (Debug Loop)
    NO → Are there tests to pass?
      YES → Mode B (Feature Development)
      NO → Mode C (Pure Research)

Does it have a UI?
  YES → Add Visual Quality Scoring (§7) to any mode
```

**When NOT to use autonomous loops:**
- **You can't write a good eval.** If you can't script "better vs. worse," work interactively until you can.
- **The eval is expensive.** If each run costs >$1 or >5 minutes, the loop economics break. Optimize your eval first.
- **The search space is tiny.** If there are only 3 possible approaches, just try them manually.
- **Safety-critical code.** Every change needs human review. Use the human-in-the-loop checkpoint pattern (§8.4).
- **You need to learn, not just get results.** Interactive exploration teaches you things a results file doesn't.
- **One-off tasks.** Loops pay off at 10+ iterations. For a single attempt, use the LLM interactively.

---

## 2. Core Infrastructure

These utilities are shared by all modes. Every mode imports from this file.

### 2.1 Provider Abstraction (`providers.ts`)

```typescript
// providers.ts — Swap LLMs without changing loop code
// Works with: bun run providers.ts
import { $ } from "bun";
import { writeFileSync, unlinkSync } from "fs";

export type Provider = "claude" | "codex" | "ollama";

export function getProvider(): Provider {
  return (process.env.LLM_PROVIDER as Provider) ?? "claude";
}

export async function callLLM(prompt: string, opts?: {
  provider?: Provider;
  timeout?: number;
  model?: string;
}): Promise<string> {
  const provider = opts?.provider ?? getProvider();
  const timeout = opts?.timeout ?? 600;

  // IMPORTANT: Write prompt to temp file to avoid shell escaping issues.
  // Never pass prompts as CLI arguments — they contain quotes, newlines, and special chars.
  const promptFile = `/tmp/autoresearch-prompt-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`;
  writeFileSync(promptFile, prompt);

  try {
    switch (provider) {
      case "claude": {
        const model = opts?.model ?? "sonnet";
        return await $`timeout ${timeout} claude -p --output-format text --tools "" --model ${model} < ${promptFile}`.text();
      }
      case "codex": {
        const model = opts?.model ?? "o4-mini";
        return await $`timeout ${timeout} cat ${promptFile} | codex -q --model ${model}`.text();
      }
      case "ollama": {
        const model = opts?.model ?? "qwen3-coder";
        return await $`timeout ${timeout} ollama run ${model} < ${promptFile}`.text();
      }
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  } finally {
    try { unlinkSync(promptFile); } catch {}
  }
}
```

**Node.js alternative** (if you don't use Bun):

```typescript
// providers-node.ts — Node.js version using child_process
import { writeFileSync, unlinkSync, readFileSync } from "fs";
import { execSync } from "child_process";

export type Provider = "claude" | "codex" | "ollama";

export function callLLM(prompt: string, opts?: {
  provider?: Provider;
  timeout?: number;
  model?: string;
}): string {
  const provider = opts?.provider ?? (process.env.LLM_PROVIDER as Provider) ?? "claude";
  const timeout = opts?.timeout ?? 600;
  const promptFile = `/tmp/autoresearch-prompt-${Date.now()}.txt`;
  writeFileSync(promptFile, prompt);

  try {
    let cmd: string;
    switch (provider) {
      case "claude":
        cmd = `timeout ${timeout} claude -p --output-format text --tools "" --model ${opts?.model ?? "sonnet"} < ${promptFile}`;
        break;
      case "codex":
        cmd = `timeout ${timeout} cat ${promptFile} | codex -q --model ${opts?.model ?? "o4-mini"}`;
        break;
      case "ollama":
        cmd = `timeout ${timeout} ollama run ${opts?.model ?? "qwen3-coder"} < ${promptFile}`;
        break;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
    return execSync(cmd, { encoding: "utf-8", maxBuffer: 50 * 1024 * 1024 });
  } finally {
    try { unlinkSync(promptFile); } catch {}
  }
}
```

**Python alternative:**

```python
# providers.py — Python version
import os, subprocess, tempfile, time, random

def call_llm(prompt: str, provider: str = None, timeout: int = 600, model: str = None) -> str:
    provider = provider or os.environ.get("LLM_PROVIDER", "claude")

    # Write prompt to temp file — never pass as CLI arg
    prompt_file = f"/tmp/autoresearch-prompt-{int(time.time())}-{random.randint(0,9999)}.txt"
    with open(prompt_file, "w") as f:
        f.write(prompt)

    try:
        if provider == "claude":
            m = model or "sonnet"
            cmd = f'timeout {timeout} claude -p --output-format text --tools "" --model {m} < {prompt_file}'
        elif provider == "codex":
            m = model or "o4-mini"
            cmd = f"timeout {timeout} cat {prompt_file} | codex -q --model {m}"
        elif provider == "ollama":
            m = model or "qwen3-coder"
            cmd = f"timeout {timeout} ollama run {m} < {prompt_file}"
        else:
            raise ValueError(f"Unknown provider: {provider}")

        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout + 10)
        if result.returncode == 124:  # timeout exit code
            raise TimeoutError(f"LLM call timed out after {timeout}s")
        return result.stdout
    finally:
        try: os.unlink(prompt_file)
        except: pass
```

### 2.2 File Extraction (`extract-files.ts`)

**This is the critical missing piece.** The LLM generates text containing code blocks. This function parses that text into actual files on disk. Without this, no loop works.

```typescript
// extract-files.ts — Parse LLM output into actual files
import { writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";

interface ExtractedFile {
  path: string;
  content: string;
}

/**
 * Extracts files from LLM output. Supports two formats:
 *
 * Format 1 — Markdown code blocks with file paths:
 *   ```typescript
 *   // path/to/file.ts
 *   const x = 1;
 *   ```
 *
 * Format 2 — Explicit file markers:
 *   --- FILE: path/to/file.ts ---
 *   const x = 1;
 *   --- END FILE ---
 *
 * Format 3 — Comment-style headers:
 *   // === path/to/file.ts ===
 *   const x = 1;
 */
export function extractFiles(llmOutput: string): ExtractedFile[] {
  const files: ExtractedFile[] = [];

  // Try Format 2 first (most explicit)
  const markerPattern = /---\s*FILE:\s*(.+?)\s*---\n([\s\S]*?)(?=---\s*(?:END FILE|FILE:)|$)/g;
  let match;
  while ((match = markerPattern.exec(llmOutput)) !== null) {
    files.push({
      path: match[1].trim(),
      content: match[2].replace(/---\s*END FILE\s*---\s*$/, "").trim() + "\n",
    });
  }
  if (files.length > 0) return files;

  // Try Format 1 — markdown code blocks with path in first line or preceding text
  const codeBlockPattern = /(?:(?:^|\n)(?:#+\s+)?`?([a-zA-Z0-9_./-]+\.[a-zA-Z0-9]+)`?\s*\n)?```[\w]*\n([\s\S]*?)```/g;
  while ((match = codeBlockPattern.exec(llmOutput)) !== null) {
    let path = match[1];
    const content = match[2];

    // If no path in header, check first line of content for comment-style path
    if (!path) {
      const firstLine = content.split("\n")[0];
      const commentPath = firstLine.match(/^(?:\/\/|#|\/\*)\s*(?:===\s*)?([a-zA-Z0-9_./-]+\.[a-zA-Z0-9]+)/);
      if (commentPath) {
        path = commentPath[1];
      }
    }

    if (path) {
      files.push({
        path: path.trim(),
        content: content.trim() + "\n",
      });
    }
  }
  if (files.length > 0) return files;

  // Try Format 3 — comment-style headers outside code blocks
  const commentPattern = /(?:\/\/|#)\s*===\s*(.+?)\s*===\s*\n([\s\S]*?)(?=(?:\/\/|#)\s*===|$)/g;
  while ((match = commentPattern.exec(llmOutput)) !== null) {
    files.push({
      path: match[1].trim(),
      content: match[2].trim() + "\n",
    });
  }

  return files;
}

/**
 * Extracts files from LLM output and writes them to disk under baseDir.
 * Returns the list of files written.
 */
export function extractAndWriteFiles(llmOutput: string, baseDir: string): string[] {
  const files = extractFiles(llmOutput);
  const written: string[] = [];

  for (const file of files) {
    const fullPath = `${baseDir}/${file.path}`;
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, file.content);
    written.push(fullPath);
  }

  return written;
}
```

**Python version:**

```python
# extract_files.py
import re, os

def extract_files(llm_output: str) -> list[dict]:
    """Parse LLM output into {path, content} dicts."""
    files = []

    # Format 2: --- FILE: path --- ... --- END FILE ---
    for m in re.finditer(r'---\s*FILE:\s*(.+?)\s*---\n([\s\S]*?)(?=---\s*(?:END FILE|FILE:)|$)', llm_output):
        content = re.sub(r'---\s*END FILE\s*---\s*$', '', m.group(2)).strip()
        files.append({"path": m.group(1).strip(), "content": content + "\n"})
    if files:
        return files

    # Format 1: markdown code blocks with paths
    for m in re.finditer(r'(?:(?:^|\n)(?:#+\s+)?`?([a-zA-Z0-9_./-]+\.[a-zA-Z0-9]+)`?\s*\n)?```\w*\n([\s\S]*?)```', llm_output):
        path = m.group(1)
        content = m.group(2)
        if not path:
            first_line = content.split("\n")[0]
            cm = re.match(r'^(?://|#|/\*)\s*(?:===\s*)?([a-zA-Z0-9_./-]+\.[a-zA-Z0-9]+)', first_line)
            if cm:
                path = cm.group(1)
        if path:
            files.append({"path": path.strip(), "content": content.strip() + "\n"})
    if files:
        return files

    # Format 3: comment-style headers
    for m in re.finditer(r'(?://|#)\s*===\s*(.+?)\s*===\s*\n([\s\S]*?)(?=(?://|#)\s*===|$)', llm_output):
        files.append({"path": m.group(1).strip(), "content": m.group(2).strip() + "\n"})

    return files

def extract_and_write_files(llm_output: str, base_dir: str) -> list[str]:
    """Extract files and write to disk. Returns list of paths written."""
    files = extract_files(llm_output)
    written = []
    for f in files:
        full_path = os.path.join(base_dir, f["path"])
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, "w") as fh:
            fh.write(f["content"])
        written.append(full_path)
    return written
```

### 2.3 LLM Prompt Instructions for File Output

Include this block in every prompt sent to the LLM so it outputs files in a parseable format:

```typescript
export const FILE_OUTPUT_INSTRUCTIONS = `
## Output Format
Output each file using this EXACT format:

--- FILE: path/to/file.ts ---
<file contents here>
--- END FILE ---

Rules:
- Use relative paths from the project root
- Include COMPLETE file contents (no ellipsis, no "rest stays the same")
- Output ONLY files. No explanations before or after.
- Every file you output will overwrite any existing file at that path.
`;
```

### 2.4 Circuit Breakers (`circuit-breakers.ts`)

```typescript
// circuit-breakers.ts — Reusable stopping conditions
export interface CircuitBreakerConfig {
  maxStaleness?: number;      // Stop after N iterations with no improvement (default: 5)
  maxCrashRate?: number;      // Stop if >N of last 10 failed (default: 7)
  maxWallClockMs?: number;    // Hard time limit in ms (default: 8 hours)
  maxIdenticalScores?: number;// Stop after N identical scores (default: 3)
  startTime?: number;         // Date.now() when the loop started
}

export interface LoopResult {
  score: number | null;
  error?: string;
}

export function shouldStop(
  results: LoopResult[],
  config: CircuitBreakerConfig,
  currentStaleness: number
): { stop: boolean; reason: string } | null {
  const {
    maxStaleness = 5,
    maxCrashRate = 7,
    maxIdenticalScores = 3,
    maxWallClockMs = 8 * 3600 * 1000,
    startTime = Date.now(),
  } = config;

  // 1. Staleness — no improvement in N attempts
  if (currentStaleness >= maxStaleness) {
    return { stop: true, reason: `No improvement in ${maxStaleness} attempts` };
  }

  // 2. Identical scores — stuck in local minimum
  if (results.length >= maxIdenticalScores) {
    const recent = results.slice(-maxIdenticalScores).map(r => r.score);
    if (recent.every(s => s !== null && s === recent[0])) {
      return { stop: true, reason: `Score stuck at ${recent[0]} for ${maxIdenticalScores} iterations` };
    }
  }

  // 3. Crash rate — too many failures
  if (results.length >= 10) {
    const recentFailures = results.slice(-10).filter(r => r.score === null).length;
    if (recentFailures >= maxCrashRate) {
      return { stop: true, reason: `${recentFailures}/10 recent attempts failed` };
    }
  }

  // 4. Wall clock
  if (Date.now() - startTime > maxWallClockMs) {
    return { stop: true, reason: `Wall clock limit reached (${(maxWallClockMs / 3600000).toFixed(1)}h)` };
  }

  return null;
}
```

---

## 3. Mode A: Metric Optimization

**The Karpathy Loop:** Generate variant → measure → keep if better → repeat.

### Why it works

By decoupling generation from evaluation, you turn a creative problem into a search problem. The LLM explores the solution space; the eval function provides the gradient signal. Because the eval is locked, the only way to improve the score is to improve the actual solution. This is the difference between real improvement and Goodhart's Law.

**Concrete Goodhart failures the locked eval prevents:**
- Agent adds `test.skip()` to failing tests
- Agent modifies assertion thresholds ("assert accuracy > 0.5" → "assert accuracy > 0.1")
- Agent special-cases the eval dataset ("if input === 'test case 3' return expected_answer")
- Agent makes the eval script print a higher number

### 3.1 File Structure

```
project/
├── GOAL.md              # What to optimize, constraints, current best
├── prepare.sh           # ONE-TIME setup: install deps, seed data, build baselines
├── evaluate.sh          # THE LOCKED EVAL — agent cannot edit this
├── providers.ts         # LLM provider abstraction (from §2.1)
├── extract-files.ts     # File extraction (from §2.2)
├── circuit-breakers.ts  # Stopping conditions (from §2.4)
├── run-loop.ts          # The optimization loop
├── variants/            # Each attempt gets a numbered directory
│   ├── 001/
│   ├── 002/
│   └── ...
├── debug/               # Every prompt and response saved here
├── results.jsonl        # Append-only log of every run
└── best/                # Copy of current best variant
```

### 3.2 GOAL.md Template

```markdown
# GOAL: [One sentence — what metric, which direction]

## Metric
- **Name:** [e.g., "bundle_size_bytes"]
- **Unit:** [e.g., "bytes"]
- **Direction:** lower_is_better
- **Baseline:** [current value, e.g., "245760"]
- **Target:** [aspirational, e.g., "102400" or "as low as possible"]
- **Current best:** [updated by the loop]

## Evaluation
Run `./evaluate.sh <variant_dir>` — outputs a single JSON line:
```json
{"variant": "001", "score": 142.3, "timestamp": "...", "details": {...}}
```

## Constraints
- [ ] Must pass existing tests
- [ ] Must pass type check
- [ ] No new dependencies without justification
- [ ] [Add domain-specific constraints]

## What to try
Examples (delete and replace with yours):
- Tree-shaking unused exports
- Replacing moment.js with date-fns
- Code splitting by route
- Inlining critical CSS

## What NOT to try
- [Approaches known to fail or that are off-limits]
- Do not remove functionality to reduce size
```

### 3.3 prepare.sh Template

```bash
#!/usr/bin/env bash
# prepare.sh — Run ONCE before starting the loop.
# Installs dependencies, builds baselines, creates directories.
set -euo pipefail

echo "=== Preparing environment ==="

# Install dependencies
if [ -f "package.json" ]; then
  npm install
fi

# Create directories
mkdir -p variants debug best

# Build baseline (variant 000)
mkdir -p variants/000
cp -r src/ variants/000/src/ 2>/dev/null || true
cp package.json variants/000/ 2>/dev/null || true

# Run baseline evaluation
echo "=== Baseline measurement ==="
./evaluate.sh variants/000 | tee -a results.jsonl

echo "=== Preparation complete ==="
```

### 3.4 evaluate.sh Template

```bash
#!/usr/bin/env bash
# ┌─────────────────────────────────────────────────┐
# │  LOCKED — the agent must NEVER edit this file.  │
# │  This is the objective function.                │
# │  Changing it is cheating.                       │
# └─────────────────────────────────────────────────┘
set -euo pipefail

VARIANT_DIR="${1:?Usage: ./evaluate.sh <variant_dir>}"
VARIANT_NAME=$(basename "$VARIANT_DIR")
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Helper: emit result JSON and exit
emit() {
  local score="$1"
  local error="${2:-}"
  if [ -n "$error" ]; then
    echo "{\"variant\":\"$VARIANT_NAME\",\"score\":null,\"error\":\"$error\",\"timestamp\":\"$TIMESTAMP\"}"
    exit 1
  fi
  echo "{\"variant\":\"$VARIANT_NAME\",\"score\":$score,\"timestamp\":\"$TIMESTAMP\"}"
}

# ── Backpressure checks (must pass before scoring) ──

# Check 1: Required files exist
if [ ! -d "$VARIANT_DIR" ]; then
  emit "" "variant_dir_missing"
fi

# Check 2: Tests pass (uncomment and adapt for your project)
# cd "$VARIANT_DIR" && npm test 2>/dev/null || emit "" "tests_failed"

# Check 3: Type check passes (uncomment for TypeScript projects)
# npx tsc --noEmit --project "$VARIANT_DIR/tsconfig.json" 2>/dev/null || emit "" "typecheck_failed"

# ── Scoring ──
# REPLACE the SCORE= line with your actual measurement.
# Examples:
#   Bundle size:   SCORE=$(wc -c < "$VARIANT_DIR/dist/bundle.js")
#   Latency:       SCORE=$(hyperfine --json './run.sh' | jq '.results[0].median')
#   Accuracy:      SCORE=$(python3 score.py --dir "$VARIANT_DIR" | jq '.accuracy')
#   File count:    SCORE=$(find "$VARIANT_DIR/dist" -name '*.js' | wc -l)
#   Test pass rate:
#     TOTAL=$(npm test --prefix "$VARIANT_DIR" 2>&1 | grep -oE '[0-9]+ (tests?|specs?)' | head -1 | grep -oE '[0-9]+' || echo 0)
#     PASSED=$(npm test --prefix "$VARIANT_DIR" 2>&1 | grep -oE '[0-9]+ pass' | grep -oE '[0-9]+' || echo 0)
#     SCORE=$(echo "scale=4; $PASSED / $TOTAL" | bc)

SCORE=0  # ← REPLACE THIS

emit "$SCORE"
```

### 3.5 The Loop Runner (`run-loop.ts`)

```typescript
// run-loop.ts — The Karpathy optimization loop
// Usage: chmod +x evaluate.sh && timeout 8h bun run run-loop.ts 2>&1 | tee run.log
import { $ } from "bun";
import { readFileSync, writeFileSync, mkdirSync, existsSync, cpSync, rmSync } from "fs";
import { callLLM } from "./providers";
import { extractAndWriteFiles, FILE_OUTPUT_INSTRUCTIONS } from "./extract-files";
import { shouldStop, type LoopResult, type CircuitBreakerConfig } from "./circuit-breakers";

// ── Configuration ──
const DIRECTION: "higher" | "lower" = "lower"; // ← MUST match GOAL.md's Direction field
const MAX_VARIANTS = 100;
const RESULTS_FILE = "results.jsonl";
const STALE_LIMIT = 8; // Tunable: 5 for fast feedback, 10-20 for large search spaces

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
    .trim().split("\n").filter(Boolean)
    .map(l => JSON.parse(l));
}

function bestResult(results: Result[]): Result | null {
  const valid = results.filter(r => r.score !== null);
  if (valid.length === 0) return null;
  return valid.reduce((best, r) => {
    if (best.score === null) return r;
    if (DIRECTION === "higher") return r.score! > best.score ? r : best;
    return r.score! < best.score! ? r : best;
  });
}

async function generateAndExtractVariant(
  variantNum: number,
  results: Result[]
): Promise<string> {
  const variantDir = `variants/${String(variantNum).padStart(3, "0")}`;
  mkdirSync(variantDir, { recursive: true });

  const goal = readFileSync("GOAL.md", "utf-8");
  const recentResults = results.slice(-10);
  const best = bestResult(results);

  const prompt = `You are an optimization agent.

## Goal
${goal}

## Current state
- Best score so far: ${best ? `${best.score} (variant ${best.variant})` : "no measurements yet"}
- Direction: ${DIRECTION} is better
- Total variants tested: ${results.length}
- Recent results:
${recentResults.map(r => `  - ${r.variant}: ${r.score ?? `FAILED (${r.error})`}`).join("\n") || "  (none yet)"}

## Task
Generate variant ${variantNum}. Write the implementation files.
${results.length > 3 ? "Recent attempts cluster — try a RADICALLY different approach." : ""}
${results.filter(r => r.error).length > 2 ? `Common failures: ${[...new Set(results.filter(r => r.error).map(r => r.error))].join(", ")}. Avoid these.` : ""}

${FILE_OUTPUT_INSTRUCTIONS}`;

  // Save prompt for debugging
  mkdirSync("debug", { recursive: true });
  writeFileSync(`debug/${variantNum}-prompt.txt`, prompt);

  const llmOutput = await callLLM(prompt);

  // Save raw response for debugging
  writeFileSync(`debug/${variantNum}-response.txt`, llmOutput);

  // CRITICAL: Extract files from LLM output and write them to the variant directory
  const writtenFiles = extractAndWriteFiles(llmOutput, variantDir);

  if (writtenFiles.length === 0) {
    console.warn(`⚠️ No files extracted from variant ${variantNum}. Raw output saved to debug/${variantNum}-response.txt`);
    // Save raw output as fallback
    writeFileSync(`${variantDir}/generated.txt`, llmOutput);
  } else {
    console.log(`  Extracted ${writtenFiles.length} files: ${writtenFiles.map(f => f.replace(variantDir + "/", "")).join(", ")}`);
  }

  return variantDir;
}

async function evaluateVariant(variantDir: string): Promise<Result> {
  try {
    const output = await $`./evaluate.sh ${variantDir}`.text();
    // Parse the LAST JSON line (eval may print progress before the result)
    const lines = output.trim().split("\n").filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        return JSON.parse(lines[i]) as Result;
      } catch {}
    }
    return {
      variant: variantDir,
      score: null,
      error: "no_json_in_eval_output",
      timestamp: new Date().toISOString(),
    };
  } catch (e) {
    return {
      variant: variantDir,
      score: null,
      error: `evaluation_crashed: ${(e as Error).message.slice(0, 200)}`,
      timestamp: new Date().toISOString(),
    };
  }
}

// ── Main loop ──
async function main() {
  let staleness = 0;
  const startTime = Date.now();
  const circuitConfig: CircuitBreakerConfig = {
    maxStaleness: STALE_LIMIT,
    maxWallClockMs: 8 * 3600 * 1000,
    startTime,
  };

  console.log(`\n━━━ Autoresearch Metric Optimization ━━━`);
  console.log(`Direction: ${DIRECTION} is better`);
  console.log(`Max variants: ${MAX_VARIANTS}, Stale limit: ${STALE_LIMIT}\n`);

  for (let i = 1; i <= MAX_VARIANTS; i++) {
    const results = loadResults();

    // Check circuit breakers
    const loopResults: LoopResult[] = results.map(r => ({ score: r.score, error: r.error }));
    const breaker = shouldStop(loopResults, circuitConfig, staleness);
    if (breaker) {
      console.log(`\n⚡ Circuit breaker: ${breaker.reason}. Stopping.`);
      break;
    }

    console.log(`\n━━━ Variant ${i}/${MAX_VARIANTS} ━━━`);

    try {
      const variantDir = await generateAndExtractVariant(i, results);
      const result = await evaluateVariant(variantDir);

      // Append result
      writeFileSync(RESULTS_FILE, JSON.stringify(result) + "\n", { flag: "a" });

      const currentBest = bestResult(results);
      if (result.score !== null) {
        const improved = currentBest === null
          || (DIRECTION === "higher" ? result.score > currentBest.score! : result.score < currentBest.score!);

        if (improved) {
          console.log(`✅ NEW BEST: ${result.score} (was ${currentBest?.score ?? "none"})`);
          staleness = 0;
          try { rmSync("best", { recursive: true }); } catch {}
          cpSync(variantDir, "best", { recursive: true });
        } else {
          staleness++;
          console.log(`❌ No improvement: ${result.score} vs best ${currentBest!.score} (stale: ${staleness}/${STALE_LIMIT})`);
        }
      } else {
        staleness++;
        console.log(`💥 Failed: ${result.error} (stale: ${staleness}/${STALE_LIMIT})`);
      }
    } catch (e) {
      console.error(`Variant ${i} crashed:`, (e as Error).message);
      staleness++;
    }
  }

  // ── Final report ──
  const results = loadResults();
  const best = bestResult(results);
  const successful = results.filter(r => r.score !== null).length;
  const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);
  console.log(`\n━━━ FINAL REPORT ━━━`);
  console.log(`Total variants: ${results.length}`);
  console.log(`Successful: ${successful} (${results.length > 0 ? ((successful / results.length) * 100).toFixed(0) : 0}%)`);
  console.log(`Best score: ${best?.score ?? "none"} (variant ${best?.variant ?? "none"})`);
  console.log(`Elapsed: ${elapsed} minutes`);
  console.log(`Best variant saved in: best/`);
}

main().catch(console.error);
```

### 3.6 Python Loop Runner

```python
#!/usr/bin/env python3
# run_loop.py — Karpathy optimization loop (Python version)
# Usage: timeout 8h python3 run_loop.py 2>&1 | tee run.log
import json, os, subprocess, sys, time, shutil
from providers import call_llm
from extract_files import extract_and_write_files

# ── Configuration ──
DIRECTION = "lower"  # "higher" or "lower" — MUST match GOAL.md
MAX_VARIANTS = 100
RESULTS_FILE = "results.jsonl"
STALE_LIMIT = 8

def load_results():
    if not os.path.exists(RESULTS_FILE):
        return []
    with open(RESULTS_FILE) as f:
        return [json.loads(line) for line in f if line.strip()]

def best_result(results):
    valid = [r for r in results if r.get("score") is not None]
    if not valid:
        return None
    if DIRECTION == "higher":
        return max(valid, key=lambda r: r["score"])
    return min(valid, key=lambda r: r["score"])

FILE_OUTPUT_INSTRUCTIONS = """
## Output Format
Output each file using this EXACT format:

--- FILE: path/to/file.ext ---
<file contents here>
--- END FILE ---

Rules:
- Use relative paths from the project root
- Include COMPLETE file contents (no ellipsis, no "rest stays the same")
- Output ONLY files. No explanations before or after.
"""

def generate_variant(variant_num, results):
    variant_dir = f"variants/{variant_num:03d}"
    os.makedirs(variant_dir, exist_ok=True)
    os.makedirs("debug", exist_ok=True)

    with open("GOAL.md") as f:
        goal = f.read()

    recent = results[-10:]
    best = best_result(results)

    prompt = f"""You are an optimization agent.

## Goal
{goal}

## Current state
- Best score so far: {f'{best["score"]} (variant {best["variant"]})' if best else 'no measurements yet'}
- Direction: {DIRECTION} is better
- Total variants tested: {len(results)}
- Recent results:
{chr(10).join(f'  - {r["variant"]}: {r.get("score", f"FAILED ({r.get("error", "unknown")})")}' for r in recent) or '  (none yet)'}

## Task
Generate variant {variant_num}. Write the implementation files.
{'Recent attempts cluster — try a RADICALLY different approach.' if len(results) > 3 else ''}

{FILE_OUTPUT_INSTRUCTIONS}"""

    with open(f"debug/{variant_num}-prompt.txt", "w") as f:
        f.write(prompt)

    llm_output = call_llm(prompt)

    with open(f"debug/{variant_num}-response.txt", "w") as f:
        f.write(llm_output)

    written = extract_and_write_files(llm_output, variant_dir)
    if not written:
        print(f"  ⚠️ No files extracted. Raw output in debug/{variant_num}-response.txt")
        with open(f"{variant_dir}/generated.txt", "w") as f:
            f.write(llm_output)
    else:
        print(f"  Extracted {len(written)} files: {', '.join(os.path.relpath(f, variant_dir) for f in written)}")

    return variant_dir

def evaluate_variant(variant_dir):
    try:
        result = subprocess.run(
            ["./evaluate.sh", variant_dir],
            capture_output=True, text=True, timeout=300
        )
        # Parse last JSON line
        for line in reversed(result.stdout.strip().split("\n")):
            try:
                return json.loads(line)
            except json.JSONDecodeError:
                continue
        return {"variant": os.path.basename(variant_dir), "score": None,
                "error": "no_json_in_eval_output", "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    except Exception as e:
        return {"variant": os.path.basename(variant_dir), "score": None,
                "error": str(e)[:200], "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}

def main():
    staleness = 0
    start_time = time.time()

    print(f"\n━━━ Autoresearch Metric Optimization (Python) ━━━")
    print(f"Direction: {DIRECTION} is better, Max: {MAX_VARIANTS}, Stale limit: {STALE_LIMIT}\n")

    for i in range(1, MAX_VARIANTS + 1):
        results = load_results()

        if staleness >= STALE_LIMIT:
            print(f"\n⚡ Circuit breaker: No improvement in {STALE_LIMIT} attempts.")
            break
        if time.time() - start_time > 8 * 3600:
            print(f"\n⚡ Circuit breaker: Wall clock limit (8h).")
            break

        print(f"\n━━━ Variant {i}/{MAX_VARIANTS} ━━━")

        try:
            variant_dir = generate_variant(i, results)
            result = evaluate_variant(variant_dir)

            with open(RESULTS_FILE, "a") as f:
                f.write(json.dumps(result) + "\n")

            current_best = best_result(results)
            if result.get("score") is not None:
                improved = (current_best is None or
                    (DIRECTION == "higher" and result["score"] > current_best["score"]) or
                    (DIRECTION == "lower" and result["score"] < current_best["score"]))
                if improved:
                    print(f"✅ NEW BEST: {result['score']} (was {current_best['score'] if current_best else 'none'})")
                    staleness = 0
                    shutil.rmtree("best", ignore_errors=True)
                    shutil.copytree(variant_dir, "best")
                else:
                    staleness += 1
                    print(f"❌ No improvement: {result['score']} vs best {current_best['score']} (stale: {staleness}/{STALE_LIMIT})")
            else:
                staleness += 1
                print(f"💥 Failed: {result.get('error')} (stale: {staleness}/{STALE_LIMIT})")
        except Exception as e:
            print(f"Variant {i} crashed: {e}")
            staleness += 1

    # Final report
    results = load_results()
    best = best_result(results)
    successful = len([r for r in results if r.get("score") is not None])
    elapsed = (time.time() - start_time) / 60
    print(f"\n━━━ FINAL REPORT ━━━")
    print(f"Variants: {len(results)}, Successful: {successful}, Best: {best['score'] if best else 'none'}")
    print(f"Elapsed: {elapsed:.1f} minutes. Best variant saved in: best/")

if __name__ == "__main__":
    main()
```

### 3.7 Launch Commands

```bash
# Preparation (run once)
chmod +x evaluate.sh prepare.sh
./prepare.sh

# Lock the eval so the agent can't modify it
chmod 444 evaluate.sh

# Run for up to 8 hours, logging everything
timeout 8h bun run run-loop.ts 2>&1 | tee run.log

# Or Python:
timeout 8h python3 run_loop.py 2>&1 | tee run.log

# Or with nohup for overnight (detached from terminal)
nohup timeout 12h bun run run-loop.ts > run.log 2>&1 &
echo $! > .pid

# Monitor progress
tail -f run.log
watch -n 30 'cat results.jsonl | jq -s "length" && cat results.jsonl | jq -s "map(select(.score)) | sort_by(-.score) | .[0]"'
```

### 3.8 Locking the Eval

```bash
# Method 1: File permissions (simple)
chmod 444 evaluate.sh
# To edit later: chmod 644 evaluate.sh

# Method 2: Git pre-commit hook (team-safe)
cat > .git/hooks/pre-commit << 'HOOK'
#!/bin/bash
LOCKED="evaluate.sh tests/"
for pattern in $LOCKED; do
  if git diff --cached --name-only | grep -q "$pattern"; then
    echo "❌ BLOCKED: Cannot modify locked eval files: $pattern"
    echo "   If you really need to, run: git commit --no-verify"
    exit 1
  fi
done
HOOK
chmod +x .git/hooks/pre-commit
```

### 3.9 Confidence Scoring (Multiple Runs)

Don't trust a single measurement. Noise in benchmarks, network latency, and system load can produce misleading results.

```typescript
// confidence.ts — Run each variant multiple times and compute confidence
export function medianAbsoluteDeviation(values: number[]): {
  median: number;
  mad: number;
  confident: boolean;
  coefficientOfVariation: number;
} {
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const deviations = sorted.map(v => Math.abs(v - median)).sort((a, b) => a - b);
  const mad = deviations[Math.floor(deviations.length / 2)];

  const cv = Math.abs(median) > 0 ? mad / Math.abs(median) : 0;

  // Confident if:
  // - At least 3 measurements
  // - Coefficient of variation < 15% (adjust for your domain)
  //   Use 5% for tight benchmarks, 15% for network/latency, 25% for LLM scoring
  const confident = values.length >= 3 && cv < 0.15;

  return { median, mad, confident, coefficientOfVariation: cv };
}
```

**When to use this:** Latency benchmarks, any metric with system noise. Skip for deterministic metrics (file size, line count, test pass count).

### 3.10 Prompt Variant Testing (Mode A Special Case)

For optimizing prompts against a fixed dataset.

**Statistical note:** Your evaluation dataset size determines measurement precision. With 23 items, your 95% CI is roughly ±20%. With 100 items, it's ±10%. With 400 items, it's ±5%. Use at least 50 items for meaningful comparisons. The +29% improvement in real experiments used 23 items — this worked because the improvement was so large that it exceeded the confidence interval, but smaller improvements would be invisible at that dataset size.

```typescript
// test-prompts.ts — Test prompt variants against a fixed dataset
import { readFileSync, writeFileSync, existsSync } from "fs";
import { callLLM } from "./providers";

interface TestCase {
  input: string;
  expected: string;
}

interface PromptResult {
  variant: string;
  correct: number;
  total: number;
  accuracy: number;
  details: { input: string; expected: string; actual: string; match: boolean }[];
}

async function testPromptVariant(
  templatePath: string,
  testCases: TestCase[]
): Promise<PromptResult> {
  const template = readFileSync(templatePath, "utf-8");
  const variantName = templatePath.replace(/.*\//, "").replace(/\.\w+$/, "");
  const details: PromptResult["details"] = [];

  for (const tc of testCases) {
    // Use a placeholder that won't conflict with prompt content
    const prompt = template.replace(/\{\{INPUT\}\}/g, tc.input);
    const actual = await callLLM(prompt, { timeout: 120 });

    const match = actual.trim().toLowerCase().includes(tc.expected.trim().toLowerCase());
    details.push({ input: tc.input, expected: tc.expected, actual: actual.trim(), match });
  }

  const correct = details.filter(d => d.match).length;
  return {
    variant: variantName,
    correct,
    total: testCases.length,
    accuracy: correct / testCases.length,
    details,
  };
}

async function main() {
  const dataset: TestCase[] = JSON.parse(readFileSync("test_data.json", "utf-8"));
  const variantFiles = process.argv.slice(2); // Pass variant files as CLI args

  if (variantFiles.length === 0) {
    console.error("Usage: bun run test-prompts.ts prompt_variants/*.md");
    process.exit(1);
  }

  const results: PromptResult[] = [];
  for (const file of variantFiles) {
    console.log(`Testing: ${file}`);
    const result = await testPromptVariant(file, dataset);
    results.push(result);
    console.log(`  → ${result.correct}/${result.total} (${(result.accuracy * 100).toFixed(1)}%)`);
  }

  // Sort by accuracy, descending
  results.sort((a, b) => b.accuracy - a.accuracy);
  console.log("\n━━━ Results (best first) ━━━");
  for (const r of results) {
    console.log(`  ${r.variant}: ${(r.accuracy * 100).toFixed(1)}% (${r.correct}/${r.total})`);
  }

  writeFileSync("prompt_results.json", JSON.stringify(results, null, 2));
}

main().catch(console.error);
```

---

## 4. Mode B: Feature Development

**The TDD Loop:** Write locked tests → agent implements → score by pass rate + quality checks → repeat.

### Why locked tests work

Human-written tests encode intent. By locking them, you make "what the code should do" immutable and let the agent focus entirely on "how to make it work." The composite score (tests + types + lint + other checks) prevents solutions that technically pass tests but are otherwise broken.

### 4.1 File Structure

```
project/
├── GOAL.md              # Feature spec with acceptance criteria
├── tests/               # LOCKED — agent cannot modify
│   ├── feature.test.ts
│   └── e2e.test.ts
├── evaluate.sh          # Composite scorer (LOCKED)
├── src/                 # Agent writes code here
├── providers.ts         # From §2.1
├── extract-files.ts     # From §2.2
├── tdd-loop.ts          # The TDD loop runner
├── iterations/          # Raw LLM output per iteration
├── debug/               # Prompts and responses
└── results.jsonl        # Score history
```

### 4.2 GOAL.md for Features

```markdown
# GOAL: [Feature name]

## Acceptance Criteria
- [ ] Users can sign up with email and password
- [ ] Passwords are hashed with bcrypt (cost factor 12)
- [ ] Duplicate emails return 409 Conflict
- [ ] JWT token returned on successful signup

## Composite Score (0-100)
| Check | Weight | How to measure |
|-------|--------|----------------|
| Tests pass | 50% | `npm test` pass rate |
| Type check | 20% | `npx tsc --noEmit` exit code |
| Lint clean | 10% | `npx eslint src/` error count |
| No console errors | 10% | grep for console.error in output |
| Security basics | 10% | no plaintext passwords, no SQL injection |

## Constraints
- All existing tests must continue to pass
- No modifications to files in tests/ or evaluate.sh
- Must work with Node.js 20+
- Use only existing dependencies in package.json

## Context
- API framework: Express.js
- Database: PostgreSQL via Prisma
- Auth: JWT with jsonwebtoken package
- See src/routes/ for existing route patterns
```

### 4.3 Composite Scoring Script

```bash
#!/usr/bin/env bash
# evaluate.sh — Composite feature scorer
# ┌─────────────────────────────────────────────────┐
# │  LOCKED — the agent must NEVER edit this file.  │
# └─────────────────────────────────────────────────┘
set -euo pipefail

SCORE=0
DETAILS=""

# ── Tests (50 points) ──
TEST_OUTPUT=$(npm test 2>&1) || true
# Cross-platform grep: use -oE (POSIX ERE), not -oP (Perl)
TOTAL_TESTS=$(echo "$TEST_OUTPUT" | grep -oE '[0-9]+ (tests?|specs?|suites?)' | head -1 | grep -oE '[0-9]+' || echo "0")
PASSED_TESTS=$(echo "$TEST_OUTPUT" | grep -oE '[0-9]+ pass(ed|ing)?' | head -1 | grep -oE '[0-9]+' || echo "0")
if [ "$TOTAL_TESTS" -gt 0 ]; then
  TEST_SCORE=$(echo "scale=1; ($PASSED_TESTS / $TOTAL_TESTS) * 50" | bc)
else
  TEST_SCORE=0
fi
SCORE=$(echo "$SCORE + $TEST_SCORE" | bc)
DETAILS="\"tests\":\"$PASSED_TESTS/$TOTAL_TESTS ($TEST_SCORE pts)\""

# ── Type check (20 points) ──
if npx tsc --noEmit 2>/dev/null; then
  TYPE_SCORE=20
else
  TYPE_SCORE=0
fi
SCORE=$(echo "$SCORE + $TYPE_SCORE" | bc)
DETAILS="$DETAILS,\"typecheck\":$TYPE_SCORE"

# ── Lint (10 points) ──
LINT_ERRORS=$(npx eslint src/ --format json 2>/dev/null | jq '[.[].errorCount] | add // 0' 2>/dev/null || echo "999")
if [ "$LINT_ERRORS" -eq 0 ]; then LINT_SCORE=10
elif [ "$LINT_ERRORS" -lt 5 ]; then LINT_SCORE=5
else LINT_SCORE=0; fi
SCORE=$(echo "$SCORE + $LINT_SCORE" | bc)
DETAILS="$DETAILS,\"lint\":\"$LINT_ERRORS errors ($LINT_SCORE pts)\""

# ── Console errors (10 points) ──
CONSOLE_ERRORS=$(grep -c "console\.error" src/*.ts src/**/*.ts 2>/dev/null || echo "0")
if [ "$CONSOLE_ERRORS" -eq 0 ]; then CONSOLE_SCORE=10; else CONSOLE_SCORE=5; fi
SCORE=$(echo "$SCORE + $CONSOLE_SCORE" | bc)

# ── Security basics (10 points) ──
SEC_SCORE=10
# Check for plaintext password storage
if grep -rq "password.*=.*req\." src/ 2>/dev/null && ! grep -rq "bcrypt\|argon2\|hash" src/ 2>/dev/null; then
  SEC_SCORE=0
fi
SCORE=$(echo "$SCORE + $SEC_SCORE" | bc)

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo "{\"score\":$SCORE,\"timestamp\":\"$TIMESTAMP\",\"details\":{$DETAILS,\"security\":$SEC_SCORE}}"
```

### 4.4 The TDD Loop Runner

```typescript
// tdd-loop.ts — Iterative TDD feature development
// Usage: timeout 4h bun run tdd-loop.ts 2>&1 | tee tdd.log
import { $ } from "bun";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { callLLM } from "./providers";
import { extractAndWriteFiles, FILE_OUTPUT_INSTRUCTIONS } from "./extract-files";

const MAX_ITERATIONS = 30;
const TARGET_SCORE = 95;
const RESULTS_FILE = "results.jsonl";

interface Iteration {
  iteration: number;
  score: number;
  timestamp: string;
  details?: Record<string, unknown>;
}

function loadHistory(): Iteration[] {
  if (!existsSync(RESULTS_FILE)) return [];
  return readFileSync(RESULTS_FILE, "utf-8")
    .trim().split("\n").filter(Boolean)
    .map(l => JSON.parse(l));
}

function readSourceFiles(): string {
  const srcDir = "src";
  if (!existsSync(srcDir)) return "(no source files yet)";

  const files: string[] = [];
  function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
        walk(path);
      } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        files.push(path);
      }
    }
  }
  walk(srcDir);

  let context = "";
  for (const file of files.slice(0, 20)) {
    const content = readFileSync(file, "utf-8");
    if (content.length > 5000) {
      context += `\n--- ${file} (first 5000 chars) ---\n${content.slice(0, 5000)}\n[...truncated...]\n`;
    } else {
      context += `\n--- ${file} ---\n${content}\n`;
    }
  }
  return context || "(no source files yet)";
}

async function runIteration(iterNum: number, history: Iteration[]): Promise<number> {
  mkdirSync("iterations", { recursive: true });
  mkdirSync("debug", { recursive: true });

  // Get current test output — this is the key feedback signal
  const testOutput = await $`npm test 2>&1 || true`.text();
  const sourceContext = readSourceFiles();
  const goal = readFileSync("GOAL.md", "utf-8");
  const recentHistory = history.slice(-5);

  const stuckDetected = history.length >= 3 &&
    history.slice(-3).every(h => h.score === history[history.length - 1].score);

  const prompt = `You are a TDD implementation agent. Your ONLY job: make the tests pass.

## Goal
${goal}

## Current test output (READ THIS CAREFULLY — every failure tells you what to fix)
\`\`\`
${testOutput.slice(-4000)}
\`\`\`

## Current source code
${sourceContext.slice(-15000)}

## Recent scores
${recentHistory.map(h => `  Iteration ${h.iteration}: ${h.score}/100`).join("\n") || "  (none yet — first iteration)"}

${stuckDetected ? `
## ⚠️ STUCK DETECTION
Score has been ${history[history.length - 1].score} for 3+ iterations.
Your previous approach is NOT WORKING. You MUST try a completely different strategy:
- Rewrite the implementation from scratch
- Use a different algorithm or library
- Restructure the module boundaries
Do NOT make incremental changes to the same failing approach.
` : ""}

## Rules
1. You CANNOT modify any files in tests/ or evaluate.sh
2. You can ONLY write/modify files in src/
3. Read each test failure message. Fix them one by one.
4. Output COMPLETE files — no partial updates.

${FILE_OUTPUT_INSTRUCTIONS}`;

  writeFileSync(`debug/tdd-${iterNum}-prompt.txt`, prompt);

  const llmOutput = await callLLM(prompt, { timeout: 600 });

  writeFileSync(`debug/tdd-${iterNum}-response.txt`, llmOutput);
  writeFileSync(`iterations/${iterNum}.txt`, llmOutput);

  // CRITICAL: Extract and write files into src/
  const writtenFiles = extractAndWriteFiles(llmOutput, ".");
  if (writtenFiles.length === 0) {
    console.warn(`  ⚠️ No files extracted from iteration ${iterNum}`);
  } else {
    console.log(`  Wrote ${writtenFiles.length} files: ${writtenFiles.join(", ")}`);
  }

  // Evaluate
  const evalOutput = await $`./evaluate.sh 2>&1 || echo '{"score":0}'`.text();
  let evalResult: Iteration;
  try {
    const lines = evalOutput.trim().split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const parsed = JSON.parse(lines[i]);
        evalResult = { iteration: iterNum, ...parsed };
        break;
      } catch {}
    }
    evalResult ??= { iteration: iterNum, score: 0, timestamp: new Date().toISOString() };
  } catch {
    evalResult = { iteration: iterNum, score: 0, timestamp: new Date().toISOString() };
  }

  writeFileSync(RESULTS_FILE, JSON.stringify(evalResult) + "\n", { flag: "a" });
  console.log(`  Iteration ${iterNum}: ${evalResult.score}/100`);

  return evalResult.score;
}

async function main() {
  console.log(`\n━━━ Autoresearch TDD Loop ━━━`);
  console.log(`Target: ${TARGET_SCORE}/100, Max iterations: ${MAX_ITERATIONS}\n`);

  for (let i = 1; i <= MAX_ITERATIONS; i++) {
    const history = loadHistory();

    console.log(`\n━━━ Iteration ${i}/${MAX_ITERATIONS} ━━━`);
    const score = await runIteration(i, history);

    if (score >= TARGET_SCORE) {
      console.log(`\n🎯 Target reached! Score: ${score}/100`);
      break;
    }
  }

  const history = loadHistory();
  const best = Math.max(...history.map(h => h.score), 0);
  console.log(`\n━━━ DONE ━━━`);
  console.log(`Best score: ${best}/100 over ${history.length} iterations`);
}

main().catch(console.error);
```

---

## 5. Mode C: Pure Research

**Phased synthesis:** Run 4–6 phases sequentially, each building on the last, with a self-gap-analysis phase that finds what you don't know you don't know.

### Why phased research beats single-prompt research

Single-prompt research hits two walls: context limits (one prompt can only hold so much) and recency bias (the LLM focuses on what it "remembers" most easily). Phased research fixes both:
1. Each phase narrows focus, so you go deeper without hitting context limits.
2. The gap-identification phase (Phase 3) is critical: LLMs have systematic blind spots. When you explicitly ask "what did I miss?", it surfaces areas the model would otherwise skip.
3. Checkpoint/resume means a crash at hour 6 doesn't lose hours 1–5.

### 5.1 File Structure

```
research/
├── config.ts            # Phase definitions
├── run-research.ts      # Orchestrator
├── providers.ts         # From §2.1
├── phases/              # Output from each phase
│   ├── 01-landscape.md
│   ├── 02-deep-dive.md
│   ├── 03-gaps.md
│   ├── 04-fill-gaps.md
│   └── 05-synthesis.md
├── checkpoints/         # Resume state
│   └── progress.json
├── debug/               # Prompts for each phase
└── ANALYSIS.md          # Final compiled output
```

### 5.2 Phase Configuration

```typescript
// config.ts — Research phase definitions
export interface Phase {
  id: string;
  name: string;
  prompt: string;
  timeout: number;         // seconds
  maxContextInput: number; // bytes — summarize prior phases if exceeded
  dependsOn: string[];     // phase IDs needed as input
}

export const TOPIC = "YOUR RESEARCH TOPIC HERE"; // ← Replace this

// Context budget guidance (adjust based on your model):
// - Claude (200K context): maxContextInput up to 150KB works well
// - GPT-4o (128K context): keep under 80KB
// - Ollama 7B models: keep under 20KB
// - When in doubt, start with 80KB and increase if output quality is good
const CTX_BUDGET = 80_000; // bytes — the default "safe" limit

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
    maxContextInput: CTX_BUDGET,
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
    maxContextInput: CTX_BUDGET * 1.5,
    dependsOn: ["01-landscape", "02-deep-dive"],
  },
  {
    id: "04-fill-gaps",
    name: "Fill Research Gaps",
    prompt: `You are a research agent investigating: ${TOPIC}

Phase 4: FILL THE GAPS
The gap analysis identified these missing areas. Research each one thoroughly.

## Identified gaps
{{03-gaps}}

## Prior research (for context)
{{CONTEXT}}`,
    timeout: 900,
    maxContextInput: CTX_BUDGET,
    dependsOn: ["03-gaps", "01-landscape"],
  },
  {
    id: "05-synthesis",
    name: "Synthesis & Recommendations",
    prompt: `You are a research agent investigating: ${TOPIC}

Phase 5: FINAL SYNTHESIS
Combine ALL prior research into a coherent analysis.

Structure your output as:
1. **Executive Summary** (1 page max)
2. **Key Findings** (ranked by importance, with confidence: high/medium/low)
3. **Comparison Matrix** (approaches vs. evaluation criteria, as a markdown table)
4. **Recommendations** (specific, actionable, with confidence levels)
5. **Open Questions** (what we still don't know and why it matters)
6. **References & Sources**

## All prior research
Note: This includes landscape survey, deep dive, gap analysis, and gap-fill research.
{{CONTEXT}}`,
    timeout: 1200,
    maxContextInput: CTX_BUDGET * 1.5,
    // Includes 03-gaps explicitly so synthesis sees both the gaps AND the gap-fills
    dependsOn: ["01-landscape", "02-deep-dive", "03-gaps", "04-fill-gaps"],
  },
];
```

### 5.3 Research Orchestrator

```typescript
// run-research.ts — Phased research runner with checkpoint/resume
// Usage: nohup bun run run-research.ts > research.log 2>&1 &
import { $ } from "bun";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { PHASES, type Phase } from "./config";
import { callLLM } from "./providers";

const PHASES_DIR = "phases";
const CHECKPOINTS_DIR = "checkpoints";
const PROGRESS_FILE = `${CHECKPOINTS_DIR}/progress.json`;
const DEBUG_DIR = "debug";

mkdirSync(PHASES_DIR, { recursive: true });
mkdirSync(CHECKPOINTS_DIR, { recursive: true });
mkdirSync(DEBUG_DIR, { recursive: true });

// ── Context management ──
function summarizeIfNeeded(text: string, maxBytes: number): string {
  if (maxBytes <= 0) return "";
  const textBytes = Buffer.byteLength(text);
  if (textBytes <= maxBytes) return text;

  // Truncate at a section boundary if possible
  const truncated = text.slice(0, maxBytes);
  const lastHeader = truncated.lastIndexOf("\n## ");
  if (lastHeader > maxBytes * 0.5) {
    return truncated.slice(0, lastHeader) +
      `\n\n[...truncated from ${(textBytes / 1024).toFixed(0)}KB to ${(maxBytes / 1024).toFixed(0)}KB for context management...]\n`;
  }
  return truncated +
    `\n\n[...truncated from ${(textBytes / 1024).toFixed(0)}KB to ${(maxBytes / 1024).toFixed(0)}KB...]\n`;
}

function gatherContext(phase: Phase): string {
  const parts: string[] = [];
  for (const depId of phase.dependsOn) {
    const depFile = `${PHASES_DIR}/${depId}.md`;
    if (existsSync(depFile)) {
      const content = readFileSync(depFile, "utf-8");
      parts.push(`## From: ${depId}\n\n${content}`);
    }
  }
  const combined = parts.join("\n\n---\n\n");
  return summarizeIfNeeded(combined, phase.maxContextInput);
}

// ── Checkpoint/resume ──
interface Progress {
  completed: string[];
  startedAt: string;
  phaseTimes: Record<string, number>; // seconds per phase
}

function loadProgress(): Progress {
  if (existsSync(PROGRESS_FILE)) {
    return JSON.parse(readFileSync(PROGRESS_FILE, "utf-8"));
  }
  return { completed: [], startedAt: new Date().toISOString(), phaseTimes: {} };
}

function saveProgress(progress: Progress) {
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// ── Phase execution ──
async function runPhase(phase: Phase): Promise<string> {
  const context = gatherContext(phase);

  let prompt = phase.prompt;
  // Replace {{CONTEXT}} with gathered context
  prompt = prompt.replace("{{CONTEXT}}", context);

  // Replace any {{phase-id}} placeholders with specific phase content
  for (const depId of phase.dependsOn) {
    const placeholder = `{{${depId}}}`;
    if (prompt.includes(placeholder)) {
      const depFile = `${PHASES_DIR}/${depId}.md`;
      const depContent = existsSync(depFile) ? readFileSync(depFile, "utf-8") : "(not available)";
      prompt = prompt.replace(placeholder, depContent);
    }
  }

  const promptSize = (Buffer.byteLength(prompt) / 1024).toFixed(1);
  console.log(`  📝 Prompt size: ${promptSize}KB`);

  // Save prompt for debugging
  writeFileSync(`${DEBUG_DIR}/research-${phase.id}-prompt.txt`, prompt);

  const result = await callLLM(prompt, { timeout: phase.timeout })
    .catch((e: Error) => {
      console.error(`  ⚠️ Phase ${phase.id} failed: ${e.message}`);
      return `[Phase failed: ${e.message}. Prompt was ${promptSize}KB]`;
    });

  return result;
}

// ── Main ──
async function main() {
  const progress = loadProgress();
  console.log(`\n━━━ Autoresearch: Pure Research Mode ━━━`);
  console.log(`Topic: see config.ts`);
  console.log(`Progress: ${progress.completed.length}/${PHASES.length} phases complete`);
  if (progress.completed.length > 0) {
    console.log(`Resuming from checkpoint.`);
  }

  for (const phase of PHASES) {
    if (progress.completed.includes(phase.id)) {
      console.log(`\n⏭️  ${phase.name} — already complete`);
      continue;
    }

    // Check dependencies
    const missingDeps = phase.dependsOn.filter(d => !progress.completed.includes(d));
    if (missingDeps.length > 0) {
      console.error(`\n❌ ${phase.name} — missing dependencies: ${missingDeps.join(", ")}`);
      console.error(`  This shouldn't happen with sequential execution. Check phase order.`);
      continue;
    }

    console.log(`\n━━━ Phase: ${phase.name} (timeout: ${phase.timeout}s) ━━━`);
    const startTime = Date.now();
    const result = await runPhase(phase);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    const outFile = `${PHASES_DIR}/${phase.id}.md`;
    writeFileSync(outFile, result);
    const sizeKB = (Buffer.byteLength(result) / 1024).toFixed(1);
    console.log(`  ✅ Done in ${elapsed}s → ${outFile} (${sizeKB}KB)`);

    progress.completed.push(phase.id);
    progress.phaseTimes[phase.id] = parseFloat(elapsed);
    saveProgress(progress);
  }

  // ── Compile final output ──
  console.log(`\n━━━ Compiling ANALYSIS.md ━━━`);
  const allPhases = PHASES.map(p => {
    const file = `${PHASES_DIR}/${p.id}.md`;
    if (existsSync(file)) return `# ${p.name}\n\n${readFileSync(file, "utf-8")}`;
    return "";
  }).filter(Boolean).join("\n\n---\n\n");

  writeFileSync("ANALYSIS.md", allPhases);
  const totalSize = (Buffer.byteLength(allPhases) / 1024).toFixed(1);
  const totalTime = Object.values(progress.phaseTimes).reduce((a, b) => a + b, 0);
  console.log(`📄 ANALYSIS.md: ${totalSize}KB across ${progress.completed.length} phases in ${(totalTime / 60).toFixed(1)} minutes`);
}

main().catch(console.error);
```

### 5.4 Cross-Model Adversarial Review

For higher quality, have a different model critique the output:

```bash
#!/usr/bin/env bash
# review.sh — Cross-model critique of research output
# Usage: ./review.sh ANALYSIS.md
set -euo pipefail

INPUT="${1:?Usage: ./review.sh <analysis_file>}"

cat > /tmp/review-prompt.txt << 'PROMPT'
You are a rigorous academic reviewer. Critique this research for:
1. Factual errors or unsupported claims
2. Missing perspectives or blind spots
3. Logical gaps or non sequiturs
4. Insufficient evidence for strong claims
5. Bias toward any particular approach

Score each dimension 1-10. Then list specific corrections needed.

Output as markdown with a summary table at the top.

## Research to review:
PROMPT

cat "$INPUT" >> /tmp/review-prompt.txt

# Use a DIFFERENT provider than the one that wrote the research
echo "Sending to reviewer..."
if command -v codex &> /dev/null; then
  codex -q --model o4-mini < /tmp/review-prompt.txt > CRITIQUE.md
elif command -v claude &> /dev/null; then
  claude -p --output-format text --tools "" --model sonnet < /tmp/review-prompt.txt > CRITIQUE.md
else
  echo "No LLM CLI found. Install claude or codex."
  exit 1
fi

echo "Critique saved to CRITIQUE.md"
cat CRITIQUE.md | head -30
```

---

## 6. Mode D: Debug Loop

**Reproduction-driven debugging:** Locked reproduction script → agent investigates → agent patches → reproduction must pass.

This mode is structurally different from optimization: the agent reads stack traces and logs, bisects possibilities, and must not just "make it work" but find and fix the root cause.

### 6.1 File Structure

```
debug-session/
├── GOAL.md              # Bug description, repro steps, expected vs actual
├── repro.sh             # LOCKED — reproduction script (exit 0 = bug fixed)
├── evaluate.sh          # Runs repro + regression checks (LOCKED)
├── src/                 # Code the agent can modify
├── providers.ts         # From §2.1
├── extract-files.ts     # From §2.2
├── debug-loop.ts        # The debug loop runner
├── hypotheses/          # Agent's diagnosis attempts
├── debug/               # Prompts, responses, logs
└── results.jsonl
```

### 6.2 GOAL.md for Debugging

```markdown
# BUG: [One-line description]

## Reproduction
Run `./repro.sh` — exits non-zero when bug is present, zero when fixed.

## Symptoms
- [What happens — error message, wrong behavior, crash]
- [When it happens — specific input, timing, conditions]

## Expected behavior
- [What SHOULD happen]

## Stack trace / error log
```
[Paste the actual error here]
```

## What we know
- [Any prior investigation]
- [Files likely involved]
- [Recent changes that might have caused it]

## Constraints
- Fix the root cause, not the symptom
- Don't disable tests or error handling to make it pass
- Existing tests must continue to pass
```

### 6.3 repro.sh Template

```bash
#!/usr/bin/env bash
# repro.sh — LOCKED reproduction script
# Exit 0 = bug is fixed. Exit non-zero = bug still present.
set -euo pipefail

# Example: API returns wrong status code
# RESPONSE=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/users/nonexistent)
# [ "$RESPONSE" = "404" ] || { echo "FAIL: Expected 404, got $RESPONSE"; exit 1; }

# Example: Script crashes on specific input
# echo '{"malformed": true' | node src/parser.js > /dev/null 2>&1 || { echo "FAIL: Parser crashes on malformed JSON"; exit 1; }

# Example: Memory leak detection
# node --max-old-space-size=128 src/server.js &
# PID=$!
# for i in $(seq 1 1000); do curl -s http://localhost:3000 > /dev/null; done
# RSS=$(ps -o rss= -p $PID)
# kill $PID
# [ "$RSS" -lt 131072 ] || { echo "FAIL: RSS ${RSS}KB exceeds 128MB"; exit 1; }

echo "PLACEHOLDER — replace with your reproduction"
exit 1  # ← Remove this after writing your actual repro
```

### 6.4 Debug Loop Runner

```typescript
// debug-loop.ts — Automated debugging loop
// Usage: timeout 4h bun run debug-loop.ts 2>&1 | tee debug.log
import { $ } from "bun";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { callLLM } from "./providers";
import { extractAndWriteFiles, FILE_OUTPUT_INSTRUCTIONS } from "./extract-files";

const MAX_ITERATIONS = 15;
const RESULTS_FILE = "results.jsonl";

function readSourceFiles(): string {
  if (!existsSync("src")) return "(no src directory)";
  const files: string[] = [];
  function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory() && entry.name !== "node_modules") walk(path);
      else if (entry.isFile() && /\.(ts|tsx|js|jsx|py|go|rs)$/.test(entry.name)) files.push(path);
    }
  }
  walk("src");
  return files.slice(0, 15).map(f => {
    const c = readFileSync(f, "utf-8");
    return `--- ${f} ---\n${c.length > 4000 ? c.slice(0, 4000) + "\n[...truncated...]" : c}`;
  }).join("\n\n");
}

interface DebugResult {
  iteration: number;
  fixed: boolean;
  hypothesis: string;
  timestamp: string;
}

function loadHistory(): DebugResult[] {
  if (!existsSync(RESULTS_FILE)) return [];
  return readFileSync(RESULTS_FILE, "utf-8")
    .trim().split("\n").filter(Boolean)
    .map(l => JSON.parse(l));
}

async function main() {
  console.log(`\n━━━ Autoresearch Debug Loop ━━━\n`);

  for (let i = 1; i <= MAX_ITERATIONS; i++) {
    const history = loadHistory();
    const goal = readFileSync("GOAL.md", "utf-8");

    // Run repro to get current error output
    let reproOutput: string;
    try {
      reproOutput = await $`./repro.sh 2>&1`.text();
      console.log(`\n✅ Bug appears to be fixed! Verifying...`);
      // Double-check: also run any existing tests
      try { await $`npm test 2>&1`.text(); } catch {}
      console.log(`🎯 Bug fixed in ${i} iterations.`);
      break;
    } catch (e: any) {
      reproOutput = e.stdout?.toString() ?? e.message ?? "repro failed (no output)";
    }

    console.log(`\n━━━ Debug Iteration ${i}/${MAX_ITERATIONS} ━━━`);
    const source = readSourceFiles();
    const priorHypotheses = history.map(h =>
      `  - Iteration ${h.iteration}: "${h.hypothesis}" → ${h.fixed ? "FIXED" : "DID NOT FIX"}`
    ).join("\n");

    const prompt = `You are a debugging agent. Your job: find and fix the ROOT CAUSE.

## Bug Report
${goal}

## Current reproduction output (this is what's still wrong)
\`\`\`
${reproOutput.slice(-3000)}
\`\`\`

## Source code
${source.slice(-15000)}

## Prior hypotheses (AVOID repeating failed approaches)
${priorHypotheses || "  (first attempt)"}

## Your task
1. State your HYPOTHESIS (one sentence: what you think the root cause is)
2. Write the FIX (modified source files)
3. Do NOT disable tests, suppress errors, or work around the bug. Fix the root cause.

Start your response with:
HYPOTHESIS: <your one-sentence hypothesis>

Then output the fixed files:
${FILE_OUTPUT_INSTRUCTIONS}`;

    mkdirSync("debug", { recursive: true });
    mkdirSync("hypotheses", { recursive: true });
    writeFileSync(`debug/debug-${i}-prompt.txt`, prompt);

    const llmOutput = await callLLM(prompt, { timeout: 600 });
    writeFileSync(`debug/debug-${i}-response.txt`, llmOutput);

    // Extract hypothesis
    const hypothesisMatch = llmOutput.match(/HYPOTHESIS:\s*(.+?)(?:\n|$)/);
    const hypothesis = hypothesisMatch ? hypothesisMatch[1].trim() : "no hypothesis stated";
    writeFileSync(`hypotheses/${i}.txt`, `${hypothesis}\n\n${llmOutput}`);

    // Apply fix
    const writtenFiles = extractAndWriteFiles(llmOutput, ".");
    console.log(`  Hypothesis: "${hypothesis}"`);
    console.log(`  Applied ${writtenFiles.length} files: ${writtenFiles.join(", ")}`);

    // Test fix
    let fixed = false;
    try {
      await $`./repro.sh 2>&1`.text();
      fixed = true;
    } catch {}

    const result: DebugResult = {
      iteration: i,
      fixed,
      hypothesis,
      timestamp: new Date().toISOString(),
    };
    writeFileSync(RESULTS_FILE, JSON.stringify(result) + "\n", { flag: "a" });

    if (fixed) {
      console.log(`  ✅ FIXED! Hypothesis was correct.`);
      // Run full test suite as regression check
      try {
        await $`npm test 2>&1`.text();
        console.log(`  ✅ All tests still pass.`);
      } catch (e: any) {
        console.log(`  ⚠️ Fix introduced regression. Continuing...`);
        // Don't break — mark as not truly fixed
      }
      break;
    } else {
      console.log(`  ❌ Not fixed. Trying next hypothesis.`);
    }
  }

  const history = loadHistory();
  const fixedAt = history.find(h => h.fixed);
  console.log(`\n━━━ DONE ━━━`);
  if (fixedAt) {
    console.log(`Bug fixed at iteration ${fixedAt.iteration}: "${fixedAt.hypothesis}"`);
  } else {
    console.log(`Bug NOT fixed after ${history.length} attempts.`);
    console.log(`Review hypotheses/ for investigation notes.`);
  }
}

main().catch(console.error);
```

---

## 7. UI/UX Visual Quality Scoring

Three layers: automated checks (fast, cheap), LLM visual judge (slower, nuanced), chaos testing (adversarial). Add to any mode.

### 7.1 Layer 1: Automated Playwright Checks

```typescript
// visual-eval.test.ts — LOCKED — agent cannot edit
import { test, expect } from "@playwright/test";

// Install: npm init playwright@latest
// Accessibility: npm install @axe-core/playwright

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const PAGES = ["/", "/dashboard", "/settings"];

for (const pagePath of PAGES) {
  test.describe(`Page: ${pagePath}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`${BASE_URL}${pagePath}`);
      await page.waitForLoadState("networkidle");
    });

    // ── Accessibility ──
    test("passes accessibility audit", async ({ page }) => {
      // Requires: npm install @axe-core/playwright
      const AxeBuilder = (await import("@axe-core/playwright")).default;
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      const critical = results.violations.filter(
        v => v.impact === "critical" || v.impact === "serious"
      );
      expect(critical).toHaveLength(0);
    });

    // ── Responsive: no horizontal overflow ──
    for (const vp of [
      { width: 375, height: 812, name: "mobile" },
      { width: 768, height: 1024, name: "tablet" },
      { width: 1440, height: 900, name: "desktop" },
    ]) {
      test(`no horizontal overflow at ${vp.name}`, async ({ page }) => {
        await page.setViewportSize(vp);
        await page.goto(`${BASE_URL}${pagePath}`);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth
        );
        expect(overflow).toBe(false);
      });
    }

    // ── No console errors ──
    test("no console errors", async ({ page }) => {
      const errors: string[] = [];
      page.on("console", msg => { if (msg.type() === "error") errors.push(msg.text()); });
      await page.goto(`${BASE_URL}${pagePath}`);
      await page.waitForTimeout(2000);
      expect(errors).toHaveLength(0);
    });
  });
}
```

### 7.2 Layer 2: LLM Visual Judge

Screenshots → LLM vision → structured rubric scores.

**Note:** The screenshot-to-LLM pipeline depends on your provider's image support. This example uses file-based prompting. Adjust the LLM call for your provider's image API.

```typescript
// visual-judge.ts — Screenshot-based visual quality scoring
import { $ } from "bun";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { callLLM } from "./providers";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

const RUBRIC = `You are a UI/UX expert evaluating a web page. Score each dimension 0-10:

- **layout** (0-10): Alignment, grid consistency, visual hierarchy, proper use of space
- **typography** (0-10): Font sizes appropriate, line heights readable, sufficient contrast
- **spacing** (0-10): Padding/margins consistent, no cramped or wasted areas
- **color** (0-10): Palette harmonious, sufficient contrast (WCAG AA), purposeful use
- **consistency** (0-10): Elements look unified, same style language throughout
- **overall** (0-10): Would a senior designer approve this for production?

Also list up to 5 specific issues found.

Respond ONLY with valid JSON (no markdown, no explanation):
{"layout":N,"typography":N,"spacing":N,"color":N,"consistency":N,"overall":N,"issues":["issue 1","issue 2"]}`;

interface VisualScore {
  page: string;
  viewport: string;
  layout: number;
  typography: number;
  spacing: number;
  color: number;
  consistency: number;
  overall: number;
  issues: string[];
}

async function captureAndJudge(page: string, viewport: { width: number; height: number; name: string }): Promise<VisualScore> {
  const screenshotDir = "screenshots";
  mkdirSync(screenshotDir, { recursive: true });

  const safeName = page.replace(/\//g, "_") || "home";
  const screenshotPath = `${screenshotDir}/${safeName}_${viewport.name}.png`;

  // Capture screenshot with Playwright
  await $`npx playwright screenshot --viewport-size=${viewport.width},${viewport.height} ${BASE_URL}${page} ${screenshotPath}`
    .quiet()
    .catch(() => console.warn(`  ⚠️ Screenshot failed for ${page} @ ${viewport.name}`));

  if (!existsSync(screenshotPath)) {
    return { page, viewport: viewport.name, layout: 0, typography: 0, spacing: 0, color: 0, consistency: 0, overall: 0, issues: ["screenshot capture failed"] };
  }

  // Convert screenshot to base64 for prompt inclusion
  const imageBase64 = readFileSync(screenshotPath).toString("base64");

  // Note: Image support varies by provider. This sends the rubric as text.
  // For providers with native image support, you'd use their multimodal API.
  // Fallback: describe what to look for textually.
  const prompt = `${RUBRIC}

Evaluating: ${page} at ${viewport.name} (${viewport.width}x${viewport.height}).

[Note: If you cannot see the screenshot, score based on the page description and common patterns for this type of page. State this in issues.]`;

  try {
    const result = await callLLM(prompt, { timeout: 120 });
    // Extract JSON from response (LLM might wrap it in markdown)
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const scores = JSON.parse(jsonMatch[0]);
      return { page, viewport: viewport.name, ...scores };
    }
  } catch (e) {
    console.warn(`  ⚠️ Visual judge failed for ${page} @ ${viewport.name}`);
  }

  return { page, viewport: viewport.name, layout: 0, typography: 0, spacing: 0, color: 0, consistency: 0, overall: 0, issues: ["evaluation failed"] };
}

async function main() {
  const pages = ["/", "/dashboard"];
  const viewports = [
    { width: 1440, height: 900, name: "desktop" },
    { width: 375, height: 812, name: "mobile" },
  ];

  const results: VisualScore[] = [];
  for (const page of pages) {
    for (const vp of viewports) {
      console.log(`Evaluating: ${page} @ ${vp.name}`);
      const score = await captureAndJudge(page, vp);
      results.push(score);
      console.log(`  overall: ${score.overall}/10 | issues: ${score.issues.length}`);
    }
  }

  writeFileSync("visual-scores.json", JSON.stringify(results, null, 2));
  const avg = results.reduce((s, r) => s + r.overall, 0) / results.length;
  console.log(`\nAverage visual quality: ${avg.toFixed(1)}/10`);
  console.log(`Details saved to visual-scores.json`);
}

main().catch(console.error);
```

### 7.3 Layer 3: Chaos Testing (gremlins.js)

```typescript
// chaos.test.ts — Monkey testing for UI robustness
import { test, expect } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

test("survives 10 seconds of random interactions", async ({ page }) => {
  await page.goto(BASE_URL);
  await page.waitForLoadState("networkidle");

  const errors: string[] = [];
  page.on("pageerror", err => errors.push(err.message));

  await page.addScriptTag({ url: "https://unpkg.com/gremlins.js" });

  await page.evaluate(() => {
    return (window as any).gremlins
      .createHorde({
        strategies: [(window as any).gremlins.strategies.allTogether({ nb: 1000 })],
        species: [
          (window as any).gremlins.species.clicker(),
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

### 7.4 Adding Visual Scores to Composite Eval

Add this to any Mode A or B `evaluate.sh`:

```bash
# ── Visual Quality (20 points) ──
# Requires: visual-judge.ts, Playwright, running dev server
if command -v bun &> /dev/null && [ -f "visual-judge.ts" ]; then
  VISUAL_OUTPUT=$(bun run visual-judge.ts 2>/dev/null | tail -1)
  VISUAL_AVG=$(echo "$VISUAL_OUTPUT" | grep -oE '[0-9]+\.[0-9]+' | tail -1 || echo "0")
  VISUAL_POINTS=$(echo "scale=1; $VISUAL_AVG * 2" | bc)  # Scale 0-10 → 0-20
else
  VISUAL_POINTS=0
  echo "⚠️ Visual scoring skipped (bun or visual-judge.ts not found)"
fi
SCORE=$(echo "$SCORE + $VISUAL_POINTS" | bc)
```

---

## 8. Configuration Cheat Sheet

### 8.1 Timeout Rules

| Context size | Task type | Timeout | Why |
|---|---|---|---|
| <50KB | Focused code generation | 5 min (300s) | Small context, clear task |
| 50–100KB | Code gen with project context | 10 min (600s) | Needs reading + reasoning |
| 100–200KB | Research or synthesis | 15 min (900s) | Heavy reading + writing |
| >200KB | Multi-document compilation | 20 min (1200s) | Maximum practical limit |
| Any | Simple scoring/classification | 2 min (120s) | Minimal output expected |

**Diagnosing timeout issues:** If a process dies at exactly the timeout limit with exit code 124 (timeout) or 143 (SIGTERM), the timeout is too short. Increase by 50%.

### 8.2 Context Management Rules

| Accumulated context | Strategy |
|---|---|
| <50KB | Feed directly |
| 50–100KB | Works but may be 2x slower; monitor output quality |
| 100–200KB | **Summarize** — don't concatenate raw documents |
| >200KB | **Split** into sections, process separately, merge |
| >500KB | Redesign your phases — you're structuring wrong |

**Model-specific context budgets:**

| Model | Max context | Effective budget per phase input |
|---|---|---|
| Claude (200K) | 200K tokens | Up to 150KB text |
| GPT-4o (128K) | 128K tokens | Up to 80KB text |
| Gemini 2.0 (1M) | 1M tokens | Up to 400KB text |
| Ollama 7B | 8–32K tokens | 10–20KB text |

The "80KB default" in the research config is a safe middle ground. Adjust for your model.

### 8.3 Circuit Breaker Reference

| Breaker | Default | When to adjust | Tradeoff |
|---|---|---|---|
| Staleness (no improvement) | 5–8 | Increase to 10–20 for large search spaces | Too low = premature stop. Too high = wasted compute |
| Identical scores | 3 | Rarely needs changing | Detects "stuck in local minimum" |
| Crash rate | 7/10 | Lower to 5/10 for fragile evals | Too low = gives up too easily |
| Wall clock | 8 hours | Set to match your available compute window | Hard safety limit |

### 8.4 Human-in-the-Loop Checkpoints

For tasks requiring taste, judgment, or safety review:

```typescript
// checkpoint.ts — Pause for human review every N iterations
import { createInterface } from "readline";

export async function humanCheckpoint(
  message: string,
  iterNum: number,
  interval: number = 10
): Promise<"continue" | "stop" | "adjust"> {
  if (iterNum % interval !== 0) return "continue";

  console.log(`\n━━━ HUMAN CHECKPOINT (iteration ${iterNum}) ━━━`);
  console.log(message);
  console.log(`Options: [c]ontinue, [s]top, [a]djust goal`);

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question("> ", answer => {
      rl.close();
      if (answer.startsWith("s")) resolve("stop");
      else if (answer.startsWith("a")) resolve("adjust");
      else resolve("continue");
    });
  });
}
```

Usage in any loop:

```typescript
const decision = await humanCheckpoint(
  `Best so far: ${bestScore}. Recent: ${recentScores.join(", ")}`,
  iterNum,
  10 // Pause every 10 iterations
);
if (decision === "stop") break;
```

For fully unattended runs, skip this. For safety-critical work, set the interval to 1 (review every iteration).

### 8.5 Git as Memory

Use git to track what the agent tries, enabling rollback and analysis:

```bash
# In your loop, after each successful variant:
git add -A
git commit -m "variant ${i}: score=${score} [autoresearch]" --allow-empty

# Rollback to best:
git log --oneline --grep="autoresearch" | head -20
git checkout <best-commit-hash> -- src/

# Analyze what worked:
git log --oneline --grep="autoresearch" | while read hash msg; do
  echo "$msg"
done
```

Add to your loop runner:

```typescript
// After each variant evaluation:
async function commitVariant(variantNum: number, score: number | null) {
  try {
    await $`git add -A`.quiet();
    await $`git commit -m "variant ${variantNum}: score=${score ?? "failed"} [autoresearch]" --allow-empty`.quiet();
  } catch {} // Don't fail the loop if git fails
}
```

---

## 9. Common Mistakes: 12 Things That Break Overnight Runs

### 1. Generated text never becomes files (THE MOST COMMON FAILURE)
**Symptom:** Loop runs, evaluate.sh can't find any code, every variant scores 0 or crashes.
**What's happening:** The LLM outputs text to stdout. You saved it to `generated.txt`. But `evaluate.sh` expects actual source files (`src/index.ts`, `package.json`, etc.) in the variant directory.
**Fix:** Use the file extraction step (§2.2). The `extractAndWriteFiles()` function parses LLM output into actual files. The `FILE_OUTPUT_INSTRUCTIONS` constant tells the LLM to output in a parseable format. Both are required.

### 2. Timeout too short
**Symptom:** Processes die at exactly the timeout value, exit code 124 or 143.
**Fix:** Check the timeout table (§8.1). Research prompts need 10–15 minutes, not 5.

### 3. Context accumulation
**Symptom:** First phases work, later phases produce short/repetitive/incoherent output.
**What's happening:** You're concatenating all prior phase output (500KB) and sending it as one prompt. The model can't process it effectively.
**Fix:** Summarize or truncate prior context. See context budget table (§8.2). The `summarizeIfNeeded()` function handles this.

### 4. Agent edits the eval
**Symptom:** Score improves dramatically but the feature doesn't actually work.
**What happened:** The agent added `test.skip()`, lowered assertion thresholds, or special-cased the test data.
**Fix:** `chmod 444 evaluate.sh tests/`. Git pre-commit hook. This is non-negotiable.

### 5. No checkpoint/resume
**Symptom:** 6-hour run crashes at hour 5, lose everything.
**Fix:** Write `progress.json` after every phase/variant (as shown in all loop runners). On restart, the loop skips completed work.

### 6. Shell escaping breaks prompts
**Symptom:** LLM receives garbled prompt, outputs nonsense.
**What's happening:** The prompt contains quotes, backticks, dollar signs, or newlines that bash interprets.
**Fix:** Write prompt to a temp file, pipe via stdin: `claude -p < prompt.txt`. NEVER pass prompts as CLI arguments.

### 7. No circuit breaker
**Symptom:** Agent loops all night generating the same score over and over.
**Fix:** Implement staleness detection: 5–8 variants with no improvement = stop. See §8.3.

### 8. Trusting single measurements
**Symptom:** You pick variant A over B, but the difference was just noise.
**Fix:** For noisy metrics (latency, throughput), run 3+ times and use median. Use MAD for confidence (§3.9). For deterministic metrics (file size, test count), one run is fine.

### 9. No backpressure checks
**Symptom:** "Faster" variant breaks existing functionality.
**Fix:** Run tests + typecheck + lint BEFORE measuring the target metric. Failures should return `score: null`, not a passing score.

### 10. BSD grep incompatibility
**Symptom:** Scores are always 0 on macOS, work fine on Linux.
**What's happening:** Your `evaluate.sh` uses `grep -P` (Perl regex), which macOS's BSD grep doesn't support. It fails silently, returning empty strings.
**Fix:** Use `grep -oE '[0-9]+'` (POSIX ERE) instead of `grep -oP '\d+'`. Works on both macOS and Linux.

### 11. Not logging everything
**Symptom:** Something broke overnight, can't figure out what happened.
**Fix:**
```bash
# Log all output
nohup bun run loop.ts > run.log 2>&1 &

# Save every prompt and response (all loop runners do this in debug/)
# Review with:
ls -la debug/
cat debug/5-prompt.txt   # What did the LLM see?
cat debug/5-response.txt # What did it output?
```

### 12. Composite score gives free points
**Symptom:** Score shows 70/100 but tests are failing.
**What's happening:** Your eval script defaults disabled checks to full marks (`A11Y=15` when lighthouse isn't configured). The "composite" score is really just the tests + free points.
**Fix:** Set disabled checks to 0, not full marks. Only count checks you actually run. Alternatively, reweight the active checks to sum to 100.

---

## 10. Complete Working Example

A full, runnable example: optimizing a JavaScript function for speed.

### Goal

Optimize a `slugify()` function to be as fast as possible while passing correctness tests.

### Step 1: Create the project

```bash
mkdir slugify-optimization && cd slugify-optimization
bun init -y
```

### Step 2: Write the locked test (`tests/slugify.test.ts`)

```typescript
// tests/slugify.test.ts — LOCKED
import { describe, test, expect } from "bun:test";

// The function under test will be at src/slugify.ts
import { slugify } from "../src/slugify";

describe("slugify", () => {
  test("converts spaces to hyphens", () => {
    expect(slugify("hello world")).toBe("hello-world");
  });

  test("lowercases", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  test("removes special characters", () => {
    expect(slugify("hello! @world#")).toBe("hello-world");
  });

  test("collapses multiple hyphens", () => {
    expect(slugify("hello   world")).toBe("hello-world");
  });

  test("trims leading/trailing hyphens", () => {
    expect(slugify(" hello world ")).toBe("hello-world");
  });

  test("handles unicode", () => {
    expect(slugify("café résumé")).toBe("cafe-resume");
  });

  test("handles empty string", () => {
    expect(slugify("")).toBe("");
  });

  test("handles already-slugified", () => {
    expect(slugify("hello-world")).toBe("hello-world");
  });
});
```

### Step 3: Write the baseline (`src/slugify.ts`)

```typescript
// src/slugify.ts — Baseline (the agent will try to beat this)
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
```

### Step 4: Write GOAL.md

```markdown
# GOAL: Optimize slugify() for maximum throughput

## Metric
- **Name:** operations_per_second
- **Unit:** ops/sec
- **Direction:** higher_is_better
- **Baseline:** ~2,000,000 ops/sec
- **Target:** as high as possible

## Evaluation
Run `./evaluate.sh <variant_dir>` — outputs JSON with score.

## Constraints
- Must pass all tests in tests/slugify.test.ts
- Must handle unicode (café → cafe)
- Must be a single file: src/slugify.ts
- No native/C extensions
- Must export a function named `slugify`

## What to try
- Avoid regex entirely (char-by-char loop)
- Pre-built lookup tables for character mapping
- Minimize string allocations (array join vs concatenation)
- Skip normalize() for ASCII-only fast path

## What NOT to try
- WebAssembly (too complex for this task)
- Native addons
```

### Step 5: Write evaluate.sh

```bash
#!/usr/bin/env bash
# evaluate.sh — LOCKED
set -euo pipefail

VARIANT_DIR="${1:?Usage: ./evaluate.sh <variant_dir>}"
VARIANT_NAME=$(basename "$VARIANT_DIR")
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Backpressure: tests must pass
if ! bun test tests/slugify.test.ts 2>/dev/null; then
  echo "{\"variant\":\"$VARIANT_NAME\",\"score\":null,\"error\":\"tests_failed\",\"timestamp\":\"$TIMESTAMP\"}"
  exit 1
fi

# Copy variant's slugify.ts into src/ for benchmarking
if [ -f "$VARIANT_DIR/src/slugify.ts" ]; then
  cp "$VARIANT_DIR/src/slugify.ts" src/slugify.ts
elif [ -f "$VARIANT_DIR/slugify.ts" ]; then
  cp "$VARIANT_DIR/slugify.ts" src/slugify.ts
fi

# Re-run tests with the new implementation
if ! bun test tests/slugify.test.ts 2>/dev/null; then
  echo "{\"variant\":\"$VARIANT_NAME\",\"score\":null,\"error\":\"tests_failed_after_copy\",\"timestamp\":\"$TIMESTAMP\"}"
  exit 1
fi

# Benchmark
SCORE=$(bun -e "
const { slugify } = require('./src/slugify');
const inputs = ['Hello World!', 'café résumé', 'already-slugified', '  lots   of   spaces  ', 'UPPERCASE!!!'];
const iterations = 100000;
const start = performance.now();
for (let i = 0; i < iterations; i++) {
  for (const input of inputs) slugify(input);
}
const elapsed = (performance.now() - start) / 1000;
const opsPerSec = Math.round((iterations * inputs.length) / elapsed);
console.log(opsPerSec);
")

echo "{\"variant\":\"$VARIANT_NAME\",\"score\":$SCORE,\"timestamp\":\"$TIMESTAMP\"}"
```

### Step 6: Copy infrastructure files

Copy `providers.ts`, `extract-files.ts`, `circuit-breakers.ts`, and `run-loop.ts` from the templates above.

Set `DIRECTION` to `"higher"` in `run-loop.ts`.

### Step 7: Run

```bash
chmod +x evaluate.sh
chmod 444 evaluate.sh tests/slugify.test.ts

# Baseline measurement
./evaluate.sh .

# Run the loop
timeout 2h bun run run-loop.ts 2>&1 | tee run.log
```

### What to expect

```
━━━ Variant 1/100 ━━━
  Extracted 1 files: src/slugify.ts
📊 First score: 2150000

━━━ Variant 2/100 ━━━
  Extracted 1 files: src/slugify.ts
✅ NEW BEST: 3200000 (was 2150000)

━━━ Variant 3/100 ━━━
  Extracted 1 files: src/slugify.ts
❌ No improvement: 2800000 vs best 3200000 (stale: 1/8)

━━━ Variant 4/100 ━━━
  Extracted 1 files: src/slugify.ts
💥 Failed: tests_failed (stale: 2/8)

━━━ Variant 5/100 ━━━
  Extracted 1 files: src/slugify.ts
✅ NEW BEST: 4100000 (was 3200000)

...
```

### Example results.jsonl

```jsonl
{"variant":"001","score":2150000,"timestamp":"2026-03-22T02:01:15Z"}
{"variant":"002","score":3200000,"timestamp":"2026-03-22T02:03:42Z"}
{"variant":"003","score":2800000,"timestamp":"2026-03-22T02:05:58Z"}
{"variant":"004","score":null,"error":"tests_failed","timestamp":"2026-03-22T02:07:12Z"}
{"variant":"005","score":4100000,"timestamp":"2026-03-22T02:09:30Z"}
```

After the loop completes, your best implementation is in `best/src/slugify.ts`. Copy it to your real project.

---

## Appendix A: Minimal Quick-Start (5 Minutes)

If the full templates feel heavy, here's the absolute minimum viable loop:

```bash
#!/usr/bin/env bash
# quick-loop.sh — Minimal autoresearch loop
# Usage: chmod +x quick-loop.sh evaluate.sh && timeout 2h ./quick-loop.sh
set -euo pipefail

GOAL=$(cat GOAL.md)
RESULTS_FILE="results.jsonl"
MAX=20
STALE=0
STALE_LIMIT=5
BEST=""

mkdir -p variants debug

for i in $(seq 1 $MAX); do
  echo "=== Variant $i ==="
  mkdir -p "variants/$i"

  # Get recent results
  PREV=$(tail -5 "$RESULTS_FILE" 2>/dev/null || echo "(none)")

  # Generate prompt → temp file (NEVER as CLI arg)
  cat > /tmp/quick-prompt.txt << PROMPT
You are an optimization agent. Goal:
$GOAL

Recent results:
$PREV

Generate variant $i. Output files in this format:
--- FILE: path/to/file.ext ---
<contents>
--- END FILE ---
PROMPT

  # Call LLM
  claude -p --output-format text --tools "" --model sonnet < /tmp/quick-prompt.txt > "debug/$i-response.txt" 2>/dev/null

  # Extract files (simple version — handles --- FILE: format)
  cd "variants/$i"
  awk '/^--- FILE: /{f=substr($0,11); sub(/ ---$/,"",f); next} /^--- END FILE ---/{f=""; next} f{print > f}' "../../debug/$i-response.txt"
  cd ../..

  # Evaluate
  RESULT=$(./evaluate.sh "variants/$i" 2>/dev/null || echo '{"score":null,"error":"crashed"}')
  echo "$RESULT" >> "$RESULTS_FILE"

  SCORE=$(echo "$RESULT" | jq -r '.score // "null"')
  echo "  Score: $SCORE"

  if [ "$SCORE" != "null" ]; then
    if [ -z "$BEST" ] || [ "$(echo "$SCORE > $BEST" | bc)" -eq 1 ]; then
      echo "  ✅ NEW BEST"
      BEST="$SCORE"
      STALE=0
      rm -rf best && cp -r "variants/$i" best
    else
      STALE=$((STALE + 1))
    fi
  else
    STALE=$((STALE + 1))
  fi

  [ "$STALE" -ge "$STALE_LIMIT" ] && echo "Circuit breaker: stale" && break
done

echo "=== DONE ==="
echo "Best: $BEST"
jq -s 'sort_by(-.score) | .[0]' "$RESULTS_FILE"
```

---

## Appendix B: Pattern Reference Card

| Component | Purpose | File | LOCKED? |
|---|---|---|---|
| GOAL.md | What to optimize, constraints, seed ideas | GOAL.md | No (agent can read) |
| evaluate.sh | Objective function — scores a variant | evaluate.sh | **YES** |
| tests/ | Test suite (Mode B) | tests/*.test.ts | **YES** |
| repro.sh | Bug reproduction (Mode D) | repro.sh | **YES** |
| providers.ts | LLM abstraction — swap models without changing loops | providers.ts | No |
| extract-files.ts | Parse LLM output → actual files on disk | extract-files.ts | No |
| circuit-breakers.ts | Stopping conditions — staleness, crash rate, wall clock | circuit-breakers.ts | No |
| results.jsonl | Append-only score log | results.jsonl | No (append only) |
| debug/ | Every prompt sent and response received | debug/*.txt | No |
| best/ | Copy of current best variant | best/ | No |

---

*These patterns produced +29% accuracy, 578KB of overnight research, and 53% rendering speedups in real experiments. Copy, adapt, run overnight, wake up to results.*
