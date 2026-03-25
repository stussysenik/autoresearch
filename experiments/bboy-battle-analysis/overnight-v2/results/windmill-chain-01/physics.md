### PHYSICS SIGNATURE: windmill-chain-01

**Move Category**: Ground Power (windmill — repeating chain)
**Pivot**: Migrating — posterior shoulder capsule → upper dorsal thorax → contralateral shoulder capsule → anterior chest/sternum → repeat

Contact chain in SMPL: `j17 (right_shoulder) → j14/j13 (right/left_collar region) → j16 (left_shoulder) → j6/j3 (spine2/spine1) → j17 ...`

Note: SMPL joint centers sit ~0.08–0.12m anterior of the actual shoulder contact patch. When `j17.z < 0.12m` above world floor, the posterior shoulder capsule is contacting. This offset is larger than in headspins and must be accounted for in any contact detector calibrated from j16/j17 directly.

---

## STATES

### State Machine: Physics Layer — Windmill Chain

```
STATE: ENTRY_SETUP
  Phase: pre-power / approach
  Contact: feet j10,j11 weight-bearing; body upright or crouched
  Physics: arm sweep and hip rotation building pre-rotation; L_barrel ≈ 0, KE_rotational ≈ 0
  
  Entry: clip start OR (j0.z > 0.80m AND j10.z, j11.z near floor_z < 0.05m)
  Active measurements:
    - pelvis_height: j0.z → expected [0.80, 1.10] m
    - arm_sweep: ||vel(j22)||, ||vel(j23)|| → building to > 2.0 m/s
    - foot_stance: |j10.x - j11.x| → expected > 0.20m (shoulder-width or wider)
    - L_barrel_pre: angular momentum about horizontal axis → expected near 0
  Exit: j0.z drops Δz/Δt > 0.6 m/s downward AND (j16.z < 0.30m OR j17.z < 0.30m)
  Duration: 0.3–0.8s; if clip starts with j0.z < 0.50m AND L_barrel > 5 kg·m²·rad/s
             from frame 0, skip directly to BARREL_PHASE_RIGHT or _LEFT

  NOTE: May be ABSENT. Phase detector must handle clip-starts-mid-windmill gracefully.

→ TRANSITION to FIRST_SHOULDER_CONTACT

---

STATE: FIRST_SHOULDER_CONTACT
  Phase: entry impulse
  Contact: one shoulder (j16 or j17) primary; feet clearing floor
  Physics: Hip kick (j1/j2) generates initial angular impulse; L_barrel building 0 → 10–20 kg·m²·rad/s
  
  Entry: (j17.z < 0.12m OR j16.z < 0.12m) AND j0.z < 0.60m
  Active measurements:
    - shoulder_contact_z: j16.z or j17.z → expected [0.05, 0.12] m
    - hip_angular_impulse: d/dt(L_barrel) → expected large positive spike 20–60 N·m
    - pelvis_z: j0.z → expected [0.20, 0.50] m (body tilting toward floor)
    - foot_clearance: max(j10.z, j11.z) → should rise > 0.30m within 5 frames
  Exit: (j10.z > 0.30m AND j11.z > 0.30m) AND L_barrel > 8 kg·m²·rad/s
  Duration: 3–8 frames (~0.10–0.27s)

→ TRANSITION to BARREL_PHASE

---

STATE: BARREL_PHASE_RIGHT  (right shoulder leading — j17 contact)
  Phase: active rotation, leg sweep right→overhead
  Contact: j17 primary; j14 (right_collar region) secondary/migrating
  Physics: Barrel roll around approximately world-x axis; L_barrel ≈ conserved;
           legs sweeping from floor level through lateral arc to overhead
           v_tangential at j10, j11 should be 2.5–5.0 m/s
  
  Active measurements:
    - L_barrel: angular momentum about spine axis → expected [15, 40] kg·m²·rad/s
    - right_shoulder_z: j17.z → expected [0.05, 0.12] m (contact maintained)
    - left_shoulder_z: j16.z → expected > 0.30m (off floor)
    - leg_sweep_velocity: ||vel(j10)||, ||vel(j11)|| → expected [2.5, 5.0] m/s
    - pelvis_rise: j0.z → rising from ~0.25m toward 0.55m
    - axial_drift: v_axial at j0 → expected < 0.30 m/s (in-place windmill)
  Exit: j17.z > 0.12m (right shoulder lifting) AND j14.z < 0.10m (back rolling in)
  Duration: 8–18 frames (~0.27–0.60s per half-revolution)

→ TRANSITION to BACK_ROLL_TRANSITION

---

STATE: BACK_ROLL_TRANSITION
  Phase: pivot migration — shoulder-to-shoulder via dorsal thorax
  Contact: j14 (right_collar) AND/OR j13 (left_collar) — bilateral upper back contact
           or migrating contact with no single dominant point
  Physics: Brief L_barrel partial disruption due to bilateral friction; CoM at intermediate height
           This is the most mechanically complex phase — L can drop 5–15% here
  
  Active measurements:
    - back_contact: (j14.z + j13.z) / 2 → expected < 0.12m
    - L_barrel: angular momentum → watch for dip; > 10% drop = energy loss event
    - collar_z_diff: |j14.z - j13.z| → expected < 0.05m (symmetric back roll)
                     asymmetry > 0.08m = lateral tilt / pivot error
    - pelvis_z: j0.z → expected [0.45, 0.70] m (approaching inversion)
    - head_z: j15.z → expected > 0.15m (head clear of floor — NOT headmill)
  Exit: j16.z < 0.12m (left shoulder beginning contact) AND j17.z > 0.12m
  Duration: 3–8 frames (~0.10–0.27s)

→ TRANSITION to BARREL_PHASE_LEFT

---

STATE: BARREL_PHASE_LEFT  (left shoulder leading — j16 contact)
  Phase: active rotation, leg sweep overhead→lateral-left
  Contact: j16 primary; j13 (left_collar) secondary/migrating
  Physics: Mirror of BARREL_PHASE_RIGHT; should produce symmetric measurements
           L_barrel should match BARREL_PHASE_RIGHT value within 15% for good symmetry
  
  Active measurements: (symmetric to BARREL_PHASE_RIGHT, swap j16↔j17, j13↔j14)
    - L_barrel: → expected same range as BARREL_PHASE_RIGHT [15, 40] kg·m²·rad/s
    - left_shoulder_z: j16.z → expected [0.05, 0.12] m
    - right_shoulder_z: j17.z → expected > 0.30m
    - leg_sweep_velocity: ||vel(j10)||, ||vel(j11)|| → expected same as BARREL_PHASE_RIGHT
    
  LEFT-RIGHT ASYMMETRY CHECK:
    L_right = mean |L_barrel| during BARREL_PHASE_RIGHT
    L_left  = mean |L_barrel| during BARREL_PHASE_LEFT
    asymmetry_ratio = |L_right - L_left| / max(L_right, L_left)
    target: asymmetry_ratio < 0.15; > 0.30 = significant technique gap
    
  Exit: j16.z > 0.12m AND j3.z < 0.15m (chest/lower-back transitioning toward floor)
  Duration: 8–18 frames (should match BARREL_PHASE_RIGHT duration within ±3 frames)

→ TRANSITION to INVERSION_PEAK or CHEST_RECOVERY

---

STATE: INVERSION_PEAK
  Phase: maximum inversion
  Contact: upper back (j13/j14/j6) or momentarily airborne
  Physics: KE_barrel → PE exchange; L_barrel partially stored as PE;
           Maximum CoM height in revolution cycle; pelvis above head confirmed
  
  Entry: j0.z > j15.z (pelvis above head z-coordinate)
  Active measurements:
    - inversion_depth: j0.z - j15.z → expected [0.30, 0.80] m for deep windmill
    - pelvis_peak_z: j0.z → expected [0.60, 0.90] m
    - head_clearance: j15.z → expected > 0.15m (NOT headmill; if < 0.10m flag as headmill variant)
    - L_barrel_at_peak: angular momentum → can drop 10–20% vs sweep phases (normal, PE conversion)
    - leg_extension: ||j10 - j0|| + ||j11 - j0|| → expected > 1.20m (legs extended, maximizing I)
  Exit: j0.z - j15.z < 0.10m (inversion resolving) AND j0.z decreasing
  Duration: 4–10 frames (~0.13–0.33s)

→ TRANSITION to HIP_KICK_RECOVERY (for chain continuation)

---

STATE: HIP_KICK_RECOVERY
  Phase: energy re-injection (per-revolution maintenance)
  Contact: back/lower-back region (j6, j3 spine joints near floor)
  Physics: Hip kick (j1/j2) and leg whip re-engage to compensate friction losses;
           angular impulse restores L_barrel to target level
  
  Active measurements:
    - hip_kick_impulse: d/dt(L_barrel) → expected positive 5–20 N·m impulse
    - spine_contact_z: j3.z or j6.z → expected [0.05, 0.15] m
    - L_barrel_recovery: L_barrel after kick vs before → expected < 10% net decay per revolution
    - leg_whip_speed: ||vel(j10)||, ||vel(j11)|| → should peak here as new sweep begins
  Exit: j17.z < 0.12m (right shoulder re-contacting, starting next revolution)
         OR L_barrel_recovery < 5 kg·m²·rad/s (windmill dying — EXIT_UNCONTROLLED)
  Duration: 5–10 frames (~0.17–0.33s)

  CHAIN CONTINUATION: → loop back to BARREL_PHASE_RIGHT
  CHAIN EXIT (controlled): leg whip stops, body rises → EXIT_CONTROLLED
  CHAIN EXIT (crash): L_barrel < 5 kg·m²·rad/s → EXIT_UNCONTROLLED

---

STATE: EXIT_CONTROLLED
  Phase: post-power transition
  Contact: feet returning to floor OR transition to freeze contact
  Physics: Controlled energy dissipation; CoM rising; L_barrel decaying intentionally
  
  Active measurements:
    - pelvis_rise: j0.z rising toward > 0.60m
    - L_decay_rate: smooth exponential decay (good) vs abrupt stop (crash landing)
    - foot_landing: j10.z, j11.z → should reach floor_z within 3 frames of exit
  Duration: 0.3–0.8s
```

