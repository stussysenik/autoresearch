### PHASE SIGNATURE: headspin-loop-01

**Primary Phase**: `POWER` — sustained inverted axial rotation (headspin)
**Phase Sequence**: `[entry_approach] → [head_plant_transition] → [headspin_loop] → [exit_dismount]`

> Note: The clip may start mid-loop (no visible entry). Phase detection must handle entry-absent clips gracefully.

---

**State Machine**:

```
State: ENTRY_APPROACH  (may be absent from clip)
  Entry condition:    clip start OR toprock/footwork visible, pelvis(j0) z > 0.5m
  Active properties:  pelvis height, foot alternation (j10,11), L_z ≈ 0
  Exit condition:     pelvis z begins rapid descent (Δz/Δt > 0.8 m/s downward),
                      arm sweep detected at j22,23 (speed spike > 2.0 m/s)
  Duration:           variable; if clip starts in steady spin, skip this state entirely

→ Transition to: HEAD_PLANT_TRANSITION
  Transition quality signal: jerk at j15 contact (entry impulse — should be sharp/clean, 
                              not oscillating); arm sweep momentum transferred to L_z

State: HEAD_PLANT_TRANSITION
  Entry condition:    j15 z descending toward floor (<0.12m), |L_z| crossing 1.0 kg·m²·rad/s
  Active properties:  j15 z-velocity, j22+j23 sweep arc, j7+j8 kick impulse,
                      time-to-contact from j15 trajectory
  Exit condition:     j15 z stable (< 0.06m, variance < 0.01m),
                      |L_z| > 3.0 kg·m²·rad/s (angular momentum established),
                      j15 z < j0 z (inversion confirmed)
  Duration:           9–18 frames at 30 fps (0.30–0.60s)

→ Transition to: HEADSPIN_LOOP
  Transition quality signal: smoothness of L_z onset (no step-change, gradual rise);
                              momentum_continuity(L_plant → L_first_rotation) > 0.85 = clean entry

State: HEADSPIN_LOOP  ← PRIMARY PHASE
  Entry condition:    j15 z < 0.06m (floor contact), j15 z < j0 z (inversion),
                      |L_z| > 3.0 kg·m²·rad/s, ω_z > 2.0 rad/s
  Active properties:
    — Angular velocity ω_z (monotonic slow decay = good; step drops = contact failure)
    — Pivot XY drift (j15 xy std < 0.04m = clean)
    — L_z conservation residuals (linear fit slope ≤ 0; non-monotonic = wobble)
    — Axial velocity ratio v_ax/v_tan at j0,j3 (< 0.08 = clean)
    — Ankle radius r(j7,j8 → j15) for ice-skater sub-state detection
    SUB-STATES (do NOT trigger phase change):
      TUCK:   r_ankle shrinking (dr/dt < −0.05 m/s), ω_z increasing → ice-skater effect, score +
      EXTEND: r_ankle growing (dr/dt > +0.05 m/s), ω_z decreasing → momentum storage, neutral
  Exit condition:     |L_z| < 1.5 kg·m²·rad/s OR j15 z begins rising (> 0.10m),
                      OR deliberate arm/leg plant detected (j22/j23 speed spike > 1.5 m/s downward)
  Duration:           30–600+ frames (1–20s); competition quality ≥ 120 frames (4s)

→ Transition to: EXIT_DISMOUNT
  Transition quality signal: deceleration curve of ω_z (smooth exponential = clean exit;
                              abrupt spike = crash); momentum_continuity used inversely —
                              a GOOD exit absorbs L_z cleanly, so HIGH dissipation = intentional

State: EXIT_DISMOUNT
  Entry condition:    see above exit of HEADSPIN_LOOP
  Active properties:  j15 lift-off trajectory, catch joint (j22/j23 or j10/j11),
                      jerk at landing contact
  Exit condition:     new stable phase begins (footwork: hands low + leg pattern;
                      freeze: all speeds < 0.05 m/s; toprock: pelvis > 0.7m)
  Duration:           9–20 frames (0.30–0.67s)
```

