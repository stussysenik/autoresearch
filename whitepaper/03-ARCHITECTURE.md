# Part III: Technical Architecture — The Pipeline

> *"The pipeline is the product."*

---

## 3.0 Architecture Philosophy: Harness, Not Bloat

Every component must justify its existence against three tests:

1. **Does it serve the community?** (not just researchers)
2. **Does it work at cypher scale?** (iPhone on the floor, not a mocap lab)
3. **Is it the simplest thing that could work?** (no speculative complexity)

If a component fails any test, it's cut. This is why we don't use MotionBERT for triage, don't build real-time inference before offline works, and don't pretend power moves are solved.

---

## 3.1 The Canonical Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│  CAPTURE LAYER (any of these)                                    │
│                                                                  │
│  iPhone on tripod    GoPro on floor    Broadcast multi-cam       │
│  1080p @ 120fps      1080p @ 120fps    1080p @ 60fps+           │
│  $0 additional       $0-300            $8,000+                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  ① SEGMENTATION — SAM 3                                         │
│     Input:  RGB video                                            │
│     Output: Binary dancer mask per frame                         │
│     Speed:  ~50ms/frame on GPU                                   │
│     Why:    Text-promptable ("breakdancer"), temporal coherence  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  ② TRACKING — CoTracker3                                        │
│     Input:  RGB video + SAM mask query points                    │
│     Output: N×T×2 trajectories + N×T visibility masks            │
│     Speed:  ~30ms/frame (online mode)                            │
│     Why:    Only tracker that survives self-occlusion during     │
│             power moves. 70K point capacity.                     │
│     Limit:  Search radius overflow at 30fps — need 120fps input  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  ③ 2D POSE                                                      │
│     Offline:  Sapiens 1B — 133 keypoints, best hand/foot AP     │
│     Realtime: RTMPose-x — 17 keypoints, ~60 FPS on RTX 3060     │
│     Limit:    Both degraded on inverted poses (paper admits)     │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  ④ 3D WORLD RECONSTRUCTION                                      │
│                                                                  │
│     Primary:  JOSH3 — W-MPJPE 175mm, 0.8 FPS                   │
│               Joint scene+human optimization. Best accuracy.     │
│                                                                  │
│     Baseline: GVHMR — W-MPJPE 274mm, 5100 FPS (network)         │
│               World-grounded via gravity-view coordinates.       │
│               12× more robust to camera noise than WHAM.         │
│                                                                  │
│     ⚠️  POWER MOVES: Neither model handles inversions.           │
│         Headspins, windmills, flares produce degraded output.    │
│         This is the honest, unsolved problem.                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  ⑤ DENSE CLIP ASSEMBLY                                          │
│     Convert fragmented model outputs into:                       │
│     - joints_3d.npy            (F × K × 3, clip-aligned)        │
│     - valid_mask.npy           (F × 1, which frames are usable) │
│     - track_ids.npy            (F × 1, provenance per frame)    │
│     - metadata.json            (renderability, windows, gates)   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  ⑥ VALIDATION GATE                                               │
│     Physical sanity checks before any scoring:                   │
│     - Joint limits (no hyper-extended elbows)                    │
│     - Floor penetration (root y ≥ 0)                            │
│     - Temporal continuity (no teleporting)                       │
│     - Velocity bounds (|v| < 15 m/s for human motion)           │
│                                                                  │
│     Output: full_clip_ready | window_ready | unusable            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  ⑦ AUDIO ANALYSIS (runs in parallel, CPU only)                   │
│                                                                  │
│     BeatNet+ → beat positions {b_k} with confidence              │
│     MATLAB 8D → H(t) audio hotness (8 psychoacoustic dims)      │
│                                                                  │
│     Both indexed by t_audio — the parent timecode.               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  ⑧ SCORING — The 3% (Core Innovation)                           │
│                                                                  │
│     μ = max_τ corr(M(t), H(t-τ))     Musicality coefficient     │
│     S = stability(μ over windows)     Sustained musicality       │
│     A = spatial_coverage(heatmap)     Stage usage                │
│     E = kinetic_energy(V(t))          Physical effort            │
│     F = flow_score(transitions)        Transition smoothness     │
│     τ* = optimal_lag                 Anticipation/reactive       │
│                                                                  │
│     All per-segment: toprock, footwork, powermove, freeze        │
│     All indexed by t_audio                                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  ⑨ OUTPUT LAYER                                                  │
│                                                                  │
│     For dancers:   Heatmap + timeline + move signatures          │
│     For judges:    TRIVIUM breakdown (Body/Soul/Mind)            │
│     For community: BreakDex move dictionary + vector pool        │
│     For events:    Big-screen PDF replay (< 60s)                 │
│     For research:  BRACE-aligned benchmarks                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3.2 Layer Roles (Not Interchangeable)

| Layer | Component | Role | Can swap? |
|-------|-----------|------|-----------|
| Segmentation | SAM 3 | Dancer mask | Swap with SAM 2 (weaker) |
| Tracking | CoTracker3 | Dense point tracks | Swap with CoWTracker (same family) |
| 2D Pose | Sapiens 1B / RTMPose | Keypoints | Swap within layer |
| **3D Reconstruction** | **JOSH / GVHMR** | **Backbone** | **Swap within layer** |
| Ground Truth | BRACE | Evaluation dataset | **Not interchangeable** — it's truth |
| Prior/Body | HSMR/SKEL | Human biomechanical model | **Different kind** — not a backbone |
| Scoring | Our pipeline | Musicality, coverage, flow | The innovation — not swappable |

