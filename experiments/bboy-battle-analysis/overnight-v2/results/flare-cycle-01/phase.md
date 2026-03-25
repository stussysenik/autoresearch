### PHASE SIGNATURE: flare-cycle-01

**Primary Phase**: `power`
**Phase Sequence**: `ENTRY_SETUP → WIND_UP → [FLARE_CONTACT ↔ FLARE_FLIGHT]* → EXIT_DECEL → EXIT_CATCH`

---

## State Machine

```
STATE: ENTRY_SETUP
  Phase: toprock (j0.z > 0.70m) OR footwork (j22/j23.z < 0.15m, j0.z 0.20–0.50m)
  Contact: j10/j11 weight-bearing (toprock) OR j22/j23 supporting (footwork)
  Physics: L_z ≈ 0; arm coil loading, hip opening building
  Musicality: full 1.0x musicality weight — only window where beat entry is expected

  Entry: clip start OR prior phase exits
  Active measurements:
    - pelvis_height: j0.z → [0.20, 1.10] m
    - arm_coil: elbow bend at j18/j19 angle decreasing → loading tension
    - hip_opening: angle j4–j0–j5 increasing → legs separating
    - L_z: near-zero [0, 3.0] kg·m²·rad/s
  Exit: active hand j22 OR j23 descending (vz < −0.5 m/s) AND j0.z < 0.50m AND j10.z + j11.z both rising
  Duration: variable; if clip opens mid-flare with |L_z| > 8.0 and hand_contact, skip entirely

  NOTE: Entry from footwork is more common than toprock for flares. Both are valid.
  If j22.z OR j23.z < 0.08m AND |L_z| > 8.0 from frame 0, enter FLARE_CONTACT directly.

→ TRANSITION to WIND_UP
  Quality: shoulder/hip coordination — jerk at j16/j17 and j0 < 15 m/s³; arm sweep readable

---

STATE: WIND_UP
  Phase: transition (loading first hand plant)
  Contact: active hand (j22 OR j23) approaching floor; j10/j11 beginning to leave
  Physics: L_z building 0 → [5, 15] kg·m²·rad/s via arm sweep angular impulse

  Entry: active hand z descending (vz < −0.5 m/s) AND j0.z < 0.50m AND hip rotation accelerating
  Active measurements:
    - hand_approach_speed: |vel(j22 or j23).z| → expected 0.5–2.0 m/s downward
    - hip_rotation_rate: angular vel j0 about z → should be increasing
    - L_z_build: growing toward [8, 15] kg·m²·rad/s
    - feet_release: j10.z AND j11.z rising above 0.05m
  Exit: active hand z < 0.08m AND |vz| < 1.0 m/s (planted) AND feet both airborne (z > 0.05m)
  Duration: 5–12 frames

→ TRANSITION to FLARE_CONTACT
  Quality: foot-to-hand transfer smoothness; momentum_continuity > 0.70 required for clean entry

---

STATE: FLARE_CONTACT  [REPEATING]
  Phase: power
  Contact: ONE hand on floor (j22 XOR j23, z < 0.08m AND |vz| < 1.0); both feet airborne
  Physics: L_z INJECTED by push-off arm extension; pivot = active hand (lower of j22/j23)

  Entry: active hand z < 0.08m AND feet airborne
  Active measurements:
    - pivot_hand: argmin(j22.z, j23.z) → must re-detect every frame
    - L_z_pivot: angular momentum about active hand → expected [18, 40] kg·m²·rad/s
    - elbow_ext: j18 or j19 angle decreasing → push-off extension underway
    - com_z: expected [0.30, 0.60] m; decay indicates energy loss
    - occlusion: j10.z > com_z + 0.10 AND j11.z > com_z + 0.10 → flag, down-weight feet
  Exit: active hand vz > 0.3 m/s (rising) AND incoming hand z approaching 0.10m
  Duration: 8–15 frames (~0.27–0.50s, approximately half revolution)

→ TRANSITION to FLARE_FLIGHT
  Quality: push-off energy injection; brief L_z INCREASE here is a quality signal, not an error

---

STATE: FLARE_FLIGHT  [REPEATING]
  Phase: power (ballistic)
  Contact: BOTH hands airborne (j22.z > 0.10m AND j23.z > 0.10m)
  Physics: L_z CONSERVED — no external torque; any L_z drop here = technique loss

  Entry: both hands airborne (z > 0.10m)
  Active measurements:
    - Lz_conservation: |ΔL_z| across flight frames < 15% of mean → quality check
    - foot_arc_radius: ||j10 or j11 − last_pivot_pos|| → expected 0.8–1.2m
    - foot_tangential_speed: speed ⊥ radius → expected [2.5, 6.0] m/s
    - axial_oscillation: j10/j11 z-velocity alternating sign → legs sweeping over body (0.8–1.5 m/s amplitude)
    - occlusion: flag heavily — overhead foot z corrupts arc geometry estimates
    - com_z_peak: peak height per cycle; decay > 0.05m/cycle = struggling
  Exit: incoming hand z < 0.08m AND |vz| < 1.0 m/s (plant detected)
  Duration: 8–15 frames

→ TRANSITION to FLARE_CONTACT (next cycle)
  Quality: hand re-plant interval CV < 0.25; Lz_conserved → Lz_injected continuity smooth

---

STATE: EXIT_DECEL
  Phase: transition (power wind-down)
  Contact: contact duration per cycle increasing; feet beginning descent
  Physics: L_z < 8.0 kg·m²·rad/s and falling; com_z monotonically declining

  Entry: com_z declining monotonically for > 3 cycles OR contact_duration up > 30% from baseline
  Active measurements:
    - L_z_decay: |L_z| cycle-over-cycle decline
    - contact_duration: frames per hand contact — increasing signals fatigue/exit
    - feet_descent: j10.z OR j11.z approaching floor_z < 0.05m
    - elbow_fail: j18/j19 extension amplitude decreasing → push-off losing power
  Exit: j10.z < 0.05m OR j11.z < 0.05m (foot plant on exit landing)
  Duration: 5–20 frames

→ TRANSITION to EXIT_CATCH
  Quality: controlled deceleration; low jerk = graceful landing; high jerk = crash

---

STATE: EXIT_CATCH
  Phase: transition → freeze OR footwork
  Contact: j10 AND/OR j11 planted; weight redistributing from hands to feet
  Physics: L_z dissipating → 0; CoM settling to stable height

  Entry: foot contact post-exit
  Active measurements:
    - L_z_dissipation_rate: should be smooth curve, not abrupt → quality
    - weight_transfer: hand z rising as foot z settles
    - freeze_detect: all joint speeds < 0.05 m/s for > 15 frames → FREEZE
    - footwork_detect: leg pattern resuming → FOOTWORK
  Exit: next phase established
  Duration: 5–20 frames
```

