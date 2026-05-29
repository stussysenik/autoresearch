# SCENARIO BLUEPRINT: headspin-loop-01
## Tags: inversion, rotation, power
## Notes: Continuous axial rotation with heavy motion blur.

---

## STATES

### State Machine: Combined Physics + Phase + Contact + Musicality

```
STATE: ENTRY_APPROACH
  Phase: transition (pre-power setup)
  Contact: feet j10,j11 weight-bearing; head/hands free
  Physics: L_z ≈ 0; CoM descending, preparing angular impulse
  Musicality: entry sweep should arrive -80ms to -30ms before beat; arm sweep j22,j23 readable

  Entry: clip start OR pelvis j0.z > 0.70m AND foot alternation at j10,j11 visible
  Active measurements:
    - pelvis_height: j0.z → expected [0.70, 1.10] m
    - arm_speed: ||vel(j22)||, ||vel(j23)|| → expected < 2.0 m/s (building)
    - L_z_pre: Σ mᵢ(rᵢ × vᵢ)_z about corrected j15 → expected [0, 1.0] kg·m²·rad/s
    - foot_contact: j10.z, j11.z near floor_z → expected < 0.05m
  Exit: pelvis j0.z descends Δz/Δt > 0.8 m/s downward AND arm sweep speed at j22,j23 > 2.0 m/s
  Duration: variable; if clip starts mid-spin, skip entirely — NOT penalized

  NOTE: May be ABSENT from clip. Phase detector must handle clip-starts-in-spin gracefully.
  If j15.z < j0.z AND |L_z| > 3.0 from frame 0, enter HEADSPIN_LOOP directly.

→ TRANSITION to HEAD_PLANT_TRANSITION
  Quality signal: jerk at j22,j23 (arm sweep → plant handoff); should be single rising peak
  Expected duration: 3–6 frames (0.10–0.20s)
```

```
STATE: HEAD_PLANT_TRANSITION
  Phase: transition (power entry)
  Contact: j15 descending toward floor (touching → weight-bearing);
           j22,j23 briefly touching/weight-bearing as stabilizers;
           j10,j11 unloading
  Physics: |L_z| rising 0 → 3.0+ kg·m²·rad/s; arm sweep converts linear momentum to angular
  Musicality: arm sweep j18,j19,j22,j23 may hit snare accent; entry plant ideally on beat or -50ms

  Entry: j15.z < 0.12m AND |L_z| crossing 1.0 kg·m²·rad/s
  Active measurements:
    - head_descent_rate: d(j15.z)/dt → expected -0.5 to -1.5 m/s (clean plant)
    - arm_sweep_arc: angular displacement of j22,j23 about j15 → expected > 90° sweep
    - L_z_onset: |L_z| rising curve smoothness → no step changes; target d|L_z|/dt > 0
    - kick_impulse: speed at j7,j8 → expected 2.0–4.0 m/s (entry kick, pre-blur)
    - entry_jerk_j15: d²v(j15)/dt² magnitude → expected 40–120 m/s³ single spike
    - momentum_continuity: L_z_after_5frames / L_z_from_arm_sweep → target > 0.85
  Exit: j15.z stable < 0.06m (variance < 0.01m) AND |L_z| > 3.0 kg·m²·rad/s
        AND j15.z < j0.z (inversion confirmed)
  Duration: 9–18 frames at 30fps (0.30–0.60s)

→ TRANSITION to HEADSPIN_LOOP
  Quality signal: L_z onset smoothness (no step-change); momentum_continuity > 0.85 = clean
  Expected duration: 2–4 frames
```

```
STATE: HEADSPIN_LOOP  ← PRIMARY PHASE
  Phase: power (sustained inverted axial rotation)
  Contact: j15 (crown-corrected) weight-bearing, persistent; j22,j23 free (brief taps allowed);
           j10,j11 free; j16,j17,j3,j6,j9 free (shoulder/back contact = degradation)
  Physics: L_z ∈ [5,15] kg·m²·rad/s decaying slowly; ω_z ∈ [2,20] rad/s;
           fixed pivot at j15_crown = j15 + [0,0,-0.06]
  Musicality: 20% weight; only entry/pump/exit events scored; periodic revolutions rejected

  Entry: j15.z < 0.06m AND j15.z < j0.z AND |L_z| > 3.0 AND ω_z > 2.0 rad/s
  Active measurements:
    - omega_z: L_z / I_approx → expected [2, 20] rad/s; slow monotonic decay ≈ -0.1 to -0.3 rad/s²
    - tangential_cv: std(v_tan) / mean(v_tan) → expected < 0.15 (clean); > 0.25 (wobble)
    - axial_ratio: mean(|v_ax|) / mean(|v_tan|) at j0,j3 → expected < 0.08 (clean); > 0.20 (wobble)
    - pivot_drift: std(||j15_crown_xy - mean(j15_crown_xy)||) → expected < 0.04m (clean)
    - L_z_conservation_cv: std(L_z residuals from linear fit) / mean(L_z) → expected < 0.15
    - L_z_decay_slope: poly1d fit slope → expected ≤ 0 (decaying)
    - head_height_cv: std(j15.z) / mean(|j15.z|) → expected < 0.05 (stable pivot)
    - ankle_radius: mean(||j7,j8_xy - j15_crown_xy||) → drives sub-state detection
    - iceskater_corr: corr(ankle_radius, |ω_z|) → expected < -0.3 (inverse = good pumping)
    - shoulder_back_fail: any(j16,j17.z < floor+0.08) OR mean(j3,j6,j9.z) < floor+0.10

  SUB-STATES (do NOT trigger phase change; detected by ankle_radius derivative):
    TUCK: d(ankle_radius)/dt < -0.05 m/s → ω_z rising; ice-skater effect; score +
    EXTEND: d(ankle_radius)/dt > +0.05 m/s → ω_z decreasing; momentum storage; neutral
    STEADY: |d(ankle_radius)/dt| < 0.05 m/s

  Exit: |L_z| < 1.5 kg·m²·rad/s OR j15.z begins rising > 0.10m
        OR deliberate arm/leg plant: speed at j22,j23 > 1.5 m/s downward
  Duration: 30–600+ frames; competition quality ≥ 120 frames (4.0s)

→ TRANSITION to EXIT_DISMOUNT
  Quality signal: ω_z deceleration curve smoothness; abrupt spike = crash;
                  NOTE: high L_z dissipation at exit is CORRECT — do NOT penalize
  Expected duration: 3–6 frames
```

```
STATE: EXIT_DISMOUNT
  Phase: transition (power → next)
  Contact: j15 transitioning from weight-bearing → touching → free;
           catch joint (j22/j23 or j10/j11) transitioning to weight-bearing
  Physics: L_z rapidly dissipating; catch-out impulse at catch joint
  Musicality: arm catch j22/j23 may hit snare; foot landing j10/j11 may hit kick

  Entry: see HEADSPIN_LOOP exit conditions
  Active measurements:
    - head_liftoff: d(j15_crown.z)/dt → expected > +0.3 m/s (rising)
    - catch_joint_contact: j22,j23 or j10,j11 → detect weight-bearing transition
    - landing_jerk: d²v(catch_joint)/dt² → HIGH for dynamic exit; LOW for freeze exit
    - L_z_final: |L_z| → expected < 1.5 (absorbed); > 1.5 = incomplete catch
  Exit: new stable phase (footwork: hands low + leg pattern;
        freeze: all_speed < 0.05 m/s for ≥ 15 frames; toprock: j0.z > 0.70m)
  Duration: 9–20 frames (0.30–0.67s)
```

---

## PROPERTIES

Complete data dictionary for implementation:

