## ADDED Requirements

### Requirement: The CLI SHALL support a small deterministic set of basic Rhino solids
The system SHALL support deterministic planning and execution for cube, sphere, and cylinder creation requests in the early demo surface.

#### Scenario: Plan a sphere creation request
- **WHEN** the user requests `create sphere radius 1m named ball-a`
- **THEN** the CLI returns a Rhino-targeted create action for a sphere
- **THEN** the plan stores the radius in normalized millimeters

#### Scenario: Plan a cylinder creation request
- **WHEN** the user requests `create cylinder radius 500mm height 2m named column-a`
- **THEN** the CLI returns a Rhino-targeted create action for a cylinder
- **THEN** the plan stores both radius and height in normalized millimeters

### Requirement: The Rhino bridge contract SHALL expose sphere and cylinder creation methods
The system SHALL support `rhino.geometry.create_sphere` and `rhino.geometry.create_cylinder` through the same document-scoped JSON-RPC contract as existing geometry creation methods.

#### Scenario: Execute a sphere create command
- **WHEN** a validated sphere action is dispatched to an available Rhino bridge with a valid `document_id`
- **THEN** the bridge receives method `rhino.geometry.create_sphere`
- **THEN** the CLI prints a structured success result with returned host object identifiers

#### Scenario: Execute a cylinder create command
- **WHEN** a validated cylinder action is dispatched to an available Rhino bridge with a valid `document_id`
- **THEN** the bridge receives method `rhino.geometry.create_cylinder`
- **THEN** the CLI prints a structured success result with returned host object identifiers
