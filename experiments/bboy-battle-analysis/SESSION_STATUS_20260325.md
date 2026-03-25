# Session Status — 2026-03-25 03:00 UTC

## What Happened Tonight

Built the v6 breakdown renderer and discovered JOSH was 7x worse than GVHMR due to 5 compounding pipeline bugs. Fixed all of them and launched an overnight re-run.

## Current State

### Renderer (v6 — commit b6300a9 in main repo)
- Clean split: original video | speed-colored skeleton | metrics sidebar | sliding timeline | move bar | legend
- Grading fixed: uses beat_hit_pct (deterministic) instead of cross-correlation mu
- BRACE ground truth segments wired in (replaces broken auto-classifier)
- Dancer name shown on overlay (e.g., "LIL G")
- Grid-based layout system with design tokens

### JOSH Pipeline (v4 bboy-tuned — commit 54f6ec8 in josh/ repo, local)
- **5 bugs found and fixed:**
  1. `prior_loss_weight=100` → 15 (allow unusual poses)
  2. Focal length varied 2.3x across chunks → locked at 700
  3. Chunk 600-700 crashed on empty DECO tensor → guard added
  4. `smooth_loss_weight=0.1` → 2.0 (temporal coherence)
  5. `depth_filter_ratio=1.01` → 1.15 (allow depth variation)
- Batch job `josh-bboy-v4` running on L4 overnight

### BRACE Dataset Integration
- **Using:** beat annotations, dance segment labels (toprock/footwork/powermove), dancer names
- **Not yet using:** 2D keypoint ground truth (26K frames), pre-extracted audio features, shot boundaries
- **Key insight:** per-segment grading needed — powermoves legitimately aren't beat-synced, shouldn't drag score down
- **Research finding:** AIST++ BeatAlign score (soft Gaussian) is field standard, should replace binary hit/miss

### Research Reports Produced
- `experiments/josh_research_report.md` — full JOSH pipeline audit (hyperparams, losses, chunk aggregation, TRAM tracks, DECO contacts)
- `experiments/brace_integration_research.md` — BRACE opportunities, normative database concept (64 BC One dancers), per-segment metrics

## Tomorrow Morning

1. Check JOSH v4 batch results: `lightning list jobs`
2. If good → render v6 with JOSH data + BRACE labels
3. Implement per-segment grading (toprock vs footwork vs powermove, different metrics per type)
4. Download BRACE 2D keypoints for GVHMR/JOSH validation
5. Normative database: percentile rankings across 64 dancers = viral hook

## Key Files
| What | Where |
|------|-------|
| v6 renderer | `/teamspace/studios/this_studio/experiments/render_breakdown.py` |
| JOSH research | `/teamspace/studios/this_studio/experiments/josh_research_report.md` |
| BRACE research | `/teamspace/studios/this_studio/experiments/brace_integration_research.md` |
| JOSH config | `/teamspace/studios/this_studio/josh/josh/config.py` (BBOY_PRESET) |
| BRACE segments | `/teamspace/studios/this_studio/data/brace/annotations/segments.csv` |
| Session memory | `/teamspace/studios/this_studio/.claude/projects/.../memory/project_session_status_20260325.md` |