| Property | Source | SMPL Joints | Formula / Computation | Expected Range | Unit |
|---|---|---|---|---|---|
| `head_crown_pos` | All | 15 | `j15 + [0, 0, -0.06]` | z ∈ [−0.02, 0.04] during loop | m |
| `floor_z` | Contact | 15 | `median(head_crown_z[inverted_frames])` | ≈ 0.00 ± 0.02 | m |
| `inversion_flag` | Phase/Physics | 0, 15 | `j15.z < j0.z` per frame | > 0.70 frac = valid | bool/frac |
| `reconstruction_suspect` | Phase | 0, 15 | `inversion_frac < 0.70` | flag only | bool |
| `pivot_xy` | Contact/Physics | 15 | `head_crown[:, :2]` | drift std < 0.04m | m |
| `pivot_drift_std` | Contact/Physics | 15 | `std(||head_crown_xy − mean||)` | < 0.04 = clean; > 0.08 = bad | m |
| `L_z` | Physics | 0–23 | `Σ mᵢ (rᵢ × vᵢ)_z` about `head_crown_pos` | [5, 15] kg·m²·rad/s | kg·m²·rad/s |
| `L_z_conservation_cv` | Physics | 0–23 | `std(L_z − linear_trend) / mean(|L_z|)` | < 0.15 = clean | dimensionless |
| `L_z_decay_slope` | Physics | 0–23 | `polyfit(t, |L_z|, 1)[0]` | ≤ 0 = correct decay | kg·m²·rad/s² |
| `I_approx` | Physics | 1,2,7,8 | `2·m_hip·r_hip² + 0.5` where `r_hip = mean(||j1,j2_xy − j15_xy||)` | [0.4, 9.0] | kg·m² |
| `omega_z` | Physics | — | `L_z / I_approx` | [2, 20] rad/s | rad/s |
| `omega_cv` | Physics | — | `std(omega_z) / mean(|omega_z|)` | < 0.20 = clean | dimensionless |
| `ankle_radius` | Physics/Phase | 7, 8, 15 | `mean(||j7,j8_xy − head_crown_xy||)` | [0.1, 0.6] m | m |
| `ankle_radius_dt` | Physics/Phase | 7, 8, 15 | `d(ankle_radius)/dt` | TUCK < -0.05; EXTEND > +0.05 | m/s |
| `iceskater_corr` | Physics | 7,8,15 | `corr(ankle_radius_smooth, |omega_z|_smooth)` | < -0.3 = good pumping | dimensionless |
| `v_tan` | Physics | 0,1,2,4,5,7,8,22,23 | `dot(vel_j, t_hat)` per RTA decomp | CV < 0.15 = clean | m/s |
| `v_rad` | Physics | 0,1,2,4,5,7,8,22,23 | `dot(vel_j, R_hat)` per RTA decomp | intentional pulsing OK | m/s |
| `v_ax` | Physics | 0, 3 | `dot(vel_j, spin_axis)` | < 0.08 × v_tan = clean | m/s |
| `axial_ratio` | Physics | 0, 3, 6, 9 | `mean(|v_ax|) / mean(|v_tan|)` | < 0.08 clean; > 0.20 wobble | dimensionless |
| `tangential_cv` | Physics | 0,1,2,4,5 | `std(v_tan) / mean(v_tan)` (proximal only) | < 0.15 = clean; > 0.25 = wobble | dimensionless |
| `blur_conf` | Phase/Music | all | `1 / (1 + speed_j / 2.5)` per joint | [0, 1] | dimensionless |
| `head_weight_bearing` | Contact | 15 | `head_crown.z − floor_z < 0.03 AND speed_crown < 0.20 AND inverted AND pivot_drift < 0.04` | > 0.70 frac = HEADSPIN | bool |
| `hand_touch` | Contact | 22, 23 | `j22,j23.z − floor_z < 0.06 AND speed < 0.20` | brief only in loop | bool |
| `shoulder_back_fail` | Contact | 3,6,9,16,17 | `j16,j17.z < floor+0.08 OR mean(j3,j6,j9).z < floor+0.10` | frac < 0.10 = HEADSPIN | bool |
| `move_id` | Contact | 15,16,17,3,6,9 | `head_wb_frac > 0.70 AND shoulder_back_fail_frac < 0.10` | "HEADSPIN" or "assisted_or_invalid" | category |
| `phase_label` | Phase | 0,15,all | `classify_headspin_phases()` | {entry_approach, head_plant_transition, headspin_loop, exit_dismount, freeze, toprock, footwork} | category |
| `sub_state` | Phase | 7,8,15 | ankle_radius_dt threshold | {tuck, extend, steady} | category |
| `entry_jerk_j15` | Phase | 15 | `||d²vel(j15)/dt²||` at plant frame | 40–120 m/s³ single spike | m/s³ |
| `momentum_continuity` | Phase | 0–23 | `1 − |L_z_after5 − L_z_before5| / L_z_before5` | > 0.85 = clean entry | dimensionless |
| `head_height_cv` | Physics | 15 | `std(j15.z) / mean(|j15.z|)` | < 0.05 = stable | dimensionless |
| `beat_align` | Musicality | 0,1,2,4,5 (primary) | `mean(max_b(gaussian(motion_peak − beat, σ=70ms)))` | [0.10, 0.22] | dimensionless |
| `event_signal` | Musicality | 0–23 (blur-weighted) | `|d(full_env)/dt| + 0.6·|d(ankle_radius)/dt|` | peaks at entry/pump/exit | dimensionless |
| `kick_corr` | Musicality | 0,1,2,4,5 | `lagged_corr(kick_env, audio_bands["kick"])` | low-medium on entry | dimensionless |
| `snare_corr` | Musicality | 18,19,22,23 | `lagged_corr(snare_env, audio_bands["snare"])` | low-medium at entry/exit | dimensionless |
| `groove_lock` | Musicality | 0,1,2,3,6,9 | `corr(full_env[:-beat_lag], full_env[beat_lag:])` | [0.05, 0.18] — do not target high | dimensionless |
| `tau_star` | Musicality | 0,1,2,4,5 | lag at `max(kick_corr)` | -80ms to -30ms on entry | ms |
| `musicality_score` | Musicality | all | `0.20 × raw_mu × anticipation_bonus` | [0.02, 0.06] during loop | dimensionless |
| `pivot_stability` | Physics | 15 | `1 - clip(std(drift) / 0.08, 0, 1)` | > 0.75 = clean | dimensionless |
| `iceskater_bonus` | Physics | 7,8,15 | `clip(-iceskater_corr, 0, 1)` if `std(ankle_radius) > 0.02` | > 0.5 = skilled pumping | dimensionless |
| `inversion_valid` | Physics/Phase | 0, 15 | `mean(j15.z < j0.z) > 0.70` | True = scorable | bool |
| `duration_loop_frames` | Phase | 15 | frames in HEADSPIN_LOOP state | ≥ 120 = competition quality | frames |

---

## VALIDATION

### TRIVIUM Sub-Score Expectations for headspin-loop-01

| Sub-Score | Expected Range (0–1) | Rationale |
|---|---|---|
| Technique | [0.55, 0.85] | Core signal: L_z conservation, pivot stability, axial ratio. Good headspins score high; wobble or pivot migration drops it. JOSH v4 required for confident inversion — GVHMR may produce 0.30–0.50 on the same clip. |
| Vocabulary | [0.50, 0.70] | Headspin is 1 move class with 2–3 sub-states (tuck/extend/steady); moderate Shannon entropy. Ice-skater cycling increases score. |
| Progression | [0.40, 0.65] | Sustained power with pumping shows good progression; a static headspin that just decays scores lower. |
| Cleanliness | [0.60, 0.80] | SPARC on blur-confidence-weighted CoM velocity. Proximal joints (j0,j1,j2,j3) remain reliable; distal blur suppressed. |
| Musicality | [0.02, 0.06] | 20% phase weight applied. Power moves score LOW on musicality — this is correct and expected. Penalizing it would be wrong. |
| Phrasing | STUB | Requires audio phrase segmentation (8-bar, 16-bar). Cannot compute without phrase boundaries. |
| Creativity | STUB | Requires movement prediction model; headspin is well-defined, mid-creativity. |
| Flow | [0.55, 0.75] | SPARC on confidence-weighted CoM. Smooth entry and exit with sustained loop = high flow. |
| Energy | [0.60, 0.80] | High KE during loop decaying exponentially; good energy management = score tracks L_z decay curve. |
| Response | STUB | Requires opponent/music stimulus data. |
| StageUse | [0.30, 0.50] | Fixed pivot = minimal spatial movement; stage_use naturally low for headspins, this is correct. |

### "Good" vs "Bad" Execution Criteria

**Good execution:**
- `tangential_cv < 0.15` — clean, steady rotation
- `axial_ratio < 0.08` at j0,j3 — spin axis well-maintained
- `pivot_drift_std < 0.02m` — head contact point barely moves
- `L_z_conservation_cv < 0.15` — angular momentum decays smoothly
- `L_z_decay_slope ≤ 0` — monotonic decay (friction), no sudden drops
- `iceskater_corr < -0.30` — radius shrink correlates with speed increase
- `duration_loop_frames ≥ 120` — 4+ seconds at competition level
- `inversion_valid = True` — actually inverted the whole time
- `momentum_continuity > 0.85` at entry
- `shoulder_back_fail_frac < 0.05` — clean single-point head support

**Bad execution / failure modes:**
- `tangential_cv > 0.25` — wobbling or near-fall recovery
- `axial_ratio > 0.20` — pivot migrating or head bobbing
- `pivot_drift_std > 0.06m` — drifting head contact
- `L_z_decay_slope > 0` for sustained period — gaining angular momentum (reconstruction error or extreme pumping mid-sequence)
- `shoulder_back_fail_frac > 0.10` — assisted with back/shoulder (not a headspin)
- `entry_jerk_j15` multi-peaked — poor head placement, bouncing crown
- `momentum_continuity < 0.60` at entry — arm sweep energy lost in plant

### Known HMR Failure Modes for This Scenario