---

## Joint Weight Table

| Phase | Joint Group | Weight | Rationale |
|-------|-------------|--------|-----------|
| ENTRY_SETUP (toprock) | Feet j7,j8,j10,j11 | 1.5x | Foundation — stepping defines toprock |
| ENTRY_SETUP (toprock) | Hips j0,j1,j2 | 1.2x | Engine — rhythm driver |
| ENTRY_SETUP (footwork) | Hips j0,j1,j2 | 1.5x | Engine — driving hip opening |
| ENTRY_SETUP (footwork) | Feet j10,j11 | 1.3x | Fast movement, pattern-making |
| ENTRY_SETUP (footwork) | Hands j22,j23 | 0.8x | Foundation support |
| WIND_UP | Hips j0,j1,j2 | 2.0x | Engine — building angular impulse |
| WIND_UP | Active hand j22 OR j23 | 1.8x | Incoming pivot — foundation loading |
| WIND_UP | Arms j16–j21 | 1.5x | Coil release drives initial L_z |
| WIND_UP | Feet j10,j11 | 0.6x | Releasing floor — low weight |
| FLARE_CONTACT | Hips j0,j1,j2 | 2.0x | Angular momentum at large radius |
| FLARE_CONTACT | Active hand j22 OR j23 | 1.8x | Pivot foundation — only weight-bearing point |
| FLARE_CONTACT | Core j3,j6,j9 | 1.5x | Transmission — force through spine |
| FLARE_CONTACT | Knees j4,j5 | 1.2x | Moment of inertia modulation |
| FLARE_CONTACT | Feet j10,j11 | 1.0x / 0.4x | Full if clear; **0.4x if occluded** |
| FLARE_CONTACT | Inactive hand | 0.6x | Free — not load-bearing |
| FLARE_CONTACT | Head j12,j15 | 0.8x | Stabilizing only (not a pivot here) |
| FLARE_FLIGHT | Hips j0,j1,j2 | 2.0x | Dominant L_z source; swept at max radius |
| FLARE_FLIGHT | Feet j10,j11 | 1.5x / 0.4x | Tangential speed quality signal; **0.4x if occluded** |
| FLARE_FLIGHT | Core j3,j6,j9 | 1.3x | Rotation axis alignment |
| FLARE_FLIGHT | Knees j4,j5 | 1.2x | Radial extension — I modulation |
| FLARE_FLIGHT | Hands j22,j23 | 0.5x | Both airborne — not contributing to pivot |
| EXIT_DECEL | Hands j22,j23 | 1.5x | Active pivot still bearing weight |
| EXIT_DECEL | Hips j0,j1,j2 | 1.8x | L_z source — decay signal |
| EXIT_CATCH | Feet j10,j11 | 1.5x | Landing detection — primary foundation |
| EXIT_CATCH | Hands j22,j23 | 1.3x | Catch support |
| EXIT_CATCH | Core j3,j6,j9 | 1.5x | Stability hold |

