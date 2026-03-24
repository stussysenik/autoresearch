<!--
  SAM-Body4D Viability Spike
  Date: 2026-03-23
  Purpose: Verify claims from TECH_STACK_REEVALUATION.md about SAM-Body4D for bboy pipeline
  Verdict: PARTIALLY VIABLE — paper is real, code exists, but critical caveats
-->

# SAM-Body4D Viability Spike

## 1. Does SAM-Body4D Actually Exist?

**Yes.** The paper is real and the code is released.

- **Title:** SAM-Body4D: Training-Free 4D Human Body Mesh Recovery from Videos
- **arXiv:** [2512.08406](https://arxiv.org/abs/2512.08406) (December 9, 2025)
- **Authors:** Mingqi Gao, Yunqi Miao, Jungong Han
- **GitHub:** [gaomingqi/sam-body4d](https://github.com/gaomingqi/sam-body4d) (MIT license)
- **Status:** Code released, Gradio demo available, 5 checkpoint sets downloadable

**What "training-free" actually means:** SAM-Body4D itself requires no training or fine-tuning. However, it is an orchestration wrapper around three large pretrained foundation models:

| Component | Role | Origin |
|-----------|------|--------|
| **SAM 3** (Meta, Nov 2025) | Video segmentation — generates identity-consistent person masklets across frames | Pretrained on massive dataset |
| **Diffusion-VAS** | Occlusion-aware refinement — hallucinates body regions hidden behind objects/people | Pretrained diffusion model |
| **SAM 3D Body** (Meta, Nov 2025) | Per-frame 3D mesh recovery from the refined crops | Pretrained on Meta's internal dataset with "unusual poses and rare imaging conditions" |
| **MoGe-2** | Monocular geometry estimation | Pretrained |
| **Depth-Anything V2** | Monocular depth estimation | Pretrained |

So "training-free" means "no additional training on your data." The underlying models were trained on enormous datasets. This is the correct interpretation and it is meaningful — you do not need breakdancing-specific training data to run the pipeline.

---

## 2. What Are the Actual Published Benchmarks?

**This is the first major red flag.** The SAM-Body4D paper contains **zero quantitative benchmarks.** No MPJPE, no PA-MPJPE, no acceleration error, no numerical comparisons against baselines. The paper is entirely qualitative — visual comparisons in Figures 3-4 showing temporal consistency improvements over vanilla per-frame SAM 3D Body inference.

The ablation studies are also visual-only:
- Figure 3: Vanilla baseline vs. full SAM-Body4D (temporal smoothness)
- Figure 4: With vs. without occlusion refinement

**There is no formal evaluation dataset, no evaluation protocol, and no numerical evidence of quality.**

However, the underlying **SAM 3D Body** (the actual mesh recovery engine) does have benchmarks:

| Dataset | Metric | SAM 3D Body (DINOv3-H+) |
|---------|--------|--------------------------|
| 3DPW | MPJPE | **54.8 mm** |
| EMDB | MPJPE | **61.7 mm** |
| RICH | PVE | **60.3 mm** |
| COCO | PCK@.05 | **86.5** |
| FreiHand | PA-MPJPE | **5.5 mm** |

For context, the current SOTA comparison on 3DPW:

| Model | 3DPW MPJPE | 3DPW PA-MPJPE | Year |
|-------|-----------|---------------|------|
| **GenHMR** | **54.7 mm** | **32.6 mm** | AAAI 2025 |
| SAM 3D Body | 54.8 mm | N/R | Nov 2025 |
| PromptHMR | ~55 mm | ~41 mm | CVPR 2025 |
| Patient4D | 54.8 mm | 35.8 mm | Mar 2026 |
| TokenHMR | ~70 mm | ~44.5 mm | CVPR 2024 |
| HMR 2.0 | 70.0 mm | 44.5 mm | ICCV 2023 |

SAM 3D Body is competitive on standard benchmarks. But none of these benchmarks include inversions, headspins, or breakdancing.

---

## 3. Are Pretrained Weights Released?

**Yes.** Five checkpoint sets are required, all downloadable:

1. SAM 3 (requires Hugging Face access approval from Meta)
2. SAM 3D Body DINOv3 (requires Hugging Face access approval from Meta)
3. MoGe-2-vitl-normal
4. Diffusion-VAS (amodal + content completion)
5. Depth-Anything V2

The code is functional. Installation requires:
- Python 3.12
- PyTorch 2.7.1 with **CUDA 11.8**
- Detectron2
- SAM 3 local installation

An automated setup script handles checkpoint download.

---

## 4. Hardware Requirements

**This is the second major red flag.**

### Profiled on NVIDIA H800 (80GB VRAM, 120GB system RAM):

| Configuration | Peak VRAM | Time (64-100 frames) | Per-frame |
|---------------|-----------|----------------------|-----------|
| Without occlusion refinement | 14.5 GB | ~2-3 min | **~1-2 sec/frame** |
| With occlusion refinement | **53.3 GB** | ~26-27 min | **~17-18 sec/frame** |
| Masklet generation alone | 10-12 GB | — | — |

### Can it run on M1 Max (32GB unified memory)?

**No. Not without significant work.**

1. **CUDA hard dependency:** SAM-Body4D requires CUDA 11.8. SAM 3 has a hard dependency on the Triton library, which is CUDA-only with no MPS support. There are open GitHub issues ([facebookresearch/sam3#164](https://github.com/facebookresearch/sam3/issues/164)) and Hugging Face discussions confirming SAM 3 cannot run on Apple Silicon natively.

2. **Memory:** Even the lightweight configuration (no occlusion refinement) peaks at 14.5 GB VRAM. On an M1 Max with 32GB unified memory, this is theoretically within range but PyTorch MPS has known issues with pin_memory() and SAM 3's storage handling.

3. **The underlying SAM 3D Body** alone requires "a discrete GPU with 16GB+ VRAM" for interactive use. On laptop integrated GPUs, Meta reports 5-10 second processing times per image. On an RTX 5090, ~65ms/frame. On an H200, 30-50ms/frame.

4. **Workaround possibility:** The Hugging Face Transformers implementation of SAM 3 has been reported working on Apple Silicon, bypassing the Triton dependency. This is unverified for the full SAM-Body4D pipeline. [UNVERIFIED]

### Realistic deployment targets:

| Hardware | Feasibility | Speed |
|----------|------------|-------|
| M1 Max 32GB | **No** (CUDA/Triton dependency, MPS incompatible) | N/A |
| RTX 3060 12GB | **Marginal** (masklet gen only; full pipeline OOM) | Very slow |
| RTX 4090 24GB | **Possible without occlusion refinement** | ~1-2 sec/frame |
| A100/H100 80GB | **Full pipeline** | ~1-2 sec/frame (no occ), ~17 sec/frame (with occ) |
| Cloud (Lambda, RunPod) | **Best option for v0.1** | Rent A100 by the hour |

---

## 5. Does It Actually Handle Inversions?

**There is no evidence that it does.** This is the most critical finding.

- The SAM-Body4D paper makes **no mention** of inversions, acrobatics, extreme poses, dance, gymnastics, or non-upright body configurations.
- SAM 3D Body's paper mentions training on "unusual poses and rare imaging conditions" via their data engine, but provides **no specific evaluation** on inverted or non-upright poses.
- SAM 3D Body uses **MHR (Momentum Human Rig)**, not SMPL, which decouples skeletal structure from surface shape. This could theoretically help with unusual poses, but no evidence is published.
- The evaluation datasets (3DPW, EMDB, RICH, COCO) contain primarily upright humans in everyday activities.

**The claim in TECH_STACK_REEVALUATION.md that SAM-Body4D "works on any pose, including inversions, out of the box" is unsubstantiated.** It was inferred from "training-free" = "generalizes to any pose," which is a logical leap. Training-free means it does not need fine-tuning, but the underlying SAM 3D Body model was still trained predominantly on upright humans.

### What would actually test this:

1. Run SAM-Body4D on BRACE dataset clips (Red Bull BC One footage with headspins, windmills, flares)
2. Measure MPJPE against BRACE's 2D keypoint annotations (noting BRACE provides 2D, not 3D ground truth)
3. Visual inspection of mesh quality during inversions

Until someone does this, the inversion capability is **[UNVERIFIED]**.

---

## 6. March 2026 Alternatives

### Tier 1: Best Available for Extreme Poses

| Model | Why it matters | Limitation |
|-------|---------------|------------|
| **HSMR** (CVPR 2025) | Uses SKEL biomechanical model with explicit joint rotation limits. **Outperforms HMR 2.0 by >10mm on MOYO (extreme yoga poses)**. Only 46 pose parameters vs SMPL's 72. Biomechanical constraints prevent impossible poses. | Single-image only. No temporal. Not tested on inversions specifically (MOYO = yoga, not headspins). |
| **GenHMR** (AAAI 2025) | Generative approach models uncertainty. 54.7mm MPJPE on 3DPW (matching SAM 3D Body). 25% MPJPE reduction over HMR 2.0. "Effective in challenging scenarios involving complex poses." | Single-image. No published inversion evaluation. |
| **PromptHMR** (CVPR 2025) | Promptable with spatial/semantic prompts. SOTA on EMDB, 3DPW, RICH, Hi4D, CHI3D, HBW. Temporal coherence in video mode. | No inversion-specific evaluation. Uses SMPL. |

### Tier 2: Video/Temporal Methods

| Model | Why it matters | Limitation |
|-------|---------------|------------|
| **GVHMR** (SIGGRAPH Asia 2024) | Gravity-View coordinates avoid drift. Handles arbitrary-length sequences via RoPE. World-grounded trajectory. | Not designed for inversions. Gravity prior may actually *hurt* when dancer is upside down. |
| **TRAM** (ECCV 2024) | 60% less global motion error than WHAM. Metric-scale recovery via SLAM + scene background. | Not designed for extreme poses. |
| **Patient4D** (Mar 2026) | 54.8mm MPJPE on 3DPW with temporal consistency. | Medical focus (operating room). Not tested on dynamic motion. |
| **4DHumans/HMR 2.0** (ICCV 2023) | Mature, well-tested. "Capability to analyze unusual poses." Open code. | 70mm MPJPE — significantly behind current SOTA. |

### Tier 3: Specialized

| Model | Why it matters | Limitation |
|-------|---------------|------------|
| **DanceFormer** (2025) | Dance-specific. 18.4mm on AIST. | [UNVERIFIED] — could not find the paper on arXiv. AIST = upright dance, not breaking. |
| **Fast SAM 3D Body** (Mar 2026) | 10.9x faster than SAM 3D Body. 6.5 FPS on RTX 5090. 30.4mm PA-MPJPE on 3DPW. | Still needs CUDA. Same inversion uncertainty as SAM 3D Body. |

---

## 7. Realistic Verdict for Bboy Use

### The honest assessment:

**No published model has been evaluated on breakdancing inversions.** Not SAM-Body4D, not GenHMR, not HSMR, not PromptHMR. The claim that SAM-Body4D "solves Gap #1" was premature. The gap still exists — it is just smaller than in November 2025.

### What has actually changed since PromptHMR + WHAC failed (Nov 2025):

1. **SAM 3D Body** is trained on a more diverse dataset than any prior HMR model ("unusual poses and rare imaging conditions" via Meta's data engine). Whether this includes inversions is unknown but plausible given Meta's scale.

2. **HSMR's biomechanical constraints** (SKEL model, 46 DOF) are the most promising approach for inversions because they encode what human joints can physically do, rather than learning a pose distribution biased toward upright humans. HSMR's 10mm+ improvement on extreme yoga poses (MOYO dataset) is the closest published evidence to inversion handling.

3. **GenHMR's generative approach** explicitly models uncertainty in the 2D-to-3D mapping, which is exactly the problem with inversions (massive ambiguity when the body is upside down).

4. **The BRACE dataset** (ECCV 2022) exists and contains Red Bull BC One footage with 2D keypoint annotations for breakdancing, including inversions. This is the right evaluation benchmark. Nobody has published HMR results on BRACE.

### Recommended path forward:

**Option A: SAM-Body4D on cloud GPU (highest ceiling, highest cost)**
- Rent A100 on Lambda/RunPod (~$1.10/hr)
- Run SAM-Body4D (without occlusion refinement) on 3-5 BRACE clips
- Measure: visual quality of mesh during inversions, temporal consistency, failure modes
- If meshes are garbage during headspins, SAM-Body4D is eliminated

**Option B: HSMR + temporal smoothing (most likely to handle inversions, runs lighter)**
- HSMR is single-image but its biomechanical constraints are the strongest prior for extreme poses
- Run per-frame, apply temporal smoothing (Kalman or simple exponential)
- Lower hardware requirements than SAM-Body4D
- Evaluate on BRACE clips
- [UNVERIFIED whether HSMR code is released — check https://isshikihugh.github.io/HSMR/]

**Option C: GenHMR (best general SOTA, uncertainty modeling)**
- 25-30% MPJPE reduction over prior SOTA
- Generative approach should handle ambiguous inversions better than regression
- AAAI 2025, code likely available
- Single-image; need temporal wrapper

**What I would actually do:**

Run all three (SAM-Body4D, HSMR, GenHMR) on the same 5 BRACE clips, on a rented A100. Compare visual quality of the mesh during: (1) toprock (upright), (2) footwork (crouching), (3) freeze (static inversion), (4) power move (dynamic inversion — windmill/headspin). This spike would cost ~$5-10 in compute and take a day. It would give ground truth instead of speculation.

### Corrections to TECH_STACK_REEVALUATION.md:

| Claim | Reality |
|-------|---------|
| "SAM-Body4D works on any pose including inversions out of the box" | **[UNVERIFIED]** — no inversion evaluation published. Plausible but unproven. |
| "Training-free — no breaking-specific data required" | **Correct** in the narrow sense (no fine-tuning needed). But underlying SAM 3D Body training data composition is unknown. |
| "Gap #1 severity: LOW" | **Should be MEDIUM** until someone runs it on BRACE and measures. |
| "~200ms/frame for SAM-Body4D mesh" | **Wrong.** Actual: 1-2 sec/frame without occlusion refinement on H800. 17-18 sec/frame with occlusion. |
| "~330ms/frame total pipeline" | **Wrong.** Realistic total: 2-4 sec/frame minimum on A100-class GPU. |
| "RTX 3060+ hardware" | **Wrong.** Full pipeline needs 14.5-53 GB VRAM. Minimum viable: RTX 4090 (24GB) without occlusion refinement. Comfortable: A100 (80GB). |
| "Fast SAM 3D Body — real-time variant" | **Partially correct.** Fast SAM 3D Body exists (Mar 2026), achieves 6.5 FPS on RTX 5090, but this is the per-frame mesh recovery only, not the full SAM-Body4D temporal pipeline. |

### The bottom line:

SAM-Body4D is a real, runnable system that adds temporal consistency to the best available single-image HMR model (SAM 3D Body). It is a genuine improvement over running SAM 3D Body per-frame. But:

1. It has **no published benchmarks** (red flag for a December 2025 paper)
2. It has **never been evaluated on inversions** (the one thing we need)
3. It requires **A100-class hardware** (not M1 Max, not RTX 3060)
4. The per-frame cost is **1-2 seconds minimum**, not 200ms
5. It **cannot run on Apple Silicon** due to SAM 3's Triton dependency

The correct next step is not to adopt SAM-Body4D into the pipeline architecture. The correct next step is to **run a $5 cloud GPU experiment on BRACE clips** and find out if any current model actually handles inversions. Until that experiment happens, Gap #1 remains open.

---

## Sources

- [SAM-Body4D Paper (arXiv:2512.08406)](https://arxiv.org/abs/2512.08406)
- [SAM-Body4D GitHub](https://github.com/gaomingqi/sam-body4d)
- [SAM 3D Body (Meta)](https://github.com/facebookresearch/sam-3d-body)
- [SAM 3D Body Paper (arXiv:2602.15989)](https://arxiv.org/abs/2602.15989)
- [Fast SAM 3D Body (arXiv:2603.15603)](https://arxiv.org/abs/2603.15603)
- [GenHMR (arXiv:2412.14444)](https://arxiv.org/abs/2412.14444)
- [HSMR (arXiv:2503.21751)](https://arxiv.org/abs/2503.21751)
- [PromptHMR (CVPR 2025)](https://openaccess.thecvf.com/content/CVPR2025/papers/Wang_PromptHMR_Promptable_Human_Mesh_Recovery_CVPR_2025_paper.pdf)
- [GVHMR (SIGGRAPH Asia 2024)](https://github.com/zju3dv/GVHMR)
- [TRAM (ECCV 2024)](https://arxiv.org/abs/2403.17346)
- [4DHumans/HMR 2.0](https://github.com/shubham-goel/4D-Humans)
- [BRACE Dataset](https://github.com/dmoltisanti/brace)
- [SAM 3 Apple Silicon Issue](https://github.com/facebookresearch/sam3/issues/164)
- [SAM 3 Triton Issue on M4](https://huggingface.co/facebook/sam3/discussions/11)
- [TokenHMR (CVPR 2024)](https://github.com/saidwivedi/TokenHMR)
