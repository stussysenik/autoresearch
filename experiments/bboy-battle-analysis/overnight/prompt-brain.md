You are a computational biomechanics + signal processing expert.

## Task

Design a complete 9D motion feature extraction spec that mirrors an existing 9D audio feature extractor. Output as JSON.

## Context

We have a working audio feature extractor (`analyze_track.py`) that computes 9 normalized [0,1] dimensions per 500ms segment:

1. BPM Stability — autocorrelation peak of onset envelope in 60-200 BPM range
2. Bass Energy — RMS of bandpass-filtered signal (20-250 Hz)
3. Vocal Presence — energy in 300-3400 Hz + HNR
4. Beat Strength — max spectral flux onset function
5. Spectral Flux — mean normalized frame-to-frame spectral change
6. Rhythm Complexity — onset density (log-scale) + syncopation (IOI variance)
7. Harmonic Richness — spectral peak count + tonality (1 - flatness)
8. Dynamic Range — crest factor via tanh
9. Groove/Swing — alternating IOI ratio + regularity

Now we need the MOTION equivalent. Input is SMPL 24-joint positions `[T, 24, 3]` in meters at 30fps from JOSH (a monocular 4D human reconstruction model).

The SMPL 24-joint topology:
0=pelvis, 1=left_hip, 2=right_hip, 3=spine1, 4=left_knee, 5=right_knee, 6=spine2, 7=left_ankle, 8=right_ankle, 9=spine3, 10=left_foot, 11=right_foot, 12=neck, 13=left_collar, 14=right_collar, 15=head, 16=left_shoulder, 17=right_shoulder, 18=left_elbow, 19=right_elbow, 20=left_wrist, 21=right_wrist, 22=left_hand, 23=right_hand

## Mathematical Foundation

Movement Energy Profile: M(t) = sum_j(w_j * ||v_j(t)||) where v_j = dr_j/dt
Movement Accent Function: A_m(t) = [dM/dt]+ (half-wave rectified, sigma~50ms Gaussian smoothing)
Joint Activity Entropy: H_J(t) = -sum_j(p_j * log2(p_j)) where p_j = w_j*S_m(j,t) / sum(w_k*S_m(k,t))
Movement Spectrogram: STFT per joint speed, nperseg=64, noverlap=56 at 30fps → [24, 33, N_time]
Movement frequency bands: Lows 0-2Hz (body sway), Mids 2-6Hz (limb cycles), Highs 6-15Hz (pops/hits)

## Required Output

Output ONLY valid JSON (no markdown, no explanation) with this structure:

```json
{
  "dimensions": [
    {
      "index": 0,
      "audio_name": "BPM Stability",
      "motion_name": "...",
      "description": "...",
      "formula": "... (written as numpy pseudocode)",
      "input_shape": "...",
      "output_shape": "float per segment",
      "normalization": "... (how to normalize to [0,1])",
      "implementation_notes": "..."
    }
  ],
  "joint_mass_table_kg": {
    "0_pelvis": 11.17,
    "1_left_hip": "...",
    "...": "..."
  },
  "joint_mass_source": "De Leva 1996, adapted for SMPL 24-joint topology",
  "segmentation": {
    "window_sec": "...",
    "hop_sec": "...",
    "rationale": "..."
  },
  "normalization_strategy": {
    "method": "...",
    "rationale": "... (must match audio's per-track min-max to [0,1])"
  },
  "phase_detection": {
    "toprock": {
      "heuristic": "...",
      "com_height_threshold": "...",
      "joint_weight_override": {"...": "..."}
    },
    "footwork": {
      "heuristic": "...",
      "com_height_threshold": "...",
      "joint_weight_override": {"...": "..."}
    },
    "power": {
      "heuristic": "...",
      "angular_momentum_threshold": "...",
      "joint_weight_override": {"...": "..."}
    },
    "freeze": {
      "heuristic": "...",
      "max_speed_threshold_ms": "...",
      "min_duration_sec": "...",
      "joint_weight_override": {"...": "..."}
    }
  },
  "accent_detection": {
    "acceleration_accent": {
      "description": "sudden increase in M(t)",
      "threshold": "mean + N*std",
      "min_distance_sec": "...",
      "formula": "..."
    },
    "freeze_entry": {
      "description": "transition from moving to stopped",
      "speed_threshold_ms": "...",
      "min_duration_sec": "..."
    },
    "flow_break": {
      "description": "sharp change in joint activity entropy H_J(t)",
      "threshold": "...",
      "formula": "..."
    }
  }
}
```

For each of the 9 dimensions, provide the EXACT numpy expression that computes it from `joints_3d: float32 [T, 24, 3]` and `fps: int = 30`. The motion dimension must be analogous to its audio counterpart — same conceptual meaning, adapted to the movement domain.

Use the De Leva 1996 body segment mass proportions for a 70kg reference human, mapped to the 24 SMPL joints. Be precise with the mass values.

For phase detection: provide concrete thresholds that can be used as initial values, knowing they'll be tuned on real data.
