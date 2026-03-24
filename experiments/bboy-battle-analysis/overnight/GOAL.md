# GOAL: Generate TRIVIUM scoring engine — quantifiable breakdancing analysis from JOSH SMPL output

## What is TRIVIUM?
A 3-axis scoring model for breakdancing: BODY (40%) + SOUL (35%) + MIND (25%) = 100.
Each axis has sub-scores. All scores are bounded [0,1]. The final score maps to 0-100.

### BODY (40%) — Technical Execution
- **Technique**: difficulty × execution quality per move. Difficulty from joint angular velocity peaks. Execution = 1 - mean(wobble) where wobble = jerk magnitude during holds.
- **Vocabulary**: Shannon entropy of move-type distribution. H = -Σ p_i log2(p_i) / log2(N). More diverse moves = higher score.
- **Progression**: slope of difficulty over time. Positive slope = building toward climax.
- **Cleanliness**: inverse of unintentional jerk. Clean = smooth transitions, sharp intentional hits.

### SOUL (35%) — Musicality & Expression
- **Musicality**: μ = max_τ corr(M(t), H(t-τ)) for τ ∈ [-200ms, +200ms]. Movement energy vs audio hotness cross-correlation.
- **Accent Hits**: AHR = Σ hit(b_k) / |{b_k}| with δ=70ms tolerance. Weighted by beat strength.
- **Anticipation**: φ(τ) = 1 + (γ/2)·erf(-τ/σ_τ). Negative τ = dancer moves BEFORE the beat = bonus.
- **Groove Lock**: velocity autocorrelation at beat-period lag. High = riding the pocket.

### MIND (25%) — Strategy & Flow
- **Flow**: composite smoothness. SPARC metric + Laban bound/free ratio.
- **Energy Management**: variance of KE across round. Low variance in sustained sections, high peaks for power moves.
- **Stage Use**: spatial entropy of CoM trajectory. Uses the full space = higher score.
- **Response Quality**: (battle context only, skip for v0.1)

## Metric
- **Name:** trivium_engine_score
- **Unit:** composite (0-100)
- **Direction:** higher_is_better
- **Baseline:** 0
- **Target:** 90+
- **Current best:** (updated by loop)

## Evaluation
Run `./evaluate.sh <variant_dir>` — outputs JSON line with score 0-100.

5 tests, 20pts each:
1. Both files exist, valid Python syntax
2. analyze_motion.py imports and runs on synthetic SMPL joint data [300, 24, 3]
3. match_beats.py imports and runs without crashing
4. analyze_motion.py produces 9D normalized [0,1] feature matrix
5. match_beats.py cross-correlation > 0.7 on perfectly synced synthetic data

## Constraints
- Python only: numpy, scipy, standard library (no torch, no librosa for motion side)
- JOSH output format: SMPL body meshes → forward kinematics → joints_3d [T, 24, 3] in meters at 30fps
- SMPL 24 joints: 0=pelvis, 1=left_hip, 2=right_hip, 3=spine1, 4=left_knee, 5=right_knee, 6=spine2, 7=left_ankle, 8=right_ankle, 9=spine3, 10=left_foot, 11=right_foot, 12=neck, 13=left_collar, 14=right_collar, 15=head, 16=left_shoulder, 17=right_shoulder, 18=left_elbow, 19=right_elbow, 20=left_wrist, 21=right_wrist, 22=left_hand, 23=right_hand
- De Leva 1996 mass proportions for joint weighting
- analyze_motion.py mirrors analyze_track.py (9 extractors, per-track min-max norm to [0,1])
- match_beats.py: Level 1 (accent-beat timestamp matching) + Level 2 (spectral cross-correlation)
- TRIVIUM scoring: all sub-scores bounded [0,1], weighted combination to final 0-100

## What to try
- Central differences for velocity, Gaussian σ=50ms smoothing for accents
- STFT per joint speed: nperseg=64, noverlap=56. Bands: Low 0-2Hz, Mid 2-6Hz, High 6-15Hz
- 70ms tolerance for accent-beat matching (Repp 2005)
- Anticipation bonus: erf(γ=0.5, σ_τ=50ms)
- Joint groups: legs=[1,2,4,5,7,8,10,11], torso=[0,3,6,9], arms=[13,14,16,17,18,19], hands=[20,21,22,23], head=[12,15]
- Shannon entropy for vocabulary diversity
- Spatial entropy of CoM for stage use
- Jerk-based cleanliness metric

## What NOT to try
- No torch/librosa for motion
- No hardcoded test results
- No skipping synthetic test mode
