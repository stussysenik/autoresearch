You are a music production + signal processing expert specializing in breakdancing music.

## Task

Produce a JSON config file that maps bboy music frequency bands to SMPL body joint groups for an audio-motion cross-correlation engine.

## Context

We are building a system that cross-correlates audio spectrograms with movement spectrograms to score a breakdancer's musicality. The audio side uses standard STFT. The motion side uses STFT on joint velocity magnitudes from a 24-joint SMPL body model (30fps video).

The music genres are: funk breaks (James Brown, The Incredible Bongo Band), soul samples, classic hip-hop beats, electro (Afrika Bambaataa), and modern bboy edits. Typical BPM range: 90-130 BPM.

The SMPL 24-joint topology:
0=pelvis, 1=left_hip, 2=right_hip, 3=spine1, 4=left_knee, 5=right_knee, 6=spine2, 7=left_ankle, 8=right_ankle, 9=spine3, 10=left_foot, 11=right_foot, 12=neck, 13=left_collar, 14=right_collar, 15=head, 16=left_shoulder, 17=right_shoulder, 18=left_elbow, 19=right_elbow, 20=left_wrist, 21=right_wrist, 22=left_hand, 23=right_hand

## Required Output

Output ONLY valid JSON (no markdown, no explanation) with this structure:

```json
{
  "instruments": {
    "<instrument_name>": {
      "primary_hz": [low, high],
      "attack_hz": [low, high],
      "description": "...",
      "bboy_music_examples": ["..."],
      "joint_weights": {
        "<joint_group>": <weight 0-1>
      }
    }
  },
  "joint_groups": {
    "<group_name>": {
      "joint_indices": [int],
      "role": "...",
      "primary_instrument_correlation": "<instrument_name>"
    }
  },
  "audio_bands": {
    "sub_bass":  {"hz": [20, 80],    "motion_correlate": "..."},
    "bass":      {"hz": [80, 250],   "motion_correlate": "..."},
    "low_mid":   {"hz": [250, 500],  "motion_correlate": "..."},
    "mid":       {"hz": [500, 2000], "motion_correlate": "..."},
    "high_mid":  {"hz": [2000, 4000],"motion_correlate": "..."},
    "high":      {"hz": [4000, 11025],"motion_correlate": "..."}
  },
  "stft_params": {
    "audio": {
      "sr": 22050,
      "n_fft": "<int>",
      "hop_length": "<int>",
      "rationale": "..."
    },
    "motion": {
      "fps": 30,
      "nperseg": "<int>",
      "noverlap": "<int>",
      "rationale": "..."
    },
    "common_grid_hz": "<int, for resampling both to same time axis>"
  },
  "musicality_subscores": {
    "<subscore_name>": {
      "description": "...",
      "audio_component": "...",
      "motion_component": "...",
      "weight_in_total": "<float 0-1>",
      "formula_hint": "..."
    }
  },
  "metrical_weights": {
    "downbeat": "<float>",
    "beat": "<float>",
    "offbeat": "<float>",
    "ghost_note": "<float>"
  }
}
```

Include at least these instruments: kick, snare, hi-hat, bass_guitar, horn_stab, vocal_sample, congas, scratch/turntable.

For joint_weights within each instrument: which body parts should a dancer move in response to that instrument? Based on actual breaking pedagogy (e.g., footwork rides the kick, hands catch the snare, head nods the hi-hat).

For musicality_subscores, include at least: hitting_the_beat, riding_the_melody, catching_the_hat, following_the_bass, freeze_on_the_break.

Be precise with Hz ranges — use actual spectral analysis knowledge, not approximations. Think about how funk breaks and soul samples differ from modern EDM in their spectral content.
