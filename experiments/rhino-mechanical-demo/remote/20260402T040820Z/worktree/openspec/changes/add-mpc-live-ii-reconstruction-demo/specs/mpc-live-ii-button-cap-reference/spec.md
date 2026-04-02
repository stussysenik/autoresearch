## ADDED Requirements

### Requirement: MPC Live II reference button-cap reconstruction
The system SHALL support creating an MPC Live II reference button-cap model in Rhino for a named control family and SHALL keep the generated object exportable as a 3D artifact.

#### Scenario: Create a reference transport cap
- **WHEN** the operator runs a prompt for an MPC Live II button-cap reference model
- **THEN** the system SHALL create the cap geometry in the active Rhino demo document
- **THEN** the system SHALL preserve the requested alias for later session lookup
- **THEN** the system SHALL return an export path for the generated cap artifact when export succeeds

### Requirement: Button-cap provenance classification
The system SHALL distinguish official MPC Live II source data from calibrated or inferred button-cap geometry so the demo does not present unsupported features as exact.

#### Scenario: Report sourced versus inferred geometry
- **WHEN** a button-cap reference model completes successfully
- **THEN** the system SHALL identify which device facts came from official Akai documentation
- **THEN** the system SHALL label cap-surface features that are not directly documented as calibrated or inferred
- **THEN** the system SHALL keep that provenance visible in demo outputs or result metadata
