# Overnight Karpathy Loop Results: TRIVIUM Scoring Engine

**Date**: 2026-03-24
**Duration**: 81 minutes (9 variants, circuit breaker at stale=8)
**Score**: 100/100 on first variant, 9/9 perfect scores
**Provider**: codex (gpt-5.4, xhigh reasoning)

---

## Start Here

Two files were generated overnight and are ready for JOSH SMPL output:

| File | LOC | Purpose |
|------|-----|---------|
| **`analyze_motion.py`** | 859 | 9D motion feature extractor + TRIVIUM kinematic sub-scores |
| **`match_beats.py`** | 889 | Beat-motion cross-correlation + full TRIVIUM scoring (0-100) |

These sit alongside `analyze_track.py` (the audio side, 548 LOC).

---

## What the Code Does

### TRIVIUM Scoring Model

```
S_total = 0.40 * BODY + 0.35 * SOUL + 0.25 * MIND = 0-100
```

#### BODY (40%) — Technical Execution
- **Technique** (40%): difficulty x execution quality per move
- **Vocabulary** (20%): Shannon entropy of move-type distribution (toprock/footwork/power/freeze/transition)
- **Progression** (15%): slope of difficulty over time (building toward climax)
- **Cleanliness** (25%): inverse jerk — uses SPARC (Spectral Arc Length) smoothness metric

#### SOUL (35%) — Musicality & Expression
- **Musicality** (45%): cross-correlation of movement energy M(t) vs audio hotness H(t)
  - Anticipation bonus: dancers who move BEFORE the beat score higher
  - 70ms tolerance window (Repp 2005)
- **Phrasing** (25%): STUBBED for v0.1 (needs DTW corpus calibration)
- **Creativity** (30%): STUBBED for v0.1 (needs movement prediction model)

#### MIND (25%) — Strategy & Flow
- **Flow** (30%): SPARC smoothness of CoM velocity at transitions
- **Energy Management** (20%): penalizes fading (stronger finish = higher score)
- **Response** (30%): STUBBED for v0.1 (needs opponent data)
- **Stage Use** (20%): spatial entropy of center-of-mass trajectory on grid

### Motion Features (9D, mirroring audio)

| # | Dimension | What It Measures |
|---|-----------|-----------------|
| 1 | Movement Tempo Stability | Autocorrelation of M(t) at beat-period lag |
| 2 | Low-freq Motion Energy | Movement spectrogram 0-2Hz band (body sway) |
| 3 | Distal Expressivity | Speed ratio: (hands+feet+head) / (torso+hips) |
| 4 | Movement Accent Strength | Peak of half-wave rectified dM/dt |
| 5 | Movement Flux | Frame-to-frame change in speed profile |
| 6 | Movement Complexity | Accent density + temporal irregularity |
| 7 | Movement Periodicity | Frequency peaks in movement spectrogram |
| 8 | Motion Dynamic Range | Peak speed / RMS speed (crest factor) |
| 9 | Movement Groove | Velocity autocorrelation at beat subdivisions |

---

## How to Use

### Analyze motion (standalone)
```bash
# Test mode (synthetic data)
python analyze_motion.py

# With JOSH output
python analyze_motion.py joints.npz
# joints.npz must have key 'joints' with shape [T, 24, 3] at 30fps
```

### Match beats (needs audio + motion)
```bash
# Test mode (synthetic synced data, cross-correlation should be ~1.0)
python match_beats.py --test

# With real data
python match_beats.py --motion joints.npz --audio track.wav
```

### Output
Both produce JSON to stdout with full TRIVIUM breakdown.

---

## What's Ready vs Stubbed

### Implemented (computable from kinematics + audio)
- All 9 motion dimensions with per-track [0,1] normalization
- Movement spectrogram (STFT per joint, nperseg=64, noverlap=56)
- Phase detection (toprock/footwork/power/freeze/transition)
- SPARC and LDLJ-V smoothness metrics
- Accent detection (acceleration pops, freeze entries, flow breaks)
- Cross-correlation with lag search and anticipation bonus
- Accent hit rate with 70ms tolerance
- Groove lock (timing consistency)
- Energy management (thirds comparison)
- Stage use (spatial entropy)
- Vocabulary entropy
- Full TRIVIUM weighted score

### Stubbed (returns 0.5, needs external data)
- **Creativity/Originality**: needs corpus of 500+ annotated performances + movement prediction model
- **Battle Response**: needs opponent move sequence (transfer entropy)
- **Phrasing**: needs DTW calibration against annotated phrase boundaries

---

## Overnight Loop Infrastructure

```
overnight/
├── GOAL.md              # What to optimize (TRIVIUM engine)
├── evaluate.sh          # LOCKED eval — 5 tests x 20pts = 100 max
├── run-loop.ts          # Karpathy loop (Bun/TypeScript)
├── prompt-context.md    # TRIVIUM formulas + SMPL topology + pseudocode
├── run.sh               # tmux launcher
├── results.jsonl        # 9/9 = 100/100
└── best/                # Winning variant (copied to project root)
```

### Eval Breakdown (all 20/20)
1. Both files exist, valid Python syntax
2. analyze_motion.py imports and runs on synthetic [300, 24, 3] data
3. match_beats.py imports without crashing
4. 9D features are normalized to [0,1]
5. Cross-correlation > 0.7 on perfectly synced synthetic data

---

## Next Steps

1. **Plug in JOSH output**: when Lightning.ai L4 inference finishes, feed the `.npz` through `analyze_motion.py`
2. **Run audio analysis**: `python analyze_track.py <audio_file>` on the battle track
3. **Match**: `python match_beats.py --motion joints.npz --audio track.wav` for full TRIVIUM score
4. **Calibrate**: tune TRIVIUM weights against expert judge scores on 5-10 Red Bull BC One clips
5. **Fill stubs**: creativity (needs corpus model), phrasing (needs DTW_max), response (needs opponent tracking)
