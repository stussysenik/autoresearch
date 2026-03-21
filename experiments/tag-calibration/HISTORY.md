# Tag Calibration — Experiment History

## Problem Statement

The mymind-clone-web personal knowledge library has a tagging system with three issues:

1. **Inconsistent quality** — Some cards have precise, discoverable tags while others have generic or missing tags
2. **Split taxonomy** — `tag-vocabulary.ts` defines 50 aesthetic terms (visual: dark-mode, film-grain) while `dspy-service/main.py` uses 15 vibe terms (abstract: kinetic, atmospheric). No single source of truth.
3. **Top-down design** — The 3-tier structure (primary + contextual + aesthetic/vibe) was designed by assumption, not discovered from actual content patterns

## Hypothesis

A bottom-up, data-driven taxonomy discovered by GLM 4.7 from real card content will produce better tags than the current hand-designed system. DSPy can then transfer this quality to the local Gemma 3 model for cost-effective production inference.

## Method

### Phase 1: Taxonomy Discovery
- Fetched ~200 cards stratified by platform and content type
- Partitioned into 10 batches of ~20 cards each
- Each batch sent to GLM 4.7 with a discovery prompt asking it to propose optimal categories
- All 10 partial taxonomies synthesized into one canonical taxonomy

### Phase 2: Gold Tagging
- Applied the discovered taxonomy to all cards via GLM 4.7
- Rate-limited at 30 RPM with checkpoint-resumable batch processing
- Validated every gold tag against taxonomy rules (min/max counts, blocked tags)
- Cards failing validation retried up to 2x with stricter prompting

### Phase 3: DSPy Calibration
- Defined a TagClassification DSPy Signature with taxonomy-enriched descriptions
- Split gold tags 80/20 into train/dev (stratified by platform)
- Ran BootstrapFewShot: GLM 4.7 teacher generates few-shot demos for Gemma
- Ran MIPROv2: Bayesian optimization of both instructions and demos
- Evaluated both on dev set with composite metric (60% F1 + 25% adherence + 15% style)

### Phase 4: Validation
- Best optimized program run on full dataset via Gemma 3 12B
- Metrics computed: micro/macro F1, exact match, taxonomy adherence, style coverage, blocked tag rate
- Per-platform and per-category breakdowns generated
- Worst/best cards identified for qualitative review

### Phase 5: Storybook
- TagChip: Color-coded by category (green/blue/purple)
- TagCloud: Weighted frequency visualization
- TaxonomyBrowser: Collapsible tree view of the discovered taxonomy

## Key Decisions

1. **Python over TypeScript** — DSPy is Python-only. Breaking from the repo's TypeScript convention was necessary.
2. **Gemma 3 12B for experiment** — Best quality/speed balance on Apple Silicon. Production deploys Gemma 3 1B in-browser.
3. **Composite metric weights** — F1 at 60% because matching gold quality is the primary goal. Adherence at 25% ensures structural correctness. Style at 15% guarantees cross-disciplinary discovery always works.
4. **Checkpoint every 50 cards** — Balances I/O overhead vs. resume granularity for the 30-60 minute gold-tagging phase.

## Results

See `ANALYSIS.md` (generated after Phase 4 completes).
