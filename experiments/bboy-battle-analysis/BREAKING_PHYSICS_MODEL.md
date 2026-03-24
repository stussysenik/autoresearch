# Breaking Physics Model: Forces, Pivots, and Motion Decomposition

**Date**: 2026-03-24
**Status**: Research artifact — defines the physics vocabulary for TRIVIUM power move scoring

---

## What Bboys Pioneered

Breaking is the only dance form where humans systematically explore the full space of body-ground contact configurations while maintaining rotational control. Bboys figured out, through decades of embodied experimentation, how to:

- Generate angular momentum from any body orientation
- Transfer rotation between axes mid-move
- Use friction as both enemy and ally in the same sequence
- Maintain stability through single-point inversions

This document formalizes what the body is doing in physics terms.

---

## Four Categories of Power

### 1. Ground Power (windmills, swipes, halos, backspins)

**The physics**: continuous rotation with a MIGRATING contact surface. The body rolls across the ground, and the pivot point travels along the back/shoulders.

| Property | Value |
|----------|-------|
| **Pivot type** | Migrating — shifts along body surface (shoulder → back → shoulder) |
| **Contact area** | Large (back, shoulders, upper arms) |
| **Primary rotation plane** | Transverse (horizontal). CoM stays at roughly constant height. |
| **Angular momentum source** | Hip kick initiation → leg whip maintains. `L_hips → L_total` |
| **Friction role** | **Enemy** — want to minimize. Smooth floors, nylon clothing reduce drag. |
| **Normal force** | ~body weight, distributed across contact area |
| **Energy loss** | Friction at contact surface + internal muscle damping |
| **Speed control** | Leg extension/contraction → `I` changes → `ω` changes (`L = Iω = const`) |
| **Stability mechanism** | Ground contact over large area provides inherent stability. Hard to "fall" because you're already on the ground. |

**What SMPL should show**: shoulder/back joints tracing a circular path at roughly constant z-height. Hip angular velocity should be high and consistent. Leg extension should correlate inversely with rotation speed.

**Quality signal**: `CV(|L|)` low = clean. `CV(z_CoM)` low = level. Tangential velocity consistent.

---

### 2. Spinning Power (headspins, 1990s, 2000s, finger spins)

**The physics**: rotation around a FIXED single-point pivot. Pure angular momentum conservation with moment of inertia manipulation.

| Property | Value |
|----------|-------|
| **Pivot type** | Fixed single point — top of head, one palm, two palms, fingertip |
| **Contact area** | Tiny (head cap ~50cm², palm ~100cm², fingertip ~2cm²) |
| **Primary rotation plane** | Transverse, around vertical axis |
| **Angular momentum source** | Initial kick builds `L`, then `L = const` (conservation) |
| **Friction role** | **Enemy** — pivot point friction is the only energy drain. Head caps, smooth palms, waxed floors. |
| **Normal force** | Full body weight through a single point (~700N through one hand in a 1990) |
| **Energy loss** | Pivot friction torque `τ_f = μ × N × r_contact` decelerates rotation |
| **Speed control** | **The ice skater effect**: extend legs → `I` increases → `ω` decreases. Tuck legs → `I` decreases → `ω` increases. This is what bboys mastered. |
| **Stability mechanism** | Gyroscopic — spinning body resists tilting (angular momentum vector stays vertical). Core rigidity prevents precession. |

**The ice skater effect in breaking**:
```
L = I × ω = constant (no external torque ideally)

Legs extended:  I_extended ≈ 4.5 kg·m²  →  ω_slow ≈ 2 rev/s
Legs tucked:    I_tucked   ≈ 1.8 kg·m²  →  ω_fast ≈ 5 rev/s
```

A headspin that starts slow with legs wide and accelerates to a blur with legs tucked — that's `I` manipulation in real time. Every bboy learns this intuitively; it's conservation of angular momentum.

