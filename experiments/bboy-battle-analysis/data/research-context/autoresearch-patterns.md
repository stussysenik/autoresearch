# Autoresearch Patterns — Web Research Summary (2026-03-22)

## Karpathy's Autoresearch (github.com/karpathy/autoresearch)
- 630-line Python, 3 files: program.md (instructions), prepare.py (frozen eval), train.py (agent-editable)
- Agent modifies train.py → runs 5-min experiment → checks if val_bpb improved → keeps/reverts via git → repeats
- ~12 experiments/hour, ~100 overnight
- 110-126 improvements in ~12 hours
- Shopify CEO ran it on templating engine: 53% faster rendering from 93 automated commits
- Key insight: entire codebase fits in LLM context window — eliminates partial-understanding bugs

## pi-autoresearch (github.com/davebcn87/pi-autoresearch)
- Generalizes loop to any measurable metric (test speed, bundle size, Lighthouse scores, build times)
- Adds persistent sessions (.jsonl + .md + .sh files survive context resets)
- Live dashboard for monitoring
- Confidence scoring: Median Absolute Deviation after 3+ runs to distinguish real gains from noise
- Backpressure checks: tests, types, lint must all pass before accepting improvement

## ARIS — Auto-Research-In-Sleep (github.com/wanshuiyin/Auto-claude-code-research-in-sleep)
- Chains: idea discovery → experiment execution → paper writing (overnight pipeline)
- Cross-model adversarial review: Claude writes, GPT-5.4 critiques (single-model self-review converges to local minima)
- All state is Markdown files — crash-recoverable, no database
- Real result: papers scored 7-8/10 ("clear accept") at AAAI 2026
- Anti-hallucination: DBLP/CrossRef BibTeX fetching for citations

## Claude Autoresearch Skill (github.com/uditgoenka/autoresearch)
- Claude Code skill with 8-phase loop (Review Context → Decide → Change → Commit → Verify → Evaluate → Keep/Revert → Log)
- 8 sub-commands including :debug, :fix, :security, :predict
- Uses git as memory — experiments persist across context resets
- Key rule: one change per iteration, mechanical verification only

## Ralph (github.com/frankbria/ralph-claude-code)
- Solves hard engineering: dual-condition exit detection (heuristic + explicit signal)
- Circuit breakers: 3 no-progress loops OR 5 identical errors → cooldown
- Three-layer rate limit detection (timeout guard, JSON parsing, text fallback)
- Learned: timeout exit codes (124) get misidentified as API limits

## GOAL.md (github.com/jmilinovich/goal-md)
- Generalizes Karpathy loop to features via composite 0-100 scores
- Weighted components: tests passing (40%), typecheck (20%), lighthouse (20%), bundle size (10%), lint (10%)
- "Dual scoring" prevents agents from gaming metrics
- Real examples: React docs quality, Playwright tests, REST API coverage, web service performance

## YOLO Mode Pattern
- Simplest: `while :; do cat prompt.md | claude -p --dangerously-skip-permissions; done`
- Two simultaneous loops exhaust Max plan rate limits in under an hour
- Expect to discard ~25% of overnight changes
- Simple prompts (3-5 sentences) work better than detailed ones

## Key Cross-Cutting Lessons
- Tests ARE the fitness function — a test suite IS a metric
- Lock the eval — agent cannot edit tests or scoring
- Git as memory — commit improvements, revert regressions, survives context resets
- One change per iteration — clear signal, easy rollback
- Circuit breakers prevent infinite loops
- State as Markdown — crash-recoverable, human-readable, git-friendly
- 25% of overnight changes should be discarded — review in the morning

## Sources
- github.com/karpathy/autoresearch (30k+ stars)
- github.com/davebcn87/pi-autoresearch
- github.com/wanshuiyin/Auto-claude-code-research-in-sleep
- github.com/uditgoenka/autoresearch
- github.com/frankbria/ralph-claude-code
- github.com/jmilinovich/goal-md
- paddo.dev/blog/autoresearch-ecosystem/
- mfyz.com/claude-code-on-loop-autonomous-ai-coding/
- lesswrong.com (SAE autonomous research post)
- fortune.com/2026/03/17/andrej-karpathy-loop (The Karpathy Loop)
