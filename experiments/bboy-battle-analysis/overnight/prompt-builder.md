You are an expert Python developer specializing in signal processing and biomechanics.

## Task

Generate two complete, ready-to-run Python files:
1. `analyze_motion.py` — 9D motion feature extractor (mirrors analyze_track.py)
2. `match_beats.py` — beat-motion cross-correlation engine (Levels 1 + 2)

## Context

These files are part of a bboy battle analysis system. The motion data comes from JOSH (a monocular 4D human mesh recovery model) which outputs SMPL 24-joint positions in meters at 30fps.

The audio side already works: `analyze_track.py` extracts 9 normalized [0,1] dimensions per 500ms segment. We need the motion equivalent + the cross-correlation matching engine.

## File 1: analyze_motion.py

Structure should mirror analyze_track.py:
- Config section with constants
- Feature extractors (one function per dimension)
- Main analysis function that returns 9xN feature matrix
- CLI with test mode (synthetic sinusoidal joint motion)
- JSON output

### The 9 Dimensions

| # | Audio Dim | Motion Equivalent | Formula |
|---|-----------|-------------------|---------|
| 1 | BPM Stability | Movement Tempo Stability | Autocorrelation of M(t) at beat-period lag |
| 2 | Bass Energy | Low-freq Motion Energy | Sum of movement spectrogram in 0-2Hz band |
| 3 | Vocal Presence | Distal Expressivity | Speed ratio: (hands+feet+head) / (torso+hips) |
| 4 | Beat Strength | Movement Accent Strength | Max of A_m(t) = [dM/dt]+ per segment |
| 5 | Spectral Flux | Movement Flux | Half-rectified frame-to-frame change in speed profile |
| 6 | Rhythm Complexity | Movement Complexity | Accent density + temporal irregularity |
| 7 | Harmonic Richness | Movement Periodicity | Peak count in movement spectrogram + spectral flatness inverse |
| 8 | Dynamic Range | Motion Dynamic Range | Peak speed / RMS speed (crest factor) |
| 9 | Groove/Swing | Movement Groove | Velocity autocorrelation at beat subdivisions |

### Key Formulas

```python
# Velocities via central differences
velocities = np.zeros_like(joints_3d)  # [T, 24, 3]
velocities[1:-1] = (joints_3d[2:] - joints_3d[:-2]) * fps / 2
velocities[0] = (joints_3d[1] - joints_3d[0]) * fps
velocities[-1] = (joints_3d[-1] - joints_3d[-2]) * fps

# Speed per joint
speed = np.linalg.norm(velocities, axis=-1)  # [T, 24]

# Mass-weighted energy profile
M_t = speed @ JOINT_WEIGHTS  # [T]

# Movement accent function
M_smooth = gaussian_filter1d(M_t, sigma=0.050 * fps)
dM = np.gradient(M_smooth) * fps
A_m = np.maximum(0, dM)  # half-wave rectified

# Movement spectrogram (STFT per joint)
f, t, Zxx = stft(speed[:, j], fs=fps, nperseg=64, noverlap=56)
# frequency bins: 0-15Hz, resolution ~0.47Hz
# Lows: bins 0-4 (0-1.9Hz), Mids: bins 5-12 (2.3-5.6Hz), Highs: bins 13-32 (6.1-15Hz)

# Joint Activity Entropy
weighted_speed = speed * JOINT_WEIGHTS[np.newaxis, :]
p = weighted_speed / (weighted_speed.sum(axis=1, keepdims=True) + 1e-8)
H_J = -np.sum(p * np.log2(np.clip(p, 1e-10, 1.0)), axis=1)
```

### De Leva 1996 Mass Table (for 70kg reference)

```python
JOINT_MASSES_KG = {
    0: 11.17,   # pelvis
    1: 2.78, 2: 2.78,    # hips
    3: 5.0,               # spine1
    4: 3.28, 5: 3.28,    # knees
    6: 3.0,               # spine2
    7: 0.61, 8: 0.61,    # ankles
    9: 2.5,               # spine3
    10: 0.97, 11: 0.97,  # feet
    12: 1.5,              # neck
    13: 0.5, 14: 0.5,    # collars
    15: 5.0,              # head
    16: 2.0, 17: 2.0,    # shoulders
    18: 1.14, 19: 1.14,  # elbows
    20: 0.45, 21: 0.45,  # wrists
    22: 0.41, 23: 0.41,  # hands
}
```

