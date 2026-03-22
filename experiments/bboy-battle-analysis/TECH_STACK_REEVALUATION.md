<!--
  Bboy Battle Analysis: Tech Stack Re-Evaluation
  Date: 2026-03-22
  Trigger: Original research loop used 2024-era models; re-evaluated against March 2026 SOTA
  Status: Supersedes tech stack recommendations in ANALYSIS_v2.md
-->

# Tech Stack Re-Evaluation — March 2026

## Why This Document Exists

The autonomous research loop (ANALYSIS_v2.md, 56 artifacts, 2.4 MB) recommended **ViTPose + rotation augmentation + librosa** as the core tech stack. This was the best answer with 2024-era knowledge. After re-evaluating against what's actually available in March 2026, **three of the top three critical gaps the research flagged as unsolvable now have direct solutions**.

The core innovation — **audio × movement spectrogram cross-correlation** ("the 3%") — is unchanged and remains the differentiator. This re-evaluation upgrades the **inputs** (better pose, segmentation, beat tracking) that feed into that cross-correlation.

---

## The Core Innovation (Unchanged)

```
Musicality = corr(audio_spectrogram, movement_spectrogram)
```

Cross-correlate the audio STFT with joint velocity/acceleration mapped to the same time-frequency grid. When a dancer hits a break on the beat, both spectrograms light up at the same coordinates. When they're off, you can see exactly where.

**Nobody else does this.** Better upstream models make the movement spectrogram cleaner, which makes the cross-correlation more accurate. The 3% is still the 3%.

---

## Critical Gaps — Revised Assessment

### Gap #1: Inversion Pose Estimation

**Research said:** "No model handles headspins, flares, windmills — CRITICAL. Requires training data + architecture innovation."

**Confirmed by experience:** PromptHMR + WHAC tested in November 2025 — results were poor because no breaking data in training sets. 3D mesh recovery models are trained on upright human motion.

**March 2026 reality:**

| Model | What it does | Why it changes things |
|-------|-------------|----------------------|
| **SAM-Body4D** (Dec 2025) | Training-free 4D human mesh recovery from video | Built on SAM 3 + Diffusion-VAS + SAM-3D-Body. **No retraining needed** — works on any pose, including inversions, out of the box. Temporal consistency across frames. |
| **Fast SAM 3D Body** (Nov 2025) | Accelerated single-frame body mesh | Real-time variant of SAM 3D Body. Meta checkpoints released 2025-11-19. |
| **DanceFormer** (2025) | Dance-specific pose estimation | Transformer trained specifically for dance sequences. 18.4mm accuracy on AIST dataset. Better than generic models on complex dance. |

**New severity: LOW** — SAM-Body4D is training-free; no breaking-specific data required for the core pipeline.

### Gap #2: Training Data Scarcity

**Research said:** "No public annotated breaking move dataset — CRITICAL. Root cause of Gap #1."

**March 2026 reality:**

| Dataset | Source | What's in it |
|---------|--------|-------------|
| **BRACE** (ECCV 2022, still active 2026) | Red Bull BC One competition footage | Breakdancing video with annotations. Specifically designed for acrobatic inversions and tangled postures. Multiple moving cameras. Used as benchmark in current pose estimation research. |

**New severity: LOW** — BRACE exists for validation and fine-tuning. SAM-Body4D doesn't need task-specific training anyway.

### Gap #3: Multi-Dancer Occlusion

**Research said:** "Requires multi-view fusion or temporal tracking innovation — HIGH."

**March 2026 reality:**

| Model | What it does | Occlusion handling |
|-------|-------------|-------------------|
| **JOSH** (ICLR 2026) | Joint optimization for 4D human-scene reconstruction | Human-scene contact constraints handle occlusions. 2-3x less error than WHAM on SLOPER4D. Handles close human-human interaction. |
| **CoTracker3** (ICLR 2025) | Dense point tracking (up to 70K points) | Tracks through occlusions natively via joint correlations between tracked points. Online real-time mode. |
| **Carnegie Mellon Multi-View 4D** (Jan 2026) | Markerless multi-view reconstruction | Handles close interactions (wrestling, dancing, fencing) — exactly the battle scenario. |

**New severity: MEDIUM** — direct solutions exist; still needs validation on breaking-specific occlusion patterns.

### Gaps #4-9: Revised Severity

