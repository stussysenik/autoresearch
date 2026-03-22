# Playbook Review: Gaps, Errors, and Confusions

## 1. Missing Patterns

**A. No Mode for "Fix/Debug" loops**
The three modes cover optimize, build, and research — but one of the most common autonomous tasks is "find and fix bugs." A debug loop is structurally different: you need reproduction steps as the locked eval, bisection logic, and the agent needs to read stack traces + logs rather than generate from scratch. This is arguably more common than pure research.

**B. No multi-file refactoring pattern**
Mode B assumes you're building something new. Large-scale refactors (rename a concept across 50 files, migrate from one ORM to another, upgrade a major dependency) need a different pattern: AST-aware diffing, incremental migration with "both old and new work" checkpoints, and rollback strategies. The playbook has no guidance here.

**C. No data pipeline / ETL pattern**
Metric optimization assumes a single score. Data pipelines need evaluation across multiple stages: extraction correctness, transformation accuracy, load verification, and end-to-end latency. A composite eval that checks each stage independently would be a natural Mode A variant but isn't shown.

**D. No adversarial/security testing loop**
Fuzzing, penetration testing, and security audits are natural autonomous loop candidates. Generate attack vectors → test → classify findings → repeat. Missing entirely.

**E. No "human-in-the-loop" checkpoint pattern**
All three modes are fully autonomous. There's no pattern for "run 10 variants, then pause for human review before continuing." For tasks involving taste, judgment, or safety, you'd want a hybrid mode that batches work and waits.

---

## 2. Missing Practical Details

**A. No setup/prerequisites section**
The playbook assumes you have `bun`, `claude` CLI, `codex` CLI, `jq`, `bc`, `npx`, `playwright`, and possibly `ollama` installed. Someone copy-pasting this cold will hit `command not found` within 30 seconds. Need a prerequisites block:
```
Required: bun (>=1.0), jq, bc
Optional: claude CLI (authenticated), codex CLI, ollama
```

**B. `generateVariant` doesn't actually write files into the variant directory**
This is a critical bug. The Mode A loop calls `claude -p` which outputs text to stdout, saves it to `generated.txt`, but never parses that output into actual source files. The `evaluate.sh` then tries to run `npm test --prefix "$VARIANT_DIR"` against a directory that contains only `generated.txt`. The loop will fail on every single variant. You need either:
- An extraction step that parses the LLM output into files
- Or `claude -p` with tools enabled so it writes files directly (but the playbook explicitly disables tools with `--tools ""`)

This is the single biggest "it won't actually run" problem in the entire playbook.

**C. Mode B's `runIteration` has the same problem**
The TDD loop writes LLM output to `iterations/${iterNum}.txt` but never applies it to `src/`. The evaluate script runs `npm test` against unchanged source. Every iteration will get the same score. The "stuck detection" will fire on iteration 3 every time.

**D. `evaluate.sh` grep patterns are Linux-only**
`grep -oP '\d+'` uses Perl regex (`-P`), which doesn't work on macOS's BSD grep. Since the CLAUDE.md shows this is a macOS environment, and many developers use macOS, this will silently fail. Use `grep -oE '[0-9]+'` instead, or note the GNU grep dependency.

**E. No `prepare.sh` template or explanation**
The file structure lists `prepare.sh` but the playbook never shows what goes in it or when it runs. Is the loop supposed to call it? Does the user run it once? It's a ghost file.

**F. The `--image` flag for Claude CLI is unverified**
```bash
claude -p --output-format text --tools "" --model sonnet "${prompt}" --image ${screenshotPath}
```
The Claude CLI's image support syntax may not work this way. The visual judge section would fail silently if the flag is wrong. This needs verification or a fallback using base64 encoding.

