### PHASE SIGNATURE: windmill-chain-01

**Primary Phase**: power
**Phase Sequence**: `ENTRY_SETUP` → `POWER_DROP` → `[BARREL_PHASE_RIGHT → BACK_ROLL_TRANSITION → BARREL_PHASE_LEFT → INVERSION_PEAK → HIP_KICK_RECOVERY] × N` → `EXIT_CONTROLLED | EXIT_CRASH`

---

## State Machine

```
STATE: ENTRY_SETUP
  Phase classification: toprock OR footwork (clip-start detection required)
  
  Entry: clip start with j0.z > 0.70m (toprock) OR j22/j23.z < 0.15m (footwork)
  Active properties:
    - pelvis_height: j0.z → expected > 0.70m (toprock) or 0.20–0.50m (footwork)
    - foot_stance: |j10.x - j11.x| → expected > 0.20m (weight distribution pre-drop)
    - arm_coil: ||vel(j22)||, ||vel(j23)|| → expected < 1.5 m/s (pre-sweep)
    - L_barrel: near 0 kg·m²·rad/s (no rotation yet)
  Exit: j0.z drops Δz/Δt > 0.6 m/s downward AND arm sweep at j22/j23 > 2.0 m/s
  Duration: 6–24 frames (variable; may be entirely absent)
  
  NOTE: If from frame 0, j0.z < 0.50m AND |L_barrel| > 5 kg·m²·rad/s → skip to
        BARREL_PHASE_RIGHT or _LEFT directly. NOT a quality penalty.

→ TRANSITION to POWER_DROP
  Transition quality signal:
    - Jerk at pelvis (j0) during drop: EXPECTED HIGH (this is an intentional impulse, not an error)
    - Jerk at j22/j23 (arm sweep initiation): EXPECTED MODERATE
    - Momentum continuity: L_barrel 0 → initial value; discontinuity here is normal and expected
    - Quality is in the TIMING of the drop (see Musicality agent tau*), not jerk magnitude

---

STATE: POWER_DROP
  Phase classification: transition (entry impulse)
  
  Entry: j0.z descending at > 0.6 m/s AND (j16.z < 0.30m OR j17.z < 0.30m) imminently
  Active properties:
    - pelvis_descent_rate: Δj0.z/Δt → expected 0.6–1.5 m/s downward
    - arm_sweep_peak: ||vel(j22)||, ||vel(j23)|| → expected 2.0–4.5 m/s (maximum at contact)
    - first_contact_joint: j16.z or j17.z → approaching floor_z + 0.12m threshold
    - hip_angular_impulse: d/dt(L_barrel) → initial impulse spike 20–60 N·m
  Exit: (j16.z < 0.12m OR j17.z < 0.12m) AND L_barrel > 8 kg·m²·rad/s
  Duration: 3–8 frames (~0.10–0.27s)

→ TRANSITION to BARREL_PHASE_RIGHT (if j17 contacts first) or BARREL_PHASE_LEFT (if j16)
  Transition quality signal:
    - Jerk magnitude at j17/j16 at floor contact: HIGH expected (impact); use as contact event marker
    - Momentum continuity: L_barrel rising steeply; NOT a continuity penalty
    - Quality signal here: smoothness of arm-to-shoulder handoff (vel(j22/j23) → vel(j10/j11))

---

STATE: BARREL_PHASE_RIGHT
  Phase classification: power
  
  Entry: j17.z < 0.12m AND j10.z, j11.z rising > 0.15m (feet clearing floor)
  Active properties:
    - contact_primary: j17 (right_shoulder) z → expected [0.05, 0.12] m sustained
    - contact_secondary: j14 (right_collar) z → expected < 0.15m (near-floor)
    - leg_sweep_velocity: ||vel(j10)||, ||vel(j11)|| → expected 2.5–5.0 m/s
    - L_barrel: [15, 40] kg·m²·rad/s, should be stable (< 15% variation during phase)
    - pelvis_trajectory: j0.z rising from ~0.25m → ~0.55m through half-revolution
    - foot_path_symmetry: ||j10 - j17|| vs ||j11 - j17|| → should be roughly equal
  Exit: j17.z > 0.12m (right shoulder lifting) AND j14.z < 0.10m (back rolling in)
  Duration: 8–18 frames (~0.27–0.60s)

→ TRANSITION to BACK_ROLL_TRANSITION
  Transition quality signal:
    - Axial velocity at j0 during shoulder lift: expected < 0.30 m/s (no floor drift)
    - L_barrel continuity: < 10% dip at shoulder-to-back handoff = clean
    - Jerk at j17 (lift-off): moderate; smooth lift = good pivot mechanics

---

STATE: BACK_ROLL_TRANSITION
  Phase classification: power (sub-phase — pivot migration)
  
  Entry: j14.z < 0.10m AND j13.z < 0.12m (bilateral collar/upper-back contact)
  Active properties:
    - collar_bilateral_z: (j14.z + j13.z) / 2 → expected < 0.12m
    - collar_symmetry: |j14.z - j13.z| → expected < 0.05m; > 0.08m = lateral tilt (quality flag)
    - pelvis_z: j0.z → expected [0.45, 0.70m] (approaching inversion)
    - head_clearance: j15.z → MUST be > 0.10m; if < 0.10m, flag as headmill variant
    - L_barrel_dip: watch for transient 5–15% drop during bilateral contact (normal friction)
  Exit: j16.z < 0.12m (left shoulder initiating contact) AND j17.z > 0.12m
  Duration: 3–8 frames (~0.10–0.27s)

→ TRANSITION to BARREL_PHASE_LEFT
  Transition quality signal:
    - Jerk at j16 (left shoulder contact onset): compare magnitude to j17 contact at POWER_DROP
      LR_jerk_ratio = jerk(j16_contact) / jerk(j17_contact); target: 0.85–1.15 (symmetric impact)
    - L_barrel at entry of BARREL_PHASE_LEFT vs BARREL_PHASE_RIGHT: target < 15% difference
    - collar_symmetry score from this phase feeds directly into left-right quality assessment

---

STATE: BARREL_PHASE_LEFT
  Phase classification: power
  
  Entry: j16.z < 0.12m AND j10.z, j11.z still elevated > 0.15m
  Active properties: (mirror of BARREL_PHASE_RIGHT — swap j16↔j17, j13↔j14)
    - contact_primary: j16 (left_shoulder) z → expected [0.05, 0.12] m sustained
    - contact_secondary: j13 (left_collar) z → expected < 0.15m
    - leg_sweep_velocity: ||vel(j10)||, ||vel(j11)|| → expected same range as BARREL_PHASE_RIGHT
    - L_barrel: should match BARREL_PHASE_RIGHT within 15%; > 30% difference = significant asymmetry
    - phase_duration: should match BARREL_PHASE_RIGHT ± 3 frames; longer = asymmetric dwelling
    
    LEFT-RIGHT PHASE CONSISTENCY CHECK:
      dur_R = duration(BARREL_PHASE_RIGHT) in frames
      dur_L = duration(BARREL_PHASE_LEFT) in frames
      dur_asymmetry = |dur_R - dur_L| / max(dur_R, dur_L)
      target: dur_asymmetry < 0.15; > 0.25 = technique gap (favoring one shoulder)
      
  Exit: j16.z > 0.12m AND (j3.z < 0.15m OR j6.z < 0.15m) (lower-back transitioning toward floor)
  Duration: 8–18 frames (MUST match BARREL_PHASE_RIGHT duration within ±3 frames for high score)

→ TRANSITION to INVERSION_PEAK
  Transition quality signal:
    - Radial velocity at j0 during left-shoulder lift: expected moderate spike (0.5–1.5 m/s)
    - L_barrel should be near maximum here (approaching peak CoM height)
    - Jerk at j16 lift-off: mirror metric of j17 lift-off; compare for symmetry

---

STATE: INVERSION_PEAK
  Phase classification: power (inversion sub-phase)
  
  Entry: j0.z > j15.z (pelvis overtakes head in z — confirmed inversion)
  Active properties:
    - inversion_depth: j0.z - j15.z → expected [0.30, 0.80] m for full windmill
    - pelvis_peak_z: j0.z → expected [0.60, 0.90] m
    - head_clearance: j15.z → must stay > 0.15m (headmill threshold at < 0.10m)
    - leg_extension: ||j10 - j0|| + ||j11 - j0|| → expected > 1.20m (legs fully extended)
    - L_barrel_at_peak: 10–20% below BARREL_PHASE values (normal — PE conversion)
    - pelvis_symmetry: compare peak_z achieved in right-leading vs left-leading revolutions
      per_rev_peak = [max(j0.z) for each revolution]
      peak_cv = std(per_rev_peak) / mean(per_rev_peak)
      target: peak_cv < 0.10; > 0.20 = inconsistent inversion depth (quality flag)
  Exit: j0.z - j15.z < 0.10m (inversion resolving) AND j0.z decreasing
  Duration: 4–10 frames (~0.13–0.33s)

→ TRANSITION to HIP_KICK_RECOVERY
  Transition quality signal:
    - Radial velocity at j0 (CoM falling): expected moderate (0.3–0.8 m/s) — controlled descent
    - L_barrel recovery rate: should begin rising immediately after peak; flat or declining = dying chain
    - Momentum continuity: partial disruption expected and normal here

---

STATE: HIP_KICK_RECOVERY
  Phase classification: power (energy re-injection)
  
  Entry: j0.z decreasing post-inversion AND spine contacts (j3.z or j6.z < 0.15m)
  Active properties:
    - hip_kick_impulse: d/dt(L_barrel) → expected positive 5–20 N·m
    - spine_contact_z: j3.z or j6.z → expected [0.05, 0.15m]
    - L_barrel_before_kick vs after_kick: < 10% net decay per revolution = strong technique
    - leg_whip_onset: ||vel(j10)||, ||vel(j11)|| → should peak here as new sweep initiates
    - kick_symmetry: compare hip_kick_impulse magnitude between revolution N and N+1
      impulse_cv = std([kick_impulse_per_rev]) / mean([kick_impulse_per_rev])
      target: impulse_cv < 0.20; > 0.35 = fading chain or inconsistent drive
  Exit: j17.z < 0.12m (right shoulder re-contacting, next revolution)
         OR L_barrel < 5 kg·m²·rad/s (chain dying)
  Duration: 5–10 frames (~0.17–0.33s)

  CHAIN LOOP: → BARREL_PHASE_RIGHT (next revolution)
  EXIT (controlled): leg whip stops intentionally, body rises, j0.z increasing → EXIT_CONTROLLED
  EXIT (crash): L_barrel < 5 kg·m²·rad/s abruptly → EXIT_UNCONTROLLED

---

STATE: EXIT_CONTROLLED
  Phase classification: transition
  
  Entry: intentional leg-whip stop AND j0.z rising toward > 0.60m
  Active properties:
    - L_barrel_decay: should be smooth exponential (controlled) not step-function (crash)
    - pelvis_rise_rate: j0.z Δ/Δt > 0.3 m/s upward
    - foot_return_z: j10.z, j11.z → should reach floor_z within 3 frames
    - exit_quality: 1.0 - clamp01(jerk_at_j0 / JERK_REF_EXIT)
  Duration: 0.3–0.8s

STATE: EXIT_CRASH
  Phase classification: transition (uncontrolled)
  
  Entry: L_barrel drops > 40% in < 5 frames (abrupt stall)
  Active properties: same joints; jerk will be HIGH (quality penalty)
  Duration: variable; often ends in unplanned freeze or stumble
```

