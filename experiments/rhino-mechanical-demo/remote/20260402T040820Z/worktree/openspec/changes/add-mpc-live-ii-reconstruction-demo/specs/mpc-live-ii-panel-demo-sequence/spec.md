## ADDED Requirements

### Requirement: MPC Live II staged panel reconstruction demo
The system SHALL support a staged MPC Live II top-panel reconstruction flow that presents checkpoint geometry live in Rhino instead of only producing a final object.

#### Scenario: Build the staged panel demo
- **WHEN** the operator runs a prompt for an MPC Live II panel reconstruction demo
- **THEN** the system SHALL create checkpointed geometry for the device envelope, control anchors, target button family, and cap reconstruction
- **THEN** the system SHALL keep those checkpoints separated with named layers or equivalent grouping
- **THEN** the system SHALL transition from a 2D calibration-oriented view to a 3D presentation-oriented view before completion

### Requirement: Demo-ready panel presentation
The system SHALL leave the MPC Live II panel demo in a presentation-ready state for live viewing and follow-up export.

#### Scenario: Finish in a demo-ready state
- **WHEN** the staged panel reconstruction completes successfully
- **THEN** the system SHALL frame the reconstructed area in a perspective viewport
- **THEN** the system SHALL use a shaded or rendered display mode for the final view
- **THEN** the system SHALL make the highlighted cap or final artifact exportable as STL
