# `bboy` CLI Design Spec

## Unix-Philosophy Pipeline for Breakdancing Computer Vision Analysis

**Date:** 2026-03-23
**Status:** Design Document (no implementation yet)
**Depends on:** TECH_STACK_REEVALUATION.md, SAM_BODY4D_VIABILITY_SPIKE.md, BBSK format (phase-3-data-model-universal-format.md)

---

## 1. Design Philosophy

The `bboy` CLI chains computer vision models into a breakdancing analysis pipeline using Unix-philosophy composition. The aspirational interface:

```bash
bboy segment video.mp4 | bboy track | bboy pose | bboy mesh | bboy score --audio track.wav
```

But this is a lie. True Unix pipes cannot work here because **every stage after segmentation needs the raw video**. CoTracker3 needs pixels + masks. Sapiens/HSMR needs pixels + bounding boxes. GVHMR needs pixels + keypoints. You cannot pipe raw video frames through stdout alongside structured data.

The design resolves this with a **workspace directory** model that preserves the Unix pipe ergonomics while routing the raw video through a side channel.

---

## 2. The Pipe Problem and Its Solution

### Why Real Pipes Fail

```
Stage           Needs raw video?    Needs previous output?
-----------     ----------------    ----------------------
segment         YES (input)         No
track           YES                 YES (masks from segment)
pose            YES                 YES (bboxes from segment)
mesh            YES                 YES (keypoints from pose)
score           No                  YES (keypoints/mesh + audio)
view            No                  YES (mesh/keypoints)
```

Four of six stages need both the raw video AND the previous stage's structured output. A Unix pipe carries one stream. We need two.

### The Solution: Workspace + Pipe Facade

Every `bboy` invocation operates on a **workspace directory**. The first command (`bboy segment`) creates it. Subsequent commands in the pipe detect the workspace from stdin metadata and read the video from disk.

```bash
# What the user types (looks like pipes):
bboy segment video.mp4 | bboy track | bboy pose | bboy mesh | bboy score --audio track.wav

# What actually happens:
# 1. bboy segment video.mp4
#    - Creates workspace: .bboy/runs/<timestamp>/
#    - Symlinks video into workspace: .bboy/runs/<timestamp>/source.mp4
#    - Runs SAM 3 segmentation
#    - Writes masks to workspace: .bboy/runs/<timestamp>/segment/
#    - Emits to stdout: {"workspace": ".bboy/runs/20260323-143022", "stage": "segment", "status": "complete"}
#
# 2. bboy track (reads stdin)
#    - Parses workspace path from stdin JSON
#    - Reads video from workspace/source.mp4
#    - Reads masks from workspace/segment/
#    - Runs CoTracker3
#    - Writes tracks to workspace/track/
#    - Emits to stdout: {"workspace": "...", "stage": "track", "status": "complete"}
#
# ... and so on
```

The pipe carries a **single JSON line** (the workspace manifest) between stages. The heavy data lives on disk. This gives us:

- Unix pipe syntax (composable, familiar)
- Filesystem persistence (resume, inspect intermediates, cache)
- Video side-channel (every stage reads the original video from the workspace)
- Sequential GPU execution (each pipe stage runs after the previous completes, so only one model is loaded at a time)

### Alternative: Explicit Workspace Mode

For users who prefer explicitness over pipe syntax:

```bash
# Create workspace explicitly
bboy init-run video.mp4 --audio track.wav --name "bboy-menno-2024"
# => Created workspace: .bboy/runs/bboy-menno-2024/

# Run stages individually
bboy segment --run bboy-menno-2024
bboy track   --run bboy-menno-2024
bboy pose    --run bboy-menno-2024
bboy mesh    --run bboy-menno-2024
bboy score   --run bboy-menno-2024

# Or run the full pipeline in one shot
bboy run video.mp4 --audio track.wav
```

---

## 3. Intermediate Data Format

### Decision: JSON Lines (NDJSON) for workspace manifests, NumPy `.npz` for tensor data

**Why not pure JSON Lines through the pipe?**
Per-frame pose data for a 30fps, 60-second clip is 1800 frames x 33 joints x 3 coords = 178,200 floats. As JSON, that is ~3.5 MB of text. As float32 `.npz`, that is 700 KB. For mesh vertices (6890 verts x 3 coords x 1800 frames), JSON is 600+ MB; float32 is 150 MB. Binary wins by 4x on size and 10x on load time.

**Why not pure binary (MessagePack/protobuf)?**
The workspace manifests, stage metadata, and scoring results are small and benefit from human readability. Protobuf adds a compile step. MessagePack adds a dependency for marginal gain on small payloads.

**Why not Arrow/Parquet?**
Arrow is ideal for columnar time-series queries ("give me left_wrist velocity for frames 100-200"), but the pipeline stages consume data sequentially, not with random access. The added complexity of Arrow schemas does not pay off until the analysis/visualization layer, where we export to it optionally.

### The Hybrid Format

```
.bboy/runs/<run-id>/
  manifest.json          # Run metadata (JSON, human-readable)
  source.mp4             # Symlink to original video
  source_audio.wav       # Extracted or provided audio track

  segment/
    meta.json            # Stage metadata: model, timing, config
    masks.npz            # Binary: uint8 masks [T, H, W] per dancer
    bboxes.ndjson        # JSON Lines: one {frame, dancer_id, bbox} per line
    preview.mp4          # Optional: masked video preview

  track/
    meta.json
    tracks.npz           # Binary: float32 [T, N_points, 2] xy positions
    visibility.npz       # Binary: bool [T, N_points] occlusion flags

  pose/
    meta.json
    keypoints_2d.npz     # Binary: float32 [T, N_dancers, 33, 3] (x, y, confidence)
    keypoints_3d.npz     # Binary: float32 [T, N_dancers, 33, 3] (x, y, z) in meters

  mesh/
    meta.json
    vertices.npz         # Binary: float32 [T, N_dancers, 6890, 3] SMPL vertices
    joints_smpl.npz      # Binary: float32 [T, N_dancers, 24, 3] SMPL joints
    cameras.npz          # Binary: camera parameters per frame
    world_traj.npz       # Binary: float32 [T, N_dancers, 3] world-space root trajectory

  score/
    meta.json
    trivium.json         # TRIVIUM scores with per-dimension breakdown
    musicality.json      # Audio-movement cross-correlation results
    timeline.ndjson      # Per-frame scoring events
    movement_spectrogram.npz  # The cross-correlation matrix

  export/
    bbsk.json            # Full BBSK format export (for visualization engines)
    bbsk.bin             # Binary BBSK (compact)
```