| Failure Mode | Detection | Mitigation |
|---|---|---|
| **GVHMR inversion collapse**: j15.z drifts above j0.z for inverted pose | `inversion_frac < 0.70` | Set `reconstruction_suspect=True`; switch to JOSH v4 output; do not score `inversion_valid=True` |
| **Ankle/foot ghosting**: j7,8,10,11 velocity 2–5× true at 3+ rev/s | `speed[j] > 5.0 m/s` during HEADSPIN_LOOP | Apply `blur_conf` weighting; use `ankle_radius` (position) not ankle velocity for tuck detection |
| **Head z below floor**: GVHMR places j15 underground | `j15.z < floor_z − 0.05` | Clamp to `floor_z`; flag frames; exclude from pivot drift calculation |
| **Ice-skater tuck misread as entry**: tight tuck doubles ω; phase detector resets entry timestamp | L_z spike detected > 15 frames into loop | Guard: if frame > 15 and currently in HEADSPIN_LOOP, L_z increase = `iceskater_bonus`, not new entry |
| **False freeze from pump valleys**: ω dips between pumps → all_speed < 0.05 briefly | < 15-frame duration | Enforce `FREEZE_MIN_FRAMES = 15`; do not exit HEADSPIN_LOOP on short dips |
| **Head crown offset omitted**: using raw j15 introduces ~0.06m lever arm error on all L_z | Any L_z calculation | Always apply `pivot_corrected = j15 + [0, 0, -0.06]` before computing r vectors |
| **Spin-frequency aliasing in groove**: periodic revolutions produce false groove lock signal | `groove_lock > 0.30` during loop | Apply spin-frequency rejection: filter event_signal to suppress peaks at ω_z periodicity |

---

## TESTS

```python
import numpy as np
import pytest

def generate_synthetic_headspin_loop_01(
    fps: int = 30,
    duration: float = 8.0,
    omega_init: float = 10.0,    # rad/s initial
    omega_decay: float = 0.15,   # rad/s² decay rate
    n_pumps: int = 4,            # ice-skater pump cycles
    quality: str = "good"        # "good" | "wobbly" | "gvhmr_fail"
) -> tuple:
    """
    Synthetic headspin: inverted axial rotation with realistic SMPL joint trajectories.
    
    Phases:
      frames 0–14:   HEAD_PLANT_TRANSITION (arm sweep + plant)
      frames 15–end-15: HEADSPIN_LOOP (primary)
      frames end-15 to end: EXIT_DISMOUNT
    """
    T = int(duration * fps)
    joints = np.zeros((T, 24, 3))
    t = np.arange(T) / fps

    HEAD_CROWN_OFFSET = 0.06
    FLOOR_Z = 0.0

    # ── Pivot: head crown on floor ──
    crown_z = FLOOR_Z + HEAD_CROWN_OFFSET  # j15.z (crown at floor means j15 center is +6cm)
    pivot_xy = np.array([0.0, 0.0])

    if quality == "wobbly":
        # Add 4cm lateral pivot drift
        pivot_drift = 0.04 * np.sin(2 * np.pi * 0.5 * t)
        pivot_xy_t = np.column_stack([pivot_drift, np.zeros(T)])
    else:
        pivot_xy_t = np.zeros((T, 2))

    # ── Angular velocity with decay and ice-skater pumps ──
    omega_base = omega_init * np.exp(-omega_decay * t)

    if quality == "good":
        # Ice-skater pumping: ankle_radius oscillates
        pump_freq = n_pumps / duration
        ankle_r_base = 0.35
        pump_amp = 0.15
        ankle_r = ankle_r_base + pump_amp * np.cos(2 * np.pi * pump_freq * t)
        # Conservation: I·ω = const → ω ∝ 1/r²
        I_base = 2 * 2.78 * ankle_r_base**2 + 0.5
        I_t = 2 * 2.78 * ankle_r**2 + 0.5
        omega_t = omega_base * (I_base / I_t)
    else:
        ankle_r = np.full(T, 0.35)
        omega_t = omega_base

    # ── Spin angle ──
    theta = np.cumsum(omega_t) / fps  # integrated angle

    # ── Joint positions (HEADSPIN_LOOP phase, frames 15 to T-15) ──
    loop_start, loop_end = 15, T - 15

    for frame in range(T):
        th = theta[frame]
        r_ankle = ankle_r[frame]
        px, py = pivot_xy_t[frame]

        # Head (j15): pivot point + offset toward floor
        joints[frame, 15] = [px, py, crown_z]

        # Pelvis (j0): above head, rotating around spin axis
        r_pelvis = 0.25  # pelvis orbits ~25cm from spin axis
        joints[frame, 0] = [
            px + r_pelvis * np.cos(th),
            py + r_pelvis * np.sin(th),
            crown_z + 0.55  # pelvis above head in inversion
        ]

        # Hips (j1, j2): ~15cm from spin axis
        for ji, sign in [(1, 1.0), (2, -1.0)]:
            r_hip = 0.15
            joints[frame, ji] = [
                px + r_hip * np.cos(th + sign * 0.3),
                py + r_hip * np.sin(th + sign * 0.3),
                crown_z + 0.40
            ]

        # Core (j3, j6, j9): spine above pelvis
        for ji, dz in [(3, 0.15), (6, 0.30), (9, 0.45)]:
            r_spine = 0.10
            joints[frame, ji] = [
                px + r_spine * np.cos(th),
                py + r_spine * np.sin(th),
                crown_z + dz
            ]

        # Knees (j4, j5)
        for ji, sign in [(4, 1.0), (5, -1.0)]:
            r_knee = r_ankle * 0.7
            joints[frame, ji] = [
                px + r_knee * np.cos(th + sign * 0.5),
                py + r_knee * np.sin(th + sign * 0.5),
                crown_z + 0.70
            ]

        # Ankles (j7, j8) and feet (j10, j11)
        for ji, jf, sign in [(7, 10, 1.0), (8, 11, -1.0)]:
            joints[frame, ji] = [
                px + r_ankle * np.cos(th + sign * 0.2),
                py + r_ankle * np.sin(th + sign * 0.2),
                crown_z + 0.90
            ]
            joints[frame, jf] = joints[frame, ji] + [0.05*np.cos(th), 0.05*np.sin(th), 0.05]

        # Arms (j18–j23): extended horizontally
        r_arm = 0.45
        for ji, sign in [(18, 1.0), (19, -1.0)]:
            joints[frame, ji] = [
                px + r_arm * 0.5 * np.cos(th + sign * np.pi/2),
                py + r_arm * 0.5 * np.sin(th + sign * np.pi/2),
                crown_z + 0.60
            ]
        for ji, sign in [(22, 1.0), (23, -1.0)]:
            joints[frame, ji] = [
                px + r_arm * np.cos(th + sign * np.pi/2),
                py + r_arm * np.sin(th + sign * np.pi/2),
                crown_z + 0.65
            ]

        # Neck (j12), collar (j13, j14), wrist (j20, j21): interpolate
        joints[frame, 12] = 0.5 * (joints[frame, 9] + joints[frame, 15])
        joints[frame, 13] = 0.5 * (joints[frame, 9] + joints[frame, 18])
        joints[frame, 14] = 0.5 * (joints[frame, 9] + joints[frame, 19])
        joints[frame, 20] = 0.5 * (joints[frame, 18] + joints[frame, 22])
        joints[frame, 21] = 0.5 * (joints[frame, 19] + joints[frame, 23])

        # Shoulders (j16, j17): free from floor in clean headspin
        for ji, sign in [(16, 1.0), (17, -1.0)]:
            joints[frame, ji] = [
                px + 0.20 * np.cos(th + sign * np.pi/2),
                py + 0.20 * np.sin(th + sign * np.pi/2),
                crown_z + 0.55
            ]

    # GVHMR failure mode: inversion collapse (j15.z > j0.z for many frames)
    if quality == "gvhmr_fail":
        joints[:, 0, 2] = 0.10  # pelvis near floor (reconstruction failure)
        joints[:, 15, 2] = 0.20  # head above pelvis (wrong!)

    # ── Beat times: 4/4 at 92 BPM ──
    bpm = 92.0
    beat_period = 60.0 / bpm
    beat_times = np.arange(0, duration, beat_period)

    # Entry is ~50ms before first beat
    beat_times = beat_times - 0.050

    # ── Expected scores ──
    expected = {
        "good":      {"power_quality": (0.70, 0.90), "pivot_stability": (0.80, 1.00),
                      "tangential_cv": (0.00, 0.15), "axial_ratio": (0.00, 0.08),
                      "musicality": (0.02, 0.06), "beat_align": (0.10, 0.22),
                      "inversion_valid": True, "reconstruction_suspect": False,
                      "iceskater_bonus": (0.40, 1.00)},
        "wobbly":    {"power_quality": (0.30, 0.60), "pivot_stability": (0.20, 0.60),
                      "tangential_cv": (0.15, 0.40), "axial_ratio": (0.08, 0.30),
                      "inversion_valid": True, "reconstruction_suspect": False,
                      "iceskater_bonus": (0.00, 0.30)},
        "gvhmr_fail": {"inversion_valid": False, "reconstruction_suspect": True},
    }

    return joints, beat_times, expected[quality], omega_t


class TestHeadspinLoop01:
    """Automated test suite for headspin-loop-01 scenario blueprint."""

    @pytest.fixture
    def good_spin(self):
        return generate_synthetic_headspin_loop_01(quality="good")

    @pytest.fixture
    def wobbly_spin(self):
        return generate_synthetic_headspin_loop_01(quality="wobbly")

    @pytest.fixture
    def gvhmr_fail(self):
        return generate_synthetic_headspin_loop_01(quality="gvhmr_fail")

    # ── Phase Detection ──

    def test_phase_headspin_loop_detected(self, good_spin):
        joints, _, _, _ = good_spin
        labels = classify_headspin_phases(joints)['labels']
        loop_frames = [l for l in labels[15:-15] if l == 'headspin_loop']
        assert len(loop_frames) / len(labels[15:-15]) > 0.80, \
            "Primary phase must be headspin_loop for >80% of loop frames"

    def test_no_false_freeze_during_pump(self, good_spin):
        joints, _, _, _ = good_spin
        result = classify_headspin_phases(joints)
        # Freeze requires 15+ consecutive frames; pump valleys should not trigger this
        labels = result['labels']
        in_freeze = [i for i, l in enumerate(labels[15:-15]) if l == 'freeze']
        if len(in_freeze) > 0:
            # Check no freeze segment is in the middle of the loop
            assert all(labels[i] == 'freeze' for i in range(min(in_freeze)-5, min(in_freeze))), \
                "Freeze inside loop = false positive from pump valley"

    def test_gvhmr_failure_flagged(self, gvhmr_fail):
        joints, _, _, _ = gvhmr_fail
        result = classify_headspin_phases(joints)
        assert result['reconstruction_suspect'] is True, \
            "GVHMR inversion failure must be flagged"
        assert result['inversion_frac'] < 0.70

    # ── Physics ──

    def test_L_z_in_expected_range(self, good_spin):
        joints, _, expected, _ = good_spin
        fps = 30
        dt = 1.0 / fps
        vel = np.gradient(joints, dt, axis=0)
        crown = joints[:, 15].copy(); crown[:, 2] -= 0.06
        MASSES = {0:11.17,1:2.78,2:2.78,3:5.0,4:3.28,5:3.28,6:3.0,7:0.61,8:0.61,
                  9:2.5,10:0.97,11:0.97,12:1.5,13:0.5,14:0.5,15:5.0,16:2.0,17:2.0,
                  18:1.14,19:1.14,20:0.45,21:0.45,22:0.41,23:0.41}
        Lz = np.zeros(len(joints))
        for j, m in MASSES.items():
            r = joints[:, j] - crown
            v = vel[:, j]
            Lz += m * (r[:, 0]*v[:, 1] - r[:, 1]*v[:, 0])
        loop_Lz = np.abs(Lz[15:-15])
        assert 5.0 <= loop_Lz.mean() <= 15.0, \
            f"L_z mean {loop_Lz.mean():.2f} outside [5, 15] kg·m²·rad/s"

    def test_tangential_cv_clean(self, good_spin):
        joints, _, expected, _ = good_spin
        result = score_headspin(joints, fps=30)
        lo, hi = expected["tangential_cv"]
        assert lo <= 1.0 - result['tangential_score'] <= hi or result['tangential_score'] >= 0.85, \
            f"tangential_score {result['tangential_score']} too low for clean spin"

    def test_pivot_stability_clean(self, good_spin):
        joints, _, expected, _ = good_spin
        result = score_headspin(joints, fps=30)
        lo, hi = expected["pivot_stability"]
        assert lo <= result['pivot_stability'] <= 1.0, \
            f"pivot_stability {result['pivot_stability']} below expected {lo}"

    def test_iceskater_bonus_positive(self, good_spin):
        joints, _, expected, _ = good_spin
        result = score_headspin(joints, fps=30)
        lo, hi = expected["iceskater_bonus"]
        assert result['iceskater_bonus'] >= lo, \
            f"iceskater_bonus {result['iceskater_bonus']} below {lo} — pumping not detected"

    def test_wobbly_scores_lower(self, good_spin, wobbly_spin):
        g_joints, _, _, _ = good_spin
        w_joints, _, _, _ = wobbly_spin
        g_result = score_headspin(g_joints)
        w_result = score_headspin(w_joints)
        assert g_result['power_quality'] > w_result['power_quality'] + 0.10, \
            "Good spin must score >0.10 higher than wobbly spin"

    def test_inversion_valid(self, good_spin):
        joints, _, expected, _ = good_spin
        result = score_headspin(joints)
        assert result['inversion_valid'] is expected['inversion_valid']

    # ── Contact ──

    def test_head_weight_bearing_during_loop(self, good_spin):
        joints, _, _, _ = good_spin
        contact = detect_headspin_contact(joints)
        loop_wb = contact['head_weight_bearing'][15:-15]
        assert loop_wb.mean() > 0.85, \
            f"Head weight-bearing frac {loop_wb.mean():.2f} < 0.85 during loop"

    def test_move_id_headspin(self, good_spin):
        joints, _, _, _ = good_spin
        contact = detect_headspin_contact(joints)
        assert contact['move_id'] == "HEADSPIN", \
            f"move_id '{contact['move_id']}' != 'HEADSPIN'"

    def test_shoulder_back_clean(self, good_spin):
        joints, _, _, _ = good_spin
        contact = detect_headspin_contact(joints)
        fail_frac = contact['shoulder_back_failure'][15:-15].mean()
        assert fail_frac < 0.05, \
            f"shoulder_back_failure {fail_frac:.2f} > 0.05 — not a clean headspin"

    # ── Musicality ──

    def test_musicality_low_for_power(self, good_spin):
        joints, beat_times, expected, _ = good_spin
        # Stub audio bands with silence — musicality should still be low
        T = len(joints)
        audio_bands = {"kick": np.zeros(T), "snare": np.zeros(T), "hat": np.zeros(T)}
        result = score_headspin_musicality(joints, beat_times, audio_bands)
        assert result['musicality'] <= 0.08, \
            "Power move musicality must be low (20% weight applied)"

    def test_beat_align_in_range(self, good_spin):
        joints, beat_times, expected, _ = good_spin
        T = len(joints)
        audio_bands = {"kick": np.zeros(T), "snare": np.zeros(T), "hat": np.zeros(T)}
        result = score_headspin_musicality(joints, beat_times, audio_bands)
        lo, hi = expected["beat_align"]
        assert lo <= result['beatalign'] <= hi + 0.05, \
            f"beat_align {result['beatalign']} outside [{lo}, {hi}]"
```