---

## Joint Weight Table

| Phase in This Scenario | Joint Group | Joints | Weight | Rationale |
|------------------------|-------------|--------|--------|-----------|
| ENTRY_SETUP (toprock) | Feet/ankles | j7,j8,j10,j11 | 1.5x | Footwork foundation — stepping is the move |
| ENTRY_SETUP (toprock) | Hips/pelvis | j0,j1,j2 | 1.2x | Engine — drives toprock rhythm |
| ENTRY_SETUP (toprock) | Arms | j16–j21 | 1.0x | Expression/styling |
| POWER_DROP | Hips/pelvis | j0,j1,j2 | 2.5x | Angular impulse source — critical timing event |
| POWER_DROP | Arms/hands | j22,j23 | 2.0x | Sweep is the entry gesture; judges read this |
| BARREL_PHASE_RIGHT | Hips/core | j0,j1,j2,j3,j6 | 2.0x | Engine + transmission for barrel roll |
| BARREL_PHASE_RIGHT | Right shoulder/collar | j17,j14 | 2.0x | Active contact point — pivot correctness |
| BARREL_PHASE_RIGHT | Feet | j10,j11 | 1.5x | Leg whip velocity — power signal |
| BARREL_PHASE_RIGHT | Left shoulder | j16 | 0.5x | Off-floor; informational only |
| BARREL_PHASE_RIGHT | Hands | j22,j23 | 0.4x | Not weight-bearing in windmill |
| BACK_ROLL_TRANSITION | Upper back/collar | j13,j14 | 2.5x | Bilateral pivot contact — asymmetry detected here |
| BACK_ROLL_TRANSITION | Core/spine | j3,j6,j9 | 1.8x | Transmission through back contact |
| BACK_ROLL_TRANSITION | Head | j15 | 2.0x | Clearance check — headmill detection |
| BARREL_PHASE_LEFT | Hips/core | j0,j1,j2,j3,j6 | 2.0x | Mirror of BARREL_PHASE_RIGHT |
| BARREL_PHASE_LEFT | Left shoulder/collar | j16,j13 | 2.0x | Active contact — mirror pivot |
| BARREL_PHASE_LEFT | Feet | j10,j11 | 1.5x | Leg whip — compare CV to RIGHT phase |
| INVERSION_PEAK | Pelvis | j0 | 2.5x | Inversion depth measurement anchor |
| INVERSION_PEAK | Head | j15 | 2.0x | j0.z > j15.z is the inversion gate |
| INVERSION_PEAK | Legs | j4,j5,j7,j8,j10,j11 | 1.5x | Extension = moment of inertia = quality |
| HIP_KICK_RECOVERY | Hips | j1,j2 | 2.5x | Re-injection source — chain maintenance |
| HIP_KICK_RECOVERY | Spine contact | j3,j6 | 1.8x | Pivot/support during kick |
| HIP_KICK_RECOVERY | Feet | j10,j11 | 1.5x | Whip onset — should peak here |
| EXIT_CONTROLLED | Pelvis | j0 | 1.5x | Rise rate = controlled vs crash indicator |
| EXIT_CONTROLLED | Feet | j10,j11 | 1.5x | Return-to-floor timing |