### Why `.npz` Specifically

- Native to NumPy (zero-copy load in Python)
- Named arrays (`np.savez(masks=..., bboxes=...)`)
- Compressed variant (`np.savez_compressed`) for archival
- Every CV model in the pipeline already uses NumPy arrays
- No schema definition needed (self-describing via array names + shapes)
- Can be loaded lazily with `np.load(file, mmap_mode='r')` for large files

### Stage Metadata Format (meta.json)

Every stage writes a `meta.json` with a consistent schema:

```json
{
  "stage": "segment",
  "model": "sam3",
  "model_version": "sam3-hiera-large",
  "checkpoint": "~/.bboy/checkpoints/sam3/sam3_hiera_large.pt",
  "started_at": "2026-03-23T14:30:22.000Z",
  "completed_at": "2026-03-23T14:31:45.000Z",
  "duration_s": 83.0,
  "gpu": "NVIDIA RTX 4090",
  "gpu_memory_peak_mb": 8200,
  "config": {
    "text_prompt": "breakdancer",
    "max_dancers": 2,
    "min_mask_area": 5000
  },
  "input": {
    "video_frames": 1800,
    "resolution": [1920, 1080],
    "fps": 30
  },
  "output": {
    "dancers_detected": 1,
    "files": ["masks.npz", "bboxes.ndjson"]
  }
}
```

---

## 4. Subcommands

### Pipeline Stages

```
bboy segment <video>          SAM 3 dancer segmentation
bboy track                    CoTracker3 dense point tracking
bboy pose                     2D/3D pose estimation
bboy mesh                     3D world mesh recovery
bboy score --audio <file>     Musicality + TRIVIUM scoring
bboy view                     Three.js 3D playback in browser
bboy export                   Export to BBSK / FBX / BVH / glTF
```

### Workflow Commands

```
bboy run <video>              Full pipeline in one shot
bboy init-run <video>         Create workspace without running
bboy resume                   Resume a failed/interrupted run
bboy status                   Show installed models, GPU, runs
bboy doctor                   Verify environment (Python, CUDA, models)
bboy init                     Download all model checkpoints
```

### Inspection Commands

```
bboy inspect <run-id>         Show workspace contents and stage status
bboy inspect <run-id> pose    Show details of a specific stage
bboy diff <run-a> <run-b>     Compare two runs (e.g., different models)
bboy list                     List all runs with status
bboy clean [--older-than 7d]  Remove old workspaces
```

---

## 5. Subcommand Details

### `bboy segment <video>`

Isolates the dancer(s) from the background using SAM 3 video segmentation.

```
bboy segment video.mp4 [options]

Options:
  --prompt <text>         SAM 3 text prompt (default: "breakdancer")
  --max-dancers <n>       Maximum dancers to segment (default: 2)
  --min-area <px>         Minimum mask area in pixels (default: 5000)
  --model <name>          SAM 3 variant: hiera-large | hiera-base | hiera-small (default: hiera-large)
  --run <id>              Workspace ID (default: auto-generated timestamp)
  --preview               Generate masked preview video
  --device <dev>          cuda | cuda:0 | cuda:1 (default: cuda)
  --dry-run               Show what would run without executing

Output (stdout):
  {"workspace": ".bboy/runs/20260323-143022", "stage": "segment", "status": "complete", "dancers": 1, "duration_s": 83.0}

Output (workspace):
  segment/masks.npz       uint8 [T, H, W] per-dancer binary masks
  segment/bboxes.ndjson   Per-frame bounding boxes
  segment/meta.json       Stage metadata
```

**Implementation notes:**
- SAM 3 requires CUDA (Triton dependency). No Apple Silicon support.
- The text prompt approach ("breakdancer") leverages SAM 3's concept-aware segmentation. In a battle with two dancers, the `--max-dancers 2` flag requests two separate masklets with distinct IDs. SAM 3's video tracking maintains identity across frames.
- The `--preview` flag uses ffmpeg to composite the mask onto the original video for visual verification before proceeding.

### `bboy track [options]`

Dense point tracking through the video using CoTracker3.

```
bboy track [options]

Input: reads workspace from stdin or --run flag

Options:
  --points <n>            Number of points to track (default: 2048)
  --grid                  Use grid-based initialization (default: mask-based)
  --online                Use CoTracker3 online mode for streaming
  --model <name>          cotracker3 | cowtracker (default: cotracker3)
  --run <id>              Workspace ID

Dependencies:
  Reads: workspace/source.mp4, workspace/segment/masks.npz
  Writes: workspace/track/tracks.npz, workspace/track/visibility.npz
```

**Implementation notes:**
- CoTracker3 supports up to 70K points but 2048 is sufficient for pose-relevant body tracking.
- Mask-based initialization (default) seeds points only within the dancer mask, avoiding wasted computation on background.
- The `--online` flag enables CoTracker3's sliding-window mode for real-time use but with lower accuracy.
- CoTracker3 tracks through occlusions natively via joint correlations between tracked points.

### `bboy pose [options]`

2D and optionally 3D pose estimation.