---

**Joint Weight Table**:

| Phase in This Scenario | Joint Group | Joints | Weight | Rationale |
|------------------------|-------------|--------|--------|-----------|
| HEAD_PLANT_TRANSITION | Arms/Hands | 18,19,22,23 | 2.0x | Arm sweep is the primary L_z generator; most readable pre-blur |
| HEAD_PLANT_TRANSITION | Ankles/Feet | 7,8,10,11 | 1.6x | Entry kick — before high-speed blur begins |
| HEAD_PLANT_TRANSITION | Head | 15 | 1.8x | Crown placement accuracy defines entire spin axis |
| HEAD_PLANT_TRANSITION | Hips | 0,1,2 | 1.3x | Engine momentum transfer |
| HEADSPIN_LOOP | Hips | 0,1,2 | 2.0x | ENGINE — angular momentum source; low blur risk, proximal |
| HEADSPIN_LOOP | Core | 3,6,9 | 1.5x | Transmission layer; stable during spin |
| HEADSPIN_LOOP | Head | 15 | 1.4x | PIVOT POINT — XY stability is primary quality signal |
| HEADSPIN_LOOP | Knees | 4,5 | 1.0x | Ice-skater radius proxy; moderate blur |
| HEADSPIN_LOOP | Hands | 22,23 | 0.7x | Extended at mid-speed; moderate blur, reduced reliability |
| HEADSPIN_LOOP | Ankles | 7,8 | 0.3x | SEVERE BLUR at > 2 rev/s; down-weight aggressively |
| HEADSPIN_LOOP | Feet | 10,11 | 0.2x | Worst blur zone — nearly unreliable at competitive speed |
| EXIT_DISMOUNT | Hands | 22,23 | 1.8x | Catch joint — defines landing quality |
| EXIT_DISMOUNT | Core | 3,6,9 | 1.4x | Deceleration control |
| EXIT_DISMOUNT | Hips | 0,1,2 | 1.2x | Center of mass repositioning |

---

**Transition Quality Expectations**:

- **Number of transitions**: 2 visible (entry plant + exit dismount); 0–N internal tuck/extend sub-state pulses (NOT phase transitions — treat as within-phase features)
- **Entry plant jerk** (j15 contact): expected HIGH magnitude (~40–120 m/s³), should be a single clean spike. Oscillating or multi-peak jerk = poor head placement technique.
- **Loop-internal jerk** (j0, j3): should be LOW (< 5 m/s³ steady-state). Any spike during the loop = pivot wobble or near-fall event.
- **Exit jerk**: intentionally HIGH if exit is dynamic (kick-out to footwork); lower if the dancer decelerates into a freeze.
- **Momentum continuity at entry**: target > 0.85 — the planted L_z should smoothly extend the arm-sweep impulse.
- **Momentum continuity at exit**: NOT a quality signal — full dissipation is correct for a clean catch-out.

---

**Edge Cases**:

1. **Clip-starts-in-spin**: No entry_approach or head_plant_transition visible. Phase detector must not look for L_z rising onset — it should enter HEADSPIN_LOOP directly if `j15 z < j0 z` and `|L_z| > threshold` from frame 0. Missing entry score = `None`, not penalized.

2. **Blur-induced false velocity spikes at j7,8,10,11**: GVHMR ghosts fast-moving distal joints. At 3+ rev/s, ankles travel at 3–5 m/s at 0.5m extension. These ghost trajectories will produce velocity readings 2–5× true values. **Do NOT use ankle speed to detect tuck/extend sub-states** — use the radius `||j7,j8 xy − j15 xy||` instead, which is more stable than velocity.