| # | Gap | Old | New | Why |
|---|-----|-----|-----|-----|
| 4 | Identity/Unity quantification | HIGH | **HIGH** | Still hard — cultural judgment resists automation |
| 5 | Error propagation ceiling | MEDIUM | **MEDIUM** | Better upstream = less noise, but ceiling unknown |
| 6 | Latency for AR overlays | MEDIUM | **MEDIUM** | Models heavier but GPU-optimized |
| 7 | Phase encoding (toprock/footwork/power/freeze) | MEDIUM | **LOW** | DanceFormer + InternVideo 2.5 can classify phases |
| 8 | Real-time 8D psychoacoustic | MEDIUM | **LOW** | BeatNet+ is real-time; MSNet RTF < 0.1 |
| 9 | Multi-view fusion | LOW | **LOW** | Carnegie Mellon system exists |

**The only remaining HARD problem is #4 (Identity/Unity)** — quantifying cultural style and round concept coherence.

---

## Upgraded Tech Stack

### Vision Layer

| Tool | Replaces | What it does | Released |
|------|----------|-------------|---------|
| **SAM 3** | Manual segmentation | Concept-aware dancer segmentation via text prompt ("breakdancer"). Video tracking with temporal consistency. 2x accuracy over SAM 2. Handles occlusions + re-appearances. | Nov 2025 |
| **CoTracker3** | N/A (new capability) | Dense point tracking — up to 70K points through occlusions. Online real-time mode. Joint correlations between points. | Oct 2024 (ICLR 2025) |
| **SAM-Body4D** | ViTPose + rotation augmentation | Training-free 4D mesh recovery. No retraining for unusual poses. Temporal consistency. | Dec 2025 |
| **JOSH** | N/A (new capability) | 4D human-scene reconstruction. Occlusion-aware via contact constraints. Handles battles. | ICLR 2026 |
| **DanceFormer** | MoveNet Lightning | Dance-specific pose estimation. 18.4mm on AIST. | 2025 |

### Audio Layer

| Tool | Replaces | What it does | Released |
|------|----------|-------------|---------|
| **BeatNet+** | BeatNet (broken on Python 3.13) | Real-time beat/downbeat. Percussive-invariant — works on ANY music. | Dec 2024 |
| **MSNet** | N/A (new capability) | Music source separation. RTF < 0.1. SOTA on MUSDB18. Isolate drums/bass/vocals. | 2025 |
| **analyze_track.py** | (kept) | 9D psychoacoustic features. Already built and working. | Existing |

### Judging/Scoring Layer (NEW — not in original research)

| Tool | What it does | Maps to TRIVIUM |
|------|-------------|----------------|
| **Hierarchical Pose-Guided AQA** (arxiv:2501.03674) | Multi-stage action quality assessment from pose sequences | T (Technique), V (Vocabulary) |
| **Laban Movement Analysis** | 17 macroscopic movement features. ML classifier distinguishes Breakdance/Popping/Krump. | I (Identity), U (Unity) |
| **DanceFix** (AAAI 2025) | Group dance neatness quantification — limb/joint precision scoring | T (Technique) in crew battles |

### Video Understanding (NEW)

| Tool | What it does | Use case |
|------|-------------|---------|
| **InternVideo 2.5** (Dec 2025) | Video foundation model. SOTA on 40+ datasets, 6x memory efficiency. | Move classification directly from video |
| **CoWTracker** (2026) | Warping-based dense tracking. More efficient than CoTracker3. | Leading TAP-Vid results |

---

## Revised Pipeline

```
OLD (ANALYSIS_v2.md Recommendation):
  ① Capture → ② ViTPose + rotation hack → ③ Kalman filter → ④ 143D features
  → ⑤ MS-TCN++ → ⑥ TRIVIUM → ⑦ Three.js

NEW (March 2026 Stack):
  ① Capture    → iPhone 1080p@30fps
  ② Segment    → SAM 3 (text: "breakdancer" → isolate dancer)
  ③ Track      → CoTracker3 (dense points on segmented dancer, through occlusions)
  ④ Mesh       → SAM-Body4D (training-free 4D mesh → full body per frame)
  ⑤ Audio      → BeatNet+ (beat/downbeat) + MSNet (source separation) + analyze_track.py (9D)
  ⑥ Correlate  → Audio spectrogram × Movement spectrogram (THE 3%)
  ⑦ Score      → Hierarchical AQA + Laban features + TRIVIUM
  ⑧ Visualize  → Three.js (trails, spectrogram, heatmap, freeze signature, particles)
```

**Key difference:** Steps ②-④ are **training-free** for unusual poses. No breaking-specific training data needed for the core pipeline. BRACE dataset available for validation and fine-tuning.

---

## Latency Comparison