**G. No `package.json` or project initialization**
Every TypeScript file imports from `"bun"` and uses `$` shell syntax. Someone copy-pasting needs to know to run `bun init` first, and that this is Bun-specific (won't work with Node.js/tsx without changes).

---

## 3. Confusing Sections

**A. Mode A's "variant" concept is ambiguous**
The loop generates "variants" as numbered directories, but it's unclear what a variant IS for different project types. For prompt optimization, a variant is a prompt file. For code optimization, it's... a whole project? A single file? A diff? The template says "Write all necessary files into that directory" but never shows what the LLM actually outputs or how those files relate to the project being optimized.

**B. `direction` is hardcoded but GOAL.md has a field for it**
```typescript
const direction: "higher" | "lower" = "lower"; // ← Set from GOAL.md
```
The comment says "Set from GOAL.md" but the code hardcodes `"lower"`. Should parse it from GOAL.md or at least make it a clear constant at the top. Someone will miss this and optimize in the wrong direction.

**C. Mode C phase dependencies skip `03-gaps` in the synthesis**
Phase 05's `dependsOn` is `["01-landscape", "02-deep-dive", "04-fill-gaps"]` — it skips `03-gaps`. This means the synthesis never sees the gap analysis directly. Maybe intentional (the gaps are addressed in 04), but it's confusing and should be explicit about why.

**D. "Prompt Variant Testing" (§2.6) is a bash script but everything else is TypeScript**
This creates a cognitive mismatch. The reader has to switch mental models. Worse, the bash approach has a critical problem: it processes items sequentially with no parallelism, no resume capability, and no error handling per-item. It's also vulnerable to shell injection via `$INPUT` being `sed`-substituted directly.

**E. Composite scoring weights don't match between GOAL.md and evaluate.sh**
GOAL.md template says tests=40%, types=20%, lint=10%, a11y=15%, bundle=15%. But the evaluate.sh defaults `A11Y=15` and `SIZE_SCORE=15` (full marks) when disabled, meaning the "composite score" is really just tests+types+lint+30 free points. Someone using this template will see inflated scores and think their code is better than it is.

**F. The quick-start in Appendix A doesn't use the loop runner**
It's a raw bash for-loop that passes the prompt as a CLI argument (contradicting §7.5 "never pass as CLI arg"). The quick-start violates its own playbook's advice.

---

## 4. Wrong Advice

**A. "Even 23 items works!" for evaluation datasets**
The prompt testing section casually mentions 23 items as sufficient. For accuracy measurements, 23 items gives you ±20% confidence intervals at 95% CI. You'd need ~100+ items for the ±10% precision needed to distinguish prompt variants. The +29% improvement claim is plausible only if the baseline was very low. This needs a caveat about statistical power.

**B. Staleness limit of 5 is too low for some domains**
Five consecutive non-improvements is aggressive. In many optimization landscapes, you need 10-20 random attempts to escape a local minimum. The playbook should note this is tunable and explain the tradeoff: too low = premature stopping, too high = wasted compute.

**C. "80KB Rule" lacks nuance**
The claim that truncating to 80KB "saved our overnight research run" is a data point, not a rule. Different models have different effective context windows. Claude with 200K context can handle much more than 80KB; Ollama running a 7B model might struggle at 20KB. The rule should be model-dependent.

**D. MAD confidence threshold of 5% is arbitrary**
```typescript
const confident = values.length >= 3 && (mad / Math.abs(median)) < 0.05;
```
5% MAD-to-median ratio is very strict for most real-world measurements. Benchmarks often have 10-20% variance due to system noise. This will almost never report "confident" for latency measurements.

**E. Cost estimate circuit breaker references API tokens but every example uses CLI tools**
The CLI tools (claude -p, codex -q) don't expose token counts. The cost circuit breaker is unimplementable as described unless you switch to direct API calls. Either show how to estimate cost from CLI usage or remove this circuit breaker.

---

## 5. Missing the "Why"

**A. No explanation of WHY the Karpathy Loop works**
The playbook says "Generate variant → measure → keep if better → repeat" but never explains the key insight: by decoupling generation from evaluation, you turn a creative problem into a search problem. The "why" matters because it tells you when the pattern DOESN'T apply (when you can't write a good eval).

**B. No explanation of WHY locked evals matter beyond "Goodhart's Law"**
The one-liner about Goodhart's Law is correct but insufficient. Real failure modes include:
- Agent adds `test.skip()` to failing tests
- Agent modifies assertion thresholds
- Agent adds special-case handling that detects the eval dataset
These concrete examples would convince skeptics more than an abstract reference.

**C. No explanation of WHY phased research beats single-prompt research**
Mode C just presents the phases. It should explain: single-prompt research hits context limits and recency bias. Phased research lets you narrow focus progressively, and the gap-identification phase (03) is critical because LLMs have systematic blind spots that only emerge when you explicitly ask "what did I miss?"