### Body Part Groups

```python
JOINT_GROUPS = {
    'legs':      [1, 2, 4, 5, 7, 8, 10, 11],
    'torso':     [0, 3, 6, 9],
    'arms':      [13, 14, 16, 17, 18, 19],
    'hands':     [20, 21, 22, 23],
    'head':      [12, 15],
}
```

### Test Mode

Generate synthetic motion: sinusoidal joint oscillation at known frequency (e.g., 2Hz for all joints = simulated footwork). Should produce predictable feature values.

## File 2: match_beats.py

### Level 1: Accent-Beat Timestamp Matching

```python
def match_accents_to_beats(motion_accents, beat_times, downbeat_times, beat_strengths, delta=0.070):
    """Match motion accent timestamps to audio beat timestamps.

    Args:
        motion_accents: list of {'time': float, 'type': str, 'strength': float}
        beat_times: float32 [N_beats] in seconds
        downbeat_times: float32 [N_downbeats] in seconds
        beat_strengths: float32 [N_beats] (D4 from analyze_track.py)
        delta: matching tolerance in seconds (70ms default, Repp 2005)

    Returns:
        accent_hit_rate: float [0,1]
        weighted_hit_score: float [0,1]
        downbeat_hit_score: float [0,1]
        optimal_lag_ms: float
        per_beat_hits: list of dicts
    """
```

### Level 2: Spectral Cross-Correlation

```python
def spectral_cross_correlation(M_t, audio_energy, audio_band_envelopes, fps=30, sr=22050,
                                 tau_max=0.200, common_hz=100, gamma=0.5, sigma_tau=0.050):
    """Cross-correlate movement energy with audio energy at multiple bands.

    Args:
        M_t: float32 [T] movement energy profile at video fps
        audio_energy: float32 [N_audio] total audio energy envelope
        audio_band_envelopes: dict of {band_name: float32 [N_audio]}
        fps: video frame rate
        sr: audio sample rate
        tau_max: max lag in seconds
        common_hz: common time grid frequency
        gamma: anticipation bonus magnitude
        sigma_tau: anticipation transition sharpness

    Returns:
        musicality_global: float [0,1] (mu_ant)
        raw_correlation: float [0,1] (mu)
        optimal_lag_ms: float
        anticipation_factor: float (phi)
        band_correlations: dict of {band: {correlation, lag_ms}}
    """
```

### CLI Interface

```bash
# Analyze motion only (outputs 9D features + motion accents)
python analyze_motion.py joints.npz

# Match beats (needs both audio analysis + motion data)
python match_beats.py --motion joints.npz --audio track.wav

# Test mode (synthetic data, should produce correlation ~1.0)
python match_beats.py --test
```

### Output Format

```json
{
  "level1": {
    "accent_hit_rate": 0.73,
    "weighted_hit_score": 0.81,
    "downbeat_hit_score": 0.85,
    "optimal_lag_ms": -15.0,
    "n_beats": 64,
    "n_motion_accents": 47,
    "n_hits": 47
  },
  "level2": {
    "musicality_global": 0.78,
    "raw_correlation": 0.75,
    "optimal_lag_ms": -23.0,
    "anticipation_factor": 1.12,
    "band_correlations": {
      "sub_bass": {"correlation": 0.82, "lag_ms": -15.0},
      "bass": {"correlation": 0.79, "lag_ms": -20.0}
    }
  }
}
```

## Requirements

- Use only numpy, scipy, and standard library (no librosa needed for motion)
- Each file must be self-contained and runnable
- Include docstrings and type hints
- Match analyze_track.py's style: config section → extractors → analysis → CLI → JSON output
- Per-track min-max normalization to [0,1] for all dimensions (same as audio)
- Test mode must validate with known expected values

Output the two files separated by this exact marker:
```
===== FILE SEPARATOR: match_beats.py =====
```

Output ONLY the Python code. No markdown wrapping, no explanations.
