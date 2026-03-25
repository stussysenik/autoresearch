### PHYSICS SIGNATURE: flare-cycle-01

**Move Category**: Air power — alternating two-point hand pivot with ballistic leg-sweep phases
**Pivot**: Alternating at j22 (left_hand) and j23 (right_hand), fast-switching (~every 180° of body rotation)

---

**Angular Momentum Profile**:

- **Source**: Leg chain provides dominant contribution — high-mass segments (hips j1/j2, knees j4/j5) at large radii (~0.8–1.2m from hand pivot). At full extension, I_leg_pair ≈ 8.5 kg·m². The arm push-off at each hand contact injects energy but contributes comparatively little to L.
- **Conservation**: L_z is CONSERVED during ballistic flight phases (no external torque, feet airborne). It is INJECTED at each hand contact — the push-off arm extends under load and delivers an angular impulse. A clean flare shows nearly constant L_z across flight phases with a brief discontinuity at each hand switch as the pivot re-anchors.
- **Expected |L_z| range**: [18, 40] kg·m²·rad/s at ω ≈ 2.5–3.5 rad/s with I_total ≈ 10–12 kg·m²

> Critical: unlike headspin-loop-01 (single fixed pivot) and windmill-chain-01 (slow-migrating barrel pivot), **flares require L_z to be re-computed relative to the active hand pivot every ~15 frames**. L computed about a stale pivot center will appear to grow or collapse spuriously. Pivot-anchored L_z is the correct signal.

---

**RTA Velocity Expectations**:

| Component | Expected Profile | Quality Signal | SMPL Joints to Watch |
|-----------|-----------------|----------------|---------------------|
| Tangential | HIGH (2.5–6.0 m/s) and CONSISTENT across the full leg arc; feet j10/j11 trace near-circular path around active hand | `CV(v_tan_feet)` < 0.25 = clean; > 0.40 = deceleration or technique break | j10, j11 (feet), j7, j8 (ankles) relative to active hand j22/j23 |
| Radial | OSCILLATING — legs extend outward at arc peak (v_rad > 0) and retract slightly entering hand switch (v_rad < 0); intentional I modulation | Radial amplitude 0.3–0.8 m/s expected; absence = rigid/locked legs; excessive (>1.5 m/s) = unstable arc geometry | j4, j5 (knees) radial vector from pivot |
| Axial | SINUSOIDAL — legs sweep over the body, so foot z-velocity alternates sign across each half-revolution; amplitude ~0.8–1.5 m/s at foot | `mean(|v_ax|) / mean(|v_tan|)` should be 0.15–0.35; higher means body is tipping off the horizontal rotation plane | j10, j11 (feet) z-component; j0 (pelvis) z-velocity as CoM height oscillation |

---

**Energy Budget**:

- **KE source**: Each hand push-off (j22 or j23) extends elbow j18/j19 under load, delivering an impulse ∆p = F·∆t ≈ 80–150 N·s that both lifts CoM slightly and sustains angular rotation. The leg sweep starting from the split position converts stored potential energy (elevated CoM from push-off) back into tangential KE as the body drops into the arc.
- **Energy losses**: Floor friction at hand contact patch (palm area, not a smooth cap like headspin); muscle damping in hip extensors resisting leg drop; wrist/elbow absorption during landing. Each hand contact dissipates ~15–30% of rotational KE — the push-off must exceed this to maintain height.
- **Maintenance signal**: CoM height cycle-to-cycle. A decaying flare shows monotonically decreasing `max(z_CoM)` per rotation cycle. Good execution: `Δ max(z_CoM)` across N cycles < 0.05m. Collapse threshold: z_CoM dropping below 0.25m (body hitting floor).

```
KE_decay_rate = (KE_cycle_N - KE_cycle_1) / N_cycles  [J/cycle]
Good: KE_decay_rate > -5 J/cycle
Struggling: < -15 J/cycle
```

---

**Quality Pseudo-Code**:

