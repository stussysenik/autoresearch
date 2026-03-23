<!--
  ARC-101 Pipeline Feasibility Assessment & Stitching Plan
  Date: 2026-03-23
  Purpose: Concrete assessment of building the 4-layer ARC-101 pipeline as a solo developer
  Depends on: TECH_STACK_REEVALUATION.md, SAM_BODY4D_VIABILITY_SPIKE.md, BBOY_CLI_SPEC.md
-->

# ARC-101 Feasibility Assessment & Stitching Plan

## 0. Verdict Up Front

**Yes, one person can build a working v0.1 in 4-6 weeks.** But only by making specific compromises documented below. The architecture as described has real dependency conflicts, a format mismatch between Layer 3 (SMPL) and Layer 4 (SKEL), and a compute cost that rules out the M1 Max for anything beyond audio analysis. The critical path is not code -- it is validating whether any existing model handles inversions, which requires a $5-10 cloud GPU experiment before committing to an architecture.

---

## 1. Can One Person Build This?

### What Is "Download and Run" vs "Custom Integration"

| Component | Status | Effort |
|-----------|--------|--------|
| **GVHMR** | Clone-and-run. Mature repo, SimpleVO replaced DPVO (March 2025), self-contained demo script. Preprocessing: YOLOv8 detection + ViTPose keypoints + ViT features + SimpleVO. Single command `python tools/demo/demo.py`. | **Low.** 1-2 hours to run on a cloud GPU. |
| **JOSH** | Clone-and-run with caveats. Requires VIMO checkpoint (HMR), DECO checkpoint (contact estimation), SMPL body models. Demo script `josh_demo.sh` handles preprocessing. But it is an **optimization method** -- runtime is minutes-to-hours per video, not seconds. | **Medium.** Setup ~4 hours. Each video takes significant optimization time. |
| **JOSH3R** | Part of the JOSH repo. Single forward pass variant, real-time capable. Trades accuracy for speed. Less documented than JOSH proper. | **Medium.** Need to verify checkpoint availability and quality. |
| **HSMR** | Clone-and-run. CVPR 2025 Oral, demo/eval/training code released March 2025. Requires SKEL model download from MPI. Single-image inference. | **Low.** 1-2 hours to run. But single-image only -- no temporal coherence built in. |
| **SAM 3** | Requires Meta HuggingFace access approval. Hard CUDA/Triton dependency -- cannot run on Apple Silicon natively. Proven on H200/A100. | **Medium.** Access approval may take days. CUDA-only is a hard constraint. |
| **CoTracker3** | `torch.hub.load("facebookresearch/co-tracker", "cotracker3_offline")`. Simplest integration of any component. | **Low.** 30 minutes. |
| **Sapiens 1B Pose** | HuggingFace checkpoint available. Outputs 133-keypoint heatmaps. Needs top-down detection (bbox input). CC-BY-NC license. | **Low-Medium.** Straightforward but slow (1-4 FPS on 4090). |
| **TRAM** | Clone-and-run. Includes DROID-SLAM, ZoeDepth, Detectron2, SAM, DEVA. Install script provided. Python 3.10. | **Medium.** Many submodule dependencies. |

### Custom Integration Code Required

The models do not speak the same language. The glue layer must handle:

1. **Detection to Pose**: SAM 3 outputs masks (binary per-pixel); GVHMR expects bounding boxes (x,y,w,h) + ViTPose 2D keypoints. You need to convert SAM 3 masks to bounding boxes (trivial -- `cv2.boundingRect` on the mask), then crop and run ViTPose on the crops.

2. **World Coordinates**: GVHMR outputs SMPL parameters in gravity-view coordinates with a world-space root trajectory. JOSH expects to initialize from HMR (its own VIMO backbone) and runs its own DROID-SLAM. These are **parallel pipelines, not sequential ones.** You cannot simply feed GVHMR output into JOSH -- JOSH has its own preprocessing and initialization path.

3. **SMPL vs SKEL Format Mismatch**: GVHMR and JOSH output SMPL parameters (72 pose DOF). HSMR outputs SKEL parameters (46 pose DOF). Converting between them requires an offline optimization step (SKELify) that is lossy and can get stuck in local minima. This is the single biggest integration headache.

4. **Temporal Wrapper for HSMR**: HSMR is single-image. If you want temporal coherence, you must add Kalman filtering or exponential smoothing yourself. Estimated ~200-400 LOC in Python.

### Estimated LOC for Glue/Orchestration

