#!/usr/bin/env bash
# ┌─────────────────────────────────────────────────┐
# │  LOCKED — the agent must NEVER edit this file.  │
# │  This is the objective function.                │
# │  Changing it is cheating.                       │
# └─────────────────────────────────────────────────┘
set -euo pipefail

VARIANT_DIR="${1:?Usage: ./evaluate.sh <variant_dir>}"
VARIANT_NAME=$(basename "$VARIANT_DIR")
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

SCORE=0
DETAILS=""

emit() {
  local score="$1"
  local error="${2:-}"
  if [ -n "$error" ]; then
    echo "{\"variant\":\"$VARIANT_NAME\",\"score\":null,\"error\":\"$error\",\"timestamp\":\"$TIMESTAMP\"}"
    exit 1
  fi
  echo "{\"variant\":\"$VARIANT_NAME\",\"score\":$score,\"timestamp\":\"$TIMESTAMP\",\"details\":{$DETAILS}}"
}

# ── Test 1: Files exist and have valid Python syntax (20 pts) ──
T1=0
if [ -f "$VARIANT_DIR/analyze_motion.py" ] && [ -f "$VARIANT_DIR/match_beats.py" ]; then
  if python3 -c "
import py_compile, sys
try:
    py_compile.compile('$VARIANT_DIR/analyze_motion.py', doraise=True)
    py_compile.compile('$VARIANT_DIR/match_beats.py', doraise=True)
    print('OK')
except py_compile.PyCompileError as e:
    print(f'SYNTAX ERROR: {e}')
    sys.exit(1)
" 2>/dev/null; then
    T1=20
  fi
fi
DETAILS="\"syntax\":$T1"

