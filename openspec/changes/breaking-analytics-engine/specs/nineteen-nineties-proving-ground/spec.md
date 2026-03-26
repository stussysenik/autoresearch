# 1990s Proving Ground

## ADDED Requirements

### Requirement: Axis of rotation detection

Given a `[T, 24, 3]` skeleton sequence during a spin, detect the dominant axis of rotation by fitting a line through the center-of-mass trajectory and computing the principal axis of the angular momentum vector.

#### Scenario: Vertical spin axis for 1990s
- **WHEN** `detect_rotation_axis(joints_3d)` is called on a 1990s clip
- **THEN** the returned axis vector is within 15 degrees of vertical [0, 1, 0] (since 1990s spin around the vertical axis while inverted on one hand)

### Requirement: Pivot point validation

Verify that the pivot hand (typically right hand) remains approximately stationary during the spin. Compute hand velocity magnitude and flag if it exceeds a threshold.

#### Scenario: Clean 1990s has stable pivot
- **WHEN** `validate_pivot(joints_3d, pivot_joint=RIGHT_WRIST)` is called on a clean 1990s
- **THEN** the pivot stability score is > 0.8 (mean hand velocity < 0.05 m/s during sustained spin)

#### Scenario: Sloppy 1990s detected
- **WHEN** the pivot hand drifts significantly (velocity > 0.2 m/s average)
- **THEN** the pivot stability score drops below 0.5 and a `pivot_drift_warning` flag is set

### Requirement: Spin counting

Count the number of complete revolutions by integrating angular displacement around the rotation axis. Uses the angular velocity of the body (torso + hip joints) projected onto the detected rotation axis.

#### Scenario: Count revolutions accurately
- **WHEN** `count_spins(joints_3d, fps=30)` is called on a 1990s with visually 5 rotations
- **THEN** the returned spin count is between 4.5 and 5.5 (within 0.5 revolutions of ground truth)

#### Scenario: Partial revolution detected
- **WHEN** the dancer completes 3.7 revolutions before stopping
- **THEN** the spin count reports 3.7 (not rounded), with `complete_revolutions=3` and `partial_fraction=0.7`

### Requirement: Moment of inertia profile

Compute I(t) = sum of m_i * r_perp_i^2 for each frame, where r_perp_i is the perpendicular distance of joint i from the rotation axis. This reveals the ice skater effect.

#### Scenario: Leg tuck decreases I
- **WHEN** the dancer tucks legs during a 1990s
- **THEN** I(t) shows a measurable decrease (ratio I_tucked/I_extended < 0.5) at the tuck point

#### Scenario: Conservation check L = I * omega
- **WHEN** L(t) and I(t) * omega(t) are compared during sustained spin
- **THEN** their relative error is < 15% (accounting for friction losses and measurement noise)

### Requirement: Wobble quantification

Measure the center-of-mass distance from the rotation axis over time. Low wobble = high quality. Computed as the perpendicular distance of CoM from the fitted rotation axis.

#### Scenario: Clean spin has low wobble
- **WHEN** `quantify_wobble(joints_3d)` is called on a clean 1990s
- **THEN** the mean wobble distance is < 0.1m and the wobble coefficient of variation is < 0.3

### Requirement: Entry and exit analysis

Analyze the initiation phase (angular acceleration to reach spin speed) and the exit phase (controlled deceleration). Compute entry torque and exit control scores.

#### Scenario: Powerful entry detected
- **WHEN** the angular acceleration during the first 0.5 seconds exceeds 10 rad/s^2
- **THEN** the entry_torque score is > 0.8 (strong initiation)

#### Scenario: Controlled exit scored
- **WHEN** the dancer decelerates smoothly (monotonically decreasing omega) over the last 1 second
- **THEN** the exit_control score is > 0.7 (controlled landing, not a crash)

### Requirement: Leg extension timing

Track the mean radial distance of leg joints (hips, knees, ankles) from the rotation axis over time to detect tuck/extend transitions for speed control.

#### Scenario: Detect ice skater tuck event
- **WHEN** leg radius drops by > 30% within 0.3 seconds
- **THEN** a `tuck_event` is recorded with timestamp, and angular velocity should increase proportionally

### Requirement: 1990s MoveSignature

Produce a complete MoveSignature for a 1990s clip, including all standard fields plus rotation-specific extensions: rotation_count, moment_of_inertia_profile, pivot_stability, angular_velocity_consistency, entry_torque, exit_control.

#### Scenario: Full signature extraction
- **WHEN** `extract_signature(joints_3d, fps=30, move_type="power")` is called on a 1990s clip
- **THEN** the returned MoveSignature has all standard fields populated AND the rotation extension fields are non-null

#### Scenario: Signature distinguishes 1990s from windmill
- **WHEN** signatures are extracted for a 1990s and a windmill
- **THEN** `move_distance(sig_1990s, sig_windmill) > 0.5` — they are clearly different power moves
