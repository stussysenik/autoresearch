## ADDED Requirements

### Requirement: The system SHALL bootstrap a local SQLite session store automatically
The CLI SHALL create the local SQLite database and required tables on first use so the prototype can run without a manual database setup step.

#### Scenario: First run initializes the database
- **WHEN** the user runs the CLI for the first time
- **THEN** the session database file is created automatically
- **THEN** the required schema for sessions, objects, and command history exists before execution continues

### Requirement: Successful executions SHALL be persisted to session history
The system SHALL persist each successful command execution with the session identifier, original prompt, normalized plan payload, and bridge result payload.

#### Scenario: Persist a successful create command
- **WHEN** a create command succeeds
- **THEN** the command history includes the original prompt
- **THEN** the command history includes the normalized action payload
- **THEN** the command history includes the returned host object identifier

### Requirement: Named host objects SHALL be resolvable across commands in the same session
When a successful execution returns an aliased host object, the system SHALL persist the alias mapping so later commands in the same session can resolve that alias deterministically.

#### Scenario: Resolve a previously created alias in a follow-up command
- **WHEN** the user first creates an object named `staircase`
- **AND** the user later requests `move staircase 500mm left` in the same session
- **THEN** the CLI resolves `staircase` to the previously stored host object identifier
- **THEN** the move request is dispatched using the resolved identifier instead of a raw text alias

#### Scenario: Report missing aliases clearly
- **WHEN** the user requests an operation on an alias that does not exist in the active session
- **THEN** the CLI exits with a clear alias resolution error
- **THEN** no bridge request is sent
