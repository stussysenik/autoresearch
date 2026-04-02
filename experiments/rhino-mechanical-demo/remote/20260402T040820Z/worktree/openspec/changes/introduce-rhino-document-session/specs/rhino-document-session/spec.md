## ADDED Requirements

### Requirement: The core SHALL execute Rhino geometry inside an explicit document context
The system SHALL resolve a Rhino document before dispatching geometry methods. Geometry execution requests SHALL include a `document_id`, and the bridge SHALL reject geometry requests that omit or reference an unknown document.

#### Scenario: Create flow opens a headless document when none is active
- **WHEN** the user runs a supported create command in a session without an active Rhino document
- **THEN** the core opens a headless Rhino document before geometry dispatch
- **THEN** the geometry request includes the returned `document_id`
- **THEN** the active document metadata is persisted for that CLI session

#### Scenario: Move flow uses the active document context
- **WHEN** the user runs a supported move command for an alias in a session with an active Rhino document
- **THEN** the core validates the active document before geometry dispatch
- **THEN** the move request includes the active `document_id`

#### Scenario: Bridge rejects geometry without document context
- **WHEN** a geometry request reaches the bridge without a `document_id` or with a stale `document_id`
- **THEN** the bridge returns a structured execution error
- **THEN** the CLI does not print a fake success result

### Requirement: The bridge SHALL expose document lifecycle methods
The Rhino bridge SHALL support `rhino.document.open_headless`, `rhino.document.describe`, and `rhino.document.close`.

#### Scenario: Open headless returns document metadata
- **WHEN** the core sends `rhino.document.open_headless`
- **THEN** the bridge returns document metadata including `document_id`, `unit_system`, `model_tolerance_mm`, `headless`, and optional `document_path`

#### Scenario: Describe returns the current document metadata
- **WHEN** the core sends `rhino.document.describe` with a known `document_id`
- **THEN** the bridge returns the current metadata for that document

#### Scenario: Close removes the active document
- **WHEN** the core sends `rhino.document.close` for the active document
- **THEN** the bridge confirms the document close in a success envelope
- **THEN** later describe or geometry requests for that `document_id` fail

### Requirement: The session store SHALL persist the active document and scope aliases to it
The system SHALL persist active-document metadata per CLI session and SHALL associate stored aliases with the document that created them.

#### Scenario: Stored aliases are scoped to their document
- **WHEN** a create command succeeds in an active document
- **THEN** the alias record is stored with that document identifier
- **THEN** follow-up commands can validate that the alias and active document still match

#### Scenario: Explicit close clears document-scoped aliases
- **WHEN** the user closes the active document through the CLI
- **THEN** the active document record is removed from the session store
- **THEN** aliases scoped to that document are cleared from the active session

### Requirement: The CLI SHALL expose active document inspection and close behavior
The system SHALL surface active document metadata in session inspection and SHALL allow the user to close the active document explicitly.

#### Scenario: Session inspection shows active document details
- **WHEN** the user runs `session show` for a session with an active document
- **THEN** the CLI prints the active `document_id`
- **THEN** the CLI prints the stored unit system, model tolerance, and headless status

#### Scenario: Document close fails clearly when no active document exists
- **WHEN** the user runs `document close` for a session without an active document
- **THEN** the CLI exits with a clear document-specific error
- **THEN** no bridge close request is sent

#### Scenario: Move fails on mismatched document context
- **WHEN** the user runs a move command for an alias whose stored `document_id` does not match the active document
- **THEN** the CLI exits with a clear document-mismatch error
- **THEN** the bridge does not execute the move