**D. No discussion of WHEN autonomous loops are worse than interactive work**
Appendix B is too short. Key missing cases:
- When the eval function is expensive (>$1/run, or >5 min) — loops become cost-prohibitive
- When the search space is tiny (only 3 possible approaches) — just try them manually
- When you need to learn from the process, not just get the result

---

## 6. Copy-Paste Readiness

**A. An LLM receiving this playbook doesn't know what to do first**
The playbook is a reference manual, not a prompt. If you paste this into ChatGPT and say "run this," it'll ask clarifying questions. What's needed: a meta-prompt at the top that says "When given a task, classify it using the decision tree, then follow the corresponding mode step by step."

**B. File paths are inconsistent**
Mode A uses `variants/001/`, Mode B uses `src/`, Mode C uses `phases/`. The loop runners reference these paths but the prompts to the LLM don't always make clear where files should go. An LLM generating code won't know the expected directory structure unless told explicitly.

**C. No error recovery instructions for the LLM**
When `evaluate.sh` returns `{"score":null,"error":"tests_failed"}`, what should the LLM do differently on the next iteration? The prompt says "try something DIFFERENT" but doesn't tell the LLM to read the error output. Mode B does this better (feeds test output back), but Mode A doesn't.

**D. The GOAL.md "What to try" / "What NOT to try" sections need examples per domain**
Empty brackets `[Seed ideas]` won't help someone who doesn't know what seed ideas look like for their domain. Need 2-3 concrete examples for common use cases (web perf, prompt eng, API optimization).

---

## 7. Missing Examples

**A. No complete working example from start to finish**
The playbook has templates but no example you can clone and run. A single concrete example — say, optimizing a CSS bundle size — showing GOAL.md filled out, evaluate.sh with a real measurement, and 3-4 variant results would make the abstract templates concrete.

**B. No example of what LLM output looks like and how it becomes files**
This is the biggest pedagogical gap. The loop sends a prompt to the LLM and gets text back. What does that text look like? How does `generated.txt` become runnable code? There's a missing `extractAndWriteFiles()` step that would need to parse markdown code blocks or file delimiters.

**C. No example of results.jsonl with real data**
Showing 5-10 lines of actual results.jsonl output would make the format concrete and help people debug their own eval scripts.

**D. No example of a failed run and how to diagnose it**
Section 7 lists common mistakes but doesn't show what the symptoms look like in logs. "Context accumulation" — what does "garbage output" actually look like? Show a real log snippet.

---

## 8. Platform Coverage

**A. Python is mentioned nowhere in code**
The intro says "any LLM" and the cheat sheet shows curl commands, but every code template is Bun/TypeScript. Python users (arguably the largest audience for ML/research tasks) get nothing. Need at least one Mode A loop runner in Python, or a note saying "translate the TypeScript to your language — the pattern is what matters."

**B. No Windows support**
`chmod`, `nohup`, `timeout`, bash scripts, `/tmp/` paths — none of this works on Windows without WSL. Either note "requires Unix/macOS" upfront or provide PowerShell equivalents.

**C. No Docker/containerization option**
For reproducible overnight runs, a Dockerfile that bundles bun + claude CLI + the loop runner would be valuable. It also solves the "agent escapes its sandbox" problem by limiting filesystem access.

**D. No CI/CD integration example**
Running these loops in GitHub Actions / GitLab CI is a natural use case (nightly optimization runs). The playbook doesn't show how to set this up, store results across runs, or manage secrets for LLM API keys.

**E. `$` shell template tag is Bun-specific**
Every TypeScript example uses `import { $ } from "bun"` which doesn't exist in Node.js. The playbook should either note this prominently or provide a Node.js-compatible alternative (e.g., `execa` or `child_process`).

---

## Summary: Top 5 Blockers (Fix These First)

| # | Issue | Severity |
|---|---|---|
| 1 | **Generated variants never become actual files** — the loop produces `generated.txt` but `evaluate.sh` expects a runnable project. The core loop is broken. | Critical |
| 2 | **No prerequisites/setup section** — first-time users will fail at `command not found` | High |
| 3 | **BSD grep incompatibility** — `grep -P` fails silently on macOS, producing wrong scores | High |
| 4 | **No meta-prompt for LLM consumption** — pasting this into an LLM doesn't make it actionable | High |
| 5 | **Python/Node users get nothing** — Bun-only templates exclude the majority of the audience | Medium |