| Component | LOC | Description |
|-----------|-----|-------------|
| Video I/O + frame extraction | 100 | FFmpeg wrapper, frame iterator |
| SAM 3 mask to bbox conversion | 50 | Mask contour to bounding box |
| ViTPose integration | 150 | Crop, resize to 256x192, run inference, extract keypoints |
| GVHMR preprocessing adapter | 200 | Format keypoints, ViT features, VO into GVHMR's expected input |
| JOSH preprocessing bypass | 100 | Skip JOSH's internal HMR, feed external SMPL init (if possible) |
| SMPL-to-SKEL conversion | 300 | SKELify optimization wrapper |
| Temporal smoothing for HSMR | 300 | Kalman filter or exponential smoothing on SKEL params |
| Audio feature extraction | 50 | Existing `analyze_track.py` adapter |
| Cross-correlation engine | 400 | Movement spectrogram generation + audio spectrogram alignment |
| Workspace/pipeline orchestration | 500 | The `bboy` CLI workspace model from BBOY_CLI_SPEC.md |
| Output serialization (npz/JSON) | 200 | Write to workspace format |
| **Total** | **~2,350** | Excluding model code, excluding visualization |

This is a manageable amount of code. The hard part is not writing it -- it is debugging the format conversions and ensuring numerically correct coordinate transforms between model outputs.

### Dependency Conflicts

| Conflict | Severity | Resolution |
|----------|----------|------------|
| **Python version**: JOSH requires 3.10 (chumpy). GVHMR works on 3.10. SAM-Body4D requires 3.12. SAM 3 needs 3.10+. | **HIGH** | Use Python 3.10 for the core pipeline. Skip SAM-Body4D (use GVHMR + HSMR instead). |
| **PyTorch version**: JOSH uses PyTorch + CUDA 12.8. GVHMR uses PyTorch + CUDA 11.8 (with DPVO) or any CUDA (with SimpleVO). TRAM uses DROID-SLAM which pins specific CUDA versions. | **MEDIUM** | GVHMR with SimpleVO is CUDA-version-flexible. JOSH on CUDA 12.8. May need separate conda envs for JOSH vs GVHMR if they conflict. |
| **SMPL model licensing**: SMPL/SMPL-X body models require academic registration at MPI. SKEL model also requires MPI registration. | **LOW** | One-time registration, typically approved within 24 hours. |
| **Detectron2**: JOSH and TRAM both depend on Detectron2, which has known build issues with newer PyTorch/CUDA combinations. | **MEDIUM** | Use pre-built Detectron2 wheels or build from source with pinned versions. |
| **Triton (SAM 3)**: Hard CUDA dependency. No MPS support. Blocks Apple Silicon completely. | **HARD BLOCK for local dev** | Cloud GPU only for SAM 3 stages. |

**The practical resolution**: Two conda environments on a cloud GPU. Env 1: Python 3.10, PyTorch 2.x + CUDA 12.x, for GVHMR + JOSH + HSMR. Env 2: For SAM 3 if needed. Or, more practically: skip SAM 3 for v0.1 and use GVHMR's built-in YOLOv8 + ViTPose preprocessing, which works out of the box.

---

## 2. The Minimal Vertical Slice

### Input
One 30-second toprock clip. Download from YouTube using `yt-dlp`. Extract audio with `ffmpeg -i video.mp4 -vn -acodec pcm_s16le audio.wav`.

### Output
World-grounded 3D skeleton (SMPL joints in meters), per-frame, with audio features aligned to motion. Rendered as a 3D skeleton visualization in Three.js.

### The v0.1 Pipeline (What to Actually Build First)

