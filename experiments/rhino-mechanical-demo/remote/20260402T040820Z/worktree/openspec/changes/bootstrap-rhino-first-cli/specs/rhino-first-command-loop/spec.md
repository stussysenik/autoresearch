## ADDED Requirements

### Requirement: The CLI SHALL turn supported natural-language Rhino prompts into deterministic execution plans
The system SHALL accept a prompt string and produce a typed Rhino-targeted plan for the supported prototype command set. The initial supported command set SHALL include creating a cube, creating a spiral staircase, and moving an existing named object.

#### Scenario: Plan a staircase creation request
- **WHEN** the user requests `spiral staircase, 10 steps, 3m tall`
- **THEN** the CLI returns a plan that targets the Rhino host
- **THEN** the plan contains a typed action for staircase creation
- **THEN** the numeric parameters are normalized into deterministic fields rather than left as free-form text

#### Scenario: Plan a move request for an existing alias
- **WHEN** the user requests `move staircase 500mm left`
- **THEN** the CLI returns a plan that targets the Rhino host
- **THEN** the plan contains a typed translation action
- **THEN** the plan references the named object alias `staircase`

### Requirement: The core SHALL validate and normalize supported inputs before bridge dispatch
The system SHALL validate supported prompt shapes, normalize metric units to millimeters, and reject unsupported or ambiguous prompts before sending any JSON-RPC request to a bridge.

#### Scenario: Normalize metric inputs before execution
- **WHEN** the user requests `create cube size 2m named block-a`
- **THEN** the validated plan stores the cube size as `2000` millimeters
- **THEN** the resulting JSON-RPC payload contains normalized numeric parameters

#### Scenario: Reject unsupported prompts before dispatch
- **WHEN** the user submits a prompt outside the supported prototype command set
- **THEN** the CLI exits with a clear validation error
- **THEN** no bridge request is sent

### Requirement: The core SHALL dispatch validated plans through a JSON-RPC bridge contract
The system SHALL convert validated actions into JSON-RPC 2.0 requests and send them to a Rhino bridge endpoint. The CLI SHALL report structured success and failure information from the bridge.

#### Scenario: Execute a supported create command
- **WHEN** a validated create action is dispatched to an available Rhino bridge
- **THEN** the bridge receives a JSON-RPC request with a Rhino-scoped method name
- **THEN** the CLI prints a success result including returned host object identifiers

#### Scenario: Surface bridge unavailability clearly
- **WHEN** the bridge endpoint is unavailable
- **THEN** the CLI exits with an execution error that identifies the transport failure
- **THEN** the session store is not updated with fake success data