---

## 3.3 The Power Move Problem (Honest Assessment)

No public 3D human mesh recovery model handles inverted breakdancing poses. This was confirmed by:

| Test | Result |
|------|--------|
| PromptHMR + WHAC (Nov 2025) | Poor results on breaking footage |
| SAM-Body4D spike (Mar 2026) | Zero quantitative benchmarks, zero inversion evidence |
| Sapiens (ECCV 2024) | Explicitly lists "complex/rare poses" as limitation |
| GVHMR/JOSH3 | Trained on upright-human motion capture (AMASS) |

### Candidate Solutions (ranked by likelihood)

| Path | Approach | Effort | Risk |
|------|----------|--------|------|
| **4: Accept degraded** (ship v1) | Use GVHMR, temporal smoothing, ~1s blur on power moves | 0 | None |
| **1: Fine-tune on BRACE** | Domain-adapt existing models on Red Bull footage | 1-2 weeks | Medium |
| **2: HSMR biomechanical constraints** | Add joint limits to prevent impossible skeletons | 1 week | Medium |
| **3: TRAM trajectory bypass** | Use SLAM for trajectory, skip MoCap prior | 1 week | Medium |

**Recommended**: Ship Path 4 now. Run Path 1 in parallel. Spike Path 2 as the research bet.

---

## 3.4 Capture Tiers — Low to High Condition

### Tier 1: iPhone Solo ($0 additional)

```
iPhone 15/16 Pro on tripod → 1080p @ 120fps
                              ↓
Upload to cloud GPU (RunPod ~$5/event)
                              ↓
Full pipeline runs → download results (~5MB joints_3d.npy)
                              ↓
Audio + scoring on M1 Max locally
```

**Works for**: Practice sessions, self-study, community cyphers
**Limitation**: Results ~30 min after recording, no live preview

### Tier 2: iPhone + Laptop ($0 if you own both)

| Component | Runs on laptop? |
|-----------|----------------|
| Audio (BeatNet+, MATLAB 8D) | Yes |
| Scoring + visualization | Yes |
| RTMPose (2D pose preview) | Slow but works |
| SAM 3 / CoTracker3 / GVHMR | **No** — CUDA required |

**Best split**: Cloud GPU for vision, local for everything else.

### Tier 3: Event Rig ($4,300)

| Item | Cost | Purpose |
|------|------|---------|
| Panasonic GH5 (used) | $800 | Cinema-quality 120fps, fixed focal |
| 12mm f/1.4 prime | $300 | Wide for battle circle |
| Tripod | $150 | Eliminates camera shake |
| RTX 4090 laptop | $2,500 | On-site GPU inference |
| Portable monitor | $200 | Live skeleton overlay |
| SSD + cables | $250 | Storage + connectivity |

**GH5 Settings** (critical for pipeline quality):
- 1080p @ 120fps (NOT 4K — pipeline crops to 256×192)
- Rec.709 (NOT V-Log — washed frames degrade detection)
- Fixed prime lens (zoom changes break SLAM)
- Manual exposure (auto creates flickering)
- Shutter 1/250s (reduces motion blur at 120fps)

### Tier 4: Broadcast ($8,000+)

3× GH5 + synced timecode + calibration target + A100 cloud. Multi-angle JOSH reconstruction, triangulated 3D, significantly better power move coverage through occlusion resolution.

---

## 3.5 What Runs Where

```
┌──────────────────────┐     ┌──────────────────────┐
│   CLOUD GPU (GPU)     │     │   LOCAL (CPU/MPS)     │
│                      │     │                      │
│  SAM 3 segmentation  │     │  BeatNet+ beat detect │
│  CoTracker3 tracking │     │  MATLAB 8D features   │
│  Sapiens 2D pose     │     │  Cross-correlation μ  │
│  GVHMR / JOSH 3D     │     │  TRIVIUM scoring      │
│                      │     │  Visualization        │
│  Output: joints_3d   │     │  BreakDex move dict   │
│         (~5MB/clip)  │     │  Knowledge pool search│
│                      │     │                      │
└──────────┬───────────┘     └──────────▲───────────┘
           │                             │
           └───── download .npy ─────────┘
```

No runtime dependency between audio and vision. This is the key deployment insight.

---

## 3.6 The Gravity-View Coordinate System

GVHMR reconstructs motion in a gravity-view (GV) frame:

$$R_{c \to gv} = \begin{bmatrix} (\hat{y} \times \hat{v})^T \\ \hat{g}^T \\ ((\hat{y} \times \hat{v}) \times \hat{g})^T \end{bmatrix}$$

where $\hat{g}$ is gravity direction (from visual odometry) and $\hat{v}$ is camera view direction.

**Consequences:**
- Y-axis = gravity — dancer stays "upright" regardless of camera tilt
- Translation = world meters — position in real-world scale
- No scene model needed — gravity anchors the coordinate system

**With iPhone Pro sensors** (future):
- Gyroscope replaces visual odometry for gravity — exact, no drift
- LiDAR provides metric depth — 2cm accuracy vs 14cm from monocular depth estimation
- ARKit provides device pose — replaces SLAM entirely

The iPhone Pro is a calibrated sensor array (RGB + depth + IMU) disguised as a phone.

---

*Next: [Part IV — Scoring & TRIVIUM Framework](04-SCORING.md)*
