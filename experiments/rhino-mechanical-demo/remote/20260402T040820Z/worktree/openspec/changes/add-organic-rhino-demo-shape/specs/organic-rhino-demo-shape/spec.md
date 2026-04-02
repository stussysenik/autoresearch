## ADDED Requirements

### Requirement: The CLI SHALL support a deterministic organic Rhino demo shape
The system SHALL support a deterministic `organic blob` shape so the Rhino demo can show a visibly richer result than engineering primitives alone.

#### Scenario: Plan an organic blob request
- **WHEN** the user requests `create organic blob named pod-a`
- **THEN** the CLI returns a Rhino-targeted create action for an organic blob
- **THEN** the plan uses a fixed deterministic blob recipe instead of free-form generation

#### Scenario: Plan an explicitly sized organic blob request
- **WHEN** the user requests `create organic blob size 1.8m named pod-a`
- **THEN** the CLI returns a Rhino-targeted create action for an organic blob
- **THEN** the plan stores the normalized size in millimeters

### Requirement: The bridge SHALL execute the organic blob as one merged demo form
The system SHALL expose `rhino.geometry.create_organic_blob` so the mock and live Rhino paths remain coherent for the organic demo shape.

#### Scenario: Execute the organic blob in the mock bridge
- **WHEN** a validated organic blob action is dispatched to the mock bridge with a valid `document_id`
- **THEN** the bridge returns a structured success result with a mock host object identifier
- **THEN** the object kind is reported as an organic blob

#### Scenario: Execute the organic blob in live Rhino
- **WHEN** a validated organic blob action is dispatched to the live Rhino path
- **THEN** Rhino creates the shape from the deterministic sphere-cluster recipe
- **THEN** the resulting geometry is persisted as one returned host object identifier

### Requirement: The live Rhino path SHALL frame the organic blob for presentation
The system SHALL adjust the active view after organic blob creation so the result is immediately demo-ready.

#### Scenario: Frame the blob after creation
- **WHEN** the live Rhino bridge completes organic blob creation
- **THEN** the active Rhino view switches to a presentation-friendly perspective view
- **THEN** the view zooms to frame the created blob
- **THEN** the blob remains stored under the requested session alias