```
bboy pose [options]

Input: reads workspace from stdin or --run flag

Options:
  --model <name>          sapiens-1b | sapiens-0.3b | rtmpose-l | vitpose-h (default: sapiens-1b)
  --lift                  Also compute 3D keypoints via lifting network (default: true)
  --lift-model <name>     motionbert | mixste (default: motionbert)
  --run <id>              Workspace ID

Dependencies:
  Reads: workspace/source.mp4, workspace/segment/bboxes.ndjson
  Writes: workspace/pose/keypoints_2d.npz, workspace/pose/keypoints_3d.npz
```

**Implementation notes:**
- Sapiens (Meta, 2024) is the default because it has the best 2D keypoint accuracy and supports up to 308 keypoints (hands, face, body). The 1B parameter model is the most accurate; 0.3B is the fast variant.
- The `bboxes.ndjson` from the segment stage provides per-frame crops, so the pose model runs on tightly cropped dancer regions rather than full frames.
- 3D lifting (MotionBERT) takes the 2D keypoint sequence and produces metric-scale 3D joints. This is a lightweight alternative to full mesh recovery.
- Output uses the BBSK 33-joint topology regardless of the model's native keypoint format. A remapping layer handles the translation (Sapiens 308 -> BBSK 33, ViTPose 17 -> BBSK 33 with interpolated joints).

### `bboy mesh [options]`

Full 3D body mesh recovery in world coordinates.

```
bboy mesh [options]

Input: reads workspace from stdin or --run flag

Options:
  --model <name>          gvhmr | hsmr | sam-body4d | genhmr (default: gvhmr)
  --temporal              Enable temporal smoothing (default: true)
  --world                 Output world-grounded trajectory (default: true)
  --body-model <name>     smpl | smplx | skel (default: smpl)
  --run <id>              Workspace ID

Dependencies:
  Reads: workspace/source.mp4, workspace/pose/keypoints_2d.npz
  Writes: workspace/mesh/vertices.npz, workspace/mesh/joints_smpl.npz,
          workspace/mesh/world_traj.npz, workspace/mesh/cameras.npz

Models and their characteristics:
  gvhmr       SIGGRAPH Asia 2024. Gravity-View coords, handles long sequences via RoPE.
              World-grounded trajectory. Runs on RTX 3060+. ~100ms/frame.
              WARNING: Gravity prior may hurt during inversions (dancer upside down).

  hsmr        CVPR 2025. SKEL biomechanical model (46 DOF, joint limits).
              Best candidate for inversions — outperforms HMR 2.0 by >10mm on extreme yoga.
              Single-image; temporal smoothing applied post-hoc.
              WARNING: Code release status UNVERIFIED.

  sam-body4d  Dec 2025. Training-free temporal mesh via SAM 3 + SAM 3D Body.
              Requires A100-class GPU (14.5-53 GB VRAM). 1-2 sec/frame minimum.
              WARNING: Zero published benchmarks. Inversion capability UNVERIFIED.

  genhmr      AAAI 2025. Generative approach, models uncertainty.
              54.7mm MPJPE (matching SAM 3D Body). Single-image; needs temporal wrapper.
```

**Implementation notes:**
- The default is GVHMR because it is the only model that natively produces world-grounded trajectories with temporal consistency AND runs on consumer GPUs. Its gravity prior is a known risk for inversions but works well for toprock, footwork, and freezes.
- The `--model` flag is critical for experimentation. The `bboy diff` command lets users compare mesh outputs from different models on the same video.
- SAM-Body4D requires a separate `bboy segment` pass since it uses SAM 3 internally for its own segmentation. The pipeline detects this and reuses the existing masks.

### `bboy score --audio <file> [options]`

Musicality scoring via audio-movement spectrogram cross-correlation (the "3%").

```
bboy score --audio track.wav [options]

Input: reads workspace from stdin or --run flag

Options:
  --audio <file>          Audio file (wav, mp3, flac)
  --model <name>          trivium | aqa | laban (default: trivium)
  --beat-model <name>     beatnet+ | madmom (default: beatnet+)
  --source-sep            Run music source separation via MSNet (default: false)
  --run <id>              Workspace ID

Dependencies:
  Reads: workspace/mesh/ OR workspace/pose/ (falls back gracefully)
         workspace/source_audio.wav (extracted or provided)
  Writes: workspace/score/trivium.json, workspace/score/musicality.json,
          workspace/score/movement_spectrogram.npz, workspace/score/timeline.ndjson
```

**Scoring breakdown (TRIVIUM framework):**

```
T  Technique    — Joint angle precision, balance metrics, power move rotational consistency
R  Rhythm       — Beat alignment (cross-correlation peak at lag=0)
I  Identity     — Style uniqueness (embedding distance from "average" dancer) [PARTIALLY AUTOMATED]
V  Vocabulary   — Move diversity (unique moves / total moves via temporal segmentation)
I  Intensity    — Kinetic energy profile, acceleration peaks
U  Unity        — Round concept coherence (transition smoothness, thematic consistency) [HUMAN-JUDGED]
M  Musicality   — THE 3%: corr(audio_spectrogram, movement_spectrogram)
```

**Implementation notes:**
- The core innovation is unchanged: cross-correlate the audio STFT with joint velocity/acceleration mapped to the same time-frequency grid.
- `--source-sep` isolates drums/bass/vocals via MSNet before computing the cross-correlation. This gives separate musicality scores for "hitting the kick drum" vs "riding the melody."
- If the mesh stage was not run, scoring falls back to 3D keypoints from the pose stage. If only 2D pose is available, it still works but with reduced accuracy on depth-dependent metrics (e.g., rotational consistency in power moves).
- The `timeline.ndjson` output is a per-frame event stream suitable for visualization overlays.

### `bboy view [options]`

Launch a Three.js-based 3D viewer in the browser.

```
bboy view [options]

Input: reads workspace from stdin or --run flag

Options:
  --mode <name>           skeleton | mesh | trails | spectrogram | heatmap | freeze | all (default: skeleton)
  --port <n>              Local server port (default: 3333)
  --overlay-audio         Show audio waveform + beat grid synchronized to playback
  --overlay-score         Show live TRIVIUM scores during playback
  --export-video          Record the 3D view to MP4 via headless browser
  --run <id>              Workspace ID

Dependencies:
  Reads: workspace/mesh/ OR workspace/pose/ OR workspace/export/bbsk.json
  Launches: Local HTTP server serving a Three.js application
```