---

## Transition Quality Expectations

- **Number of transitions**: `2 + (2 × N_cycles) + 2` — wind-up entry, alternating CONTACT↔FLIGHT per cycle, exit decel, exit catch
- **Expected jerk at CONTACT→FLIGHT**: `5–12 m/s³` at j22/j23 — push-off impulse; spikes here are **quality signal**
- **Expected jerk at FLIGHT→CONTACT**: `8–18 m/s³` at active hand — hand re-plant; must be absorbed cleanly
- **Momentum continuity at hand switch**: `> 0.75` for clean execution; `< 0.55` = energy loss or technique break
- **Momentum continuity at EXIT_DECEL entry**: `0.40–0.65` expected — intentional deceleration, not a technique failure
- **Foot occlusion flag rate**: Expected `0.15–0.35` per cycle at peak arc height; if `> 0.50`, depth-estimated joint positions are unreliable for that window

---

## Edge Cases

- **Clip starts mid-flare**: If frame 0 has `|L_z| > 8.0` AND one hand planted — skip ENTRY_SETUP and WIND_UP entirely, enter FLARE_CONTACT directly. Not penalized.
- **Pivot ambiguity at hand switch**: During the 2–3 frame window where incoming hand z approaches 0.10m and outgoing hand z rises, both hands are near-floor. Use `argmin(j22.z, j23.z)` with 0.05m hysteresis to avoid oscillation. A false dual-contact label here will spuriously inject L_z — use contact-settling criterion (`|vz| < 1.0 m/s`) to confirm true plant.
- **FLARE_FLIGHT L_z appears to drift**: If L_z about a fixed center is used, apparent drift during flight is a measurement artifact, not a physics event. Must use last-planted hand position as pivot anchor throughout flight until next CONTACT.
- **L_z increase during FLARE_CONTACT push-off**: This is a quality signal (energy injection), not an error. v0.1 may misclassify this as a transition. Tag push-off frames explicitly.
- **EXIT_CATCH masquerading as FREEZE**: If the dancer catches into a brief balance hold before resuming footwork, all-joint speed may dip below 0.05 m/s for < 15 frames. Require > 15 frames for FREEZE label to avoid false freeze detection at catch.
- **Asymmetric flares**: Some dancers produce clean right-hand but degraded left-hand contacts. The hand-switch interval CV should be computed per-hand separately; a per-hand CV split exposes this where aggregate CV would mask it.

---

## Pseudo-Code