**What SMPL should show**: CoM on the rotation axis (zero radial drift). Rotation speed inversely proportional to moment of inertia. Any lateral CoM drift = wobble = technique failure.

**Quality signal**: `|r_CoM - r_pivot|` should be near zero (no drift). `L_z` should be constant. `dω/dI` should follow `ω ∝ 1/I` precisely.

---

### 3. Freeze Power (baby freeze, airchair, hollowback, flag, pike, elbow freeze)

**The physics**: STATICS. Zero velocity is the goal. The art is torque balance against gravity with minimal support.

| Property | Value |
|----------|-------|
| **Pivot type** | Static 1-3 contact points |
| **Contact area** | Small (hand + head, one elbow, one hand) |
| **Primary motion** | Ideally NONE. The art is stillness. |
| **Angular momentum** | Zero (or damped to zero at entry) |
| **Friction role** | **Friend** — prevents sliding. Need GRIP. Chalk, textured floors. |
| **Normal force** | Body weight distributed across support polygon |
| **Energy source** | Muscular isometric contraction opposing gravity torque |
| **Stability mechanism** | CoM must project into support polygon (static equilibrium). For single-point contacts, the friction cone must contain the CoM projection. |

**Torque balance for a baby freeze**:
```
Contact: right hand (ground) + right side of head (ground)
CoM: must be directly above the line connecting hand and head
Torque: gravity × (CoM horizontal offset) must be countered by:
  - Left arm bracing against hip/knee
  - Core isometric contraction
  - Shoulder internal rotation

If |torque_gravity| > |torque_muscular| → rotation begins → fall
```

**The wobble spectrum**: even in a "still" freeze, the body oscillates:
- **Clean freeze**: damped oscillations (amplitude decreasing). The body finds equilibrium.
- **Struggling freeze**: sustained oscillations (constant amplitude). Muscles fighting gravity.
- **Failing freeze**: growing oscillations (amplitude increasing). About to collapse.

This is directly measurable from SMPL: `max(||v_joints||)` over time during the hold.

**What SMPL should show**: all joint velocities < 0.01 m/s for >0.5s. CoM directly above support points. Oscillation amplitude decreasing over time.

**Quality signal**: `max(||v_CoM||)` during hold — lower = cleaner. Duration of hold. Oscillation damping rate.

---

### 4. Air Power (airflares, Thomas flares, air tracks, butterflies)

**The physics**: periodic ballistic flight interrupted by brief hand contacts. Each contact is an impulse that redirects and re-energizes the rotation.

| Property | Value |
|----------|-------|
| **Pivot type** | Alternating — left hand, right hand, left hand... with flight between |
| **Contact area** | Single palm (~100cm²), ~200ms per contact |
| **Primary rotation plane** | Tilted from horizontal — body sweeps in a cone |
| **Angular momentum source** | Hand push-off impulse each cycle + hip rotation |
| **Friction role** | **Friend during contact** (need grip to push off), **irrelevant during flight** |
| **Normal force** | Impulse: N >> body weight during push-off (launch force) |
| **Energy source** | Each hand contact must ADD energy or the move decays. Push up (potential energy) + rotate (kinetic energy). |
| **Stability mechanism** | NONE during flight — purely ballistic. Stability comes from precise hand placement at each landing. |

**The airflare cycle**:
```
Phase 1 — LEFT HAND CONTACT (200ms):
  - Hand hits ground, absorbs impact
  - Push upward (adds potential energy)
  - Push rotationally (adds angular momentum)
  - Body launches into flight

Phase 2 — FLIGHT (300ms):
  - Ballistic trajectory: CoM follows parabola
  - Body rotates freely (L = const)
  - Legs trace a cone in the air
  - Hip rotation controls body orientation for next landing

Phase 3 — RIGHT HAND CONTACT (200ms):
  - Hand hits ground at precisely the right spot
  - Cycle repeats

CoM trajectory: sinusoidal helix
  x(t) = R·cos(ωt)           (circular in horizontal plane)
  y(t) = R·sin(ωt)
  z(t) = z₀ + A·sin(2ωt)     (vertical oscillation at 2× rotation freq)
```