```
Input: video.mp4 (30s, 30fps = 900 frames)

Step 1: GVHMR end-to-end (Layer 1 + 2 + 3 combined)
  - GVHMR already includes: YOLOv8 detection, ViTPose 2D keypoints,
    ViT feature extraction, SimpleVO camera estimation
  - Input: video.mp4
  - Output: per-frame SMPL params (body_pose [T,63], global_orient [T,3],
    transl [T,3], betas [10]) in world coordinates
  - Data shapes:
    body_pose: float32 [900, 63]  (21 joints x 3 axis-angle)
    global_orient: float32 [900, 3]
    transl: float32 [900, 3]  (world-space root, in meters)
    betas: float32 [10]  (body shape)
  - Runtime: ~46 sec preprocessing + ~2 sec GVHMR inference (on A100)

Step 2: Audio analysis (existing code)
  - Input: audio.wav
  - Tool: analyze_track.py (already built, 9D psychoacoustic features)
  - Output: per-beat feature vectors
  - Additional: BeatNet+ for beat/downbeat timestamps
  - Data shapes:
    beat_times: float32 [N_beats]
    downbeat_times: float32 [N_downbeats]
    audio_features: float32 [N_segments, 9]  (9D psychoacoustic)

Step 3: Movement spectrogram construction
  - Input: SMPL joints from Step 1
  - Process:
    a. Forward kinematics: SMPL params -> 24 joint positions [900, 24, 3]
    b. Joint velocities: finite differences -> [899, 24, 3]
    c. Joint accelerations: finite differences -> [898, 24, 3]
    d. Velocity magnitudes per joint: [898, 24]
    e. STFT on each joint's velocity time series:
       window=64 frames (~2.1s at 30fps), hop=8 frames (~0.27s)
    f. Movement spectrogram: [24, N_freq_bins, N_time_bins]
  - Output: movement_spectrogram.npz

Step 4: Audio-movement cross-correlation (THE 3%)
  - Input: audio STFT + movement spectrogram
  - Process:
    a. Resample both to same time grid
    b. Audio STFT: [N_freq, N_time] (standard librosa)
    c. Cross-correlate: pearsonr per time-frequency bin
    d. Musicality score: mean correlation across joints weighted by
       joint importance (hands > torso > feet for toprock)
  - Output: musicality_score.json, correlation_matrix.npz

Step 5: Export + Visualize
  - Export joint positions [900, 24, 3] as JSON for Three.js
  - Render 3D skeleton with color-coded musicality overlay
```

### What Gets Skipped for v0.1

| Component | Why Skip It |
|-----------|------------|
| **SAM 3 segmentation** | GVHMR's built-in YOLOv8 handles single-person detection fine. SAM 3 adds value only for multi-dancer scenarios. |
| **CoTracker3 dense tracking** | Not needed if GVHMR handles the full pipeline. CoTracker3 is useful for surface detail (clothing, hair), not skeleton recovery. |
| **JOSH optimization** | Adds minutes-to-hours of runtime per video. GVHMR alone gives usable world-grounded output. Add JOSH in v0.5. |
| **HSMR/SKEL biomechanical refinement** | Requires SMPL-to-SKEL conversion (lossy). The biomechanical constraints are most valuable for inversions, which toprock does not involve. Add in v0.5. |
| **Sapiens 133 keypoints** | GVHMR uses ViTPose (17 COCO keypoints) internally. Sapiens 133 is overkill for v0.1 and significantly slower. |
| **Multi-dancer tracking** | v0.1 is one dancer, one camera. |

**The v0.1 insight**: GVHMR is already a self-contained pipeline that covers Layers 1-3. The vertical slice is: `GVHMR + analyze_track.py + cross-correlation + Three.js`. That is four components, not twelve.

---

## 3. What Should NOT Be Built From Scratch

### Use As-Is (git clone, run inference)

| Repo | URL | License | What You Get |
|------|-----|---------|-------------|
| **GVHMR** | `github.com/zju3dv/GVHMR` | Apache 2.0 | Full Layer 1-3: detection + keypoints + VO + world-grounded SMPL recovery |
| **CoTracker3** | `github.com/facebookresearch/co-tracker` | Apache 2.0 | Dense point tracking via `torch.hub.load` one-liner |
| **HSMR** | `github.com/IsshikiHugh/HSMR` | MIT | Biomechanically constrained single-image mesh recovery |
| **analyze_track.py** | Local (already built) | Yours | 9D psychoacoustic audio features |

### Fork + Patch (minor modifications needed)

| Repo | URL | What Needs Changing |
|------|-----|-------------------|
| **JOSH** | `github.com/genforce/JOSH` | May need to modify initialization to accept external SMPL params from GVHMR instead of JOSH's internal VIMO. Check if `josh_demo.sh` allows custom init. |
| **TRAM** | `github.com/yufu-wang/tram` | If you use TRAM instead of GVHMR for world-grounding, you need its DROID-SLAM masking. But GVHMR with SimpleVO is simpler. TRAM is the fallback. |

### Paper-Only / No Usable Code

| Model | Status | Impact |
|-------|--------|--------|
| **DanceFormer** | Claimed "2025" but no arXiv paper found, no GitHub repo verified. The SAM_BODY4D_VIABILITY_SPIKE.md already flagged this as [UNVERIFIED]. | **Skip entirely.** |
| **CoWTracker** | Project page exists but code release status unclear. CoTracker3 covers the same capability. | **Skip.** Use CoTracker3. |
| **Carnegie Mellon Multi-View 4D** | Research paper. Multi-view is not relevant for monocular v0.1. | **Skip.** |
| **JOSH3R** | Part of JOSH repo but less documented. Checkpoint availability unconfirmed. | **Try it if JOSH is too slow.** |

### Build From Scratch