```python
def classify_flare_phases(joints, fps=30):
    """Phase classification for flare-cycle-01. joints: [T, 24, 3], 70kg reference."""
    import numpy as np
    T = len(joints)
    dt = 1.0 / fps
    mass = np.array([11.17,2.78,2.78,5.0,3.28,3.28,3.0,0.61,0.61,2.5,0.97,0.97,
                     1.5,0.5,0.5,5.0,2.0,2.0,1.14,1.14,0.45,0.45,0.41,0.41])

    # Kinematics
    vel = np.gradient(joints, dt, axis=0)
    speed = np.linalg.norm(vel, axis=-1)  # [T, 24]

    pelvis_z = joints[:, 0, 2]
    hand_z   = joints[:, [22, 23], 2]      # [T, 2]
    foot_z   = joints[:, [10, 11], 2]      # [T, 2]
    com_z    = (joints[:, :, 2] @ mass) / 70.0

    # Active hand: whichever is lower (with 0.05m hysteresis)
    active_hand = np.where(hand_z[:, 0] <= hand_z[:, 1] + 0.05, 22, 23)
    active_hand_z = np.min(hand_z, axis=1)
    active_hand_vz = np.gradient(active_hand_z, dt)

    # Contact: planted (not crashing/bouncing)
    hand_contact = (active_hand_z < 0.08) & (np.abs(active_hand_vz) < 1.0)

    # Feet airborne
    feet_airborne = (foot_z[:, 0] > 0.05) & (foot_z[:, 1] > 0.05)

    # Occlusion: both feet above CoM + 0.10m
    occluded = (foot_z[:, 0] > com_z + 0.10) & (foot_z[:, 1] > com_z + 0.10)

    # Pivot-anchored L_z
    def lz_at(f):
        pivot = joints[f, active_hand[f], :]
        Lz = 0.0
        for j in range(24):
            r = joints[f, j, :] - pivot
            v = vel[f, j, :]
            Lz += mass[j] * (r[0]*v[1] - r[1]*v[0])
        return Lz

    Lz = np.array([lz_at(f) for f in range(T)])

    # Phase labels
    raw = []
    for t in range(T):
        s = np.mean(speed[t])
        lz = abs(Lz[t])
        if s < 0.05:
            raw.append('FREEZE')
        elif lz > 8.0 and hand_contact[t]:
            raw.append('FLARE_CONTACT')
        elif lz > 8.0 and feet_airborne[t]:
            raw.append('FLARE_FLIGHT')
        elif lz > 3.0 and pelvis_z[t] < 0.50 and active_hand_vz[t] < -0.5:
            raw.append('WIND_UP')
        elif lz < 5.0 and pelvis_z[t] < 0.50 and np.mean(active_hand_z[max(0,t-3):t+1]) < 0.15:
            # L_z falling, hand descending → EXIT_DECEL
            raw.append('EXIT_DECEL')
        elif pelvis_z[t] > 0.70:
            raw.append('ENTRY_TOPROCK')
        elif np.min(hand_z[t]) < 0.15 and pelvis_z[t] < 0.50:
            raw.append('ENTRY_FOOTWORK')
        else:
            raw.append('TRANSITION')

    return smooth_labels(raw, min_segment=int(0.25 * fps))  # 7-frame minimum


def flare_joint_weights(phase, active_hand_idx, occluded):
    """Returns [24] weight multipliers for scoring this phase frame."""
    import numpy as np
    w = np.ones(24)
    inactive = 23 if active_hand_idx == 22 else 22

    if phase in ('FLARE_CONTACT', 'FLARE_FLIGHT'):
        w[[0, 1, 2]] = 2.0                    # ENGINE: hips
        w[[3, 6, 9]] = 1.5                    # TRANSMISSION: core
        w[active_hand_idx] = 1.8              # FOUNDATION: active pivot
        w[inactive] = 0.6                     # free hand
        w[[4, 5]] = 1.2                       # EXPRESSION: knees (I modulation)
        w[[12, 15]] = 0.8                     # head stabilizing
        foot_w = 0.4 if occluded else (1.5 if phase == 'FLARE_FLIGHT' else 1.0)
        w[[7, 8, 10, 11]] = foot_w            # DOWN-WEIGHT HEAVILY if occluded

    elif phase == 'WIND_UP':
        w[[0, 1, 2]] = 2.0
        w[active_hand_idx] = 1.8
        w[[16, 17, 18, 19, 20, 21]] = 1.5    # arm coil release
        w[[10, 11]] = 0.6                     # releasing floor

    elif phase == 'EXIT_CATCH':
        w[[10, 11]] = 1.5                     # landing feet
        w[[22, 23]] = 1.3                     # catch support
        w[[3, 6, 9]] = 1.5                    # stability core

    return w


def flare_transition_quality(joints, t_frame, fps=30, window=5):
    """Quality score for a CONTACT↔FLIGHT transition frame."""
    import numpy as np
    vel   = np.gradient(joints, 1/fps, axis=0)
    accel = np.gradient(vel,    axis=0) * fps
    jerk  = np.gradient(accel,  axis=0) * fps
    jerk_mag = np.linalg.norm(jerk, axis=-1)  # [T, 24]

    f = np.clip(t_frame, window, len(jerk_mag) - window - 1)
    boundary = jerk_mag[f-window:f+window]

    # Pivot jerk at hand switch (expected to spike — measure containment)
    pivot_jerk = boundary[:, [22, 23]].mean()

    # Momentum continuity across the pivot switch
    mass = np.array([11.17,2.78,2.78,5.0,3.28,3.28,3.0,0.61,0.61,2.5,0.97,0.97,
                     1.5,0.5,0.5,5.0,2.0,2.0,1.14,1.14,0.45,0.45,0.41,0.41])
    def lz_anchored(f_, anchor_j):
        piv = joints[f_, anchor_j, :]
        lz = sum(mass[j] * ((joints[f_,j,:]-piv)[0]*vel[f_,j,1]
                            - (joints[f_,j,:]-piv)[1]*vel[f_,j,0])
                 for j in range(24))
        return abs(lz)

    hand_before = int(joints[t_frame-3, 22, 2] <= joints[t_frame-3, 23, 2] + 0.05) and 22 or 23
    hand_after  = int(joints[t_frame+3, 22, 2] <= joints[t_frame+3, 23, 2] + 0.05) and 22 or 23
    L_before = lz_anchored(t_frame - 3, hand_before)
    L_after  = lz_anchored(t_frame + 3, hand_after)
    mom_cont = np.clip(1.0 - abs(L_after - L_before) / (L_before + 1e-8), 0, 1)

    quality = 0.50 * np.clip(1.0 - pivot_jerk / 50.0, 0, 1) + 0.50 * mom_cont
    return {"quality": quality, "pivot_jerk": pivot_jerk, "momentum_continuity": mom_cont}
```