---

## PSEUDO-CODE

```python
import numpy as np
from typing import Optional

# ── Constants ──────────────────────────────────────────────────────────────────

MASSES = {
    0:11.17, 1:2.78, 2:2.78, 3:5.0, 4:3.28, 5:3.28,
    6:3.0,   7:0.61, 8:0.61, 9:2.5, 10:0.97, 11:0.97,
    12:1.5,  13:0.5, 14:0.5, 15:5.0, 16:2.0, 17:2.0,
    18:1.14, 19:1.14, 20:0.45, 21:0.45, 22:0.41, 23:0.41
}

HEAD_CROWN_OFFSET  = 0.06      # m — j15 center → actual crown contact
BLUR_SPEED_SCALE   = 2.5       # m/s where blur_conf = 0.5
SPIN_AXIS          = np.array([0.0, 0.0, 1.0])

# Phase thresholds
LZ_POWER_ENTRY    = 3.0        # kg·m²·rad/s — enter HEADSPIN_LOOP
LZ_POWER_EXIT     = 1.5        # kg·m²·rad/s — exit HEADSPIN_LOOP
HEAD_CONTACT_Z    = 0.06       # m — head near floor (loop active)
PELVIS_UPRIGHT_Z  = 0.70       # m — toprock
FREEZE_MIN_FRAMES = 15         # min frames to confirm freeze (prevent pump-valley false positives)
FREEZE_SPEED      = 0.05       # m/s

# Joint groups (Physics Agent)
PROXIMAL = [0, 1, 2, 3, 6, 9]
ICE_SKATER_JOINTS = [7, 8]     # ankle radius proxy for I-manipulation
BLUR_RISK = [7, 8, 10, 11, 22, 23]
KICK_JOINTS  = [0, 1, 2, 4, 5, 7, 8]
SNARE_JOINTS = [18, 19, 20, 21, 22, 23]
HAT_JOINTS   = [15, 16, 17]
RTA_JOINTS   = [0, 1, 2, 4, 5, 7, 8, 22, 23]

# TRIVIUM weights
TRIVIUM_BODY = 0.40; TRIVIUM_SOUL = 0.35; TRIVIUM_MIND = 0.25
BODY_W = dict(technique=0.40, vocabulary=0.20, progression=0.15, cleanliness=0.25)
SOUL_W = dict(musicality=0.45, phrasing=0.25, creativity=0.30)
MIND_W = dict(flow=0.30, energy=0.20, response=0.30, stage_use=0.20)

MUSICALITY_PHASE_WEIGHT = {
    "toprock": 1.0, "footwork": 0.8, "headspin_loop": 0.20,
    "head_plant_transition": 0.50, "exit_dismount": 0.50,
    "freeze": 0.60, "transition": 0.40
}


# ── Utilities ──────────────────────────────────────────────────────────────────

def crown_pos(joints_3d: np.ndarray) -> np.ndarray:
    """
    Physics + Phase + Contact agents agree: j15 is head center, not crown contact.
    Actual pivot = j15 - HEAD_CROWN_OFFSET in z (toward floor when inverted, world up = +z).
    """
    pivot = joints_3d[:, 15, :].copy()  # [T, 3]
    pivot[:, 2] -= HEAD_CROWN_OFFSET
    return pivot


def blur_confidence(joints_3d: np.ndarray, fps: int = 30) -> np.ndarray:
    """
    Phase + Musicality agents: down-weight high-velocity distal joints.
    At 3+ rev/s, ankles travel 3–5 m/s at 0.5m extension — GVHMR ghosts them.
    """
    dt = 1.0 / fps
    vel = np.gradient(joints_3d, dt, axis=0)  # [T, 24, 3]
    speed = np.linalg.norm(vel, axis=-1)       # [T, 24]
    return 1.0 / (1.0 + speed / BLUR_SPEED_SCALE)


def compute_Lz(joints_3d: np.ndarray, velocities: np.ndarray, pivot: np.ndarray) -> np.ndarray:
    """
    Physics Agent: angular momentum z-component about corrected crown pivot.
    L_z = Σ mᵢ (rᵢ × vᵢ)_z
    De Leva (1996) 70kg body segment masses.
    """
    Lz = np.zeros(len(joints_3d))
    for j, m in MASSES.items():
        r = joints_3d[:, j, :] - pivot          # [T, 3]
        v = velocities[:, j, :]
        Lz += m * (r[:, 0] * v[:, 1] - r[:, 1] * v[:, 0])
    return Lz


def rta_decompose(joints_3d: np.ndarray, velocities: np.ndarray, pivot: np.ndarray,
                  joints: list = RTA_JOINTS) -> tuple:
    """
    Physics Agent: decompose velocity into Radial / Tangential / Axial.
    Returns per-frame aggregated values.
    """
    T = len(joints_3d)
    v_tan = np.zeros(T * len(joints))
    v_rad = np.zeros(T * len(joints))
    v_ax  = np.zeros(T * len(joints))
    idx = 0
    for t in range(T):
        for j in joints:
            R = joints_3d[t, j] - pivot[t]
            R_mag = np.linalg.norm(R) + 1e-9
            R_hat = R / R_mag
            t_hat = np.cross(SPIN_AXIS, R_hat)
            t_hat_mag = np.linalg.norm(t_hat) + 1e-9
            t_hat = t_hat / t_hat_mag
            v = velocities[t, j]
            v_tan[idx] = abs(np.dot(v, t_hat))
            v_rad[idx] = abs(np.dot(v, R_hat))
            v_ax[idx]  = abs(np.dot(v, SPIN_AXIS))
            idx += 1
    return v_tan, v_rad, v_ax


def gaussian_beat_align(event_times: np.ndarray, beat_times: np.ndarray,
                         sigma: float = 0.070) -> float:
    """Musicality Agent: soft BeatAlign — critical for anticipatory power setups."""
    if len(event_times) == 0:
        return 0.0
    return float(np.mean([
        max(np.exp(-((et - bt)**2) / (2 * sigma**2)) for bt in beat_times)
        for et in event_times
    ]))


# ── Phase Classification ───────────────────────────────────────────────────────

def classify_headspin_phases(joints_3d: np.ndarray, fps: int = 30) -> dict:
    """
    Phase Agent: classify frames into headspin state machine.
    Handles clip-starts-in-spin (HEADSPIN_LOOP from frame 0 if conditions met).
    """
    T = len(joints_3d)
    dt = 1.0 / fps
    vel = np.gradient(joints_3d, dt, axis=0)
    conf = blur_confidence(joints_3d, fps)
    all_speed = (np.linalg.norm(vel, axis=-1) * conf).mean(axis=1)  # confidence-weighted

    pivot = crown_pos(joints_3d)
    Lz = compute_Lz(joints_3d, vel, pivot)
    Lz_abs = np.abs(Lz)

    pelvis_z = joints_3d[:, 0, 2]
    head_z   = joints_3d[:, 15, 2]
    crown_z  = pivot[:, 2]

    # Inversion validation — Physics Agent: flag GVHMR failure
    inversion_frac = float(np.mean(head_z < pelvis_z))
    reconstruction_suspect = inversion_frac < 0.70

    # Ankle radius from crown: use POSITION not velocity (blur-safe)
    # Phase Agent edge case 2: blur-induced false ankle velocities
    ankle_r = np.linalg.norm(
        joints_3d[:, [7, 8], :2] - pivot[:, np.newaxis, :2],
        axis=-1
    ).mean(axis=1)

    # Per-frame raw labels
    raw_labels = []
    for t in range(T):
        if all_speed[t] < FREEZE_SPEED:
            raw_labels.append('freeze_candidate')
        elif (crown_z[t] < HEAD_CONTACT_Z and
              Lz_abs[t] > LZ_POWER_ENTRY and
              head_z[t] < pelvis_z[t]):
            raw_labels.append('headspin_loop')
        elif pelvis_z[t] > PELVIS_UPRIGHT_Z:
            raw_labels.append('toprock')
        elif crown_z[t] < HEAD_CONTACT_Z and Lz_abs[t] > 1.0:
            raw_labels.append('head_plant_transition')
        elif np.mean(joints_3d[t, [22, 23], 2]) < 0.15:
            raw_labels.append('footwork')
        else:
            raw_labels.append('transition')

    # Temporal smoothing: minimum segment duration
    # Phase Agent: freeze requires 15 frames minimum to prevent pump-valley false positives
    labels = _smooth_segments(raw_labels, min_seg=9,
                              phase_min={'freeze_candidate': FREEZE_MIN_FRAMES})
    labels = ['freeze' if l == 'freeze_candidate' else l for l in labels]

    # Ice-skater sub-states (Phase Agent: within HEADSPIN_LOOP only)
    ankle_r_dt = np.gradient(ankle_r, dt)
    sub_state = np.full(T, 'steady', dtype=object)
    for t in range(T):
        if labels[t] == 'headspin_loop':
            if ankle_r_dt[t] < -0.05:    # TUCK: radius shrinking → ω rising
                sub_state[t] = 'tuck'
            elif ankle_r_dt[t] > +0.05:  # EXTEND: radius growing → ω storing
                sub_state[t] = 'extend'

    # Transition quality
    boundaries = _find_boundaries(labels)
    jerk = np.gradient(np.gradient(all_speed, dt), dt)
    transition_scores = []
    for frame, from_ph, to_ph in boundaries:
        w = jerk[max(0, frame-5):frame+5]
        jerk_score = float(1.0 - np.clip(w.mean() / 50.0, 0.0, 1.0))

        # Momentum continuity: meaningful ONLY at entry (Physics + Phase agents)
        # At exit: high dissipation = CORRECT — do NOT penalize
        mom_cont = None
        if to_ph == 'headspin_loop':
            L_b = Lz_abs[max(0, frame-5):frame].mean()
            L_a = Lz_abs[frame:frame+5].mean()
            mom_cont = float(1.0 - abs(L_a - L_b) / (L_b + 1e-6))

        transition_scores.append({
            'frame': frame, 'from': from_ph, 'to': to_ph,
            'jerk_score': round(jerk_score, 3),
            'momentum_continuity': round(mom_cont, 3) if mom_cont is not None else None,
        })

    return {
        'labels': labels,
        'sub_state': list(sub_state),
        'reconstruction_suspect': reconstruction_suspect,
        'inversion_frac': round(inversion_frac, 3),
        'transitions': transition_scores,
        'Lz_abs_mean': round(float(Lz_abs.mean()), 2),
    }


def get_phase_weights(labels: list) -> np.ndarray:
    """
    Phase Agent: per-frame per-joint weight table.
    HEADSPIN_LOOP: ankles j7,j8 = 0.3x; feet j10,j11 = 0.2x (severe blur).
    HEAD_PLANT_TRANSITION: arms/hands 2.0x (primary L_z generator).
    """
    WEIGHT_TABLE = {
        'headspin_loop':          {(0,1,2):2.0, (3,6,9):1.5, (15,):1.4,
                                   (4,5):1.0, (22,23):0.7, (7,8):0.3, (10,11):0.2},
        'head_plant_transition':  {(18,19,22,23):2.0, (7,8,10,11):1.6,
                                   (15,):1.8, (0,1,2):1.3},
        'exit_dismount':          {(22,23):1.8, (3,6,9):1.4, (0,1,2):1.2, (4,5):1.0},
    }
    T = len(labels)
    weights = np.ones((T, 24))
    for t, phase in enumerate(labels):
        table = WEIGHT_TABLE.get(phase, {})
        for joints, w in table.items():
            for j in joints:
                weights[t, j] = w
    return weights


# ── Contact Detection ──────────────────────────────────────────────────────────

def detect_headspin_contact(joints_3d: np.ndarray, fps: int = 30) -> dict:
    """
    Contact Agent: identify weight-bearing joints and move fingerprint.
    Primary contact = head crown (j15 corrected); single-point gyroscopic support.
    """
    dt = 1.0 / fps
    vel = np.gradient(joints_3d, dt, axis=0)
    speed = np.linalg.norm(vel, axis=-1)

    crown = crown_pos(joints_3d)           # [T, 3] corrected
    crown_vel = np.gradient(crown, dt, axis=0)
    crown_speed = np.linalg.norm(crown_vel, axis=-1)

    inverted = joints_3d[:, 15, 2] < joints_3d[:, 0, 2]
    floor_z = float(np.median(crown[inverted, 2])) if np.any(inverted) \
              else float(np.percentile(joints_3d[..., 2], 5))

    # Contact Agent: use pivot drift for weight-bearing, not just z-proximity
    pivot_drift = np.linalg.norm(crown[:, :2] - crown[:, :2].mean(axis=0), axis=1)
    head_touch  = (crown[:, 2] - floor_z < 0.03) & (crown_speed < 0.20) & inverted
    head_wb     = head_touch & (pivot_drift < 0.04)

    hand_touch  = ((joints_3d[:, [22,23], 2] - floor_z) < 0.06) & (speed[:, [22,23]] < 0.20)
    hand_wb     = hand_touch & (~head_wb[:, np.newaxis])  # hands only bear weight pre/post loop

    # Degradation check: shoulder/back contact = not a clean headspin
    shoulder_back_fail = (
        (joints_3d[:, [16,17], 2] - floor_z < 0.08).any(axis=1) |
        (joints_3d[:, [3,6,9], 2].mean(axis=1) - floor_z < 0.10)
    )

    move_id = ("HEADSPIN"
               if head_wb.mean() > 0.70 and shoulder_back_fail.mean() < 0.10
               else "assisted_or_invalid")

    return {
        'floor_z':              floor_z,
        'head_weight_bearing':  head_wb,
        'hand_touch':           hand_touch,
        'hand_weight_bearing':  hand_wb,
        'shoulder_back_failure': shoulder_back_fail,
        'move_id':              move_id,
        'pivot_drift':          pivot_drift,
    }


# ── Physics Scoring ────────────────────────────────────────────────────────────

def score_headspin(joints_3d: np.ndarray, fps: int = 30) -> dict:
    """
    Physics Agent: power quality score from angular momentum and RTA decomposition.
    Returns sub-scores consumed by TRIVIUM technique and body dimensions.
    """
    T = len(joints_3d)
    dt = 1.0 / fps
    vel = np.gradient(joints_3d, dt, axis=0)

    pivot = crown_pos(joints_3d)
    Lz = compute_Lz(joints_3d, vel, pivot)
    Lz_abs = np.abs(Lz)

    # Inversion validation (Physics Agent gap #5: GVHMR prior mismatch)
    inversion_frac = float(np.mean(joints_3d[:, 15, 2] < joints_3d[:, 0, 2]))
    inversion_valid = inversion_frac > 0.70

    # Pivot stability (Contact Agent: drift std threshold 4cm)
    pivot_drift = np.linalg.norm(pivot[:, :2] - pivot[:, :2].mean(axis=0), axis=1)
    pivot_stability = float(1.0 - np.clip(np.std(pivot_drift) / 0.08, 0.0, 1.0))

    # L_z conservation: linear decay expected; non-monotonic = wobble
    # Physics Agent: residual CV separates clean friction decay from technique failure
    t_arr = np.arange(T)
    poly = np.polyfit(t_arr, Lz_abs, 1)
    trend = np.polyval(poly, t_arr)
    residuals = Lz_abs - trend
    conservation_cv = float(np.std(residuals) / (np.mean(Lz_abs) + 1e-6))
    conservation_score = float(1.0 - np.clip(conservation_cv * 4.0, 0.0, 1.0))
    decay_sign_ok = bool(poly[0] <= 0)

    # ω estimation (approximated I from hip radius)
    r_hips = np.linalg.norm(
        joints_3d[:, [1,2], :2] - pivot[:, np.newaxis, :2], axis=-1
    ).mean(axis=1)
    I_approx = 2 * 2.78 * r_hips**2 + 0.5
    omega_z = Lz / (I_approx + 1e-6)
    omega_cv = float(np.std(omega_z) / (np.abs(omega_z).mean() + 1e-6))
    omega_smoothness = float(1.0 - np.clip(omega_cv * 3.0, 0.0, 1.0))

    # RTA decomposition (proximal joints only for blur safety)
    # Physics Agent: down-weight blur-risk joints by confidence
    conf = blur_confidence(joints_3d, fps)
    proximal_rta = [j for j in RTA_JOINTS if j not in BLUR_RISK]
    v_tan, v_rad, v_ax = rta_decompose(joints_3d, vel, pivot, joints=proximal_rta)
    v_tan_mean = v_tan.mean() + 1e-6

    tangential_cv    = float(np.std(v_tan) / v_tan_mean)
    tangential_score = float(1.0 - np.clip(tangential_cv, 0.0, 1.0))

    axial_ratio  = float(v_ax.mean() / v_tan_mean)
    axial_score  = float(1.0 - np.clip(axial_ratio * 8.0, 0.0, 1.0))

    radial_intent = conservation_score * 0.7 + omega_smoothness * 0.3

    # Head height stability
    head_z = joints_3d[:, 15, 2]
    head_z_cv    = float(np.std(head_z) / (np.abs(head_z).mean() + 1e-6))
    height_score = float(1.0 - np.clip(head_z_cv * 15.0, 0.0, 1.0))

    # Ice-skater bonus: ankle_radius ↓ → ω ↑ (intentional I-manipulation)
    # Physics Agent: use POSITION not velocity for ankle radius (blur-safe)
    ankle_r = np.linalg.norm(
        joints_3d[:, [7, 8], :2] - pivot[:, np.newaxis, :2], axis=-1
    ).mean(axis=1)
    r_smooth = np.convolve(ankle_r, np.ones(5)/5, mode='same')
    w_smooth = np.convolve(np.abs(omega_z), np.ones(5)/5, mode='same')
    if np.std(r_smooth) > 0.02:
        iceskater_corr  = float(np.corrcoef(r_smooth, w_smooth)[0, 1])
        iceskater_bonus = float(np.clip(-iceskater_corr, 0.0, 1.0))
    else:
        iceskater_bonus = 0.0

    power_quality = (
        0.25 * tangential_score +
        0.20 * conservation_score +
        0.20 * pivot_stability +
        0.15 * axial_score +
        0.10 * height_score +
        0.10 * radial_intent
    )

    return {
        'power_quality':     round(float(power_quality), 3),
        'pivot_stability':   round(float(pivot_stability), 3),
        'L_z_conservation':  round(float(conservation_score), 3),
        'L_z_mean_kgm2s':    round(float(Lz_abs.mean()), 2),
        'omega_z_mean_rads': round(float(np.abs(omega_z).mean()), 2),
        'tangential_score':  round(float(tangential_score), 3),
        'axial_score':       round(float(axial_score), 3),
        'radial_intent':     round(float(radial_intent), 3),
        'height_stability':  round(float(height_score), 3),
        'iceskater_bonus':   round(float(iceskater_bonus), 3),
        'inversion_valid':   bool(inversion_valid),
        'L_z_decay_correct': bool(decay_sign_ok),
        'omega_cv':          round(float(omega_cv), 3),
        'axial_ratio':       round(float(axial_ratio), 3),
        'pivot_drift_std_m': round(float(np.std(pivot_drift)), 4),
    }


# ── Musicality Scoring ────────────────────────────────────────────────────────

def score_headspin_musicality(joints_3d: np.ndarray, beat_times: np.ndarray,
                               audio_bands: dict, fps: int = 30) -> dict:
    """
    Musicality Agent: event-based scoring with spin-frequency rejection.
    Power phase weight = 20%. Anticipation bonus for -50ms setup.
    """
    dt = 1.0 / fps
    t = np.arange(len(joints_3d)) * dt
    vel = np.gradient(joints_3d, dt, axis=0)
    speed = np.linalg.norm(vel, axis=-1)

    # Blur-aware joint weighting (Musicality Agent: distal joints unreliable)
    blur_conf = 1.0 / (1.0 + speed / 2.5)
    kick_env  = (speed[:, KICK_JOINTS]  * blur_conf[:, KICK_JOINTS]).sum(axis=1)
    snare_env = (speed[:, SNARE_JOINTS] * blur_conf[:, SNARE_JOINTS]).sum(axis=1)
    hat_env   = (speed[:, HAT_JOINTS]   * blur_conf[:, HAT_JOINTS]).sum(axis=1)

    # Proximal-weighted full envelope
    POWER_PROX = [0,1,2,3,4,5,6,9,12,18,19,22,23]
    prox_w = np.zeros(24)
    prox_w[POWER_PROX] = [1.4,1.1,1.1,0.8,0.9,0.9,0.7,0.8,0.8,0.7,0.7,1.0,1.0]
    full_env = (speed * blur_conf * prox_w[np.newaxis, :]).sum(axis=1)

    # Event detection: isolate entry/pump/exit accents
    # Musicality Agent: reject periodic revolution signal (spin-frequency rejection)
    ankle_r = np.linalg.norm(
        joints_3d[:, [7,8], :2] - joints_3d[:, 15:16, :2], axis=-1
    ).mean(axis=1)
    event_signal = np.abs(np.gradient(full_env, dt)) + 0.6 * np.abs(np.gradient(ankle_r, dt))
    event_signal = (event_signal - event_signal.mean()) / (event_signal.std() + 1e-6)
    peak_idx = _local_peaks(event_signal, thresh=1.0, refractory=int(0.18/dt))
    motion_beats = t[peak_idx]

    beat_align_score = gaussian_beat_align(motion_beats, beat_times, sigma=0.070)

    # Per-band correlations with lag
    kick_corr,  kick_tau  = _lagged_corr(kick_env,  audio_bands["kick"], dt)
    snare_corr, _         = _lagged_corr(snare_env, audio_bands["snare"], dt)
    hat_corr,   _         = _lagged_corr(hat_env,   audio_bands["hat"], dt)

    # Groove (should be LOW for headspin — [0.05, 0.18])
    beat_period = float(np.median(np.diff(beat_times))) if len(beat_times) > 1 else 0.5
    beat_lag = int(round(beat_period / dt))
    groove = 0.0
    if 0 < beat_lag < len(full_env):
        groove = float(max(0.0, np.corrcoef(full_env[:-beat_lag], full_env[beat_lag:])[0, 1]))

    # AHR
    ahr = 0.0
    if len(beat_times) > 0 and len(motion_beats) > 0:
        ahr = float(np.mean([
            np.any(np.exp(-((motion_beats - b)**2) / (2*0.070**2)) > 0.5)
            for b in beat_times
        ]))

    # Anticipation bonus: -50ms setup is correct technique (Musicality Agent)
    anticipation_bonus = float(1.0 + 0.25 * np.tanh((-kick_tau) / 0.050))

    raw = (0.40 * beat_align_score + 0.20 * kick_corr +
           0.15 * snare_corr + 0.10 * hat_corr + 0.15 * ahr)

    # 20% phase weight for power (Musicality Agent: never over-penalize power)
    musicality = 0.20 * raw * anticipation_bonus

    return {
        'musicality':   round(float(musicality), 3),
        'beatalign':    round(float(beat_align_score), 3),
        'ahr':          round(float(ahr), 3),
        'kick_corr':    round(float(kick_corr), 3),
        'snare_corr':   round(float(snare_corr), 3),
        'hat_corr':     round(float(hat_corr), 3),
        'groove_lock':  round(float(groove), 3),
        'tau_star_s':   round(float(kick_tau), 3),
    }


# ── Main TRIVIUM Scorer ────────────────────────────────────────────────────────

def score_scenario_headspin_loop_01(
    joints_3d: np.ndarray,
    beat_times: np.ndarray,
    audio_bands: dict,
    fps: int = 30,
    require_josh_v4: bool = False  # if True, reject GVHMR reconstructions
) -> dict:
    """
    TRIVIUM v0.2 scoring for headspin-loop-01.
    Integrates: Physics (RTA + L_z) | Musicality (event-based) | Phase (blur-safe weights) | Contact (move ID).

    joints_3d: [T, 24, 3] — SMPL world-grounded coordinates (meters, z-up)
    beat_times: [N] — audio beat onsets (seconds)
    audio_bands: {"kick": [T], "snare": [T], "hat": [T]} — normalized band energy envelopes
    """
    T = joints_3d.shape[0]
    dt = 1.0 / fps
    vel = np.gradient(joints_3d, dt, axis=0)

    # ── Phase Detection (Phase Agent) ──────────────────────────────────────────
    phase_result = classify_headspin_phases(joints_3d, fps)
    labels  = phase_result['labels']
    weights = get_phase_weights(labels)  # [T, 24]

    # Reconstruction gate (Phase + Physics agents)
    if require_josh_v4 and phase_result['reconstruction_suspect']:
        return {
            'total': None, 'error': 'reconstruction_suspect',
            'inversion_frac': phase_result['inversion_frac'],
            'message': 'GVHMR inversion prior collapse detected. Rerun with JOSH v4.'
        }

    # ── Contact Detection (Contact Agent) ────────────────────────────────────
    contact = detect_headspin_contact(joints_3d, fps)
    move_id = contact['move_id']  # "HEADSPIN" or "assisted_or_invalid"

    # Confidence gate: if not recognized as headspin, scores are degraded
    move_conf = 1.0 if move_id == "HEADSPIN" else 0.50

    # ── Physics Analysis (Physics Agent) ─────────────────────────────────────
    physics = score_headspin(joints_3d, fps)

    # TRIVIUM Technique = power_quality + iceskater bonus
    # Ice-skater bonus is the primary competitive differentiator (Physics Agent)
    technique_raw = physics['power_quality'] + 0.10 * physics['iceskater_bonus']
    technique = float(np.clip(technique_raw, 0.0, 1.0)) * move_conf

    # Vocabulary: Shannon entropy of phase labels + sub-state richness
    from collections import Counter
    label_counts = Counter(labels)
    n_total = len(labels)
    vocab_entropy = float(-sum(
        (c/n_total) * np.log2(c/n_total + 1e-9)
        for c in label_counts.values()
    )) / np.log2(max(len(label_counts), 2))
    vocabulary = float(np.clip(vocab_entropy, 0.0, 1.0))

    # Cleanliness: SPARC on blur-confidence-weighted CoM velocity
    conf = blur_confidence(joints_3d, fps)
    mass_arr = np.array([MASSES[j] for j in range(24)])
    total_mass = mass_arr.sum()
    # Confidence-weighted CoM: down-weight blurred distal joints
    conf_mass = (mass_arr[np.newaxis, :] * conf)  # [T, 24]
    conf_mass_norm = conf_mass / conf_mass.sum(axis=1, keepdims=True)
    com_vel = (vel * conf_mass_norm[:, :, np.newaxis]).sum(axis=1)  # [T, 3]
    com_speed = np.linalg.norm(com_vel, axis=-1)
    cleanliness = float(_sparc(com_speed, fps))

    # Progression: does the headspin sustain or improve over time?
    loop_mask = np.array([l == 'headspin_loop' for l in labels])
    if loop_mask.sum() > 30:
        loop_lz = np.abs(compute_Lz(joints_3d, vel, crown_pos(joints_3d)))[loop_mask]
        # Score: early |L_z| vs late |L_z| ratio (pumping = sustained)
        mid = len(loop_lz) // 2
        ratio = loop_lz[mid:].mean() / (loop_lz[:mid].mean() + 1e-6)
        progression = float(np.clip(ratio * 0.8 + 0.2, 0.0, 1.0))
    else:
        progression = 0.40  # short/missing loop → mid score

    BODY = (BODY_W['technique']   * technique +
            BODY_W['vocabulary']  * vocabulary +
            BODY_W['progression'] * progression +
            BODY_W['cleanliness'] * cleanliness)

    # ── Musicality Analysis (Musicality Agent) ───────────────────────────────
    mu_result = score_headspin_musicality(joints_3d, beat_times, audio_bands, fps)
    musicality = mu_result['musicality']  # already has 20% phase weight applied

    phrasing   = 0.50  # STUB: requires audio phrase segmentation (8-bar / 16-bar boundaries)
    creativity = 0.50  # STUB: requires movement prediction model baseline

    SOUL = (SOUL_W['musicality'] * musicality +
            SOUL_W['phrasing']   * phrasing +
            SOUL_W['creativity'] * creativity)

    # ── MIND (25%) ───────────────────────────────────────────────────────────
    flow = float(_sparc(com_speed, fps))

    # Energy management: does KE decay match theoretical friction curve?
    # Good: smooth exponential → energy score 0.7–0.8
    ke = 0.5 * np.array([
        sum(MASSES[j] * np.dot(vel[t, j], vel[t, j]) for j in range(24))
        for t in range(T)
    ])
    if ke.max() > 1e-6:
        ke_norm = ke / ke.max()
        t_arr = np.arange(T) / fps
        # Fit exponential decay: ke ≈ A·exp(-b·t)
        log_ke = np.log(ke_norm + 1e-9)
        poly_ke = np.polyfit(t_arr, log_ke, 1)
        ke_residuals = log_ke - np.polyval(poly_ke, t_arr)
        energy_cv = np.std(ke_residuals) / (np.abs(log_ke).mean() + 1e-6)
        energy = float(1.0 - np.clip(energy_cv * 2.0, 0.0, 1.0))
    else:
        energy = 0.50

    response  = 0.50  # STUB: requires opponent/judge reaction data
    # Stage use: low for fixed-pivot headspin — this is correct, not a penalty
    com_xy = (joints_3d * mass_arr[np.newaxis, :, np.newaxis]).sum(axis=1)[:, :2] / total_mass
    com_spread = float(np.std(com_xy))
    stage_use = float(np.clip(com_spread / 1.5, 0.0, 1.0))  # 0.30–0.50 expected

    MIND = (MIND_W['flow']      * flow +
            MIND_W['energy']    * energy +
            MIND_W['response']  * response +
            MIND_W['stage_use'] * stage_use)

    total = (TRIVIUM_BODY * BODY + TRIVIUM_SOUL * SOUL + TRIVIUM_MIND * MIND) * 100

    return {
        # ── Totals ──
        'total':         round(float(total), 1),
        'body':          round(float(BODY), 3),
        'soul':          round(float(SOUL), 3),
        'mind':          round(float(MIND), 3),
        # ── BODY sub-scores ──
        'technique':     round(float(technique), 3),
        'vocabulary':    round(float(vocabulary), 3),
        'progression':   round(float(progression), 3),
        'cleanliness':   round(float(cleanliness), 3),
        # ── SOUL sub-scores ──
        'musicality':    round(float(musicality), 3),
        'phrasing':      phrasing,      # STUB
        'creativity':    creativity,    # STUB
        # ── MIND sub-scores ──
        'flow':          round(float(flow), 3),
        'energy':        round(float(energy), 3),
        'response':      response,      # STUB
        'stage_use':     round(float(stage_use), 3),
        # ── Diagnostics (from sub-scorers) ──
        'phase_labels':          labels,
        'sub_state':             phase_result['sub_state'],
        'move_id':               move_id,
        'reconstruction_suspect': phase_result['reconstruction_suspect'],
        'inversion_valid':       physics['inversion_valid'],
        'pivot_stability':       physics['pivot_stability'],
        'L_z_mean':              physics['L_z_mean_kgm2s'],
        'omega_z_mean':          physics['omega_z_mean_rads'],
        'iceskater_bonus':       physics['iceskater_bonus'],
        'beat_align':            mu_result['beatalign'],
        'tau_star_s':            mu_result['tau_star_s'],
        'groove_lock':           mu_result['groove_lock'],
        'transitions':           phase_result['transitions'],
    }


# ── Internal helpers ────────────────────────────────────────────────────────────

def _smooth_segments(labels, min_seg=9, phase_min=None):
    """Merge isolated short segments into surrounding phase."""
    phase_min = phase_min or {}
    labels = list(labels)
    changed = True
    while changed:
        changed = False
        i = 0
        while i < len(labels):
            j = i
            while j < len(labels) and labels[j] == labels[i]:
                j += 1
            seg_len = j - i
            min_len = phase_min.get(labels[i], min_seg)
            if seg_len < min_len and 0 < i and j < len(labels):
                prev_phase = labels[i-1]
                next_phase = labels[j]
                fill = prev_phase if prev_phase == next_phase else prev_phase
                for k in range(i, j):
                    labels[k] = fill
                changed = True
                break
            i = j
    return labels


def _find_boundaries(labels):
    return [(i, labels[i-1], labels[i]) for i in range(1, len(labels))
            if labels[i] != labels[i-1]]


def _local_peaks(x, thresh, refractory):
    peaks, last = [], -10**9
    for i in range(1, len(x) - 1):
        if (x[i] > thresh and x[i] >= x[i-1] and x[i] > x[i+1]
                and (i - last) >= refractory):
            peaks.append(i)
            last = i
    return np.array(peaks, dtype=int)


def _lagged_corr(x, y, dt, max_lag_s=0.2):
    max_lag = int(max_lag_s / dt)
    best_r, best_tau = 0.0, 0.0
    for lag in range(-max_lag, max_lag + 1):
        a, b = (x[-lag:], y[:lag or None]) if lag < 0 else \
               (x[:-lag], y[lag:]) if lag > 0 else (x, y)
        if len(a) < 5:
            continue
        r = float(np.corrcoef(a, b)[0, 1])
        if np.isfinite(r) and r > best_r:
            best_r, best_tau = r, lag * dt
    return best_r, best_tau


def _sparc(speed, fps, padlevel=4, fc=10.0, amp_th=0.05):
    """Spectral Arc Length — higher = smoother."""
    N = len(speed)
    nfft = int(pow(2, np.ceil(np.log2(N))) * padlevel)
    freqs = np.arange(nfft) * fps / nfft
    X = np.abs(np.fft.fft(speed - speed.mean(), nfft))
    X_norm = X / X.max()
    idx_fc = int(fc * nfft / fps)
    fc_idx = next((i for i in range(1, idx_fc) if X_norm[i:idx_fc].max() < amp_th), idx_fc)
    arc = -float(np.sum(np.sqrt(
        (1.0 / (freqs[fc_idx] + 1e-9))**2 +
        np.diff(X_norm[:fc_idx+1])**2
    )))
    return float(np.clip(1.0 + arc / 10.0, 0.0, 1.0))
```