| Component | Why |
|-----------|-----|
| **Movement spectrogram generator** | ~200 LOC. STFT on joint velocity time series. No existing tool does this specific transform. |
| **Audio-movement cross-correlator** | ~200 LOC. The core innovation (the "3%"). Must be custom. |
| **Pipeline orchestration / workspace** | ~500 LOC. The `bboy` CLI workspace model. |
| **SMPL-to-Three.js exporter** | ~150 LOC. Convert SMPL joint positions to Three.js-compatible JSON. |

---

## 4. The Stitching Plan -- Actual Data Shapes and Conversion Steps

### Full Pipeline Pseudocode (v0.5 target, with all 4 layers)

```python
# =========================================================
# ARC-101 Pipeline: Full 4-Layer Stitching
# Input: video.mp4, audio.wav
# Output: world_skeleton.json, musicality_score.json
# =========================================================

import numpy as np
import torch
from smplx import SMPL  # pip install smplx

# ---- LAYER 1: Vision ----

# Option A (v0.1): Use GVHMR's built-in preprocessing
# GVHMR internally runs:
#   YOLOv8 -> bboxes [T, 4] (xyxy)
#   ViTPose -> keypoints_2d [T, 17, 3] (x, y, conf; COCO format)
#   ViT-H  -> image_features [T, 1, 1024]
#   SimpleVO -> camera_rotations [T, 3, 3]

# Option B (v0.5): Use SAM 3 + custom ViTPose
masks = sam3.generate(
    video,                         # [T, 3, H, W] uint8
    text_prompt="breakdancer"
)
# masks: dict of {object_id: [T, H, W] bool}

# Convert masks to bounding boxes
bboxes = []
for t in range(T):
    contours = cv2.findContours(masks[dancer_id][t])
    x, y, w, h = cv2.boundingRect(contours[0])
    bboxes.append([x, y, x+w, y+h])
bboxes = np.array(bboxes)           # [T, 4] float32, xyxy format

# Run ViTPose on crops
crops = extract_crops(video, bboxes, target_size=(256, 192))
# crops: [T, 3, 256, 192] float32
keypoints_2d = vitpose(crops)       # [T, 17, 3] float32 (x, y, confidence)
# Keypoints are in COCO format: nose, eyes, ears, shoulders,
# elbows, wrists, hips, knees, ankles

# Optional: CoTracker3 for dense surface tracking
pred_tracks, pred_visibility = cotracker3(
    video,                          # [1, T, 3, H, W] float32
    grid_size=30                    # 30x30 = 900 points
)
# pred_tracks: [1, T, 900, 2] float32 (x, y pixel coords)
# pred_visibility: [1, T, 900, 1] bool

# Optional: Sapiens for 133-keypoint dense pose
# heatmaps = sapiens_pose_1b(crops)  # [T, 133, H/4, W/4]
# keypoints_133 = argmax_heatmaps(heatmaps)  # [T, 133, 3]


# ---- LAYER 2: World ----

# Option A (v0.1): GVHMR handles this internally via SimpleVO
# SimpleVO estimates camera rotation per frame
# GVHMR's gravity-view coordinates transform:
#   1. Estimate gravity direction from VO
#   2. Decompose camera rotation into gravity-aligned and view components
#   3. Predict human motion in this gravity-view frame
#   4. Transform back to world coordinates
# Output is already in meters, world-grounded.

# Option B (v0.5): TRAM-style for better metric scale
# TRAM uses:
#   1. Masked DROID-SLAM (mask out the human, SLAM on background)
#      camera_poses: [T, 4, 4] SE(3) matrices
#   2. ZoeDepth metric depth estimation
#      depth_maps: [T, H, W] float32 (meters)
#   3. Align SLAM scale to metric depth via optimization
#      scale_factor: float (SLAM units -> meters)
#   4. Human trajectory in metric-scale world coordinates
# This gives better absolute scale than GVHMR's SimpleVO.
# TRAM achieves 60% less global trajectory error than WHAM.


# ---- LAYER 3: Brain ----

# GVHMR inference (the main model)
# Input: preprocessed data from Layer 1
gvhmr_input = {
    'keypoints_2d': keypoints_2d,   # [T, 17, 3] normalized to [-1, 1]
    'img_features': image_features, # [T, 1, 1024] from ViT-H
    'cam_rotations': cam_rotations, # [T, 3, 3] from SimpleVO
    'bboxes': bboxes_normalized,    # [T, 4] normalized
}

# GVHMR temporal transformer with RoPE:
#   - Processes arbitrary-length sequences (no fixed window)
#   - RoPE positional encoding handles variable-length input
#   - Gravity-view coordinate decomposition
#   - Outputs SMPL parameters in world frame
gvhmr_output = gvhmr_model(gvhmr_input)

# Output format:
smpl_params = {
    'body_pose':     gvhmr_output['body_pose'],      # [T, 63] axis-angle (21 joints x 3)
    'global_orient': gvhmr_output['global_orient'],   # [T, 3] axis-angle
    'transl':        gvhmr_output['transl'],          # [T, 3] world translation (meters)
    'betas':         gvhmr_output['betas'],           # [10] body shape
}

# Forward kinematics: SMPL params -> joint positions + mesh vertices
smpl_model = SMPL(model_path='SMPL_NEUTRAL.pkl')
smpl_output = smpl_model(
    body_pose=torch.tensor(smpl_params['body_pose']),
    global_orient=torch.tensor(smpl_params['global_orient']),
    transl=torch.tensor(smpl_params['transl']),
    betas=torch.tensor(smpl_params['betas']).expand(T, -1),
)
joints_3d = smpl_output.joints.numpy()     # [T, 24, 3] float32, meters
vertices = smpl_output.vertices.numpy()     # [T, 6890, 3] float32, meters


# ---- LAYER 4: Physics ----

# Step 4a: JOSH joint optimization (v0.5+)
# JOSH takes a raw video and runs its OWN preprocessing:
#   1. VIMO (its HMR backbone) -> initial SMPL params
#   2. DROID-SLAM -> scene point cloud + camera poses
#   3. DECO -> per-vertex contact probability
#   4. Joint optimization: minimize
#      L = L_contact + L_motion_prior + L_scene_consistency + L_penetration
#
# Key question: Can we initialize JOSH with GVHMR's SMPL output
# instead of VIMO's? If yes, we get GVHMR's superior gravity-view
# coordinates as initialization + JOSH's contact-based refinement.
# If no, JOSH is a parallel pipeline, not a refinement step.
#
# JOSH output (after optimization):
#   smpl_params_refined: same format as above, but with
#   scene_pointcloud: [N_points, 3] float32 (scene geometry)
#   contact_labels: [T, 6890] float32 (per-vertex contact probability)
#
# Runtime warning: JOSH optimization takes MINUTES per video.
# For a 30s clip: expect 5-20 minutes on A100.

# Step 4b: HSMR biomechanical refinement (v0.5+)
# HSMR is single-image, outputs SKEL parameters (not SMPL).
# Two options for integration:
#
# Option 1: Run HSMR per-frame, get SKEL params, add temporal smoothing
#   hsmr_output = hsmr_model(crops)  # per-frame
#   skel_params = {
#       'pose': hsmr_output['pose'],       # [T, 46] Euler angles (radians)
#       'shape': hsmr_output['shape'],     # [T, 10] body shape
#       'cam': hsmr_output['cam'],         # [T, 3] weak-perspective camera
#   }
#   # Apply temporal smoothing:
#   from scipy.signal import savgol_filter
#   skel_params['pose'] = savgol_filter(skel_params['pose'], 15, 3, axis=0)
#
# Option 2: Use SKELify to convert GVHMR's SMPL output to SKEL
#   This is an optimization that minimizes vertex distance between
#   SMPL mesh and SKEL mesh while respecting biomechanical constraints.
#   skel_from_smpl = skelify(smpl_params)  # lossy, ~1-2 sec/frame
#
# FORMAT MISMATCH WARNING:
#   SMPL: 72 pose params (24 joints x 3 axis-angle)
#   SKEL: 46 pose params (anatomical joints, Euler angles)
#   These are NOT interchangeable. SKEL has fewer DOF because
#   real joints don't have 3 full rotation axes.
#   The knee, for example, has 1 DOF in SKEL vs 3 in SMPL.
#   This is a FEATURE (prevents impossible poses) but makes
#   conversion non-trivial.


# ---- STEP 5: Audio-Motion Correlation ----

# 5a: Audio features (existing code)
from analyze_track import analyze  # existing 9D psychoacoustic
audio_features = analyze('audio.wav')
# audio_features: dict with keys like 'spectral_centroid',
# 'rms_energy', 'tempo', etc.

# 5b: Beat detection
# Use BeatNet+ or madmom for beat/downbeat times
beat_times = beatnet.process('audio.wav')
# beat_times: float32 [N_beats] in seconds

# 5c: Movement spectrogram
# Compute joint velocities from 3D positions
joint_velocities = np.diff(joints_3d, axis=0) * fps  # [T-1, 24, 3] m/s
joint_speed = np.linalg.norm(joint_velocities, axis=-1)  # [T-1, 24]

# STFT on each joint's speed time series
from scipy.signal import stft
movement_spectrogram = np.zeros((24, n_freq_bins, n_time_bins))
for j in range(24):
    f, t, Zxx = stft(joint_speed[:, j], fs=fps, nperseg=64, noverlap=56)
    movement_spectrogram[j] = np.abs(Zxx)
# movement_spectrogram: [24, 33, N_time] float32

# 5d: Audio STFT
import librosa
audio_y, sr = librosa.load('audio.wav', sr=22050)
audio_stft = np.abs(librosa.stft(audio_y, n_fft=2048, hop_length=512))
# audio_stft: [1025, N_audio_time] float32

# 5e: Cross-correlation
# Resample both spectrograms to same time grid
# Compute Pearson correlation per time bin
# Weight by joint importance (configurable)
joint_weights = {
    'wrists': 1.0, 'ankles': 0.8, 'shoulders': 0.6,
    'hips': 0.4, 'head': 0.3, 'spine': 0.2
}
musicality_score = weighted_cross_correlation(
    audio_stft, movement_spectrogram, joint_weights
)
# musicality_score: float in [0, 1]
```

