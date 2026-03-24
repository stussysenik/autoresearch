# Breaking Kinetic Chain: A Biomechanical Model for Scoring

**Date**: 2026-03-24
**Status**: Research artifact — informs TRIVIUM v0.2 scoring weights and fine-tuning strategy

---

## Core Thesis: Breaking is a Hip-Driven, Inversion-Based Art Form

Breaking inverts the normal human kinematic hierarchy. In everyday movement, feet are the foundation, hands are expressive endpoints, and the head stays on top. In breaking:

- **Hands become load-bearing foundations** (freezes, power moves, airflares)
- **Head becomes a structural pivot** (headspins, head slides)
- **Legs become the expressive layer** (windmill leg shape, kick extensions, catches)
- **Hips are the engine** — always — generating angular momentum that everything else rides

No existing human mesh recovery model has been trained on this inverted configuration.

---

## The Three-Layer Model

### Layer 1: ENGINE (generates movement)

| Body Part | SMPL Joints | Role in Breaking | Priority |
|-----------|------------|------------------|----------|
| **Hips** | pelvis(0), left_hip(1), right_hip(2) | Angular momentum generator. Windmills, flares, toprock — all hip-initiated. The hip rotation speed and range defines the move's power. | **Critical** |
| **Core/Abs** | spine1(3), spine2(6), spine3(9) | Power transmission between upper and lower body. Controls transition quality. Tight core = clean movement, loose core = sloppy. The "transmission" between hip engine and everything else. | **Critical** |
| **Shoulders** | left_shoulder(16), right_shoulder(17), collars(13,14) | Secondary engine for upper body power moves. Shoulder freezes, swipes, flare shoulder rotation. Takes over from hips in certain moves. | **High** |

**Key metric**: Angular momentum magnitude at hips. For power moves, `|L_hips|` should be high and conserved (`CV(|L|)` low = clean rotation).

### Layer 2: FOUNDATION (holds you up)

| Body Part | SMPL Joints | Role in Breaking | Priority |
|-----------|------------|------------------|----------|
| **Hands** | left_wrist(20), right_wrist(21), left_hand(22), right_hand(23) | Weight-bearing in freezes and power moves. Palm angle, finger spread, wrist alignment determine freeze quality. SMPL sees one point per hand — misses grip detail. | **Critical** |
| **Head** | neck(12), head(15) | Structural pivot in headspins and head-based power moves. Head-ground contact angle and stability define headspin quality. | **High** |
| **Feet** | left_ankle(7), right_ankle(8), left_foot(10), right_foot(11) | Foundation in upright phases (toprock, footwork). Toe placement, weight distribution, push-off dynamics. | **High** |

**Key metric**: Contact classification — WHICH body parts are load-bearing at each frame. This is THE distinguishing feature of breaking vs other dance forms.

### Layer 3: EXPRESSION (what judges see)

| Body Part | SMPL Joints | Role in Breaking | Priority |
|-----------|------------|------------------|----------|
| **Legs** | left_knee(4), right_knee(5) + hip/ankle joints | Shape and extension during power moves. Leg catches, kick-outs, windmill leg position. The "melody" played on top of the hip engine. | **Medium** |
| **Arms** | left_elbow(18), right_elbow(19) + shoulder/wrist joints | Threading through legs in footwork, gestures during toprock, "calling out" the opponent. Flavor and style. | **Medium** |

**Key metric**: Distal expressivity — the ratio of hand+foot+head velocity to torso+hip velocity. Higher ratio during expression phases = more dynamic.

---

## Transitions: Where Core/Abs Become Critical

The quality of transitions between phases is a primary judging criterion. Each transition is mediated by core control:

| Transition | What Core Does | Quality Signal |
|-----------|---------------|----------------|
| **Toprock → drop** | Abs eccentrically control the descent. Hips drop, abs absorb. | Smooth deceleration of CoM, no impact spike |
| **Footwork → freeze** | Core contracts to pull legs in. Shoulders shift to stack weight over hand. | Low jerk at the moment of stacking |
| **Power → power** (windmill → flare) | Hip-to-shoulder momentum transfer through core. | Angular momentum conservation across the transition |
| **Freeze → exit** | Core releases stored tension. Hips restart rotation. | Controlled release, not a collapse. Low wobble → clean exit. |
| **Any → power move entry** | Core pre-loads rotation. Hip tilt initiates angular momentum. | Rising `|L|` through the transition, not a sudden spike |