---

## Transition Quality Expectations

**Number of transitions**: N_revolutions × 4 (per-revolution: BARREL_R → BACK → BARREL_L → KICK) + 2 (entry, exit). A 3-revolution windmill has ~14 internal transition events.

| Transition | Expected Jerk | Momentum Continuity | Quality Signal |
|-----------|--------------|--------------------|-|
| ENTRY_SETUP → POWER_DROP | HIGH | N/A (L=0 → L>0) | Timing relative to beat; jerk is not a penalty here |
| POWER_DROP → first BARREL_PHASE | HIGH at shoulder contact (impact) | Rising | LR_jerk_ratio vs other shoulder contact |
| BARREL_PHASE → BACK_ROLL_TRANSITION | MODERATE | < 10% L dip = clean | collar_symmetry |j14.z - j13.z| < 0.05m |
| BACK_ROLL_TRANSITION → BARREL_PHASE | MODERATE | < 10% L dip = clean | Jerk at j16 contact mirrors j17 entry jerk |
| BARREL_PHASE → INVERSION_PEAK | LOW | 10–20% L dip normal | Smooth radial velocity at j0 |
| INVERSION_PEAK → HIP_KICK_RECOVERY | MODERATE | L recovering = good | d/dt(L_barrel) positive immediately |
| HIP_KICK_RECOVERY → BARREL_PHASE (loop) | MODERATE | < 10% net decay = good | Chain sustainability |
| Any phase → EXIT_CRASH | VERY HIGH | Abrupt L drop | Binary quality failure |
| BARREL_PHASE → EXIT_CONTROLLED | LOW | Smooth exponential decay | Decay curve shape (exponential=good, step=crash) |