### Critical Data Format Conversions

| From | To | Method | Lossy? |
|------|----|--------|--------|
| SAM 3 mask `[H,W] bool` | Bbox `[4] xyxy` | `cv2.boundingRect` on contour | No |
| ViTPose keypoints `[17,3]` in crop coords | GVHMR input `[17,3]` normalized | Affine transform using bbox, normalize to [-1,1] | No |
| GVHMR SMPL axis-angle `[63]` | Joint positions `[24,3]` | SMPL forward kinematics (`smplx` library) | No |
| SMPL params `[72]` | SKEL params `[46]` | SKELify optimization (~1-2 sec/frame) | **Yes** -- local minima risk |
| SKEL Euler angles `[46]` | SMPL axis-angle `[72]` | Inverse conversion (harder, less tested) | **Yes** |
| Joint positions `[T,24,3]` | Movement spectrogram `[24,F,T']` | STFT on velocity magnitudes | No (deterministic) |

---

## 5. Timeline Estimate

### v0.1 -- Proof of Concept (4-6 weeks, solo)

**Goal**: Run GVHMR on a toprock clip, generate movement spectrogram, cross-correlate with audio, render 3D skeleton in Three.js.

| Week | Task | Deliverable |
|------|------|-------------|
| 1 | Cloud GPU setup (RunPod/Lambda A100). Install GVHMR. Run on 3 YouTube toprock clips. Verify SMPL output. | `gvhmr_output.npz` with world-grounded SMPL params |
| 2 | SMPL forward kinematics to joint positions. Movement spectrogram generator. Audio STFT alignment. Cross-correlation engine. | `movement_spectrogram.npz`, `musicality_score.json` |
| 3 | Three.js skeleton renderer. Load joint positions as JSON. Color-code joints by musicality. Sync playback to audio. | Browser-based 3D skeleton viewer with audio sync |
| 4 | Run on 5 more clips (toprock + footwork). Evaluate: do musicality scores correlate with human judgment? Iterate on joint weighting. | Validation report: "does the 3% actually work?" |
| 5-6 | Buffer for debugging, dependency issues, cloud GPU costs, iteration. | Polished v0.1 demo |