3. **GVHMR inversion failure**: If `j15 z > j0 z` for > 30% of HEADSPIN_LOOP frames, the reconstruction is suspect (GVHMR inversion prior collapse). Flag the segment as `reconstruction_confidence: LOW`; switch to JOSH v4 pipeline output. Do not score inversion_valid = True on these frames.

4. **Tuck/extend oscillation misclassified as phase change**: A bboy pumping their legs will show oscillating radius and ω. This pattern looks like repeated entries into new states. The guard is: if `j15 z < 0.06m` AND `|L_z| > 1.5 kg·m²·rad/s`, the phase remains HEADSPIN_LOOP regardless of leg velocity oscillations.

5. **Ice-skater speed burst misread as entry impulse**: A tight tuck can double ω instantaneously. The phase detector will see a sharp L_z increase and may reset its "entry" timestamp. Guard: `L_z increase during established spin (>15 frames in) = ice-skater bonus, not entry reset`.

6. **Near-exit wobble triggering false FREEZE**: As L_z decays below threshold, brief pauses between pumps may cause all_speed to dip below 0.05 m/s for 2–4 frames. Minimum freeze duration = `int(0.5 * fps) = 15 frames` prevents this false positive.

7. **Head z offset**: SMPL j15 is center-of-head mesh, not crown contact. The physical pivot is ~6cm superior (toward floor when inverted). All L_z calculations must apply `pivot_corrected = j15 + [0, 0, -0.06]` (negative z = toward floor in world coordinates). Failure to correct introduces ~0.06m lever arm error per joint, scaling L_z error by `Δr/r_mean`.

---

**Pseudo-Code**:

```python
import numpy as np

INVERSION_THRESHOLD   = 0.06   # j15 z < this = floor contact
PELVIS_UPRIGHT_H      = 0.70   # j0 z > this = toprock
POWER_LZ_THRESHOLD    = 3.0    # kg·m²·rad/s
POWER_LZ_EXIT         = 1.5    # lower bound before exit
FREEZE_SPEED_THRESH   = 0.05   # m/s all joints
FREEZE_MIN_FRAMES     = 15     # at 30fps = 0.5s
HEAD_CROWN_OFFSET     = 0.06   # m — j15 → crown correction (toward floor)
BLUR_SPEED_SCALE      = 2.5    # m/s where confidence = 0.5

# Joints with severe blur risk during high-speed axial rotation
BLUR_RISK_JOINTS = [7, 8, 10, 11, 22, 23]
PROXIMAL_JOINTS  = [0, 1, 2, 3, 6, 9]

# Phase-specific weight tables
PHASE_WEIGHTS = {
    'entry_plant':   {(18,19,22,23): 2.0, (7,8,10,11): 1.6, (15,): 1.8, (0,1,2): 1.3, (3,6,9): 1.0},
    'headspin_loop': {(0,1,2): 2.0, (3,6,9): 1.5, (15,): 1.4, (4,5): 1.0,
                      (22,23): 0.7, (7,8): 0.3, (10,11): 0.2},
    'exit_dismount': {(22,23): 1.8, (3,6,9): 1.4, (0,1,2): 1.2, (4,5): 1.0},
}

MASSES = {
    0:11.17, 1:2.78, 2:2.78, 3:5.0, 4:3.28, 5:3.28,
    6:3.0,   7:0.61, 8:0.61, 9:2.5, 10:0.97, 11:0.97,
    12:1.5,  13:0.5, 14:0.5, 15:5.0, 16:2.0, 17:2.0,
    18:1.14, 19:1.14,20:0.45,21:0.45,22:0.41,23:0.41
}


def pivot_corrected(joints_3d):
    """Shift j15 toward floor by HEAD_CROWN_OFFSET to get actual contact point."""
    pivot = joints_3d[:, 15, :].copy()
    pivot[:, 2] -= HEAD_CROWN_OFFSET   # negative z = toward floor (world up = +z)
    return pivot


def compute_Lz(joints_3d, velocities, pivot):
    """L_z about the corrected pivot point."""
    T = joints_3d.shape[0]
    Lz = np.zeros(T)
    for j, m in MASSES.items():
        r = joints_3d[:, j, :] - pivot        # [T, 3]
        v = velocities[:, j, :]
        Lz += m * (r[:, 0] * v[:, 1] - r[:, 1] * v[:, 0])  # z component of r × v
    return Lz


def blur_confidence(speed_mag):
    """Per-joint confidence based on estimated motion speed. Returns [T, 24]."""
    return 1.0 / (1.0 + speed_mag / BLUR_SPEED_SCALE)


def classify_headspin_phases(joints_3d, fps=30):
    """
    Phase classification for headspin-loop-01.
    Returns per-frame phase labels and sub-state markers.
    """
    T = joints_3d.shape[0]
    dt = 1.0 / fps
    velocities = np.gradient(joints_3d, dt, axis=0)   # [T, 24, 3]
    speed_mag  = np.linalg.norm(velocities, axis=-1)  # [T, 24]
    conf       = blur_confidence(speed_mag)            # [T, 24] ∈ (0, 1]

    pivot = pivot_corrected(joints_3d)  # [T, 3] corrected head contact
    Lz    = compute_Lz(joints_3d, velocities, pivot)  # [T]
    Lz_abs = np.abs(Lz)

    pelvis_z   = joints_3d[:, 0, 2]    # [T]
    head_z     = joints_3d[:, 15, 2]   # [T]
    all_speed  = (speed_mag * conf).mean(axis=1)  # confidence-weighted mean speed

    # Ankle radius from corrected pivot (ice-skater radius) — use position, NOT velocity
    ankle_r = np.linalg.norm(
        joints_3d[:, [7, 8], :2] - pivot[:, :2, None].transpose(0, 2, 1)[:, :2],
        axis=-1
    ).mean(axis=1)   # [T]

    # --- INVERSION VALIDATION ---
    inverted = (head_z < pelvis_z)  # [T] bool
    inversion_frac = inverted.mean()
    reconstruction_suspect = inversion_frac < 0.70
    if reconstruction_suspect:
        # Flag but continue — don't silently zero out scores
        pass

    # --- RAW FRAME LABELS ---
    raw_labels = []
    for t in range(T):
        h_z   = head_z[t]
        p_z   = pelvis_z[t]
        lz    = Lz_abs[t]
        v_all = all_speed[t]

        if v_all < FREEZE_SPEED_THRESH:
            raw_labels.append('freeze_candidate')
        elif h_z < INVERSION_THRESHOLD and lz > POWER_LZ_THRESHOLD and h_z < p_z:
            raw_labels.append('headspin_loop')
        elif p_z > PELVIS_UPRIGHT_H:
            raw_labels.append('toprock')
        elif np.mean(joints_3d[t, [22, 23], 2]) < 0.15:
            raw_labels.append('footwork')
        else:
            raw_labels.append('transition')

    # --- TEMPORAL SMOOTHING ---
    # Minimum segment: 0.3s = 9 frames; freeze minimum = 15 frames
    labels = smooth_segments(raw_labels, min_seg=9, phase_min={'freeze_candidate': FREEZE_MIN_FRAMES})
    # Rename confirmed freezes
    labels = ['freeze' if l == 'freeze_candidate' else l for l in labels]

    # --- ICE-SKATER SUB-STATE (within headspin_loop only) ---
    ankle_r_dt = np.gradient(ankle_r, dt)
    sub_state = np.full(T, 'steady', dtype=object)
    for t in range(T):
        if labels[t] == 'headspin_loop':
            if ankle_r_dt[t] < -0.05:    # radius shrinking → tuck
                sub_state[t] = 'tuck'
            elif ankle_r_dt[t] > 0.05:   # radius growing → extend
                sub_state[t] = 'extend'

    # --- TRANSITION QUALITY ---
    boundaries = find_phase_boundaries(labels)  # returns list of (frame, from_phase, to_phase)
    jerk = np.gradient(np.gradient(speed_mag.mean(axis=1), dt), dt)  # proxy [T]

    transition_scores = []
    for frame, from_phase, to_phase in boundaries:
        window = jerk[max(0, frame-5) : frame+5]
        jerk_score = 1.0 - np.clip(window.mean() / 50.0, 0.0, 1.0)

        # Momentum continuity: meaningful only at entry, not exit
        if to_phase == 'headspin_loop':
            L_before = Lz_abs[max(0, frame-5):frame].mean()
            L_after  = Lz_abs[frame:frame+5].mean()
            mom_cont = 1.0 - abs(L_after - L_before) / (L_before + 1e-6)
        else:
            mom_cont = None  # exit dissipation is intentional, not a quality signal

        transition_scores.append({
            'frame': frame, 'from': from_phase, 'to': to_phase,
            'jerk_score': round(float(jerk_score), 3),
            'momentum_continuity': round(float(mom_cont), 3) if mom_cont else None,
        })

    return {
        'labels':              labels,
        'sub_state':           list(sub_state),
        'reconstruction_suspect': bool(reconstruction_suspect),
        'inversion_frac':      round(float(inversion_frac), 3),
        'transitions':         transition_scores,
        'Lz_abs_mean':         round(float(Lz_abs.mean()), 2),
    }


def get_phase_weights(phase_name: str) -> dict:
    """Return per-joint weight multipliers for the given phase."""
    mapping = PHASE_WEIGHTS.get(phase_name, {})
    weights = np.ones(24)
    for joints, w in mapping.items():
        for j in joints:
            weights[j] = w
    return weights


def smooth_segments(labels, min_seg=9, phase_min=None):
    """
    Merge short isolated segments into surrounding phase.
    phase_min: per-phase minimum frame count override.
    """
    # Implementation: sliding window majority vote + minimum duration enforcement
    # ...
    return labels


def find_phase_boundaries(labels):
    """Return list of (frame_idx, from_phase, to_phase) for each phase change."""
    boundaries = []
    for i in range(1, len(labels)):
        if labels[i] != labels[i-1]:
            boundaries.append((i, labels[i-1], labels[i]))
    return boundaries
```

