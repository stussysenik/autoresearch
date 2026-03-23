# POC: Bboy Musicality Analysis — GPU Instance Instructions

> **You are on a GPU instance.** Your job is to run the full proof of concept autonomously.
> Read `../POC.md` for the methodology and math. This file tells you WHAT to do.

## Your Mission

Prove that cross-correlating 3D joint velocities with audio beats produces a meaningful musicality score for breakdancing. Use the BRACE dataset (Red Bull BC One footage) as test data.

**Expected time:** 30-60 minutes including setup.
**Success:** μ > 0.3 on beat-aligned toprock, μ < 0.15 on off-beat/silence.

---

## Step-by-Step Execution

### Phase 1: Environment Setup (~15 min)

```bash
# Run the setup script — it handles conda, pytorch, GVHMR, checkpoints
cd poc/
bash remote/setup-gvhmr.sh
```

If the script fails:
- **pytorch3d**: `pip install "git+https://github.com/facebookresearch/pytorch3d.git"`
- **SMPL model**: Register at https://smplx.is.tue.mpg.de/, download SMPLX_NEUTRAL.npz, place in `~/gvhmr/inputs/checkpoints/body_models/smplx/`
- **OOM**: Use shorter clips (15s) or add `--batch_size 1`

### Phase 2: Get BRACE Dataset

```bash
# Clone BRACE (Red Bull BC One breakdancing footage)
git clone https://github.com/dmoltisanti/brace ~/brace
# Follow their README for downloading the video clips
# The dataset contains annotated bboy battle footage with:
#   - Toprock sequences (control — should work well)
#   - Power moves: headspins, windmills, flares (stress test)
#   - Freezes (static poses)
```

If BRACE requires registration or large downloads, find a 30-second bboy toprock clip from YouTube as fallback:
```bash
pip install yt-dlp
yt-dlp -f 'best[height<=1080]' "URL" -o ~/test_clip.mp4
```

### Phase 3: Run GVHMR Inference (~2-5 min per clip)

```bash
# Pick a toprock clip first (easiest — validates the math works)
bash remote/run-inference.sh ~/brace/videos/TOPROCK_CLIP.mp4

# If camera is on a tripod (stable), use static mode (faster, more accurate):
bash remote/run-inference.sh ~/brace/videos/TOPROCK_CLIP.mp4 --static

# Output: poc/results/joints_3d.npy + metadata.json
```

### Phase 4: Compute Musicality Score

```bash
# With real audio from the video:
pip install scipy librosa matplotlib
python analyze.py --video ~/brace/videos/TOPROCK_CLIP.mp4

# Without audio (synthetic 120 BPM test — validates the math independent of audio):
python analyze.py --no-audio
```

**Output:** `results/musicality_score.json` + `results/correlation_plot.png`

### Phase 5: Stress Test (Power Moves)

After toprock works, try clips with inversions:
```bash
# Headspin clip
bash remote/run-inference.sh ~/brace/videos/HEADSPIN_CLIP.mp4
python analyze.py --video ~/brace/videos/HEADSPIN_CLIP.mp4

# Windmill clip
bash remote/run-inference.sh ~/brace/videos/WINDMILL_CLIP.mp4
python analyze.py --video ~/brace/videos/WINDMILL_CLIP.mp4
```

Document what happens — does GVHMR crash? Does the mesh track the dancer? What's the per-joint SNR? This is the critical data we need.

### Phase 6: Report Results

Create `results/REPORT.md` summarizing:
1. Which clips were tested
2. μ and τ* for each clip
3. Per-joint SNR table
4. Whether GVHMR survived inversions (screenshots of rendered mesh if possible)
5. Correlation plots for each clip
6. Any errors encountered and how you resolved them

---

## Environment Requirements

- **GPU:** CUDA-capable, 16GB+ VRAM (T4 minimum, L4 recommended)
- **CUDA:** 12.1+
- **Python:** 3.10
- **Disk:** ~15GB for models + checkpoints + dataset
- **Network:** Needed for initial downloads

## Success Criteria

| Test Case | Expected μ | What it proves |
|-----------|-----------|----------------|
| Toprock on beat | > 0.3 | Cross-correlation works |
| Toprock off beat | < 0.15 | Discriminative power |
| Synthetic 120 BPM | > 0.2 | Math is correct independent of audio |
| Headspin | ? (observe) | Does GVHMR survive inversions? |
| Windmill | ? (observe) | Does the mesh track through rotation? |

## Context (Read If You Need More Detail)

- `../POC.md` — Full methodology with LaTeX math (velocity, SG smoothing, cross-correlation)
- `../ARCHITECTURE.md` — Full pipeline architecture, hardware tiers, future roadmap
- `../guides/` — Deep reimplementation guides for MotionBERT, CoTracker3, SAM3D
- `../../bboy-battle-analysis/ANALYSIS_v2.md` — 370KB SOTA architecture report
- `../../bboy-battle-analysis/TECH_STACK_REEVALUATION.md` — March 2026 model upgrades

## Important Notes

- We are NOT reimplementing GVHMR. We use it as a black box (their code, their weights).
- Our code is only: `extract-joints.py` (SMPL → numpy) and `analyze.py` (signal processing → μ).
- The BRACE dataset is the ideal test because it has actual Red Bull BC One footage with annotations.
- If GVHMR fails on inversions, that's a VALID RESULT — document it. It confirms our research finding that no current model handles bboy inversions.