**Hardware cost**: ~$50-100 in cloud GPU time (A100 at $1.10/hr, ~40-80 hours total including iteration).

**What you have at the end of v0.1**: A working pipeline that takes a single-dancer video, extracts world-grounded 3D skeleton, and produces a musicality score with audio-movement cross-correlation visualization. No inversions, no multi-dancer, no biomechanical refinement.

### v0.5 -- Usable at an Event (8-12 weeks after v0.1)

**Goal**: Handle power moves (inversions), add JOSH refinement, basic TRIVIUM scoring, handle 60-second rounds.

| Phase | Task | Duration |
|-------|------|----------|
| Inversion Spike | Run GVHMR + HSMR + GenHMR on 5 BRACE clips. Compare mesh quality during headspins/windmills. Choose winner. | 1 week |
| JOSH Integration | Wire JOSH optimization as post-processing on GVHMR output. Profile runtime. Decide: use JOSH or JOSH3R? | 2 weeks |
| HSMR Integration | If inversions need HSMR: add per-frame HSMR + temporal smoothing. Handle SMPL/SKEL format conversion. | 2 weeks |
| Phase Detection | Classify toprock / footwork / power / freeze segments using velocity profiles + pose heuristics. No ML needed for v0.5. | 1 week |
| TRIVIUM v0 | Implement Technique (joint angle consistency) + Musicality (cross-correlation) + Rhythm (beat alignment). Skip Identity/Unity. | 2 weeks |
| Event Polish | Handle 60s rounds. Batch processing. Results dashboard. | 2 weeks |