**Visualization modes (from ANALYSIS_v2.md Section 5):**
- `skeleton` — Animated stick figure with joint confidence coloring
- `mesh` — Full SMPL mesh playback with texture
- `trails` — Ghost trails: luminous paths every limb traces through space
- `spectrogram` — Movement spectrogram overlay (audio x movement cross-correlation)
- `heatmap` — Spatial energy distribution (where the dancer "burns")
- `freeze` — Freeze signature: geometric fingerprint of held positions
- `all` — Composite of all layers

### `bboy export [options]`

Export workspace data to interchange formats.

```
bboy export [options]

Input: reads workspace from stdin or --run flag

Options:
  --format <fmt>          bbsk-json | bbsk-bin | fbx | bvh | gltf | csv | parquet (default: bbsk-json)
  --include <stages>      Comma-separated: pose,mesh,score,audio (default: all available)
  --fps <n>               Resample to target fps (default: source fps)
  --run <id>              Workspace ID

Dependencies:
  Reads: workspace/pose/ and/or workspace/mesh/ and/or workspace/score/
  Writes: workspace/export/<filename>
```

### `bboy run <video>`

Full pipeline in one command.

```
bboy run video.mp4 [options]

Options:
  --audio <file>          Audio track (or extract from video)
  --stages <list>         Comma-separated stages to run (default: segment,track,pose,mesh,score)
  --until <stage>         Run pipeline up to and including this stage
  --skip <list>           Skip these stages
  --name <id>             Workspace name (default: auto-generated)
  --config <file>         Config file with model/flag overrides (default: .bboy/config.toml)

  # Model selection (passed through to individual stages)
  --segment-model <name>
  --track-model <name>
  --pose-model <name>
  --mesh-model <name>
  --score-model <name>

  # GPU control
  --device <dev>          cuda | cuda:0 | cuda:1 (default: cuda)
  --low-vram              Use smaller model variants, sacrifice accuracy

  # Output
  --view                  Auto-launch viewer after pipeline completes
  --export <fmt>          Auto-export after pipeline completes
  --dry-run               Show execution plan without running
```

### `bboy status`

```
bboy status

Output:
  bboy CLI v0.1.0

  Python:      3.12.3 (/usr/bin/python3)
  PyTorch:     2.7.1+cu118
  CUDA:        11.8  (Driver: 535.129.03)
  GPU:         NVIDIA RTX 4090 (24 GB)
  GPU Memory:  2.1 / 24.0 GB used

  Models:
    sam3 (hiera-large)     OK    ~/.bboy/checkpoints/sam3/sam3_hiera_large.pt (2.3 GB)
    cotracker3             OK    ~/.bboy/checkpoints/cotracker3/cotracker3.pth (410 MB)
    sapiens-1b             OK    ~/.bboy/checkpoints/sapiens/sapiens_1b_goliath_best.pth (4.1 GB)
    gvhmr                  OK    ~/.bboy/checkpoints/gvhmr/gvhmr_siga24_release.ckpt (260 MB)
    hsmr                   MISSING  (run: bboy init --model hsmr)
    sam-body4d             MISSING  (run: bboy init --model sam-body4d)
    beatnet+               OK    ~/.bboy/checkpoints/beatnet/BeatNet_Plus.pth (15 MB)

  Workspaces:  3 runs in .bboy/runs/ (1.2 GB total)
    20260323-143022  complete   video.mp4         5 stages  83s
    20260323-151500  failed     battle-clip.mp4   3/5       segment,track,pose (mesh failed: OOM)
    menno-2024       running    menno-finals.mp4  4/5       mesh in progress...
```

### `bboy doctor`

```
bboy doctor

Checks:
  [PASS] Python 3.12+
  [PASS] PyTorch 2.7+ with CUDA
  [PASS] CUDA toolkit 11.8+
  [PASS] ffmpeg installed (6.1.1)
  [PASS] ffprobe installed
  [WARN] nvidia-smi reports 2.1 GB used — other processes on GPU
  [PASS] SAM 3 checkpoint valid (sha256 matches)
  [PASS] CoTracker3 checkpoint valid
  [FAIL] Sapiens checkpoint missing — run: bboy init --model sapiens
  [PASS] GVHMR checkpoint valid
  [PASS] BeatNet+ checkpoint valid
  [PASS] Disk space: 42 GB free (minimum 10 GB recommended)
  [PASS] /tmp writable

  Result: 1 FAIL, 1 WARN — run 'bboy init --model sapiens' to fix
```

### `bboy init`

```
bboy init [options]

Options:
  --model <name>          Download specific model checkpoint
  --all                   Download all model checkpoints (~12 GB)
  --dir <path>            Checkpoint directory (default: ~/.bboy/checkpoints/)
  --verify                Verify existing checkpoints (sha256)

Notes:
  - SAM 3 requires Hugging Face access approval from Meta
  - SAM-Body4D requires 5 separate checkpoint sets (~25 GB total)
  - Most models download from Hugging Face Hub (huggingface-cli login required)
```

---

## 6. Configuration

### Config File Location

```
~/.bboy/config.toml           # User-level defaults
.bboy/config.toml              # Project-level overrides (checked into repo)
```

Project-level overrides user-level. CLI flags override both.

### Config Schema

