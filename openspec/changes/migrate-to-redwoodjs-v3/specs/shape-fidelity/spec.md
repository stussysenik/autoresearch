## ADDED Requirements

### Requirement: 128-Point Heart Parametric Curve

The heart parametric curve template SHALL use 128 control points, increased from the previous 64 control points. This higher resolution MUST provide smoother curves and better capture the heart shape's curvature details.

#### Scenario: Heart shape scores at least 90%

WHEN a heart-shaped GhostRoute is generated using the 128-point parametric template
AND the route is validated against the target shape
THEN the composite shape fidelity score SHALL be greater than or equal to 90%

### Requirement: Curvature-Adaptive Densification

The densification algorithm SHALL adapt waypoint spacing based on local curvature of the target shape:
- High curvature (angle > 30 degrees): waypoints spaced at 40m intervals
- Medium curvature (angle 10-30 degrees): waypoints spaced at 80m intervals
- Low curvature (angle < 10 degrees): waypoints spaced at 120m intervals

This approach MUST produce fewer total waypoints than uniform densification while maintaining equivalent or better shape fidelity.

#### Scenario: Curvature-adaptive produces fewer total waypoints than uniform

WHEN the same heart shape is densified using both uniform spacing (60m) and curvature-adaptive spacing
THEN the curvature-adaptive method SHALL produce fewer total waypoints
AND the curvature-adaptive method SHALL achieve a shape fidelity score greater than or equal to the uniform method

### Requirement: Post-Routing Shape Correction

After initial routing, the system SHALL perform a shape correction pass:
1. Identify the waypoints where the routed path deviates most from the target shape
2. Insert additional control points at those worst-deviating locations
3. Re-route only the affected segments (not the entire route)

This correction MUST improve the overall shape fidelity score.

#### Scenario: Post-routing correction improves score by at least 3%

WHEN a routed shape undergoes post-routing correction
THEN the corrected shape fidelity score SHALL be at least 3 percentage points higher than the pre-correction score
AND only the segments around the worst-deviating waypoints SHALL be re-routed

### Requirement: Validation Scoring Formula Preserved

The composite shape fidelity score SHALL be computed using the following weighted formula:
- 55% Modified Hausdorff Distance
- 35% Ordered Sampling Distance
- 10% Raster IoU (Intersection over Union)

These weights MUST NOT be changed without a new proposal.

#### Scenario: Scoring formula weights are applied correctly

WHEN a shape fidelity score is computed
THEN the Modified Hausdorff component SHALL contribute 55% of the total score
AND the Ordered Sampling component SHALL contribute 35% of the total score
AND the Raster IoU component SHALL contribute 10% of the total score

### Requirement: Shape-Specific Acceptance Thresholds

Each shape type SHALL have a minimum acceptance threshold:
- Heart: greater than or equal to 90%
- Star: greater than or equal to 85%
- Circle: greater than or equal to 88%

Routes failing their shape's threshold MUST be flagged for regeneration or correction.

#### Scenario: Shape thresholds are enforced

WHEN a generated GhostRoute is validated
THEN a heart route scoring below 90% SHALL be rejected
AND a star route scoring below 85% SHALL be rejected
AND a circle route scoring below 88% SHALL be rejected

### Requirement: Google Routes API Calibration

The densification and deduplication parameters SHALL be calibrated against 5 canonical test shapes using the Google Routes API. Calibration MUST ensure that the Google Routes API's walking-mode street snapping produces results meeting the acceptance thresholds.

#### Scenario: Parallel routing completes in under 5 seconds

WHEN a shape route with chunked parallel requests is generated via the Google Routes API
THEN the total routing time (wall-clock) SHALL be less than 5 seconds
AND the resulting route SHALL meet the shape-specific acceptance threshold
