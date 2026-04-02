## ADDED Requirements

### Requirement: Ordered MPC Live II layer sequence
The system SHALL define and verify an exact chronological Rhino layer sequence for the staged MPC Live II reconstruction demo.

#### Scenario: Use the canonical ordered layers
- **WHEN** the MPC Live II panel demo is generated or evaluated
- **THEN** the system SHALL use the exact ordered layer names `MPCLiveII::01_Sources`, `MPCLiveII::02_Envelope`, `MPCLiveII::03_Anchors`, `MPCLiveII::04_ButtonFamily`, `MPCLiveII::05_Cap2D`, `MPCLiveII::06_Cap3D`, `MPCLiveII::07_Mesh`, and `MPCLiveII::08_Export`
- **THEN** the evaluator SHALL treat missing names as a failed chronological-layer check

### Requirement: Layer names reflect stage semantics
The system SHALL keep the chronological layers mechanically legible so a human observer can understand the reconstruction order directly from the Rhino layer tree.

#### Scenario: Present a chronological live build
- **WHEN** the panel demo finishes successfully
- **THEN** the layer sequence SHALL progress from source anchors to export output without decorative or ambiguous stage names
- **THEN** the ordered layer contract SHALL stay aligned with the experiment instructions used by the autoresearch loop