---

## Left-Right Consistency: Phase-Level Metrics

The `notes` explicitly call this out. The phase agent contributes three distinct measurements:

**Metric 1 — Phase Duration Parity**
```python
dur_R = [len(frames) for frames in BARREL_PHASE_RIGHT_segments]
dur_L = [len(frames) for frames in BARREL_PHASE_LEFT_segments]
# Per-revolution: pair each R with subsequent L
for r, l in zip(dur_R, dur_L):
    parity = abs(r - l) / max(r, l)
    # target < 0.15; > 0.25 = dwelling on one shoulder
```

**Metric 2 — Transition Jerk Symmetry**
```python
# Compare impact jerk at j17 (right shoulder contact) vs j16 (left shoulder contact)
jerk_R = [jerk_at_contact(frame, j17) for each right-shoulder contact event]
jerk_L = [jerk_at_contact(frame, j16) for each left-shoulder contact event]
LR_jerk_ratio = mean(jerk_L) / mean(jerk_R)
# target: 0.85–1.15; outside = unequal landing force = asymmetric entry mechanics
```

**Metric 3 — Inversion Peak Symmetry**
```python
# Compare peak j0.z for revolutions where right shoulder led vs left shoulder led
peaks_after_R = [max(j0.z[rev]) for rev in right_led_revolutions]
peaks_after_L = [max(j0.z[rev]) for rev in left_led_revolutions]
peak_symmetry = abs(mean(peaks_after_R) - mean(peaks_after_L)) / mean(peaks_after_R + peaks_after_L)
# target < 0.10; > 0.20 = asymmetric inversion depth driven by shoulder preference
```

