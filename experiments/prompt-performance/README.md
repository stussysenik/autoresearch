# Prompt Performance Analyzer

Scores every substantive Claude Code prompt across 10 dimensions using heuristic analysis (no LLM API calls — fast, free, deterministic).

## Pipeline

```
bun run fetch    # Phase 1: Read ~/.claude/history.jsonl + enrich with session data
bun run score    # Phase 2: Score all prompts across 10 dimensions
bun run analyze  # Phase 3: Generate ANALYSIS.md report
bun run all      # Run all three phases
```

## Scoring Dimensions

| # | Dimension | Weight |
|---|-----------|--------|
| 1 | Specificity | 20% |
| 2 | Action Density | 15% |
| 3 | Context Loading | 15% |
| 4 | Iteration Pattern | 10% |
| 5 | Compound Efficiency | 10% |
| 6 | Tool Leverage | 10% |
| 7 | Outcome Signal | 10% |
| 8 | Temporal Pattern | info |
| 9 | Project Pattern | info |
| 10 | Anti-patterns | deduction |

## Output

- `data/input.json` — Enriched prompt dataset
- `data/results.json` — All scored prompts
- `ANALYSIS.md` — The deliverable report
