# Tag Calibration Experiment

Re-tag all mymind-clone-web cards with a data-driven taxonomy using DSPy to optimize Gemma 3 local inference to match GLM 4.7 quality.

## Problem

The mymind-clone-web tagging system has inconsistent quality and a split taxonomy: 50 aesthetic terms vs 15 vibe terms, with generic tags polluting the tag graph. Tags were imposed top-down rather than discovered from the data.

## Approach

1. **Taxonomy Discovery** — GLM 4.7 analyzes 200 diverse cards and proposes the optimal tag taxonomy bottom-up
2. **Gold Tagging** — GLM 4.7 re-tags all 500-2000 cards using the discovered taxonomy
3. **DSPy Calibration** — BootstrapFewShot + MIPROv2 optimize Gemma 3 prompts to match GLM 4.7 quality
4. **Validation** — Full-dataset evaluation with F1, taxonomy adherence, and style coverage metrics
5. **Storybook** — Tag component library (TagChip, TagCloud, TaxonomyBrowser)

## Quick Start

```bash
# 1. Install dependencies
uv sync --extra dev

# 2. Copy .env and fill in credentials
cp .env.example .env

# 3. Ensure Ollama is running with Gemma
ollama pull gemma3:12b
ollama serve

# 4. Run the full pipeline
make all

# 5. Run tests
make test

# 6. View Storybook
make storybook
```

## Running Individual Phases

```bash
make phase1   # Taxonomy Discovery
make phase2   # Gold Tagging (requires Phase 1)
make phase3   # DSPy Calibration (requires Phase 2)
make phase4   # Validation (requires Phase 3)
```

## Key Outputs

| File | Description |
|------|-------------|
| `data/taxonomy.json` | Discovered tag taxonomy |
| `data/gold_tags.json` | GLM 4.7 gold-standard tags for all cards |
| `data/optimized_prompts/` | DSPy-optimized Gemma prompts |
| `data/validation_report.json` | Full validation metrics |
| `ANALYSIS.md` | Human-readable validation report |

## Metrics Targets

| Metric | Target |
|--------|--------|
| Micro F1 | >= 0.70 |
| Taxonomy Adherence | >= 0.90 |
| Style Coverage | >= 0.95 |
| Blocked Tag Rate | <= 0.02 |

## Tech Stack

- **Python 3.10+** with DSPy 3.x
- **GLM 4.7** via Zhipu OpenAI-compatible API (teacher model)
- **Gemma 3 12B** via Ollama (student model)
- **Supabase** for card storage
- **Storybook 8** with Next.js + Tailwind for tag components