---

## Edge Cases

**Headmill vs windmill disambiguation**: If at any BACK_ROLL_TRANSITION, `j15.z < 0.10m` — the head is contacting the floor. This is a different move (headmill). The phase machine should flag this and optionally bifurcate to a headmill sub-type. Do NOT score as a failed windmill; score as a different move.

**Clip starts mid-revolution**: If frame 0 has `j0.z < 0.50m AND |L_barrel| > 5 kg·m²·rad/s`, detect which shoulder is contacting (j16/j17 z-threshold) and enter the appropriate BARREL_PHASE directly. Duration and entry quality metrics for that first half-revolution are scored with lower confidence weight.

**One-shoulder windmill (broken chain)**: If BARREL_PHASE_LEFT never triggers (j16.z never drops below 0.12m across the entire clip), the dancer is executing a "coin drop" or degenerate windmill. Phase machine should detect this and not report LR symmetry scores at all — report `windmill_type: one_shoulder` instead.

**Dying chain detection**: Track L_barrel mean per revolution. If slope across revolutions < −0.20 × initial_L per revolution, flag `chain_decay = True`. If the dancer adds revolutions DESPITE L decay (rising ω as I decreases via leg tuck), flag `technique: I_reduction_compensated` (advanced skill).

**Traveling windmill**: Some windmills drift laterally with intent. `floor_drift > 0.60m` is informational; do NOT automatically penalize. If drift correlates with intentional spatial phrasing (dancer moves toward downstage), the phase agent should flag `drift_intentional: uncertain` and defer to synthesis.

---

## Phase Detection Pseudo-Code