```python
# Physics-based quality scoring for flare-cycle-01
# joints [T, 24, 3], 30fps, 70kg reference

import numpy as np
from scipy.signal import find_peaks

mass_table = [11.17, 2.78, 2.78, 5.0, 3.28, 3.28, 3.0, 0.61, 0.61, 2.5,
              0.97, 0.97, 1.5, 0.5, 0.5, 5.0, 2.0, 2.0, 1.14, 1.14,
              0.45, 0.45, 0.41, 0.41]

# ─── Active Pivot Detection ───────────────────────────────────────────────────
# The active pivot is the hand nearest the floor
def get_active_pivot(joints, frame):
    z_left  = joints[frame, 22, 2]
    z_right = joints[frame, 23, 2]
    if z_left < z_right + 0.05:        # left hand lower (or tied)
        return 22, joints[frame, 22, :]
    else:
        return 23, joints[frame, 23, :]

# ─── Hand Contact Frames ─────────────────────────────────────────────────────
# Contact: hand z < 0.08m AND |vz| settling (not hard landing)
def detect_hand_contacts(joints, T):
    contacts = []
    for frame in range(1, T - 1):
        for j in [22, 23]:
            z = joints[frame, j, 2]
            vz = (joints[frame, j, 2] - joints[frame-1, j, 2]) * 30
            if z < 0.08 and abs(vz) < 1.0:
                contacts.append((frame, j))
    # deduplicate consecutive
    return contacts

# ─── Pivot-Anchored L_z (critical: re-anchor per contact) ────────────────────
def compute_Lz_pivot_anchored(joints, frame, pivot_pos):
    Lz = 0.0
    for j in range(24):
        r = joints[frame, j, :] - pivot_pos
        v = (joints[min(frame+1, len(joints)-1), j, :] -
             joints[max(frame-1, 0), j, :]) * 15.0  # centered diff
        Lz += mass_table[j] * (r[0]*v[1] - r[1]*v[0])
    return Lz

# ─── CoM Height ──────────────────────────────────────────────────────────────
def com_z(joints, frame):
    return sum(mass_table[j] * joints[frame, j, 2] for j in range(24)) / 70.0

# ─── Self-Occlusion Flag ─────────────────────────────────────────────────────
# Both feet above CoM z + 0.10m → likely overhead occlusion
def detect_occlusion(joints, frame):
    cz = com_z(joints, frame)
    return (joints[frame, 10, 2] > cz + 0.10 and
            joints[frame, 11, 2] > cz + 0.10)

# ─── Tangential Velocity at Feet ─────────────────────────────────────────────
def foot_tangential_speed(joints, frame, pivot_pos, axis=np.array([0,0,1])):
    speeds = []
    for j in [10, 11]:  # feet
        r = joints[frame, j, :] - pivot_pos
        v = (joints[min(frame+1,len(joints)-1), j, :] -
             joints[max(frame-1,0), j, :]) * 15.0
        t_hat = np.cross(axis, r / (np.linalg.norm(r) + 1e-6))
        t_hat /= (np.linalg.norm(t_hat) + 1e-6)
        speeds.append(abs(np.dot(v, t_hat)))
    return max(speeds)

# ─── Main Scoring Loop ───────────────────────────────────────────────────────
T = len(joints)
Lz_series, vtan_series, com_heights = [], [], []
occlusion_flags = []

for frame in range(1, T - 1):
    _, pivot_pos = get_active_pivot(joints, frame)
    Lz_series.append(compute_Lz_pivot_anchored(joints, frame, pivot_pos))
    vtan_series.append(foot_tangential_speed(joints, frame, pivot_pos))
    com_heights.append(com_z(joints, frame))
    occlusion_flags.append(detect_occlusion(joints, frame))

# Per-cycle CoM peak heights (energy decay)
peaks, _ = find_peaks(com_heights, height=0.30, distance=10)
if len(peaks) >= 2:
    peak_vals = [com_heights[p] for p in peaks]
    com_decay = (peak_vals[-1] - peak_vals[0]) / len(peaks)   # m/cycle
    height_stability = 1.0 - min(1.0, abs(com_decay) / 0.08)
else:
    height_stability = 0.5  # insufficient cycles

# L_z consistency (non-occlusion frames only)
valid = [i for i in range(len(Lz_series)) if not occlusion_flags[i]]
Lz_valid = [Lz_series[i] for i in valid]
Lz_mean = abs(np.mean(Lz_valid)) if Lz_valid else 1e-6
Lz_cv = np.std(Lz_valid) / (Lz_mean + 1e-6)
Lz_score = 1.0 - min(1.0, Lz_cv / 0.40)

# Tangential velocity consistency
vtan_valid = [vtan_series[i] for i in valid]
vtan_cv = np.std(vtan_valid) / (np.mean(vtan_valid) + 1e-6)
vtan_score = 1.0 - min(1.0, vtan_cv / 0.35)

# Hand switch regularity
contacts = detect_hand_contacts(joints, T)
if len(contacts) >= 3:
    switch_intervals = np.diff([c[0] for c in contacts])
    switch_cv = np.std(switch_intervals) / (np.mean(switch_intervals) + 1e-6)
    rhythm_score = 1.0 - min(1.0, switch_cv / 0.30)
else:
    rhythm_score = 0.5  # too few contacts detected

# Confidence penalty for occlusion
occlusion_rate = np.mean(occlusion_flags)
confidence = 1.0 - 0.55 * occlusion_rate  # heavy penalty — flare occlusion is severe

# Composite
physics_score = (0.40 * Lz_score + 0.30 * vtan_score + 0.30 * height_stability)
physics_score_calibrated = physics_score * confidence

# Expected thresholds for clean flares:
# Lz_cv < 0.25, vtan_cv < 0.20, com_decay > -0.04 m/cycle
# Occlusion rate < 0.25 (if higher, flag output as low-confidence)
```

---

**Positive**: TRIVIUM v0.1 already captures the overall rotation signal via L_z and will correctly identify this as a high-energy power move. CoM height oscillation is computable directly from joint positions with no HMR-specific assumptions.

**Gap**: Three gaps specific to flares:

1. **Pivot re-anchoring**: v0.1 likely computes L about a fixed body center or j0. For flares, the pivot migrates between j22 and j23 every ~15 frames — L about a stale anchor will appear artificially noisy. Must anchor L to the active hand on each frame.

2. **Self-occlusion frame handling**: Large leg arcs guarantee both feet will periodically be above the CoM from a front-facing camera. JOSH v4 bboy-tuned will handle this better than GVHMR (which has no breaking-specific training), but even JOSH will produce depth-ambiguous limb positions during the overhead phase. These frames should be flagged (both j10.z > com_z + 0.10m) and down-weighted — physics scores computed over occluded frames will corrupt Lz_cv.

3. **Energy injection at contact vs conservation during flight**: v0.1 treats L as purely conserved. For flares, L is *both* conserved (during flight) and injected (during contact). The scoring model must distinguish contact frames from flight frames and apply the correct physics regime to each. A push-off frame showing a brief L_z increase is a **quality signal**, not an error.