```toml
[general]
device = "cuda"                # cuda | cuda:0 | cuda:1 | cpu (cpu = pain)
checkpoint_dir = "~/.bboy/checkpoints"
workspace_dir = ".bboy/runs"
log_level = "info"             # debug | info | warn | error

[defaults]
segment_model = "sam3-hiera-large"
track_model = "cotracker3"
pose_model = "sapiens-1b"
mesh_model = "gvhmr"
score_model = "trivium"
beat_model = "beatnet+"

[segment]
text_prompt = "breakdancer"
max_dancers = 2
min_mask_area = 5000
generate_preview = false

[track]
num_points = 2048
initialization = "mask"        # mask | grid

[pose]
lift_3d = true
lift_model = "motionbert"
output_topology = "bbsk33"     # bbsk33 | coco17 | halpe26

[mesh]
temporal_smoothing = true
world_grounded = true
body_model = "smpl"            # smpl | smplx | skel

[score]
source_separation = false
audio_features = "9d"          # 9d = full psychoacoustic | basic = BPM + beats only

[view]
default_mode = "skeleton"
port = 3333
auto_open_browser = true

[export]
default_format = "bbsk-json"

[gpu]
max_vram_gb = 24               # Pipeline will select model variants to fit within this budget
low_vram_mode = false          # If true, uses smallest model variants everywhere
unload_between_stages = true   # Free GPU memory between pipeline stages (default: true)
```

---

## 7. GPU Management Strategy

### The Core Constraint

These models cannot coexist on a single GPU:

```
Model              VRAM (inference)    Notes
---------------    ----------------    -----
SAM 3 (Large)      ~8 GB               Triton kernels
CoTracker3          ~4 GB               Depends on resolution + point count
Sapiens-1B         ~6 GB               Largest 2D pose model
GVHMR              ~3 GB               Relatively lightweight
SAM-Body4D         14-53 GB            The outlier
BeatNet+           ~0.5 GB             Can run on CPU
```

On an RTX 4090 (24 GB), SAM 3 + CoTracker3 + Sapiens + GVHMR totals ~21 GB. Tight, but technically possible. But loading/unloading models is simpler, more reliable, and matches the Unix pipe model (sequential execution).

### Strategy: Sequential Execution with Model Unloading

Each pipeline stage is a separate process (or at minimum, a separate model lifecycle). When a stage completes:

1. The model's GPU memory is explicitly freed (`del model; torch.cuda.empty_cache()`)
2. The next stage's model is loaded
3. GC and CUDA cache clearing happen between stages

The pipe syntax naturally enforces this: each `bboy <stage>` is a separate process with its own Python interpreter, so GPU memory is fully released when the process exits.

### Multi-GPU Support

```bash
# Explicit device assignment per stage:
bboy segment video.mp4 --device cuda:0 | bboy track --device cuda:1 | bboy pose --device cuda:0

# Config-level:
[gpu]
segment_device = "cuda:0"
track_device = "cuda:1"
pose_device = "cuda:0"
mesh_device = "cuda:1"
```

With multi-GPU, adjacent non-dependent stages could theoretically run in parallel. But in the current pipeline, every stage depends on the previous one, so parallelism only helps if you overlap the tail of one stage with the head of the next (e.g., start tracking frame 100 while segmentation is still processing frame 200). This optimization is deferred to v2.

### Cloud GPU Mode

```bash
# Run heavy stages on cloud, light stages locally
bboy segment video.mp4 | bboy track | bboy pose | \
  bboy mesh --remote lambda://instance-id | \
  bboy score --audio track.wav

# Or push the whole workspace to cloud
bboy run video.mp4 --remote runpod://pod-id
```

This is aspirational (v2+). For v0.1, users rent a cloud GPU, SSH in, and run `bboy` locally on the remote machine.

---

## 8. Directory Structure

### CLI Package

```
bboy-cli/
  pyproject.toml              # Package metadata, dependencies, entry point
  bboy/
    __init__.py
    cli.py                    # Click/Typer app definition, subcommand routing

    commands/
      __init__.py
      segment.py              # bboy segment
      track.py                # bboy track
      pose.py                 # bboy pose
      mesh.py                 # bboy mesh
      score.py                # bboy score
      view.py                 # bboy view (launches Three.js server)
      export.py               # bboy export
      run.py                  # bboy run (orchestrator)
      status.py               # bboy status
      doctor.py               # bboy doctor
      init.py                 # bboy init (checkpoint downloader)
      inspect_cmd.py          # bboy inspect
      clean.py                # bboy clean
      diff.py                 # bboy diff

    models/
      __init__.py
      sam3.py                 # SAM 3 wrapper: load, segment, unload
      cotracker3.py           # CoTracker3 wrapper
      sapiens.py              # Sapiens wrapper
      gvhmr.py                # GVHMR wrapper
      hsmr.py                 # HSMR wrapper (when available)
      sam_body4d.py           # SAM-Body4D wrapper
      genhmr.py               # GenHMR wrapper
      beatnet.py              # BeatNet+ wrapper
      msnet.py                # MSNet source separation wrapper

    scoring/
      __init__.py
      trivium.py              # TRIVIUM scoring framework
      musicality.py           # Audio x movement spectrogram cross-correlation
      aqa.py                  # Action Quality Assessment
      laban.py                # Laban Movement Analysis features

    formats/
      __init__.py
      workspace.py            # Workspace creation, discovery, manifest I/O
      bbsk.py                 # BBSK format read/write
      keypoint_remap.py       # Model-native keypoints -> BBSK 33-joint topology
      npz_io.py               # Typed NumPy array I/O helpers

    viewer/                   # Three.js viewer (static assets)
      index.html
      viewer.js
      shaders/

    utils/
      __init__.py
      gpu.py                  # GPU detection, VRAM monitoring, model unloading
      video.py                # ffmpeg/ffprobe wrappers
      progress.py             # Rich progress bars
      config.py               # TOML config loading with cascading overrides
      checksums.py            # Model checkpoint verification
```

### Checkpoint Directory