---

## POSITIVE

**What TRIVIUM v0.1 already handles well for this scenario:**

- Basic rotation detection fires correctly: pelvis/hip (j0–j2) angular velocity is readable even through distal blur, so the system correctly labels the segment as `power`
- Inversion detection is straightforward: j15.z < j0.z ordering is a robust signal that TRIVIUM v0.1 likely already uses
- Freeze detection (near-zero velocity) correctly fires on clean landing catch — exit quality is partially captured
- BeatAlign with 70ms Gaussian tolerance is already a real improvement over binary hit/miss — the anticipatory -50ms setup doesn't get false-penalized
- Pelvis height threshold (j0.z > 0.70m for toprock) correctly excludes the inverted segment from upright-phase scoring
- Mass-weighted whole-body energy gives a decent proxy for entry/exit beat timing via j0,j1,j2,j3,j6,j9

**What JOSH v4 bboy-tuned unlocks specifically:**

- `prior_loss_weight=15` allows unusual inverted poses to be reconstructed without collapsing to the upright prior — directly fixes the GVHMR inversion failure mode
- BSTRO contact maps give a tight crown-contact patch rather than relying solely on j15 z-threshold — improves `floor_z` estimate and `pivot_drift` calculation
- Bboy training data includes headspin pose classes, so the ankle/foot ghost velocity problem is reduced (not eliminated, but JOSH 4D temporal coherence significantly improves j7,j8 during fast rotation)