**Hardware**: Ongoing cloud GPU (~$200-400 total).

**What you have at the end of v0.5**: A pipeline that processes a full battle round (60s), handles inversions (if HSMR/GVHMR passes the spike), produces TRIVIUM sub-scores, and generates a visualization you could show at a jam. Not real-time -- processing takes 5-20 minutes per round.

### v1.0 -- Self-Improving Data Engine (6-12 months after v0.5)

**Goal**: JOSH processes web videos automatically, generates 3D labels, which train a faster feedforward model (JOSH3R), which enables near-real-time inference.

| Phase | Task | Duration |
|-------|------|----------|
| Data Collection | Scrape 1000+ battle clips from YouTube. Run JOSH on each (cloud GPU batch job). | 4 weeks |
| Pseudo-Label Generation | JOSH output = pseudo ground truth. Filter by contact consistency score. | 2 weeks |
| JOSH3R Training | Fine-tune JOSH3R on pseudo-labels with breaking-specific data. | 4 weeks |
| Evaluation | Test on held-out BRACE clips. Compare to vanilla GVHMR. | 2 weeks |
| Real-Time Pipeline | Replace JOSH optimization with JOSH3R single-pass inference. Target: <1s per frame. | 4 weeks |
| AR Prototype | iPhone capture + cloud inference + WebSocket result stream + Three.js overlay. | 8 weeks |

**Hardware**: Significant cloud GPU cost for batch processing 1000+ videos through JOSH ($500-2000).

**What you have at v1.0**: A self-improving pipeline where JOSH's optimization-based accuracy bootstraps a fast feedforward model. Processing time drops from minutes to seconds per video. Inversion handling improves as more breaking data enters the training loop.

---

## 6. The "Don't Use YOLO" Note

### The Actual Situation

GVHMR's preprocessing uses **YOLOv8** for person detection. This is already integrated and tested. The advice to "not use YOLO" creates a decision:

### Option A: Keep GVHMR's YOLOv8 (Recommended for v0.1)

GVHMR's demo script has YOLOv8 built in. It works. Replacing it adds integration work with zero accuracy benefit for single-person scenes. YOLOv8 detects persons with >95% AP on COCO. For a single breakdancer in frame, this is a solved problem.

### Option B: Replace with SAM 3 (Recommended for v0.5+)

When you need multi-dancer tracking in a cipher/battle, SAM 3 provides:
- Text-promptable segmentation ("breakdancer" vs "judge" vs "crowd")
- Identity-consistent tracking across frames (each dancer keeps their ID)
- Masks, not just boxes (useful for occlusion-aware depth)

SAM 3 effectively makes a separate detector unnecessary because it does detection + segmentation + tracking in one model. But it requires CUDA/Triton and cloud GPU.

### Option C: RTMDet or GroundingDINO (Viable alternatives)

