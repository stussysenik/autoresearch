#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# GVHMR Inference + Joint Extraction
# Usage: bash remote/run-inference.sh <video_path> [--static]
# Output: results/joints_3d.npy, results/metadata.json
# ============================================================

VIDEO_PATH="${1:?Usage: run-inference.sh <video_path> [--static]}"
STATIC_FLAG=""
if [[ "${2:-}" == "--static" || "${2:-}" == "-s" ]]; then
    STATIC_FLAG="-s"
    echo "Static camera mode (skipping visual odometry)"
fi

GVHMR_DIR="${HOME}/gvhmr"
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RESULTS_DIR="${SCRIPT_DIR}/results"

mkdir -p "${RESULTS_DIR}"

echo "╔══════════════════════════════════════════╗"
echo "║  GVHMR Inference                         ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "  Video: ${VIDEO_PATH}"
echo "  Output: ${RESULTS_DIR}/"

# Activate conda
eval "$(conda shell.bash hook)"
conda activate gvhmr

# ─── Step 1: Run GVHMR ────────────────────────────────────
echo ""
echo "▸ Step 1/3: Running GVHMR inference..."
cd "${GVHMR_DIR}"

VIDEO_BASENAME=$(basename "${VIDEO_PATH}" .mp4)
OUTPUT_DIR="${GVHMR_DIR}/outputs/demo/${VIDEO_BASENAME}"

START_TIME=$(date +%s)

python tools/demo/demo.py \
    --video="${VIDEO_PATH}" \
    ${STATIC_FLAG}

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo "  Inference completed in ${ELAPSED}s"
echo "  Output: ${OUTPUT_DIR}/"

# ─── Step 2: Extract joint positions ──────────────────────
echo ""
echo "▸ Step 2/3: Extracting 3D joint positions..."

python - <<'EXTRACT_SCRIPT'
import torch
import smplx
import numpy as np
import json
import sys
import os

# Find the GVHMR output
gvhmr_dir = os.environ.get("GVHMR_DIR", os.path.expanduser("~/gvhmr"))
video_basename = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("VIDEO_BASENAME", "test")
output_dir = os.path.join(gvhmr_dir, "outputs", "demo", video_basename)
results_dir = os.environ.get("RESULTS_DIR", "results")

# Load GVHMR results
results_path = os.path.join(output_dir, "hmr4d_results.pt")
if not os.path.exists(results_path):
    print(f"ERROR: {results_path} not found")
    sys.exit(1)

results = torch.load(results_path, map_location="cpu")
params = results["smpl_params_global"]

print(f"  Loaded {params['body_pose'].shape[0]} frames")

# Load SMPL body model
body_model_path = os.path.join(gvhmr_dir, "inputs", "checkpoints", "body_models")
try:
    body_model = smplx.create(
        body_model_path,
        model_type="smplx",
        gender="neutral",
        batch_size=params["body_pose"].shape[0]
    )
except Exception as e:
    print(f"  WARNING: SMPLX failed ({e}), trying SMPL...")
    body_model = smplx.create(
        body_model_path,
        model_type="smpl",
        gender="neutral",
        batch_size=params["body_pose"].shape[0]
    )

# Forward kinematics → joint positions in world coordinates
with torch.no_grad():
    output = body_model(
        global_orient=params["global_orient"],
        body_pose=params["body_pose"][:, :63],  # 21 joints for SMPL
        betas=params["betas"],
        transl=params["transl"]
    )

joints_3d = output.joints.numpy()  # (F, J, 3) in meters
print(f"  Joint positions: {joints_3d.shape} (frames, joints, xyz)")

# Save
np.save(os.path.join(results_dir, "joints_3d.npy"), joints_3d)

# Save metadata
metadata = {
    "video": video_basename,
    "n_frames": int(joints_3d.shape[0]),
    "n_joints": int(joints_3d.shape[1]),
    "joint_unit": "meters",
    "coordinate_system": "gravity-view (Y=up, metric scale)",
    "model": "GVHMR (SIGGRAPH Asia 2024)",
    "smpl_type": "smplx",
}

# Compute basic stats
speeds = np.linalg.norm(np.diff(joints_3d, axis=0), axis=-1)  # (F-1, J)
metadata["mean_joint_speed_m_per_frame"] = float(np.mean(speeds))
metadata["max_joint_speed_m_per_frame"] = float(np.max(speeds))
metadata["trajectory_range_m"] = {
    "x": float(joints_3d[:, 0, 0].max() - joints_3d[:, 0, 0].min()),
    "y": float(joints_3d[:, 0, 1].max() - joints_3d[:, 0, 1].min()),
    "z": float(joints_3d[:, 0, 2].max() - joints_3d[:, 0, 2].min()),
}

with open(os.path.join(results_dir, "metadata.json"), "w") as f:
    json.dump(metadata, f, indent=2)

print(f"  Saved: joints_3d.npy ({joints_3d.nbytes / 1024:.1f} KB)")
print(f"  Saved: metadata.json")
print(f"  Mean speed: {metadata['mean_joint_speed_m_per_frame']:.4f} m/frame")
EXTRACT_SCRIPT

export VIDEO_BASENAME RESULTS_DIR GVHMR_DIR
python -c "
import sys; sys.argv = ['', '${VIDEO_BASENAME}']
$(cat <<'EOF'
# The actual extraction runs inline above
EOF
)" 2>/dev/null || true

# Run the extraction script properly
cd "${SCRIPT_DIR}"
VIDEO_BASENAME="${VIDEO_BASENAME}" RESULTS_DIR="${RESULTS_DIR}" GVHMR_DIR="${GVHMR_DIR}" \
    python remote/extract-joints.py "${VIDEO_BASENAME}"

# ─── Step 3: Copy rendered video ──────────────────────────
echo ""
echo "▸ Step 3/3: Copying rendered output..."
if [ -f "${OUTPUT_DIR}/incam_global.mp4" ]; then
    cp "${OUTPUT_DIR}/incam_global.mp4" "${RESULTS_DIR}/rendered_${VIDEO_BASENAME}.mp4"
    echo "  Saved rendered video: rendered_${VIDEO_BASENAME}.mp4"
fi

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  Inference complete!                     ║"
echo "║                                          ║"
echo "║  Results in: ${RESULTS_DIR}/"
echo "║  Next: python analyze.py                 ║"
echo "╚══════════════════════════════════════════╝"