```python
def classify_windmill_phases(joints_3d, fps=30, floor_z=0.0):
    """
    Phase classification for windmill-chain-01.
    Returns per-frame phase labels and transition event list.
    """
    T = joints_3d.shape[0]
    vel = smooth_velocity(joints_3d, fps)
    speed = np.linalg.norm(vel, axis=-1)  # [T, 24]

    # Height signals
    pelvis_z = joints_3d[:, 0, 2]
    head_z   = joints_3d[:, 15, 2]
    j16_z    = joints_3d[:, 16, 2]  # left_shoulder
    j17_z    = joints_3d[:, 17, 2]  # right_shoulder
    j14_z    = joints_3d[:, 14, 2]  # right_collar (upper back right)
    j13_z    = joints_3d[:, 13, 2]  # left_collar  (upper back left)
    j10_z    = joints_3d[:, 10, 2]  # left_foot
    j11_z    = joints_3d[:, 11, 2]  # right_foot
    j3_z     = joints_3d[:,  3, 2]  # spine1
    j6_z     = joints_3d[:,  6, 2]  # spine2

    SHOULDER_THRESH = floor_z + 0.12
    BACK_THRESH     = floor_z + 0.10
    FOOT_FLOOR      = floor_z + 0.05
    SPINE_CONTACT   = floor_z + 0.15
    HEAD_FLOOR      = floor_z + 0.10   # headmill alarm threshold

    # Contact boolean arrays
    right_shoulder_contact = j17_z < SHOULDER_THRESH
    left_shoulder_contact  = j16_z < SHOULDER_THRESH
    back_contact = ((j14_z + j13_z) / 2) < BACK_THRESH
    feet_on_floor = (j10_z < FOOT_FLOOR) & (j11_z < FOOT_FLOOR)
    inversion = pelvis_z > head_z
    headmill_alarm = head_z < HEAD_FLOOR

    # L_barrel from physics module (barrel-roll axis, not L_z)
    L_barrel = compute_barrel_L(joints_3d, vel)

    # Infer phase per frame (priority order)
    labels = np.full(T, 'unknown', dtype=object)

    for t in range(T):
        if feet_on_floor[t] and pelvis_z[t] > 0.70 and L_barrel[t] < 3.0:
            labels[t] = 'ENTRY_SETUP_TOPROCK'
        elif feet_on_floor[t] and pelvis_z[t] < 0.50 and speed[t, 22] > 1.0:
            labels[t] = 'ENTRY_SETUP_FOOTWORK'
        elif right_shoulder_contact[t] and not back_contact[t] and not left_shoulder_contact[t]:
            labels[t] = 'BARREL_PHASE_RIGHT'
        elif left_shoulder_contact[t] and not back_contact[t] and not right_shoulder_contact[t]:
            labels[t] = 'BARREL_PHASE_LEFT'
        elif back_contact[t]:
            labels[t] = 'BACK_ROLL_TRANSITION'
        elif inversion[t]:
            labels[t] = 'INVERSION_PEAK'
        elif j3_z[t] < SPINE_CONTACT or j6_z[t] < SPINE_CONTACT:
            labels[t] = 'HIP_KICK_RECOVERY'
        elif L_barrel[t] > 5.0:
            labels[t] = 'BARREL_UNKNOWN'  # in-flight, no contact yet resolved
        elif pelvis_z[t] > 0.60 and L_barrel[t] < 3.0:
            labels[t] = 'EXIT_CONTROLLED'
        else:
            labels[t] = 'POWER_DROP'

    labels = smooth_labels(labels, min_segment=3)  # 3-frame minimum to avoid flicker

    # Headmill variant check
    headmill_frames = headmill_alarm & (
        np.isin(labels, ['BACK_ROLL_TRANSITION', 'INVERSION_PEAK'])
    )
    if np.sum(headmill_frames) > 2:
        # Flag potential headmill; do not reclassify without synthesis agent confirmation
        variant_flag = 'headmill_suspected'
    else:
        variant_flag = 'windmill'

    # Extract transitions as event list
    transitions = []
    for t in range(1, T):
        if labels[t] != labels[t-1]:
            transitions.append({
                'frame': t,
                'from': labels[t-1],
                'to': labels[t],
                'jerk': compute_jerk_magnitude(joints_3d, t, window=3),
                'L_continuity': abs(L_barrel[t] - L_barrel[t-1]) / (L_barrel[t-1] + 1e-6)
            })

    # Left-right duration parity
    R_segs = segment_phase(labels, 'BARREL_PHASE_RIGHT')
    L_segs = segment_phase(labels, 'BARREL_PHASE_LEFT')
    dur_parity_scores = []
    for r_seg, l_seg in zip(R_segs, L_segs):
        dur_r = r_seg[1] - r_seg[0]
        dur_l = l_seg[1] - l_seg[0]
        parity = 1.0 - abs(dur_r - dur_l) / max(dur_r, dur_l)
        dur_parity_scores.append(parity)
    lr_duration_parity = float(np.mean(dur_parity_scores)) if dur_parity_scores else 0.5

    return {
        'labels': labels,
        'transitions': transitions,
        'variant': variant_flag,
        'n_revolutions': len(R_segs),
        'lr_duration_parity': round(lr_duration_parity, 3),
    }


def apply_phase_weights(phase_label, joint_contributions):
    """
    Scale joint contributions by phase-appropriate weights.
    Used by synthesis agent when assembling composite score.
    """
    WEIGHTS = {
        'ENTRY_SETUP_TOPROCK': {
            'feet':      ([ 7, 8,10,11], 1.5),
            'hips':      ([ 0, 1, 2],    1.2),
            'arms':      ([16,17,18,19,20,21], 1.0),
        },
        'POWER_DROP': {
            'hips':      ([ 0, 1, 2],    2.5),
            'hands':     ([22,23],        2.0),
            'core':      ([ 3, 6, 9],    1.5),
        },
        'BARREL_PHASE_RIGHT': {
            'hips_core': ([ 0, 1, 2, 3, 6], 2.0),
            'r_shoulder':([17,14],           2.0),
            'feet':      ([10,11],           1.5),
            'head':      ([12,15],           0.8),
            'hands':     ([22,23],           0.4),
        },
        'BACK_ROLL_TRANSITION': {
            'collar':    ([13,14],           2.5),
            'head':      ([15],              2.0),   # clearance monitor
            'core':      ([ 3, 6, 9],        1.8),
        },
        'BARREL_PHASE_LEFT': {
            'hips_core': ([ 0, 1, 2, 3, 6], 2.0),
            'l_shoulder':([16,13],           2.0),
            'feet':      ([10,11],           1.5),
            'head':      ([12,15],           0.8),
            'hands':     ([22,23],           0.4),
        },
        'INVERSION_PEAK': {
            'pelvis':    ([ 0],              2.5),
            'head':      ([15],              2.0),
            'legs':      ([ 4, 5, 7, 8,10,11], 1.5),
            'core':      ([ 3, 6, 9],        1.2),
        },
        'HIP_KICK_RECOVERY': {
            'hips':      ([ 1, 2],           2.5),
            'spine':     ([ 3, 6],           1.8),
            'feet':      ([10,11],           1.5),
        },
        'EXIT_CONTROLLED': {
            'pelvis':    ([ 0],              1.5),
            'feet':      ([10,11],           1.5),
            'hips':      ([ 1, 2],           1.2),
        },
    }
    multipliers = np.ones(24)
    if phase_label in WEIGHTS:
        for _, (joints, w) in WEIGHTS[phase_label].items():
            for j in joints:
                multipliers[j] = w
    return joint_contributions * multipliers
```

---

**Positive**: The core pelvis-height gate (`j0.z > 0.70m` → toprock, `< 0.50m` → power) correctly catches the ENTRY_SETUP→POWER_DROP transition in v0.1 as long as the calibration threshold is valid. The inversion gate (`j0.z > j15.z`) maps directly to INVERSION_PEAK detection. The velocity smoothing approach in v0.1 handles the high-jerk contact events at FIRST_SHOULDER_CONTACT without over-penalizing the transition.

**Gap**: v0.1 uses a fixed vertical angular momentum threshold (`|L_z|`) for power move detection — this is near-useless for windmill, where the dominant component is `L_barrel` (horizontal barrel-roll axis). The phase machine will systematically underestimate windmill rotation, potentially mislabeling mid-revolution frames as `footwork` or `transition`. Additionally, v0.1 has no sub-phase discrimination within the POWER classification, so left-right parity, inversion depth, and hip-kick recovery cannot be scored at all. The collar-contact bilateral symmetry check (`|j14.z - j13.z|` during BACK_ROLL_TRANSITION) is entirely absent and is the highest-signal location for detecting lateral tilt failures.