# ── Test 2: analyze_motion.py runs on synthetic data (20 pts) ──
T2=0
if [ $T1 -gt 0 ]; then
  T2_OUT=$(python3 -c "
import sys, os, numpy as np
sys.path.insert(0, '$VARIANT_DIR')

# Generate synthetic joint data: 10 seconds at 30fps
# All joints oscillate sinusoidally at 2Hz (simulated footwork)
T_frames = 300  # 10s at 30fps
t = np.linspace(0, 10, T_frames)
joints = np.zeros((T_frames, 24, 3))
for j in range(24):
    joints[:, j, 0] = 0.1 * np.sin(2 * np.pi * 2 * t + j * 0.1)  # x
    joints[:, j, 1] = 0.05 * np.cos(2 * np.pi * 2 * t + j * 0.2) # y
    joints[:, j, 2] = 0.8 + 0.02 * np.sin(2 * np.pi * 0.5 * t)   # z (height)

# Save as npz
os.makedirs('/tmp/eval_test', exist_ok=True)
np.savez('/tmp/eval_test/joints.npz', joints=joints)

try:
    import analyze_motion
    # Try to call the main analysis function
    if hasattr(analyze_motion, 'extract_features'):
        features = analyze_motion.extract_features(joints, fps=30)
        if hasattr(features, 'shape') or isinstance(features, (tuple, list)):
            print('IMPORT_AND_RUN_OK')
        else:
            print('IMPORT_AND_RUN_OK')
    elif hasattr(analyze_motion, 'analyze'):
        result = analyze_motion.analyze(joints, fps=30)
        print('IMPORT_AND_RUN_OK')
    elif hasattr(analyze_motion, 'main'):
        print('IMPORT_AND_RUN_OK')
    else:
        # Check if it has any callable that takes joints
        for name in dir(analyze_motion):
            obj = getattr(analyze_motion, name)
            if callable(obj) and not name.startswith('_'):
                print('IMPORT_AND_RUN_OK')
                break
        else:
            print('NO_CALLABLE_FOUND')
except Exception as e:
    print(f'CRASH: {e}')
" 2>&1) || true
  if echo "$T2_OUT" | grep -q "IMPORT_AND_RUN_OK"; then
    T2=20
  fi
fi
DETAILS="$DETAILS,\"motion_runs\":$T2"

# ── Test 3: match_beats.py runs without crashing (20 pts) ──
T3=0
if [ $T1 -gt 0 ]; then
  T3_OUT=$(python3 -c "
import sys
sys.path.insert(0, '$VARIANT_DIR')
try:
    import match_beats
    print('IMPORT_OK')
except Exception as e:
    print(f'CRASH: {e}')
" 2>&1) || true
  if echo "$T3_OUT" | grep -q "IMPORT_OK"; then
    T3=20
  fi
fi
DETAILS="$DETAILS,\"beats_runs\":$T3"

# ── Test 4: 9D features are normalized [0,1] (20 pts) ──
T4=0
if [ $T2 -gt 0 ]; then
  T4_OUT=$(python3 -c "
import sys, numpy as np
sys.path.insert(0, '$VARIANT_DIR')

T_frames = 300
t = np.linspace(0, 10, T_frames)
joints = np.zeros((T_frames, 24, 3))
for j in range(24):
    joints[:, j, 0] = 0.1 * np.sin(2 * np.pi * 2 * t + j * 0.1)
    joints[:, j, 1] = 0.05 * np.cos(2 * np.pi * 2 * t + j * 0.2)
    joints[:, j, 2] = 0.8 + 0.02 * np.sin(2 * np.pi * 0.5 * t)

import analyze_motion

features = None
if hasattr(analyze_motion, 'extract_features'):
    result = analyze_motion.extract_features(joints, fps=30)
    if isinstance(result, tuple):
        features = result[0]
    elif isinstance(result, np.ndarray):
        features = result
    elif isinstance(result, dict) and 'features' in result:
        features = np.array(result['features'])

if features is not None:
    features = np.array(features)
    if features.ndim == 2:
        n_dims = features.shape[0] if features.shape[0] < features.shape[1] else features.shape[1]
        if n_dims >= 9:
            # Check normalization
            if features.min() >= -0.01 and features.max() <= 1.01:
                print(f'NORMALIZED_OK dims={n_dims}')
            else:
                print(f'NOT_NORMALIZED min={features.min():.3f} max={features.max():.3f}')
        else:
            print(f'TOO_FEW_DIMS dims={n_dims}')
    else:
        print(f'WRONG_SHAPE ndim={features.ndim}')
else:
    print('NO_FEATURES_RETURNED')
" 2>&1) || true
  if echo "$T4_OUT" | grep -q "NORMALIZED_OK"; then
    T4=20
  fi
fi
DETAILS="$DETAILS,\"features_normalized\":$T4"

# ── Test 5: Cross-correlation on synced synthetic data (20 pts) ──
T5=0
if [ $T2 -gt 0 ] && [ $T3 -gt 0 ]; then
  T5_OUT=$(python3 -c "
import sys, numpy as np
sys.path.insert(0, '$VARIANT_DIR')

# Create perfectly synced audio + motion:
# Audio: 120 BPM metronome (beat every 0.5s)
# Motion: joint velocity spikes at exactly the same times
fps = 30
duration = 10.0
T_frames = int(duration * fps)
t_frames = np.arange(T_frames) / fps

bpm = 120
beat_period = 60.0 / bpm
beat_times = np.arange(0, duration, beat_period)

# Motion: velocity spikes at beat times
joints = np.zeros((T_frames, 24, 3))
for bt in beat_times:
    frame = int(bt * fps)
    if frame + 3 < T_frames:
        for j in range(24):
            # Sharp acceleration at beat time
            joints[frame:frame+3, j, 0] += 0.5 * np.array([0, 1, 0])[:min(3, T_frames-frame)]

# Audio energy: spikes at beat times (simulated)
audio_sr = 100  # simplified common grid
N_audio = int(duration * audio_sr)
audio_energy = np.zeros(N_audio)
for bt in beat_times:
    idx = int(bt * audio_sr)
    if idx < N_audio:
        audio_energy[idx] = 1.0
# Smooth slightly
from scipy.ndimage import gaussian_filter1d
audio_energy = gaussian_filter1d(audio_energy, sigma=2)

import match_beats

corr = None
# Try various function signatures
if hasattr(match_beats, 'spectral_cross_correlation'):
    try:
        M_t = np.linalg.norm(np.diff(joints, axis=0) * fps, axis=-1).mean(axis=1)
        result = match_beats.spectral_cross_correlation(M_t, audio_energy, fps=fps)
        if isinstance(result, dict):
            corr = result.get('musicality_global') or result.get('raw_correlation') or result.get('correlation')
        elif isinstance(result, (float, int, np.floating)):
            corr = float(result)
    except Exception as e:
        print(f'CORR_ERROR: {e}')

if hasattr(match_beats, 'match_accents_to_beats') and corr is None:
    try:
        result = match_beats.match_accents_to_beats(
            joints_3d=joints, fps=fps,
            beat_times=beat_times,
            downbeat_times=beat_times[::4]
        )
        if isinstance(result, dict):
            corr = result.get('accent_hit_rate') or result.get('hit_rate') or result.get('score')
    except Exception as e:
        print(f'MATCH_ERROR: {e}')

if corr is not None:
    corr = float(corr)
    if corr > 0.7:
        print(f'CORR_OK value={corr:.3f}')
    else:
        print(f'CORR_LOW value={corr:.3f}')
else:
    print('NO_CORRELATION_RETURNED')
" 2>&1) || true
  if echo "$T5_OUT" | grep -q "CORR_OK"; then
    T5=20
  fi
fi
DETAILS="$DETAILS,\"correlation_test\":$T5"

# ── Final Score ──
SCORE=$((T1 + T2 + T3 + T4 + T5))
emit "$SCORE"