```
~/.bboy/
  config.toml                 # User-level defaults
  checkpoints/
    sam3/
      sam3_hiera_large.pt     # 2.3 GB
      sam3_hiera_base.pt      # 637 MB
    cotracker3/
      cotracker3.pth          # 410 MB
    sapiens/
      sapiens_1b_goliath_best.pth   # 4.1 GB
      sapiens_0.3b_goliath_best.pth # 1.2 GB
    gvhmr/
      gvhmr_siga24_release.ckpt    # 260 MB
    hsmr/                     # When released
    genhmr/
    sam_body4d/               # 5 checkpoint sets, ~25 GB total
    beatnet/
      BeatNet_Plus.pth        # 15 MB
    msnet/
    motionbert/
      motionbert_pretrained.pth
    smpl/
      SMPL_NEUTRAL.pkl        # SMPL body model
```

---

## 9. Implementation Language Decision

**Python with Click (not Typer).**

Rationale:

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **Python + Click** | Zero FFI friction (all models are PyTorch). Click is mature, composable, well-documented. Rich for progress bars. | Python startup time (~300ms). Not the fastest CLI. | **CHOSEN** |
| Python + Typer | Type hints as CLI args. Less boilerplate. | Typer is a thin wrapper over Click. Adds a dependency for minimal gain. Auto-generated help sometimes worse than handwritten Click help. | Close second |
| Rust | Fast startup. Binary distribution. | Every model call goes through PyO3 or subprocess. Massive FFI complexity. Two build systems (cargo + pip). | No |
| Go | Fast startup. Single binary. | Same FFI problem as Rust but worse (cgo is painful). No ecosystem for ML. | No |
| TypeScript/Bun | Fast for the viewer (Three.js). | Models are Python. Would need to shell out for every stage. Two runtimes. | No, except for the viewer component |

The viewer (`bboy view`) is the one component that benefits from JavaScript/TypeScript. It is a separate artifact: a static Three.js application served by a Python HTTP server. The Python CLI launches it; the viewer reads BBSK files.

### Key Dependencies

```toml
[project]
name = "bboy-cli"
version = "0.1.0"
requires-python = ">=3.12"

[project.scripts]
bboy = "bboy.cli:app"

[project.dependencies]
click = ">=8.1"
rich = ">=13.0"         # Progress bars, tables, status display
tomli = ">=2.0"         # TOML config parsing (stdlib in 3.11+ but tomli for write)
tomli-w = ">=1.0"       # TOML writing
numpy = ">=1.26"
torch = ">=2.4"
torchvision = ">=0.19"

[project.optional-dependencies]
sam3 = ["segment-anything-3"]      # SAM 3
cotracker = ["cotracker"]          # CoTracker3
sapiens = ["sapiens-body"]         # Sapiens pose
gvhmr = ["gvhmr"]                  # GVHMR mesh
score = ["librosa", "soundfile"]   # Audio analysis
view = []                          # No extra deps (static HTML/JS)
all = ["bboy-cli[sam3,cotracker,sapiens,gvhmr,score]"]
```

Model dependencies are optional extras so users only install what they need. `bboy doctor` checks which are available.

---

## 10. Ergonomic Details

### Progress Display

Every stage shows a Rich progress bar with:

```
segment  [████████████████████░░░░]  83%  1497/1800 frames  ETA 14s  GPU: 7.2/24.0 GB
```

In pipe mode (stdout is not a TTY), progress goes to stderr so it does not corrupt the JSON manifest flowing through the pipe:

```bash
# Progress on stderr (visible), JSON manifest on stdout (piped)
bboy segment video.mp4 2>/dev/null | bboy track
```

### `--dry-run`

Every command supports `--dry-run`, which prints the execution plan:

```bash
$ bboy run video.mp4 --audio track.wav --dry-run

  bboy run — Execution Plan

  Video:   video.mp4 (1920x1080, 30fps, 60.0s, 1800 frames)
  Audio:   track.wav (44100 Hz, stereo, 60.2s)
  Device:  cuda (NVIDIA RTX 4090, 24 GB)

  Stage 1: segment
    Model:    sam3-hiera-large (2.3 GB checkpoint)
    VRAM:     ~8 GB peak
    Est time: ~90s
    Output:   .bboy/runs/20260323-160000/segment/

  Stage 2: track
    Model:    cotracker3 (410 MB checkpoint)
    VRAM:     ~4 GB peak
    Est time: ~30s
    Input:    segment/masks.npz + source.mp4
    Output:   .bboy/runs/20260323-160000/track/

  Stage 3: pose
    Model:    sapiens-1b (4.1 GB checkpoint)
    VRAM:     ~6 GB peak
    Est time: ~120s
    Input:    segment/bboxes.ndjson + source.mp4
    Output:   .bboy/runs/20260323-160000/pose/

  Stage 4: mesh
    Model:    gvhmr (260 MB checkpoint)
    VRAM:     ~3 GB peak
    Est time: ~45s
    Input:    pose/keypoints_2d.npz + source.mp4
    Output:   .bboy/runs/20260323-160000/mesh/

  Stage 5: score
    Model:    trivium + beatnet+ (15 MB checkpoint)
    VRAM:     ~0.5 GB peak (BeatNet+) + CPU (features)
    Est time: ~15s
    Input:    mesh/ + source_audio.wav
    Output:   .bboy/runs/20260323-160000/score/

  Total estimated time: ~5 min
  Total VRAM peak: 8 GB (sequential, models unloaded between stages)
  Workspace: .bboy/runs/20260323-160000/

  Run without --dry-run to execute.
```

### Resume

If a run fails mid-pipeline, `bboy resume` picks up where it left off:

```bash
$ bboy mesh --run 20260323-151500
# => OOM error at frame 847

$ bboy resume --run 20260323-151500
# => Detected: segment OK, track OK, pose OK, mesh FAILED at frame 847
# => Resuming mesh from frame 847 with --low-vram flag...
```

The workspace's `manifest.json` tracks which stages completed and which failed with error details.

### Bash/Zsh Completions

```bash
# Install completions
bboy --install-completion

# Provides:
#   bboy <TAB>          => segment track pose mesh score view export run ...
#   bboy segment <TAB>  => suggests .mp4 files
#   bboy --run <TAB>    => suggests existing workspace IDs
#   bboy mesh --model <TAB> => gvhmr hsmr sam-body4d genhmr
```

