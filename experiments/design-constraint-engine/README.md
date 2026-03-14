# Design Constraint Engine

Ablation study measuring which CSS dimensions matter most for design fidelity when LLMs reproduce UI from screenshots.

## Quick Start

```bash
bun install
bun run experiment   # runs fetch → run → analyze in one command
```

Requires `claude` CLI (authenticated). No API keys needed — uses `claude -p` headless mode.

## Architecture

```
Screenshot ──► Phase 1: Analyze ──► Blueprint JSON
                                        │
                                        ▼
                              Phase 2: Run Experiment
                              (per ablation variant)
                                        │
                    ┌───────────────────┼───────────────────┐
                    ▼                   ▼                   ▼
             Generate Tests    Build HTML via LLM    Capture Screenshots
                    │                   │                   │
                    └───────────────────┼───────────────────┘
                                        ▼
                              Phase 3: Analyze Results
                              Fidelity Scores + Rankings
```

**Phases**: `bun run fetch` | `bun run run` | `bun run analyze` (or all at once with `bun run experiment`)

## Results (7/9 variants scored)

| Variant | Dims | Composite | CPR | VDS | SSIM |
|---------|------|-----------|-----|-----|------|
| **typography_color** | **2** | **0.853** | 0.571 | 0.975 | 0.972 |
| tier1_only | 4 | 0.818 | 0.429 | 0.985 | 0.984 |
| tier3_only | 8 | 0.812 | 0.429 | 0.977 | 0.975 |
| tier1_tier2 | 8 | 0.784 | 0.286 | 0.998 | 0.998 |
| no_typography | 15 | 0.778 | 0.286 | 0.990 | 0.987 |
| all_16 (control) | 16 | 0.742 | 0.143 | 0.998 | 0.998 |
| no_color | 15 | 0.741 | 0.143 | 0.997 | 0.997 |

**Scoring**: `0.3*CPR + 0.4*VDS + 0.3*SSIM` — balances constraint pass rate, visual diff, and structural similarity.

## Key Finding

`typography_color` (just 2 dimensions) achieved **0.853** — higher than the `all_16` control (0.742). More constraints produced stricter tests that were harder to pass, lowering CPR without proportional visual gains. The minimum viable constraint set is typography + color.

## The 16 Dimensions

| Tier | Dimensions |
|------|-----------|
| **1 — Structural** | layout, spacing, sizing, typography |
| **2 — Surface** | color, borders, shape, shadows |
| **3 — Relational** | alignment, hierarchy, composition, density, state, responsive, accessibility, micro-interactions |

## Provider System

Builder and analyzer LLMs are configurable via environment variables:

```bash
BUILDER_PROVIDER=claude   # claude | codex | openai
ANALYZER_PROVIDER=claude  # claude | openai
```

Default: `claude` — runs via `claude -p --model sonnet` (no API key required).

## File Structure

```
src/
├── fetch_data.ts          # Phase 1: screenshot → blueprint
├── run_experiment.ts      # Phase 2: ablation runner
├── analyze_results.ts     # Phase 3: scoring & ranking
├── variants.ts            # 9 ablation variant definitions
├── analyzer/              # Image analysis (GPT-4V / claude)
├── builder/               # HTML generation from constraints
├── constraints/           # 16 dimension modules
├── executor/              # Test server + Playwright runner
├── generator/             # Playwright test code generation
├── scorer/                # Fidelity scoring (CPR + VDS + SSIM)
├── types/                 # Blueprint schema, type defs
└── utils/                 # Color, screenshot, tolerance helpers
```

See [ANALYSIS.md](./ANALYSIS.md) for full results and [HISTORY.md](./HISTORY.md) for methodology.