---

## Divergence from Prior Scenarios

| Property | headspin-loop-01 | windmill-chain-01 | **flare-cycle-01** |
|---|---|---|---|
| Pivot | Fixed j15 | Migrating barrel along spine | **Alternating j22/j23 every ~15 frames** |
| L axis | L_z (vertical) | L_barrel (horizontal spine) | **L_z (vertical), re-anchored per frame** |
| Flight phases | None — j15 always contacts | None — always some floor contact | **FLARE_FLIGHT exists; L_z conserved, not injected** |
| Occlusion source | Body shields head from front camera | Shoulder/body shields contact | **Legs sweep overhead — heaviest occlusion of all three** |
| Head role | PRIMARY pivot, 1.5x | Minimal (alarm if contact) | **Stabilizing only, 0.8x** |

---

**Positive**: v0.1 will correctly identify flare as a high-energy power move via `|L_z|` threshold — the signal is strong and unambiguous. The entry/exit phase skeleton (setup → power → freeze) is standard and already present. CoM height and arm-sweep beat detection at entry/exit are also directly computable.

**Gap**: Four gaps specific to flare phase classification:

1. **No CONTACT vs FLIGHT sub-state distinction**: v0.1 treats all of a power move as one uniform state. For flares, CONTACT frames inject L_z while FLIGHT frames conserve it — the physics regime is different. Without this split, the scoring model will interpret injection events as instability.
2. **Fixed pivot assumption**: L_z about a fixed body center will appear noisy as the anchor migrates between j22 and j23 every ~15 frames. This will generate false `TRANSITION` labels mid-flare. Pivot must be re-detected on every frame.
3. **No occlusion-gated foot weights**: `j10/j11` overhead during arc peak is guaranteed. Without suppression (0.4x during occlusion), corrupted foot positions will inflate tangential speed noise and degrade phase timing signals.
4. **Hand-switch rhythm not modeled**: v0.1 has no concept of alternating-pivot regularity. The `switch_interval_CV` metric (quality of left-right alternation) is the core repeating-flare quality signal and is entirely absent from the current phase model.