---

## 11. Data Flow Diagram

```
                           .bboy/runs/<id>/
                          ┌─────────────────────────────────────────────────┐
                          │                                                 │
  video.mp4 ──symlink──>  │  source.mp4                                     │
  track.wav ──copy────>   │  source_audio.wav                               │
                          │                                                 │
                          │  ┌──────────┐                                   │
                     ┌────┤  │ segment/ │  masks.npz, bboxes.ndjson         │
                     │    │  └────┬─────┘                                   │
                     │    │       │                                         │
                     │    │  ┌────▼─────┐                                   │
  source.mp4 ────────┤    │  │  track/  │  tracks.npz, visibility.npz      │
  (side channel)     │    │  └────┬─────┘                                   │
                     │    │       │                                         │
                     │    │  ┌────▼─────┐                                   │
                     ├────┤  │  pose/   │  keypoints_2d.npz, keypoints_3d   │
                     │    │  └────┬─────┘                                   │
                     │    │       │                                         │
                     │    │  ┌────▼─────┐                                   │
                     └────┤  │  mesh/   │  vertices.npz, world_traj.npz    │
                          │  └────┬─────┘                                   │
                          │       │                                         │
                          │  ┌────▼─────┐                                   │
  source_audio.wav ───────┤  │  score/  │  trivium.json, musicality.json   │
                          │  └────┬─────┘                                   │
                          │       │                                         │
                          │  ┌────▼─────┐                                   │
                          │  │ export/  │  bbsk.json, bbsk.bin              │
                          │  └──────────┘                                   │
                          │                                                 │
                          │  manifest.json   (run state, stage status)      │
                          └─────────────────────────────────────────────────┘

  STDOUT pipe (JSON Lines):
  ─────────────────────────────────────────────────────────────────────────>
  {"workspace":"...","stage":"segment","status":"complete"} │
  {"workspace":"...","stage":"track","status":"complete"}   │
  {"workspace":"...","stage":"pose","status":"complete"}    │  one line
  {"workspace":"...","stage":"mesh","status":"complete"}    │  per stage
  {"workspace":"...","stage":"score","status":"complete"}   │
```

---

## 12. Workspace Manifest (manifest.json)

```json
{
  "version": "0.1.0",
  "id": "20260323-143022",
  "name": null,
  "created_at": "2026-03-23T14:30:22.000Z",
  "source": {
    "video": "source.mp4",
    "video_original_path": "/home/user/videos/battle-clip.mp4",
    "audio": "source_audio.wav",
    "audio_original_path": "/home/user/audio/track.wav",
    "video_info": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "duration_s": 60.0,
      "total_frames": 1800,
      "codec": "h264"
    }
  },
  "config_snapshot": {
    "segment_model": "sam3-hiera-large",
    "track_model": "cotracker3",
    "pose_model": "sapiens-1b",
    "mesh_model": "gvhmr",
    "score_model": "trivium",
    "device": "cuda"
  },
  "stages": {
    "segment": {
      "status": "complete",
      "started_at": "2026-03-23T14:30:22.000Z",
      "completed_at": "2026-03-23T14:31:45.000Z",
      "duration_s": 83.0,
      "output_files": ["segment/masks.npz", "segment/bboxes.ndjson", "segment/meta.json"]
    },
    "track": {
      "status": "complete",
      "started_at": "2026-03-23T14:31:46.000Z",
      "completed_at": "2026-03-23T14:32:18.000Z",
      "duration_s": 32.0,
      "output_files": ["track/tracks.npz", "track/visibility.npz", "track/meta.json"]
    },
    "pose": {
      "status": "complete",
      "started_at": "2026-03-23T14:32:19.000Z",
      "completed_at": "2026-03-23T14:34:21.000Z",
      "duration_s": 122.0,
      "output_files": ["pose/keypoints_2d.npz", "pose/keypoints_3d.npz", "pose/meta.json"]
    },
    "mesh": {
      "status": "failed",
      "started_at": "2026-03-23T14:34:22.000Z",
      "failed_at": "2026-03-23T14:35:10.000Z",
      "duration_s": 48.0,
      "error": "CUDA out of memory. Tried to allocate 2.1 GB. GPU 0 has 24.0 GB total, 1.8 GB free.",
      "frames_completed": 847,
      "output_files": ["mesh/meta.json"]
    },
    "score": {
      "status": "pending"
    }
  }
}
```

---

## 13. Error Handling and Edge Cases

### Missing Stages

Each stage checks for its dependencies and fails with a clear message:

```
$ bboy mesh --run 20260323-143022
Error: Stage 'mesh' requires 'pose' output (keypoints_2d.npz) but stage 'pose' has not been run.
Run: bboy pose --run 20260323-143022
```

### Multiple Dancers

The segment stage assigns dancer IDs. All downstream stages maintain per-dancer arrays:

```python
# masks.npz contains one array per dancer
masks_dancer_0 = data["dancer_0"]  # [T, H, W] uint8
masks_dancer_1 = data["dancer_1"]  # [T, H, W] uint8

# keypoints_2d.npz shape: [T, N_dancers, 33, 3]
# The N_dancers dimension is set by segment's dancer count
```

### No Audio

If `--audio` is not provided to `bboy score`, the system attempts to extract audio from the video via ffmpeg. If the video has no audio track, musicality scoring is skipped and only movement-based TRIVIUM dimensions are computed (Technique, Vocabulary, Intensity).

### Interrupted Pipeline (Ctrl+C)

On SIGINT:
1. The current stage writes a partial meta.json with `"status": "interrupted"` and `"frames_completed": N`
2. GPU memory is released
3. Workspace remains on disk for `bboy resume`

### Video Format Support

Any format ffmpeg can decode. Before processing, the video is probed with ffprobe. If the video uses variable frame rate (VFR), it is re-encoded to constant frame rate (CFR) using ffmpeg. This is written to `source_cfr.mp4` in the workspace, and `manifest.json` notes the conversion.