---

## ANGULAR MOMENTUM PROFILE

**Primary axis**: Barrel roll — approximately horizontal (world-x or world-y depending on orientation); NOT the vertical z-axis (that's headspins)

| Component | Expected Range | Notes |
|-----------|---------------|-------|
| L_x or L_y (barrel) | 15–40 kg·m²·rad/s | Dominant; direction depends on dancer orientation |
| L_z (orbital) | < 3 kg·m²·rad/s | In-place windmill; > 3 = floor drift |
| \|L\| peak (fast windmill) | 30–40 kg·m²·rad/s | Fast bboys at 1.5 rev/s |
| \|L\| peak (standard) | 15–25 kg·m²·rad/s | Standard timing at ~1 rev/s |

**Why legs dominate**: I_legs_about_barrel_axis ≈ 2 × (7.64 kg × 0.5²m²) = 3.8 kg·m²; at ω ≈ 6 rad/s → L_legs ≈ 23 kg·m²·rad/s (~70% of total L). Arms and trunk add ~30%.

---

## RTA VELOCITY EXPECTATIONS

Pivot = migrating contact point on shoulder/back; rotation axis = spine's long axis (horizontal barrel roll)

| Component | Expected Profile | Quality Signal | SMPL Joints |
|-----------|-----------------|----------------|-------------|
| Tangential | HIGH 2.5–5.0 m/s at foot tips during sweep; consistent across revolutions | `CV(v_tan_j10, v_tan_j11) < 0.20` = clean chain; > 0.35 = dying or inconsistent | j10, j11 (feet), j7, j8 (ankles), j4, j5 (knees) |
| Radial | LOW (< 0.5 m/s) during steady sweep; MODERATE spike (0.5–1.5 m/s) at inversion transition for I adjustment | Sustained v_rad > 1.0 m/s = shape instability or crash in progress | j0 (pelvis), j10, j11; key during INVERSION_PEAK |
| Axial | NEAR ZERO (< 0.3 m/s) during steady rotation; brief SPIKE (0.3–0.8 m/s) at shoulder transitions | `\|v_axial\| / \|v_tangential\| < 0.15` = clean; > 0.30 = pivot axis shifting or floor drift | j15 (head), j0 (pelvis), j16, j17 (shoulders) |

---

## ENERGY BUDGET

```
Source:         Hip kick (j1, j2) — 40–80 N·m initial impulse at FIRST_SHOULDER_CONTACT
                Leg whip continuation — 5–20 N·m restoring impulse per HIP_KICK_RECOVERY

Conversion:     KE_barrel ↔ PE as CoM oscillates ±0.20–0.35m through each revolution
                At inversion peak: ~20–40J PE stored; at shoulder contact: released back to KE

Losses:         Shoulder friction: ~15–25% KE loss per shoulder contact
                Back/collar friction: ~5–10% additional at BACK_ROLL_TRANSITION
                Internal damping: ~5% per revolution

Total KE (barrel): ½ × I_total × ω²  ≈ ½ × 5.5 × (5²) ≈ 69 J at moderate windmill
Chain sustainability: If KE_loss_per_rev < KE_injected_per_rev → sustained chain
                      If KE_loss > KE_inject → windmill dying; detectable via |L| slope

Maintenance signal:  Compute |L_barrel| per revolution (mean over sweep phase)
                     Decay > 20% per revolution = poor technique / fatigue
                     Decay < 10% per revolution = strong kick-maintenance
                     RISING |L| = dancer accelerating chain (rare, high skill)
```

---

## QUALITY PSEUDO-CODE

```python
# Physics-based quality scoring for windmill-chain-01
# Input: joints_3d [T, 24, 3] — meters, world-grounded, 30fps

import numpy as np

MASSES = {
    0:11.17, 1:2.78,  2:2.78,  3:5.00,  4:3.28,  5:3.28,
    6:3.00,  7:0.61,  8:0.61,  9:2.50, 10:0.97, 11:0.97,
   12:1.50, 13:0.50, 14:0.50, 15:5.00, 16:2.00, 17:2.00,
   18:1.14, 19:1.14, 20:0.45, 21:0.45, 22:0.41, 23:0.41
}
TOTAL_MASS = sum(MASSES.values())  # ~70 kg

def smooth_velocity(joints_3d, fps=30):
    """Central-difference velocity, smoothed with 3-frame window."""
    vel = np.gradient(joints_3d, axis=0) * fps
    kernel = np.array([0.25, 0.50, 0.25])
    for j in range(24):
        for ax in range(3):
            vel[:, j, ax] = np.convolve(vel[:, j, ax], kernel, mode='same')
    return vel

def compute_barrel_L(joints_3d, vel):
    """
    Compute angular momentum about the barrel roll axis.
    Uses CoM as pivot; returns L vector [T, 3] and |L_barrel| [T].
    """
    T = joints_3d.shape[0]
    # Center of mass
    com = sum(MASSES[j] * joints_3d[:, j, :] for j in range(24)) / TOTAL_MASS
    
    L = np.zeros((T, 3))
    for j, m in MASSES.items():
        r = joints_3d[:, j, :] - com   # [T, 3]
        v = vel[:, j, :]               # [T, 3]
        L += m * np.cross(r, v)        # [T, 3]
    
    # The barrel roll axis is approximately perpendicular to z and to spine direction.
    # Estimate spine direction from j0→j9 at mid-clip.
    mid = T // 2
    spine_vec = joints_3d[mid, 9, :] - joints_3d[mid, 0, :]
    spine_hat = spine_vec / (np.linalg.norm(spine_vec) + 1e-6)
    
    # Barrel component = L projected onto spine axis
    L_barrel = np.einsum('ti,i->t', L, spine_hat)  # [T] scalar
    
    return L, np.abs(L_barrel)

def detect_shoulder_contacts(joints_3d, floor_z=0.0, threshold=0.12):
    """
    Detect left/right shoulder contact phases from j16, j17 z-height.
    Returns boolean masks [T].
    """
    left  = joints_3d[:, 16, 2] < (floor_z + threshold)   # j16 left_shoulder
    right = joints_3d[:, 17, 2] < (floor_z + threshold)   # j17 right_shoulder
    back  = (joints_3d[:, 13, 2] + joints_3d[:, 14, 2]) / 2 < (floor_z + 0.10)
    return left, right, back

def detect_inversions(joints_3d):
    """Frames where pelvis (j0) is above head (j15)."""
    return joints_3d[:, 0, 2] > joints_3d[:, 15, 2]

def segment_revolutions(right_contact_mask, min_gap=5):
    """
    Count windmill revolutions from right-shoulder contact events.
    Returns list of (start_frame, end_frame) per revolution.
    """
    signal = right_contact_mask.astype(float)
    # Find rising edges (contact start)
    edges = np.diff(signal, prepend=0)
    starts = np.where(edges > 0)[0]
    
    # Merge starts closer than min_gap frames
    merged = []
    for s in starts:
        if not merged or s - merged[-1] > min_gap:
            merged.append(s)
    
    revolutions = []
    for i in range(len(merged) - 1):
        revolutions.append((merged[i], merged[i+1]))
    return revolutions

def windmill_chain_physics_score(joints_3d, fps=30):
    """
    Full physics quality score for windmill-chain-01.
    Returns dict of per-metric scores in [0, 1] + composite.
    """
    T = joints_3d.shape[0]
    vel = smooth_velocity(joints_3d, fps)
    
    L_full, L_barrel = compute_barrel_L(joints_3d, vel)
    left_contact, right_contact, back_contact = detect_shoulder_contacts(joints_3d)
    inversion_mask = detect_inversions(joints_3d)
    revolutions = segment_revolutions(right_contact)
    n_revs = len(revolutions)

    # ── 1. ANGULAR MOMENTUM CONSISTENCY (chain quality) ──────────────────
    sweep_mask = ~left_contact & ~right_contact & ~back_contact
    L_sweep = L_barrel[sweep_mask] if np.any(sweep_mask) else L_barrel
    
    L_cv = np.std(L_sweep) / (np.mean(L_sweep) + 1e-6)
    L_consistency_score = float(np.clip(1.0 - L_cv * 2, 0, 1))

    # ── 2. ENERGY MAINTENANCE (L decay across revolutions) ───────────────
    if n_revs >= 2:
        rev_L_means = []
        for s, e in revolutions:
            sweep_rev = sweep_mask[s:e]
            L_rev = L_barrel[s:e]
            rev_L_means.append(np.mean(L_rev[sweep_rev]) if np.any(sweep_rev) else np.mean(L_rev))
        
        decay_rates = [(rev_L_means[i] - rev_L_means[i+1]) / (rev_L_means[i] + 1e-6)
                       for i in range(len(rev_L_means) - 1)]
        mean_decay = np.mean(decay_rates)  # 0.0 = no decay, 0.20 = 20% per rev
        energy_maintenance_score = float(np.clip(1.0 - mean_decay / 0.20, 0, 1))
    else:
        energy_maintenance_score = 0.5  # single revolution: neutral score

    # ── 3. LEFT-RIGHT SYMMETRY ────────────────────────────────────────────
    n_left  = int(np.sum(left_contact))
    n_right = int(np.sum(right_contact))
    total_shoulder = n_left + n_right

    if total_shoulder > 0:
        lr_asymmetry = abs(n_left - n_right) / total_shoulder
        symmetry_score = float(1.0 - lr_asymmetry * 2)  # 50/50 split = 1.0
        symmetry_score = max(0.0, symmetry_score)
    else:
        symmetry_score = 0.0  # detector failure or no contact found

    # Per-revolution L comparison: left shoulder phase vs right shoulder phase
    if n_revs >= 1:
        L_right_phases, L_left_phases = [], []
        for s, e in revolutions:
            rc = right_contact[s:e]
            lc = left_contact[s:e]
            if np.any(rc): L_right_phases.append(np.mean(L_barrel[s:e][rc]))
            if np.any(lc): L_left_phases.append(np.mean(L_barrel[s:e][lc]))
        
        if L_right_phases and L_left_phases:
            mean_r = np.mean(L_right_phases)
            mean_l = np.mean(L_left_phases)
            L_lr_ratio = abs(mean_r - mean_l) / (max(mean_r, mean_l) + 1e-6)
            L_symmetry_score = float(np.clip(1.0 - L_lr_ratio / 0.30, 0, 1))
        else:
            L_symmetry_score = 0.5
    else:
        L_symmetry_score = 0.5

    # ── 4. INVERSION QUALITY ──────────────────────────────────────────────
    inversion_ratio = float(np.mean(inversion_mask))
    # Target: ~0.25–0.50 of frames should be inverted for a proper windmill
    # Centre of target window = 0.35; penalize deviation
    inv_target = 0.35
    inv_tolerance = 0.20
    inversion_score = float(np.clip(1.0 - abs(inversion_ratio - inv_target) / inv_tolerance, 0, 1))

    # Depth check: at inversion peak, how high does pelvis go?
    if np.any(inversion_mask):
        peak_pelvis_z = float(np.max(joints_3d[inversion_mask, 0, 2]))
        # Good windmill: pelvis > 0.60m; excellent: > 0.80m
        inversion_depth_score = float(np.clip((peak_pelvis_z - 0.40) / 0.50, 0, 1))
    else:
        inversion_depth_score = 0.0

    # ── 5. TANGENTIAL VELOCITY CONSISTENCY (leg speed at feet) ───────────
    v_j10 = np.linalg.norm(vel[:, 10, :], axis=1)  # left_foot speed
    v_j11 = np.linalg.norm(vel[:, 11, :], axis=1)  # right_foot speed

    # During sweep phases only (neither shoulder nor back contacting)
    if np.any(sweep_mask):
        v_feet = (v_j10 + v_j11)[sweep_mask] / 2
        feet_cv = np.std(v_feet) / (np.mean(v_feet) + 1e-6)
        tangential_score = float(np.clip(1.0 - feet_cv * 1.5, 0, 1))
        power_score = float(np.clip(np.mean(v_feet > 1.5), 0, 1))  # fraction > 1.5 m/s
    else:
        tangential_score = 0.5
        power_score = 0.0

    # ── 6. AXIAL DRIFT (floor drift check for in-place windmill) ─────────
    # Track CoM displacement in horizontal plane (x,y) over time
    com = sum(MASSES[j] * joints_3d[:, j, :] for j in range(24)) / TOTAL_MASS
    com_xy = com[:, :2]  # [T, 2]
    total_drift = float(np.linalg.norm(com_xy[-1] - com_xy[0]))  # meters drifted
    # Good windmill: stays within 0.30m; > 0.60m = significant traveling
    drift_score = float(np.clip(1.0 - total_drift / 0.60, 0, 1))

    # ── COMPOSITE SCORE ───────────────────────────────────────────────────
    composite = (
        0.20 * L_consistency_score +
        0.20 * energy_maintenance_score +
        0.15 * symmetry_score +
        0.10 * L_symmetry_score +
        0.10 * inversion_score +
        0.10 * inversion_depth_score +
        0.10 * tangential_score +
        0.05 * power_score +
        0.00 * drift_score  # informational only — traveling windmills valid in battle
    )

    return {
        "L_consistency":        round(L_consistency_score, 3),
        "energy_maintenance":   round(energy_maintenance_score, 3),
        "lr_contact_symmetry":  round(symmetry_score, 3),
        "lr_L_symmetry":        round(L_symmetry_score, 3),   # L equal on both sides
        "inversion_ratio_score":round(inversion_score, 3),
        "inversion_depth":      round(inversion_depth_score, 3),
        "leg_speed_consistency":round(tangential_score, 3),
        "power_level":          round(power_score, 3),
        "floor_drift_m":        round(total_drift, 3),         # informational
        "n_revolutions":        n_revs,                        # chain length, not scored
        "composite":            round(composite, 3),
    }
```

---

## CRITICAL: LEFT-RIGHT CONSISTENCY (scenario-specific)

The `notes` flag this as primary. Two distinct asymmetries to separate:

**Type A — Contact Duration Asymmetry**: dancer favors one shoulder (spends more time on it)
- Detected by: `|n_left_frames - n_right_frames| / (n_left + n_right)` — target < 0.10
- Physical cause: stronger hip kick on dominant side, or weak contralateral shoulder stability

**Type B — Angular Momentum Asymmetry**: L_barrel is systematically different during left vs right shoulder phases
- Detected by: per-revolution L comparison above (`L_lr_ratio`)
- Physical cause: unequal leg whip power or unequal CoM path on each side
- More subtle than Type A — dancer may *look* symmetric but have hidden asymmetric driving

Both should be reported independently.

---

## JOSH v4 vs GVHMR — EXPECTED ACCURACY DIFFERENCES

| Phase | JOSH v4 (bboy-tuned) | GVHMR (general) |
|-------|---------------------|-----------------|
| BARREL_PHASE (body ~45°, shoulder near floor) | Good — floor-contact training helps | Moderate — monocular depth ambiguous when body nearly horizontal |
| BACK_ROLL_TRANSITION | Moderate — brief bilateral contact hard to isolate | Poor — contact area not modeled, likely predicts "floating" torso |
| INVERSION_PEAK (pelvis overhead) | Good — inversion poses in bboy data | Moderate — non-upright poses uncommon in general HMR training |
| HEAD during near-floor approach | Moderate — head clearance uncertain ± 0.06m | Poor — may report j15.z ≈ 0.0 when head is actually 0.15m above floor |
| Shoulder contact z-values (j16, j17) | ± 0.06–0.10m error (SMPL joint offset from capsule contact) | ± 0.08–0.15m error |

**Key known limitation for ALL HMR models in windmill**: when the body is nearly parallel to the floor (body_tilt > 70° from vertical), monocular z-estimation uncertainty doubles. Treat j16/j17 z-values during contact phases as high-noise. Contact detection confidence should be downweighted here; defer to the Contact agent for ground-truth contact.

---

**Positive**: TRIVIUM v0.1's pelvis height tracking (`j0.z`) directly captures the CoM oscillation pattern — this maps well to the INVERSION_PEAK detection. The existing velocity framework at j10/j11 is the right place to measure leg whip power; only the axis decomposition needs to be extended from vertical (headspin) to barrel-roll.

**Gap**: v0.1 almost certainly assumes a fixed vertical rotation axis (headspin geometry). Windmill needs a **migrating** pivot and a **horizontal** barrel roll axis — the current `L_z` metric is nearly meaningless for windmills. The left-right symmetry check (Type A + Type B above) is entirely absent. The per-revolution energy decay loop requires revolution segmentation that v0.1 does not currently have.