**SMPL coverage**: spine1(3) → spine2(6) → spine3(9) gives 3 rigid segments. Real core engagement is continuous. The difference between a tight core hold and a loose one is subtle curvature that 3 joints approximate but can't fully resolve.

**Scoring implication**: Transition quality should be measured as:
- Jerk at transition boundaries (lower = cleaner)
- Angular momentum continuity across phase changes
- CoM deceleration profile (smooth sigmoid vs impact spike)

---

## SMPL Joint Priority Ranking for Breaking

Based on the kinetic chain analysis, here is the importance ranking for breaking specifically:

| Rank | Joints | Why | Current TRIVIUM Weight | Recommended Weight |
|------|--------|-----|----------------------|-------------------|
| 1 | **pelvis(0), hips(1,2)** | The engine. Everything starts here. | Mass-based (0.10, 0.06, 0.06) | **Increase**: 0.15, 0.08, 0.08 |
| 2 | **spine1-3(3,6,9)** | Core transmission. Transition quality. | Mass-based (0.05, 0.03, 0.04) | **Increase**: 0.08, 0.05, 0.06 |
| 3 | **hands/wrists(20-23)** | Foundation when inverted. | Mass-based (0.01 each) | **Increase**: 0.04 each |
| 4 | **head/neck(12,15)** | Pivot point. | Mass-based (0.02, 0.04) | **Increase**: 0.04, 0.06 |
| 5 | **shoulders(16,17)** | Secondary engine. | Mass-based (0.03 each) | Keep: 0.03 each |
| 6 | **ankles/feet(7,8,10,11)** | Foundation when upright. | Mass-based (0.01-0.02) | Keep |
| 7 | **knees(4,5), elbows(18,19)** | Expression. | Mass-based (0.02-0.05) | **Decrease slightly** |
| 8 | **collars(13,14)** | Minimal independent motion in breaking. | Mass-based (0.01 each) | **Decrease**: 0.005 each |

**Phase-dependent weighting**: these weights should shift based on the detected phase:
- **Toprock**: increase feet, decrease hands
- **Footwork**: increase hips + feet, decrease arms
- **Power moves**: increase hips + core, increase hands (foundation)
- **Freezes**: increase hands + head (foundation), decrease legs (held still)

---

## What SMPL Misses for Breaking

| Gap | Impact | Mitigation |
|-----|--------|------------|
| **Hand detail** (palm angle, finger spread, grip type) | Can't score freeze hand placement quality | Extend to SMPL-X/MANO for v0.2, or use contact heuristics |
| **Continuous spine** (only 3 rigid segments) | Misses core engagement quality (tight vs loose) | Use jerk of spine chain as proxy for core control |
| **Toe joints** (one "foot" point) | Misses toe stands, toe spins, push-off dynamics | Approximate from ankle angle + foot-ground distance |
| **Contact classification** (which parts touch ground) | THE critical missing signal for breaking | JOSH models contact constraints — verify it detects hand-ground and head-ground contacts |
| **Clothing/hair** | Judges see windmill with locked dreads differently than loose — affects perceived rotation speed | Out of scope for skeleton-based scoring |

---

## Fine-Tuning Strategy

The key insight: **the fine-tuning signal is contact classification, not more joints.**

A model that correctly identifies "this hand is bearing the full body weight" vs "this hand is gesturing" would solve 80% of the breaking-specific gap. This is a classification problem on top of the existing SMPL output:

```
For each frame, for each of {left_hand, right_hand, head, left_foot, right_foot}:
  contact_state ∈ {free, touching, weight-bearing}
```

JOSH already models human-scene contact. Fine-tuning JOSH on 50-100 breaking clips with contact annotations would give us this. Runs on T4 (16GB).

---

## Implications for TRIVIUM v0.2

1. **Replace mass-based joint weights** with the breaking-specific priority table above
2. **Add phase-dependent weighting** — weights shift based on toprock/footwork/power/freeze classification
3. **Add transition quality score** — jerk at phase boundaries + angular momentum continuity
4. **Add contact-aware scoring** — freeze quality based on which body parts are load-bearing and how stable they are
5. **Core engagement proxy** — spine chain jerk as a measure of core control quality
6. **Hip dominance metric** — what percentage of total angular momentum originates from hip rotation (higher = more efficient technique)
