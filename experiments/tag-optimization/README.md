# Tag Optimization

Ablation study testing 4 prompt variants for AI-generated tag quality on content cards. Winner: **Platform-Aware** at 9.3/10 (+33% vs baseline).

## Quick Start

```bash
bun install
bun run experiment   # runs fetch -> run -> analyze in one command
```

Requires a Supabase instance with a `cards` table. Copy `.env.example` to `.env` and fill in credentials.

To analyze existing results without fetching:
```bash
bun run analyze      # reads data/results.json, writes ANALYSIS.md
```

## Results

| Variant | Quality | Vibe Coverage | Avg Tags | Rank |
|---------|---------|---------------|----------|------|
| A (Baseline) | 7.0/10 | 60% | 3.8 | 4th |
| B (Lexical) | 8.1/10 | 80% | 4.1 | 3rd |
| C (Chain-of-Thought) | 8.5/10 | 85% | 4.3 | 2nd |
| **D (Platform-Aware)** | **9.3/10** | **95%** | **4.2** | **1st** |

## File Structure

```
tag-optimization/
  src/
    variants.ts          # 4 prompt variant definitions + fillTemplate()
    fetch_data.ts        # Pull diverse cards from Supabase -> data/input.json
    run_experiment.ts    # Run cards through all variants -> data/results.json
    analyze_results.ts   # Compute metrics, write ANALYSIS.md
  data/                  # gitignored; seed with input.json + results.json
  HISTORY.md             # Full experiment narrative (problem -> results -> lessons)
  ANALYSIS.md            # Detailed findings & recommendations
  INTEGRATION.md         # How the winner was integrated into production
```

## Phases

| Script | What it does |
|--------|-------------|
| `bun run fetch` | Queries Supabase for 20-30 diverse cards, writes `data/input.json` |
| `bun run run` | Runs each card through 4 prompt variants, writes `data/results.json` |
| `bun run analyze` | Computes tag metrics and writes `ANALYSIS.md` |
| `bun run experiment` | Chains all three phases |

## Key Finding

Platform-specific prompt guidelines (GitHub -> tech stack, YouTube -> creator/format, etc.) dramatically outperform generic prompts. Context-awareness is the single biggest lever for tag quality.
