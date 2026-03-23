# POC: Bboy Musicality Analysis — Claude Code Instructions

> **Goal:** Run the proof of concept end-to-end on this GPU instance.
> **Expected time:** 30-60 minutes including setup.
> **Read POC.md first** for the full methodology and math.

## What You're Doing

1. Install GVHMR (world-grounded 3D human mesh recovery)
2. Run it on a test video of a breakdancer
3. Extract 3D joint positions in world coordinates
4. Compute per-joint velocities
5. Extract audio beats from the video's soundtrack
6. Cross-correlate movement energy with beat signal
7. Report musicality score μ

## Quick Start

```bash
cd poc/
bash remote/setup-gvhmr.sh      # Install everything (~15 min first time)
bash remote/run-inference.sh test_video.mp4   # Run GVHMR (~2-5 min per 30s clip)
python analyze.py                # Compute musicality score
```

## Environment Requirements

- **GPU:** CUDA-capable, 16GB+ VRAM (T4 minimum, L4 recommended)
- **CUDA:** 12.1+
- **Python:** 3.10
- **Disk:** ~15GB for models + checkpoints
- **Network:** Needed for initial checkpoint downloads

## If Something Fails

1. **pytorch3d install fails** → `pip install pytorch3d` often needs building from source. Try:
   ```bash
   pip install "git+https://github.com/facebookresearch/pytorch3d.git"
   ```
2. **SMPL model missing** → The setup script downloads a neutral SMPL model. If it fails, you need to register at https://smplx.is.tue.mpg.de/ and download manually.
3. **OOM on T4 (16GB)** → Add `--batch_size 1` or process shorter clips (15s instead of 30s).
4. **SimpleVO fails** → Use `-s` flag (static camera mode) to skip visual odometry entirely.

## Success Criteria

- μ > 0.3 on beat-aligned dancing = **cross-correlation works**
- μ < 0.15 on off-beat or silence = **discriminative power confirmed**
- Per-joint SNR > 3:1 after smoothing = **velocity signal is clean enough**

## Context Files

- `../POC.md` — Full methodology with math
- `../ARCHITECTURE.md` — Pipeline architecture + hardware tiers
- `../guides/` — Reimplementation guides for MotionBERT, CoTracker3, SAM3D
- `../ARC-101-FEASIBILITY.md` (in bboy-battle-analysis/) — Full feasibility assessment