| Approach | Per-frame | Inversion accuracy | Use case |
|----------|-----------|-------------------|----------|
| Old (ViTPose + rotation hack) | ~115ms | Poor | N/A — superseded |
| **New (SAM 3 + CoTracker3 + SAM-Body4D)** | **~330ms** | **Good** | **Offline analysis (v0.1)** |
| Hybrid (SAM 3 + DanceFormer, skip mesh) | ~150ms | Moderate | Real-time coaching (v2) |

### Detailed Budget (New Stack)

| Component | Latency | Hardware |
|-----------|---------|---------|
| SAM 3 segmentation | ~100ms/frame | GPU (6x faster than SAM 1) |
| CoTracker3 online | ~30ms/frame | GPU (real-time mode) |
| SAM-Body4D mesh | ~200ms/frame | GPU (diffusion-based) |
| BeatNet+ | real-time | CPU/GPU streaming |
| 9D audio features | ~1ms/segment | CPU |
| **Total** | **~330ms/frame** | RTX 3060+ |

For v0.1: offline video processing at ~3fps. Real-time is a v2 problem.

---

## What's Still Valid from ANALYSIS_v2.md

The original research remains valuable for everything **except** the tech stack recommendations:

| Component | Status |
|-----------|--------|
| **Audio × Movement cross-correlation (the 3%)** | CORE INNOVATION — unchanged, enhanced by better inputs |
| **TRIVIUM scoring framework** | Valid — now augmented by Laban Movement Analysis + AQA |
| **8D psychoacoustic model** | Valid — analyze_track.py implements all 9 dimensions |
| **BBSK data format** | Valid — still needed for pipeline interchange |
| **Three.js visualization** | Valid — browser-native, lowest friction |
| **Museum installation specs** | Valid — not affected by model upgrades |
| **Business roadmap** | Valid — better tech accelerates the timeline |
| **Music history / DJ signatures / cultural context** | Irreplaceable — no model provides this |
| ~~ViTPose + rotation augmentation~~ | **Superseded** by SAM-Body4D |
| ~~MoveNet Lightning for mobile~~ | **Superseded** by DanceFormer |
| ~~"No breaking dataset exists"~~ | **Incorrect** — BRACE dataset exists |
| ~~"Inversion pose is unsolvable"~~ | **Incorrect** — SAM-Body4D is training-free |
| ~~BeatNet for beat tracking~~ | **Updated** — BeatNet+ is the successor |
| ~~Kalman + bone constraints pipeline~~ | **Simplified** — SAM-Body4D handles temporal consistency |

---

## Key References

### Vision Models
- [SAM 3](https://github.com/facebookresearch/sam3) — arxiv:2511.16719 (Nov 2025)
- [CoTracker3](https://cotracker3.github.io/) — arxiv:2410.11831 (ICLR 2025)
- [SAM-Body4D](https://arxiv.org/abs/2512.08406) — Training-free 4D mesh recovery (Dec 2025)
- [Fast SAM 3D Body](https://github.com/facebookresearch/sam-3d-body) — Meta checkpoints (Nov 2025)
- [JOSH](https://github.com/genforce/JOSH) — arxiv:2501.02158 (ICLR 2026)
- [DanceFormer](https://www.sciencedirect.com/science/article/pii/S1110016825001814) — Dance-specific pose (2025)
- [CoWTracker](https://cowtracker.github.io/) — Warping-based tracking (2026)

### Datasets
- [BRACE](https://github.com/dmoltisanti/brace) — Red Bull BC One breakdancing dataset (ECCV 2022)

### Audio Models
- [BeatNet+](https://transactions.ismir.net/articles/10.5334/tismir.198) — Real-time rhythm analysis (Dec 2024)
- [MSNet](https://www.nature.com/articles/s41598-025-20179-3) — Music source separation (2025)

### Judging/Scoring
- [Hierarchical Pose-Guided AQA](https://arxiv.org/abs/2501.03674) — Action quality assessment (2025)
- [DanceFix](https://ojs.aaai.org/index.php/AAAI/article/view/32959) — Group dance neatness (AAAI 2025)
- Dance Style Recognition via [Laban Movement Analysis](https://www.researchgate.net/publication/391328674) (2025)

### Video Understanding
- [InternVideo 2.5](https://github.com/OpenGVLab/InternVideo) — Video foundation model (Dec 2025)

---

## Next Steps

1. **Spike SAM 3 + CoTracker3** — segment + track a dancer through inversions
2. **Spike SAM-Body4D** — 4D mesh on BRACE dataset footage
3. **Spike BeatNet+** — verify Python 3.13 compatibility
4. **Download BRACE dataset** — evaluate annotations
5. **Vertical slice** — SAM 3 → CoTracker3 → mesh → 9D audio → cross-correlation → Three.js
