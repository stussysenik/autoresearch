## ADDED Requirements

### Requirement: The system SHALL create a deterministic set of basic solids in a real Rhino document
The system SHALL create cube, sphere, and cylinder geometry in a real Rhino document for the early live demo path.

#### Scenario: Create a sphere in real Rhino
- **WHEN** the user runs `run --profile rhino-inside --prompt "create sphere radius 1m named ball-a"`
- **THEN** the CLI dispatches method `rhino.geometry.create_sphere` to the real Rhino demo bridge
- **THEN** the bridge creates the sphere in the session document
- **THEN** the CLI prints a structured success result with a returned host object identifier

#### Scenario: Create a cylinder in real Rhino
- **WHEN** the user runs `run --profile rhino-inside --prompt "create cylinder radius 500mm height 2m named column-a"`
- **THEN** the CLI dispatches method `rhino.geometry.create_cylinder` to the real Rhino demo bridge
- **THEN** the bridge creates the cylinder in the session document
- **THEN** the created object can be persisted under the active session alias

#### Scenario: Reuse the active real Rhino document
- **WHEN** the active session already has a stored real Rhino `document_id`
- **THEN** a later cube, sphere, or cylinder creation reuses the same `document_id`
- **THEN** the bridge updates the same underlying `.3dm` document instead of creating a new session document