**What SMPL should show**: periodic hand-ground contacts. CoM height oscillating. Angular momentum roughly constant during flight phases, with impulse additions at each contact.

**Quality signal**: consistency of flight height and duration. Hand placement accuracy (how close to the ideal circle). Energy maintenance (does the move sustain or decay?).

---

## The Radial-Tangential-Axial Decomposition

This is the key physics vocabulary for scoring breaking from SMPL data. For any joint, at any moment, its velocity can be decomposed relative to the current rotation:

### Definitions

Given a rotation with:
- **Pivot point** `P` (the current ground contact)
- **Rotation axis** `â` (usually vertical for spinning, body-normal for ground power)
- **Joint position** `r_j`

The radius vector: `R = r_j - P`

Three orthogonal velocity components:

```
v_tangential = (v_j · t̂) × t̂     where t̂ = â × R̂ (tangent to rotation circle)
v_radial     = (v_j · R̂) × R̂     (toward/away from pivot)
v_axial      = (v_j · â) × â       (along rotation axis)
```

### What Each Component Means for Breaking

| Component | Physical Meaning | Good Technique | Bad Technique |
|-----------|-----------------|----------------|---------------|
| **Tangential** | Rotation speed contribution. This IS the power move. | High and consistent | Fluctuating (choppy rotation) |
| **Radial** | Distance from pivot changing. Controls moment of inertia. | Intentional changes (leg extension/contraction for speed control) | Unintentional drift (CoM wandering away from pivot) |
| **Axial** | Movement along the rotation axis. | Near zero for clean horizontal rotation | Non-zero = traveling (windmill drifting across floor) or wobbling (headspin tilting) |

### Per-Category Ideal Profiles

**Ground Power (windmill)**:
```
v_tangential: HIGH, consistent across rotation
v_radial:     LOW, zero mean (not drifting outward)
v_axial:      NEAR ZERO (staying level)
```

**Spinning Power (headspin)**:
```
v_tangential: HIGH (proportional to distance from axis × ω)
v_radial:     INTENTIONAL changes (leg extension/contraction)
v_axial:      ZERO (no vertical bouncing)
```

**Freeze**:
```
v_tangential: ZERO (not rotating)
v_radial:     ZERO (not drifting)
v_axial:      ZERO (not falling)
ALL NEAR ZERO = clean freeze
```

**Air Power (airflare)**:
```
During flight:
  v_tangential: HIGH, from angular momentum
  v_radial:     oscillating (CoM moves in/out as body rotates in cone)
  v_axial:      sinusoidal (up during flight peak, down at hand contact)

During contact:
  v_tangential: maintained or increased (push-off adds rotation)
  v_radial:     briefly zero (hand is the pivot, CoM is at fixed radius)
  v_axial:      reversed (push-off launches body upward)
```

### Scoring with the Decomposition

For each detected power move segment, compute:

```python
# Tangential consistency (higher = cleaner rotation)
tangential_cv = std(v_tangential) / mean(v_tangential)
tangential_score = 1 - clamp01(tangential_cv)

# Axial control (lower = cleaner, no travel/wobble)
axial_ratio = mean(|v_axial|) / mean(|v_tangential|)
axial_score = 1 - clamp01(axial_ratio * 5)  # penalize axial > 20% of tangential

# Radial intentionality (for spinning: should correlate with ω changes)
# For ground power: should be near zero
if move_type == "spinning":
    radial_intentionality = |corr(v_radial, dω/dt)|  # intentional I manipulation
else:
    radial_intentionality = 1 - clamp01(mean(|v_radial|) / mean(|v_tangential|))

# Combined power move quality
power_quality = 0.50 * tangential_score + 0.30 * axial_score + 0.20 * radial_intentionality
```

---

