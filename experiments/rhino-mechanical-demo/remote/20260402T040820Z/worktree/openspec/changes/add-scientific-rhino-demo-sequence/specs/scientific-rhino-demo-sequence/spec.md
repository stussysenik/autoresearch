## ADDED Requirements

### Requirement: Deterministic Scientific Shell Planning

The CLI SHALL support a deterministic scientific-shell demo action for Rhino.

#### Scenario: Plan a scientific shell request

- **WHEN** the user runs `create scientific shell size 2m named shell-a`
- **THEN** the CLI returns a Rhino-targeted create action
- **AND** the action kind is `create_scientific_shell`
- **AND** the plan uses a deterministic shell recipe rather than unconstrained generation

### Requirement: Staged Live Rhino Demo Sequence

The live Rhino bridge SHALL create the scientific shell through visible ordered stages.

#### Scenario: Build the shell from 2D to 3D

- **WHEN** a valid scientific-shell action is dispatched to the live Rhino path
- **THEN** Rhino first draws 2D guide geometry
- **AND** Rhino then lifts section profiles into 3D
- **AND** Rhino lofts and caps the final shell form
- **AND** the CLI returns a structured success result with a host object identifier

### Requirement: Mesh Presentation And Export

The live scientific demo SHALL generate an exportable mesh artifact.

#### Scenario: Mesh and export the final shell

- **WHEN** the scientific shell finishes building
- **THEN** Rhino generates a mesh from the final brep
- **AND** Rhino frames the result in a presentation-friendly view
- **AND** Rhino exports an STL artifact to the configured scratch workspace

### Requirement: Session Persistence For The Demo

The CLI SHALL persist the scientific-shell alias in the active session.

#### Scenario: Persist alias after a live shell run

- **WHEN** the shell is created with `named shell-a`
- **THEN** the session stores the returned object under alias `shell-a`
- **AND** the active document remains associated with the session for follow-up demo steps
