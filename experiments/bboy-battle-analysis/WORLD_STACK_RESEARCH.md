# World Stack: 4D Human Recovery Pipeline Research
## Monocular Video to World-Grounded Coordinates for Breakdancing Analysis

**Date**: 2026-03-23
**Scope**: Deep research on the "world stack" -- the chain of models needed to recover absolute 3D human position (in meters) from a single monocular video of a breakdancing battle.

---

## Table of Contents

1. [MASt3R: Matching And Stereo 3D Reconstruction](#1-mast3r)
2. [MonST3R: Motion DUSt3R for Dynamic Scenes](#2-monst3r)
3. [TRAM: Dual-Masking SLAM Implementation](#3-tram-dual-masking)
4. [Metric Depth Comparison (March 2026)](#4-metric-depth-comparison)
5. [Gravity-View (GV) Coordinate System](#5-gravity-view-coordinates)
6. [Pipeline Integration Analysis](#6-pipeline-integration)

---

## 1. MASt3R

**Paper**: "Grounding Image Matching in 3D with MASt3R"
**Authors**: Vincent Leroy, Yohann Cabon, Jerome Revaud (NAVER LABS Europe)
**Venue**: ECCV 2024
**arXiv**: 2406.09756
**Code**: https://github.com/naver/mast3r (released, weights available)

### What It Is

MASt3R builds on DUSt3R (Dense and Unconstrained Stereo 3D Reconstruction), which was the breakthrough that reframed multi-view 3D reconstruction as direct pointmap regression rather than the classical detect-match-triangulate pipeline. DUSt3R takes two images, passes them through a shared ViT encoder (Siamese), then through two transformer decoders with cross-attention, and directly regresses two 3D pointmaps -- one per image, both expressed in the coordinate frame of the first image. No camera intrinsics needed. No feature matching needed. The network just outputs 3D points.

MASt3R augments DUSt3R with a new head that outputs dense local features alongside the pointmaps, trained with an additional matching loss. It introduces a fast reciprocal matching scheme (FastNN) that accelerates matching by orders of magnitude while providing theoretical guarantees on match quality. This matters because when you have more than two images (i.e., a video), you need to establish correspondences across many pairs to build a globally consistent reconstruction.

### How It Reconstructs 3D Scenes

Given an image pair, the network outputs:
- Two 3D pointmaps (X^{1,1} and X^{2,1}, both in image-1's coordinate frame)
- Two confidence maps
- Two dense local feature maps (MASt3R addition)

For multi-view (>2 images), the process is:
1. Compute pairwise pointmaps for selected image pairs
2. Use global optimization to align all pairwise predictions into a common reference frame
3. The result is camera poses + dense scene point cloud

The training data consists of 650K image pairs sampled from 14 datasets (Mapfree, Waymo, VirtualKitti, etc.), giving it strong generalization.

### Is This a SLAM Replacement?

Not directly -- MASt3R is feed-forward per pair with offline global optimization, not a real-time tracking system. However, **MASt3R-SLAM** (Murai, Dexheimer, Davison; CVPR 2025) wraps MASt3R into a full real-time SLAM system:
- Runs at **15 FPS** on a consumer RTX 4090
- Produces globally consistent camera poses + dense geometry
- Outperforms DROID-SLAM on trajectory accuracy and dense reconstruction (7-Scenes, EuRoC)
- Works with uncalibrated cameras (no intrinsics needed)
- Uses GPU-accelerated CUDA kernels for iterative projective matching (2ms per match)

MASt3R-SLAM is a direct replacement for DROID-SLAM in the world stack, with the advantage of producing a dense scene point cloud as a byproduct. This is significant: TRAM uses DROID-SLAM for camera trajectory only, but MASt3R-SLAM gives you both camera trajectory AND scene geometry in one shot.

### Monocular Video Compatibility

Yes. Sequential video frames are treated as image pairs. MASt3R processes overlapping pairs (frame t, frame t+k) and the global optimization fuses them. The 512px largest-dimension constraint is the main limitation -- high-res input gets resized. Inference latency is ~198ms per pair on A40 (reduced to ~91ms with Speedy MASt3R optimization).

### How JOSH Uses MASt3R

JOSH (Joint Optimization for 4D Human-Scene Reconstruction, ICLR 2026) uses MASt3R as its frozen backbone:
- The MASt3R encoder + decoder are kept frozen
- A new **human trajectory head** is added that processes masked image features to predict relative human transformation between adjacent frames
- JOSH3R (the feed-forward variant) outputs dense scene points + human trajectory in a single forward pass at **15.4 FPS** on RTX 4090
- The optimization variant (JOSH) runs at **0.8 FPS** but achieves **W-MPJPE 174.7mm** (vs TRAM's 222.4mm)

### Hardware Requirements

- Base MASt3R: ~8-16GB VRAM for pairs, more for multi-view global optimization (>120 images needs >16GB)
- MASt3R-SLAM: RTX 4090 for real-time 15 FPS
- JOSH/JOSH3R: RTX 4090 recommended; training used 2x4090

### Release Status

- MASt3R: Fully released (code + weights) at github.com/naver/mast3r
- MASt3R-SLAM: Fully released (code + weights) at github.com/rmurai0610/MASt3R-SLAM
- JOSH: Code released at github.com/genforce/JOSH; JOSH3R demo and evaluation "to be updated before ICLR conference" (pending as of March 2026)

---

## 2. MonST3R

**Paper**: "MonST3R: A Simple Approach for Estimating Geometry in the Presence of Motion"
**Authors**: Junyi Zhang et al.
**Venue**: ICLR 2025
**arXiv**: 2410.03825
**Code**: https://github.com/Junyi42/monst3r (released, weights on HuggingFace + Google Drive)

### What It Is

MonST3R ("Motion DUSt3R") extends DUSt3R to handle **dynamic scenes** -- the critical gap that makes DUSt3R/MASt3R fail when there are moving objects (like a breakdancer). The key insight is deceptively simple: instead of predicting a single static pointmap per image, predict a **per-timestep pointmap** that captures the geometry at each moment in time.

### Relationship to DUSt3R/MASt3R

MonST3R is a fine-tuned version of DUSt3R. The architecture is identical -- same ViT encoder, same transformer decoders, same regression heads. The difference is purely in the training:
- DUSt3R was trained on static scene pairs
- MonST3R is fine-tuned on a small set of dynamic video datasets
- This fine-tuning teaches the network to produce time-varying pointmaps that correctly place moving objects at their actual depth, rather than incorrectly snapping them to background geometry

### Dynamic Scene Handling

DUSt3R has two failure modes with dynamic scenes:
1. It incorrectly aligns pointmaps based on moving foreground objects rather than static background
2. It places moving objects at incorrect depths (typically pushing them to background)

MonST3R fixes both. For a video input, it:
1. Computes pairwise pointmaps for frame pairs using the fine-tuned network
2. Computes optical flow from off-the-shelf methods
3. Runs global optimization to produce a time-varying 3D point cloud + per-frame camera poses + intrinsics

The output naturally contains both static scene geometry and dynamic object positions at each timestep.

### Static/Dynamic Separation

MonST3R does **not** explicitly segment static from dynamic regions. Instead, the per-timestep pointmap representation implicitly handles dynamics: static points will be consistent across timesteps, while dynamic points will move. Downstream, you can separate them by checking temporal consistency of the point positions. The paper demonstrates this enables dynamic/static scene segmentation as a downstream task.

### Hardware Requirements

- **~33GB VRAM** for processing ~65 frames
- Global optimization: ~1 minute for 60 frames on RTX 6000
- Memory-efficient mode available (non-batchified, slower but lower VRAM)
- Window-wise inference mode for longer videos

This is the most memory-hungry component in the stack. An RTX 4090 (24GB) can handle shorter clips (~40-45 frames). An A100 (40/80GB) is comfortable for longer sequences.

### Plug-and-Play Assessment

MonST3R is a strong candidate for the world stack but has a key limitation: it doesn't produce metric-scale output. The pointmaps are in an arbitrary coordinate frame. You would still need a metric depth model to establish absolute scale, similar to how TRAM uses ZoeDepth for scale recovery. However, MonST3R gives you both camera poses AND scene geometry AND dynamic object positions, which is more than DROID-SLAM provides.

---

## 3. TRAM Dual-Masking Implementation

**Paper**: "TRAM: Global Trajectory and Motion of 3D Humans from in-the-wild Videos"
**Authors**: Yufu Wang, Ziyun Wang, Lingjie Liu, Kostas Daniilidis (UPenn)
**Venue**: ECCV 2024
**arXiv**: 2403.17346
**Code**: https://github.com/yufu-wang/tram (released, checkpoints available)

### The Dual-Masking Procedure

TRAM's innovation is making SLAM robust to dynamic humans. Standard SLAM assumes a static scene -- a breakdancer windmilling through the frame catastrophically breaks the bundle adjustment. TRAM solves this with dual masking applied to DROID-SLAM:

**Step 1 -- Human Detection + Segmentation**:
- YOLOv7 detects human bounding boxes
- Bounding boxes are used as prompts for **SAM (Segment Anything Model)**
- SAM produces per-frame segmentation masks of the dancer

**Step 2 -- Input Image Masking**:
- The segmentation mask is applied to input images, setting human pixels to zero
- This prevents the ViT encoder from extracting features on the dynamic human region
- The SLAM system only "sees" the static background (battle circle, walls, floor, crowd)

**Step 3 -- Bundle Adjustment Masking**:
- In DROID-SLAM's dense bundle adjustment (DBA), flow confidence weights for masked pixels are set to zero
- This removes dynamic pixels from the reprojection error calculation
- The camera trajectory optimization only considers static scene correspondences

The dual nature is critical: masking the input alone is insufficient because residual features can leak; masking DBA confidence alone is insufficient because the encoder still gets confused by dynamic regions. Both masks together make SLAM robust.

### Metric Scale Recovery -- The Math

Monocular SLAM produces camera trajectory up to an arbitrary scale factor. To convert to meters, TRAM uses a robust least-squares optimization:

**Objective**: Find scaling factor alpha that aligns SLAM depth to metric depth:

```
E(alpha) = sum_{h,w} rho(alpha * d_slam(h,w) - D_metric(h,w))
```

Where:
- `alpha` is the unknown metric scale factor
- `d_slam(h,w)` is the SLAM depth at pixel (h,w) in arbitrary units
- `D_metric(h,w)` is the metric depth prediction from ZoeDepth (in meters)
- `rho` is the **Geman-McClure robust loss function**: `rho(x) = x^2 / (x^2 + sigma^2)`

The Geman-McClure loss is crucial -- it's a redescending M-estimator that completely suppresses outliers beyond a threshold. Metric depth predictions are noisy, especially in sky/distant regions, so a robust loss prevents those outliers from corrupting the scale estimate.

**Implementation details**:
1. Solve independently for each keyframe using BFGS optimization
2. Threshold out far regions (sky, distant buildings) before optimization
3. Take the **median across all keyframes** as the final scale factor
4. Apply the median scale to convert the entire SLAM trajectory to meters

The median-of-per-keyframe-estimates is a second layer of robustness -- even if some keyframes have poor metric depth, the median is stable.

### Code Availability

Fully released at github.com/yufu-wang/tram with trained checkpoints and example videos. The VIMO (Video Motion) transformer model for camera-space human mesh recovery is included. Dependencies include DROID-SLAM, SAM, YOLOv7, ZoeDepth, and SMPL model files.

### Reusability of Components

The dual-masking SLAM component is highly modular. You could:
- Swap ZoeDepth for DepthPro/Metric3D v2 for better metric depth
- Swap DROID-SLAM for MASt3R-SLAM for better trajectory + dense geometry
- Swap SAM v1 for SAM 2 for better temporal consistency of masks
- Keep the Geman-McClure scale optimization as-is -- it's mathematically sound and model-agnostic

---

## 4. Metric Depth Comparison (March 2026)

### The Core Question

Which model gives actual **meters** (not relative/affine-invariant depth)?

| Model | Type | Metric? | Speed | Key Advantage |
|-------|------|---------|-------|---------------|
| **DepthPro** | Foundation model | Yes, zero-shot metric | ~0.3s per 2.25MP image | Best zero-shot accuracy + sharp boundaries |
| **Metric3D v2** | Foundation model | Yes, zero-shot metric | ~0.3-0.5s (ViT-L) | Best NYU/KITTI benchmarks, also predicts surface normals |
| **UniDepth V2** | Foundation model | Yes, zero-shot metric | 30% faster than V1 on RTX4090 | No camera intrinsics needed, confidence output |
| **Depth Anything V2** | Foundation + fine-tune | Only with metric fine-tuning | Fast (multiple model sizes) | Separate indoor/outdoor metric variants |

### Detailed Analysis

**DepthPro** (Apple, ICLR 2025):
- Directly predicts metric depth in meters from a single image
- Also estimates focal length (no camera intrinsics needed)
- Sharp boundary accuracy (highest F1 score for boundary recall)
- Trained on real + synthetic mix with multi-scale ViT architecture
- Best zero-shot generalization across diverse scenes
- GPU: runs on consumer GPUs, ~0.3s inference

**Metric3D v2** (2024, IEEE TPAMI):
- Zero-shot metric depth: AbsRel 0.067, delta_1 0.980 on NYUv2; AbsRel 0.051, delta_1 0.977 on KITTI
- Also predicts surface normals (useful for ground plane estimation)
- Trained on 16M+ images from thousands of camera models
- ViT-g (giant) model is most accurate; ViT-L is faster
- The surface normal output is a unique advantage -- you can estimate the ground plane directly

**UniDepth V2** (2025):
- Camera-agnostic: predicts both depth and camera intrinsics
- New edge-guided loss for sharper depth boundaries
- Outputs uncertainty/confidence per pixel
- 30%+ faster than V1 on RTX 4090
- delta_1 scores: 98.8 NYUv2, 96.4 SUN-RGBD, 85.2 ETH3D, 94.5 IBims-1

**Depth Anything V2** (TikTok/ByteDance, NeurIPS 2024):
- Base model is **relative depth only** (not metric)
- Metric variants are fine-tuned on specific domains (indoor vs outdoor)
- Six metric models released: 3 scales x 2 domains (indoor/outdoor)
- The indoor-outdoor split is a limitation for battle circles (which are often semi-outdoor/gym environments)
- Excellent as a relative depth backbone but requires fine-tuning for metric use

### Recommendation for Breakdancing Pipeline

**DepthPro** or **Metric3D v2** are the top choices for the scale recovery step:

1. **DepthPro** if you want simplicity -- it directly outputs metric depth + focal length, no intrinsics needed
2. **Metric3D v2** if you want the most benchmarked accuracy AND surface normals (ground plane estimation is valuable for bboy analysis -- knowing the floor plane helps anchor the coordinate system)

For the specific use case of a battle circle at 2-5m camera distance:
- Both models have been validated on indoor/outdoor scenes at this range
- DepthPro's reported ~14cm error at 3m is likely representative of current SOTA performance in this regime
- The absolute errors at 2-5m are typically 3-7% of the depth (so 6-35cm), which is sufficient for trajectory-level accuracy but not for fine joint positioning

**Neither model alone is sufficient for world-grounded coordinates** -- they provide per-frame depth but not camera trajectory. They are a component in the scale recovery step, not a standalone solution.

---

## 5. Gravity-View (GV) Coordinate System

**Paper**: "World-Grounded Human Motion Recovery via Gravity-View Coordinates"
**Authors**: Zehong Shen et al. (Zhejiang University)
**Venue**: SIGGRAPH Asia 2024
**arXiv**: 2409.06662
**Code**: https://github.com/zju3dv/GVHMR (released, checkpoint available)

### How the GV Frame Is Defined

The GV coordinate system is constructed per-frame from two vectors:

1. **Gravity direction** g (pointing downward in world coordinates)
2. **Camera view direction** v (the normal vector of the image plane, i.e., the camera's z-axis in world coordinates)

The three axes are:
- **Y-axis**: y = g (aligned with gravity, pointing down)
- **X-axis**: x = y x v (cross product -- perpendicular to both gravity and view direction)
- **Z-axis**: z = x x y (right-hand rule)

The rotation from camera frame to GV frame is:

```
R_c2gv = [x, y, z]^T
```

And the per-frame GV orientation of the human is:

```
Gamma_GV = R_c2gv * Gamma_camera
```

### Why This Is Clever

The GV system has exactly **1 degree of freedom** between consecutive frames: rotation around the gravity axis (yaw). Pitch and roll relative to gravity are already resolved. This means:
- Error accumulation along the gravity direction is eliminated
- The network only needs to predict yaw changes between frames
- This is fundamentally easier than predicting full 3-DoF rotations

Compare to WHAM (autoregressive, predicts full rotations): accumulated gravity-direction errors cause the human to "float" or "sink" over long sequences. GVHMR avoids this entirely.

### Gravity Direction Estimation

GVHMR does **not** estimate gravity from visual cues like vanishing points. It gets gravity indirectly through camera rotation estimation:

**Option A -- DPVO (Deep Patch Visual Odometry)**: Estimates relative camera rotations between frames. Recent update (March 2025): replaced DPVO with a simpler custom "SimpleVO" that is more efficient and compatible.

**Option B -- Phone Gyroscope/IMU**: On datasets like EMDB that include ARKit gyroscope data, ground-truth camera rotations are used directly.

The critical insight: the camera rotation encodes gravity implicitly. If you know how the camera rotated between frames, and you assume gravity is constant (it is), you can decompose the rotation into gravity-aligned and gravity-perpendicular components. The paper shows only **1.6mm W-MPJPE difference** between using ground-truth gyro vs. DPVO-estimated rotations, meaning visual odometry is sufficient.

### Handheld Phone Camera Compatibility

Yes, explicitly designed for this. The method works with dynamic handheld cameras:
- Tested on EMDB-2 (dynamic camera dataset)
- The GV frame automatically adapts to camera tilt -- as the phone tilts, the GV frame rotates accordingly because it's defined by both gravity AND view direction
- The per-frame definition means there's no assumption about initial camera orientation
- Performance degrades gracefully with extreme camera motion (the SimpleVO or DPVO still needs reasonable frame-to-frame overlap)

### Inference Speed

The paper reports the network runs at **5100 FPS** for the pose prediction component alone. The bottleneck is preprocessing (2D detection, keypoint estimation, visual odometry), not the GV-coordinate transformer.

### Plug-and-Play Assessment

GVHMR is the most modular component in the stack. It takes:
- **Input**: Video + 2D keypoints + camera rotations (from any VO system)
- **Output**: Per-frame SMPL parameters in GV coordinates + root velocity + contact probabilities

You can replace the camera rotation source (DPVO, MASt3R-SLAM, phone gyro) without touching the core network. The contact probability output is particularly valuable for breakdancing -- it tells you which body parts are in contact with the ground, enabling floor-anchored trajectory recovery.

---

## 6. Pipeline Integration Analysis

### Current SOTA Architecture (JOSH, W-MPJPE 175mm)

```
Video --> MASt3R (frozen encoder) --> Scene Pointmaps + Human Features
                                          |                    |
                                    Global Optim          Trajectory Head
                                          |                    |
                                    Camera Poses +      Human SMPL in
                                    Scene Geometry      World Coords
                                          |                    |
                                          +-- Joint Optimization --+
                                          |   (contact constraints) |
                                          +------------------------+
                                                    |
                                          4D Human-Scene Reconstruction
```

### Proposed Modular Pipeline for Breakdancing

Based on this research, the optimal modular pipeline would be:

```
Layer 1 - SLAM/Scene:    MASt3R-SLAM (15 FPS, dense geometry + camera poses)
Layer 2 - Masking:       SAM 2 (temporal mask of dancer for clean SLAM)
Layer 3 - Scale:         DepthPro or Metric3D v2 (SLAM scale --> meters)
Layer 4 - Human Mesh:    GVHMR (per-frame SMPL in GV coordinates, 5100 FPS)
Layer 5 - Integration:   Geman-McClure scale optimization + contact constraints
```

### Component Compatibility Matrix

| Component | Released? | Weights? | M1 Max? | RTX 4090? | Modular? |
|-----------|-----------|----------|---------|-----------|----------|
| MASt3R | Yes | Yes | Slow (~2 FPS) | Yes (15 FPS as SLAM) | Yes |
| MASt3R-SLAM | Yes | Yes | No (CUDA required) | Yes (15 FPS) | Yes |
| MonST3R | Yes | Yes | Very slow | Yes (~1 FPS for optim) | Partial |
| TRAM | Yes | Yes | No (CUDA required) | Yes | Yes |
| JOSH | Yes | Partial | No | Yes (0.8 FPS) | No (monolithic) |
| JOSH3R | Coming soon | No | No | Yes (15.4 FPS) | No |
| DepthPro | Yes | Yes | Yes (~1s) | Yes (~0.3s) | Yes |
| Metric3D v2 | Yes | Yes | Slow | Yes | Yes |
| UniDepth V2 | Yes | Yes | Slow | Yes | Yes |
| GVHMR | Yes | Yes | Feasible | Yes | Yes |

### Key Trade-offs

**JOSH vs. Modular Pipeline**: JOSH achieves the best numbers (W-MPJPE 175mm) but is monolithic -- you can't swap components. The modular pipeline (MASt3R-SLAM + SAM 2 + DepthPro + GVHMR) may achieve slightly worse accuracy but lets you upgrade individual components as better models emerge. Given the pace of this field (3 major improvements in 18 months), modularity is the safer bet.

**MonST3R vs. MASt3R-SLAM + masking**: MonST3R handles dynamics natively but requires ~33GB VRAM and isn't real-time. MASt3R-SLAM + SAM masking achieves similar results with less memory and real-time capability. For a battle circle with 1-2 dancers, the masking approach is more practical.

**M1 Max viability**: Preprocessing (detection, keypoints, depth) can run on M1 Max. The SLAM and mesh recovery stages need a cloud GPU. A practical workflow: capture on iPhone, preprocess locally, upload to cloud GPU for the heavy pipeline, download results.

### What's Missing

1. **Metric scale from MASt3R-SLAM**: MASt3R-SLAM produces dense geometry but in arbitrary scale. The TRAM-style Geman-McClure alignment with DepthPro would need to be implemented as a bridge.

2. **Floor plane estimation**: For breakdancing, the ground plane is the critical reference surface. Metric3D v2's surface normal output could directly estimate this. Alternatively, RANSAC on the dense MASt3R-SLAM point cloud would work.

3. **Multi-person**: All current methods assume a single human. Battle circles have two dancers alternating. This requires per-dancer tracking + masking, which SAM 2 + a tracker (like CoTracker3) can handle.

4. **Temporal smoothing**: GVHMR is per-frame. For smooth trajectory output, you'd need a post-processing step (Kalman filter, or GVHMR's own contact-aware trajectory recovery).

---

## Sources

- [MASt3R - ECCV 2024](https://arxiv.org/abs/2406.09756)
- [MASt3R GitHub](https://github.com/naver/mast3r)
- [MASt3R-SLAM - CVPR 2025](https://arxiv.org/abs/2412.12392)
- [MASt3R-SLAM GitHub](https://github.com/rmurai0610/MASt3R-SLAM)
- [MonST3R - ICLR 2025](https://arxiv.org/abs/2410.03825)
- [MonST3R GitHub](https://github.com/Junyi42/monst3r)
- [TRAM - ECCV 2024](https://arxiv.org/abs/2403.17346)
- [TRAM GitHub](https://github.com/yufu-wang/tram)
- [TRAM Project Page](https://yufu-wang.github.io/tram4d/)
- [JOSH - ICLR 2026](https://arxiv.org/abs/2501.02158)
- [JOSH GitHub](https://github.com/genforce/JOSH)
- [GVHMR - SIGGRAPH Asia 2024](https://arxiv.org/abs/2409.06662)
- [GVHMR GitHub](https://github.com/zju3dv/GVHMR)
- [DepthPro - ICLR 2025](https://arxiv.org/abs/2410.02073)
- [Metric3D v2 - IEEE TPAMI 2024](https://arxiv.org/abs/2404.15506)
- [UniDepth V2 - 2025](https://arxiv.org/abs/2502.20110)
- [UniDepth GitHub](https://github.com/lpiccinelli-eth/UniDepth)
- [Depth Anything V2 - NeurIPS 2024](https://arxiv.org/abs/2406.09414)
- [Speedy MASt3R](https://arxiv.org/abs/2503.10017)
- [NAVER LABS Blog - MASt3R](https://europe.naverlabs.com/blog/mast3r-matching-and-stereo-3d-reconstruction/)
- [MASt3R-SLAM LearnOpenCV](https://learnopencv.com/mast3r-slam-realtime-dense-slam-explained/)