## Contact Signature Model

Every breaking move has a unique contact signature — the pattern of which body parts touch the ground over time:

```
WINDMILL:     [back, L_shoulder, back, R_shoulder, back, L_shoulder, ...]  (migrating)
HEADSPIN:     [head] constant                                               (fixed)
1990:         [R_hand] constant                                             (fixed)
BABY FREEZE:  [R_hand, head] constant                                       (fixed, multi-point)
AIRFLARE:     [L_hand, FLIGHT, R_hand, FLIGHT, L_hand, ...]               (alternating)
BACKSPIN:     [back] constant                                               (fixed, large area)
SWIPE:        [L_hand, R_hand, L_foot, R_foot] rotating sequence           (migrating)
FLARE:        [L_hand, R_hand, L_hand, R_hand, ...] alternating            (alternating, no flight)
```

**Detection from SMPL**: for each joint, compute distance to ground plane (z=0 or estimated floor). If `z_joint < threshold` AND `||v_joint|| < threshold`, that joint is in contact.

```python
def detect_contacts(joints_3d, floor_z=0.0, dist_thresh=0.05, speed_thresh=0.1, fps=30):
    """Detect ground contacts for key body parts."""
    velocities = np.gradient(joints_3d, 1.0/fps, axis=0)
    speed = np.linalg.norm(velocities, axis=-1)

    contact_joints = {
        'left_hand': 22, 'right_hand': 23,
        'left_foot': 10, 'right_foot': 11,
        'head': 15,
        # back approximated by mean of spine joints
    }

    contacts = {}
    for name, idx in contact_joints.items():
        z_dist = joints_3d[:, idx, 2] - floor_z
        is_close = z_dist < dist_thresh
        is_slow = speed[:, idx] < speed_thresh
        contacts[name] = is_close & is_slow  # bool [T]

    # Back contact: mean z of spine1, spine2, spine3 < threshold
    spine_z = np.mean(joints_3d[:, [3, 6, 9], 2], axis=1) - floor_z
    spine_speed = np.mean(speed[:, [3, 6, 9]], axis=1)
    contacts['back'] = (spine_z < dist_thresh * 2) & (spine_speed < speed_thresh * 2)

    return contacts  # dict of bool arrays [T]
```

---

## Friction as a Design Variable

Bboys don't just deal with friction — they **design** their relationship with it:

| Surface/Gear Choice | Friction Effect | Enables |
|---------------------|----------------|---------|
| Smooth linoleum floor | Low friction | Fast windmills, backspins |
| Cardboard on concrete | Medium, consistent | All-purpose practice |
| Head cap (beanie) | Reduces head-ground μ | Faster headspins, head slides |
| Nylon jacket | Reduces back-ground μ | Windmill slide, backspin speed |
| Bare hands on clean floor | High grip | Freeze stability, airflare push-off |
| Chalk/rosin on hands | Maximum grip | One-handed freezes, flag holds |
| Waxed floor | Very low | Power move competitions (speed) |

**For scoring**: friction is an uncontrolled variable in competition (same floor for everyone). But the model should recognize that **move difficulty scales with friction** — a clean 1990 on a sticky floor is harder than on wax. If we know the surface, we can adjust difficulty scores.

---

## How This Maps to SMPL Scoring

For `analyze_motion.py` v0.2, the physics model adds:

1. **Power move category detection**: ground/spinning/freeze/air based on contact signature + angular momentum pattern
2. **Radial-tangential-axial decomposition**: per-joint velocity decomposition relative to detected pivot and rotation axis
3. **Per-category quality metrics**: tangential consistency, axial control, radial intentionality
4. **Contact classification**: which joints are weight-bearing at each frame
5. **Friction-aware scoring**: if surface is known, adjust difficulty estimates
6. **Ice skater detection**: correlate leg extension with rotation speed to score `I` manipulation skill

All computable from `joints_3d [T, 24, 3]` + floor plane estimation.