---

## 14. What Is NOT in v0.1

These are explicitly deferred:

| Feature | Why deferred |
|---------|-------------|
| Real-time / streaming mode | v0.1 is offline batch processing. Streaming requires architecture changes (sliding windows, model warm-up). |
| Cloud GPU orchestration (`--remote`) | Shell into cloud box and run locally for v0.1. |
| Multi-camera fusion | Single monocular camera only. |
| Training / fine-tuning commands | v0.1 uses pretrained models as-is. |
| Battle mode (two dancers, turn detection) | v0.1 handles the segmented dancer. Turn detection (who is dancing vs. standing) is a separate classifier. |
| Plugin system for custom models | The `--model` flag with hardcoded options is sufficient for v0.1. |
| Web UI / dashboard | `bboy view` is a viewer, not a dashboard. A full web UI with run management is v2. |
| iPhone capture companion app | Capture on iPhone, transfer video, run `bboy` on a GPU machine. |

---

## 15. Example Sessions

### Minimal: Just Get a Skeleton

```bash
# Install with only pose estimation
pip install bboy-cli[sapiens]
bboy init --model sapiens

# Run only segment + pose (skip track, mesh, score)
bboy segment battle.mp4 | bboy pose
bboy view --run latest --mode skeleton
```

### Full Pipeline

```bash
# Install everything
pip install bboy-cli[all]
bboy init --all

# Full run
bboy run battle.mp4 --audio dj-set.wav --name "finals-round-3"

# View results
bboy view --run finals-round-3 --mode all --overlay-score --overlay-audio

# Export for Blender
bboy export --run finals-round-3 --format fbsk-json
```

### Model Comparison

```bash
# Run mesh with two different models on the same video
bboy segment video.mp4 | bboy pose > /dev/null
bboy mesh --run latest --model gvhmr
cp -r .bboy/runs/latest .bboy/runs/latest-gvhmr

bboy mesh --run latest --model hsmr
cp -r .bboy/runs/latest .bboy/runs/latest-hsmr

bboy diff latest-gvhmr latest-hsmr
```

### Headless Batch Processing

```bash
# Process a directory of videos overnight
for video in battles/*.mp4; do
  name=$(basename "$video" .mp4)
  bboy run "$video" --audio "audio/${name}.wav" --name "$name" --export bbsk-json 2>>"batch.log"
done
```

### Quick Musicality Check (Skip Mesh)

```bash
# Pose is enough for basic musicality scoring
bboy segment video.mp4 | bboy pose | bboy score --audio track.wav
cat .bboy/runs/latest/score/trivium.json | jq '.musicality'
```

---

## 16. Open Design Questions

| # | Question | Options | Leaning |
|---|----------|---------|---------|
| 1 | Should `bboy track` be optional? Pose models already detect keypoints without explicit point tracking. | Track is redundant for pose but useful for trails visualization and custom point tracking (e.g., tracking a prop). | Make track optional; skip by default in `bboy run` unless `--with-track` is passed. |
| 2 | Should the Three.js viewer be a separate package? | Separate npm package vs. bundled static assets in the Python package. | Bundle in Python package for v0.1. Separate package when the viewer grows complex. |
| 3 | SMPL vs. SKEL body model for the default mesh output? | SMPL is universal but has 72 pose params. SKEL (used by HSMR) has 46 DOF with biomechanical constraints. | SMPL for compatibility. Store SKEL alongside if HSMR is the mesh model. |
| 4 | Should `bboy score` require `--audio` or auto-extract from video? | Explicit is clearer; auto-extract is more convenient. | Auto-extract by default, `--audio` to override. Warn if video has no audio track. |
| 5 | Workspace location: `.bboy/` in CWD or `~/.bboy/runs/`? | CWD is project-local (git-friendly). Home is global (no clutter). | CWD (`.bboy/`) is better because different projects/videos should have separate workspaces. Add `.bboy/` to `.gitignore`. |
| 6 | Should the pipe output be the final stage's full result or just the manifest pointer? | Full result on stdout is more Unix-like but huge for mesh data. Manifest pointer is a reference. | Manifest pointer only. Use `bboy inspect` or read workspace files for full data. |

---

## 17. Relationship to Existing Artifacts

| Artifact | How `bboy` CLI relates |
|----------|----------------------|
| TECH_STACK_REEVALUATION.md | Defines the model lineup. CLI wraps these models. |
| SAM_BODY4D_VIABILITY_SPIKE.md | Informs the `--model sam-body4d` option and its warnings. GVHMR is the safer default. |
| BBSK format (phase-3) | The `bboy export` output format. Workspace `.npz` files are internal; BBSK is the interchange format. |
| analyze_track.py | The 9D psychoacoustic feature extractor. Integrated into `bboy score` as the audio feature backend. |
| MATLAB audio engine | The upstream research. `analyze_track.py` is the Python port. `bboy score` calls it. |
| ANALYSIS_v2.md TRIVIUM framework | The scoring model. `bboy score --model trivium` implements it. |
| Three.js visualization modes | `bboy view` implements skeleton, trails, spectrogram, heatmap, freeze modes from Section 5. |

---

## 18. Next Steps (After This Spec)

1. **Spike: `bboy segment` + `bboy pose` on one BRACE clip.** Prove SAM 3 segmentation and Sapiens pose work end-to-end. This validates the workspace model and .npz data flow without touching the harder mesh/score stages.

2. **Spike: `bboy mesh --model gvhmr` vs `--model hsmr` on BRACE inversions.** The $5 cloud GPU experiment from SAM_BODY4D_VIABILITY_SPIKE.md. This determines the default mesh model.

3. **Implement `bboy score` with `analyze_track.py`.** The audio-movement cross-correlation is the core innovation. Wire it up with even rough pose data to prove the 3% works.

4. **Ship `bboy view` as a standalone viewer.** The Three.js viewer can be developed and tested with synthetic BBSK data before the full pipeline exists.