---

**Positive** — what v0.1 phase detection gets right for headspin-loop-01:
- The basic `|L_z| > threshold → power` rule correctly fires for most of the headspin duration, since pelvis/hip angular momentum is readable even through blur.
- Freeze detection (near-zero velocity) will correctly fire on a clean landing catch.
- Pelvis height threshold correctly excludes toprock from the inverted segment.

**Gap** — what v0.1 misses:

1. **Fixed joint weights throughout**: v0.1 treats all 24 joints equally across all phases. During HEADSPIN_LOOP, this means blurred ankle/foot joints (j7,8,10,11) contribute equally to phase metrics as stable pelvis/core joints — inflating noise in the power quality score.

2. **No sub-state detection**: Tuck/extend cycles within the headspin are invisible to v0.1. It cannot score the ice-skater effect, the primary competitive differentiator between good and great headspins. These appear as oscillating ω, which v0.1 likely penalizes as instability.

3. **No minimum freeze duration**: A 2-frame dip in speed during a wobble will trigger a false `freeze` label and a spurious phase transition. The 15-frame minimum is essential.

4. **Head crown offset not applied**: v0.1 uses j15 directly as pivot. The ~6cm systematic error corrupts all L_z, pivot stability, and axial ratio calculations.

5. **No reconstruction confidence gate**: v0.1 cannot detect when GVHMR has silently failed on inverted poses. The `inversion_frac < 0.70` flag prevents bad reconstructions from producing confident but wrong scores.

6. **Transition quality is unidirectional**: v0.1 likely treats momentum continuity as always-positive. For exit dismounts, high momentum dissipation is the *correct* behavior — it should not be penalized.