---

## GAPS

| Gap | Difficulty | Source Agent | What's Needed |
|---|---|---|---|
| **Head crown offset omitted** | Easy | All 4 | Apply `pivot = j15 + [0,0,-0.06]` before every L_z and pivot_drift calculation. One-line fix; impacts all power quality metrics. |
| **Fixed uniform joint weights** | Medium | Phase | Implement `get_phase_weights(labels)` → [T,24] weight array. HEADSPIN_LOOP: j7,j8=0.3×; j10,j11=0.2×; j0,j1,j2=2.0×. |
| **No minimum freeze duration guard** | Easy | Phase | Add `FREEZE_MIN_FRAMES=15` to `_smooth_segments`. Prevents 2-frame pump-valley dips from triggering false `freeze` phase. |
| **Ice-skater sub-state invisible** | Medium | Physics/Phase | Track `ankle_radius` derivative. TUCK (r↓, ω↑) = positive quality signal, NOT noise. Currently likely penalized as ω instability. |
| **L_z decay model absent** | Medium | Physics | Fit linear trend to |L_z|; score residual CV. Without this, technique failure and clean friction decay look identical. |
| **Spin-frequency rejection missing in groove** | Medium | Musicality | Filter `event_signal` to suppress peaks at ω_z periodicity. Otherwise periodic revolutions inflate `groove_lock` score spuriously. |
| **GVHMR reconstruction confidence gate** | Medium | Phase/Physics | Implement `inversion_frac < 0.70 → reconstruction_suspect=True`. Without this, inverted-pose GVHMR failures produce confident but wrong scores silently. |
| **Per-band joint mapping for musicality** | Medium | Musicality | Separate kick/snare/hat envelopes using blur-confidence-weighted joint groups. Currently all joints treated equally → kick assigned to feet, not pelvis. |
| **Anticipation scoring absent** | Easy | Musicality | Apply `anticipation_bonus = 1 + 0.25·tanh(-kick_tau/0.050)`. A -50ms setup scores well; binary hit/miss marks it wrong. |
| **Momentum continuity at exit inverted** | Easy | Phase | Exit dissipation is correct behavior — do NOT apply `momentum_continuity` penalty at `→EXIT_DISMOUNT`. Currently likely penalized same as entry. |
| **Phrasing score** | Hard | Musicality (STUB) | Requires audio phrase segmentation model (8-bar/16-bar detector). Unstubs SOUL by 25%. |
| **Creativity score** | Hard | Musicality (STUB) | Requires movement prediction baseline (expected next move given context). Unstubs SOUL by 30%. |
| **Response score** | Hard | MIND (STUB) | Requires opponent or judge stimulus data synchronized with motion. Unstubs MIND by 30%. |