| Detector | Speed | Accuracy | Integration Effort |
|----------|-------|----------|-------------------|
| **YOLOv8** (current in GVHMR) | 300+ FPS | 95% AP | Zero (already integrated) |
| **RTMDet** (OpenMMLab) | 300+ FPS, 52.8% AP | Comparable | Medium (replace GVHMR's detector) |
| **GroundingDINO** | ~10 FPS | 52.5% AP zero-shot | Medium-High (add language grounding) |
| **SAM 3** | ~33 FPS (detection) | N/A (segmentation) | High (CUDA/Triton, cloud only) |

**Verdict**: For v0.1, keep YOLOv8 because it is already wired into GVHMR. For v0.5+, SAM 3 replaces both detector and tracker. RTMDet is a lateral move with no clear benefit. GroundingDINO is interesting for zero-shot ("detect the dancer doing a headspin") but adds latency and complexity.

---

## 7. Risk Register

| # | Risk | Probability | Impact | Mitigation |
|---|------|-------------|--------|------------|
| R1 | **No model handles inversions** -- GVHMR, HSMR, GenHMR all fail on headspins/windmills | 60% | Critical | The $5-10 BRACE spike. If all fail: v0.1 is toprock/footwork only. Inversions become a training data problem for v1.0. |
| R2 | **JOSH optimization is too slow** for practical use (>30 min per video) | 40% | High | Use JOSH3R (single forward pass). Or skip JOSH entirely and use GVHMR + HSMR directly. |
| R3 | **SMPL-to-SKEL conversion is unreliable** -- SKELify gets stuck in local minima | 50% | Medium | Two options: (a) Stay in SMPL-land entirely, skip biomechanical refinement. (b) Run HSMR directly from images (skip conversion, lose GVHMR's world grounding). |
| R4 | **Dependency hell** -- models won't coexist in one conda env | 30% | Medium | Docker containers per model. Orchestrate via subprocess calls. Add ~200 LOC. |
| R5 | **Cloud GPU costs escalate** during v1.0 data engine phase | 70% | Medium | Use spot instances. Process videos in batches overnight. Set cost cap. |
| R6 | **The musicality cross-correlation doesn't actually work** -- scores don't correlate with human judgment | 20% | Critical | This is the v0.1 validation question. If the 3% doesn't work, the entire project premise needs rethinking. |
| R7 | **GVHMR's gravity prior hurts during inversions** -- model assumes upright human | 80% | High for inversions | GVHMR decomposes pose into gravity-view coordinates. When the dancer IS the gravity (headspin), this decomposition may be wrong. This is a fundamental architectural assumption, not a bug. |

---

## 8. Architecture Decision Records

### ADR-1: Use GVHMR as the backbone, not TRAM

GVHMR and TRAM solve similar problems (world-grounded human motion from monocular video). GVHMR is chosen because:
- SimpleVO is simpler than TRAM's DROID-SLAM masking
- GVHMR handles arbitrary-length sequences via RoPE (TRAM has fixed windows)
- GVHMR is actively maintained (March 2025 update)
- GVHMR has lower dependency complexity

TRAM remains a fallback if GVHMR's metric scale is insufficient.

### ADR-2: Skip SAM-Body4D entirely

Per SAM_BODY4D_VIABILITY_SPIKE.md:
- No published benchmarks (red flag)
- 1-2 sec/frame minimum on A100 (not 200ms as claimed)
- 14.5-53 GB VRAM (not runnable on RTX 4090 with occlusion refinement)
- CUDA/Triton hard dependency
- No evidence it handles inversions

GVHMR + HSMR is a better-validated path with lower compute cost.

### ADR-3: HSMR is the biomechanical layer, not SKELify post-processing

Two ways to get biomechanical constraints:
1. Run GVHMR (SMPL output) then convert to SKEL via SKELify
2. Run HSMR directly on video frames (SKEL output natively)

Option 2 is preferred because:
- No lossy conversion step
- HSMR is trained end-to-end to output SKEL
- SKELify conversion has known local minima issues

The trade-off: HSMR is single-image (no temporal), while GVHMR has temporal. Solution: use GVHMR for world trajectory + temporal coherence, use HSMR for per-frame biomechanical pose, blend outputs where they disagree (GVHMR for global_orient + transl, HSMR for body_pose joint limits).

### ADR-4: v0.1 validates the 3% before building infrastructure

The most important unknown is not "can we stitch the models together" (we can). It is "does audio-movement cross-correlation produce scores that match human perception of musicality." If the answer is no, the infrastructure does not matter. v0.1 must answer this question before any further investment.

---

## Sources

- [GVHMR GitHub](https://github.com/zju3dv/GVHMR)
- [GVHMR Installation](https://github.com/zju3dv/GVHMR/blob/main/docs/INSTALL.md)
- [JOSH GitHub](https://github.com/genforce/JOSH)
- [JOSH Paper](https://arxiv.org/abs/2501.02158)
- [JOSH Project Page](https://genforce.github.io/JOSH/)
- [HSMR GitHub](https://github.com/IsshikiHugh/HSMR)
- [HSMR Project Page](https://isshikihugh.github.io/HSMR/)
- [HSMR Paper](https://arxiv.org/abs/2503.21751)
- [TRAM GitHub](https://github.com/yufu-wang/tram)
- [TRAM Project Page](https://yufu-wang.github.io/tram4d/)
- [CoTracker3 GitHub](https://github.com/facebookresearch/co-tracker)
- [CoTracker3 Paper](https://cotracker3.github.io/)
- [SAM 3 GitHub](https://github.com/facebookresearch/sam3)
- [SAM 3 HuggingFace](https://huggingface.co/facebook/sam3)
- [Sapiens GitHub](https://github.com/facebookresearch/sapiens)
- [Sapiens Pose HuggingFace](https://huggingface.co/facebook/sapiens-pose-1b)
- [SKEL Model](https://skel.is.tue.mpg.de/)
- [SKEL GitHub](https://github.com/MarilynKeller/SKEL)
- [BRACE Dataset](https://github.com/dmoltisanti/brace)
- [GroundingDINO GitHub](https://github.com/IDEA-Research/GroundingDINO)
- [SMPL Model](https://smpl.is.tue.mpg.de/)
- [SAM-Body4D Viability Spike](./SAM_BODY4D_VIABILITY_SPIKE.md) (local)
- [Tech Stack Re-evaluation](./TECH_STACK_REEVALUATION.md) (local)
