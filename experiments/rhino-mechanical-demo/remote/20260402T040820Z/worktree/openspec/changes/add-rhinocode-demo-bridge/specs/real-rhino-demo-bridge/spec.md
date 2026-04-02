## ADDED Requirements

### Requirement: The CLI SHALL provide a real Rhino demo bridge through the existing real-Rhino profile
The system SHALL allow the existing `rhino-inside` bridge profile to target a real Rhino-backed demo bridge without changing the mock bridge behavior.

#### Scenario: Start and inspect the real Rhino demo bridge
- **WHEN** the user starts the real bridge server and runs `bridge status --profile rhino-inside`
- **THEN** the CLI reports a reachable runtime descriptor for the real Rhino demo bridge
- **THEN** the runtime descriptor identifies the supported document and basic-solid methods for that bridge

#### Scenario: Preserve the mock bridge path
- **WHEN** the user runs bridge-facing commands with `--profile mock-rhino`
- **THEN** the CLI continues to use the existing mock bridge behavior
- **THEN** the real Rhino demo bridge does not change the mock runtime contract

### Requirement: The real Rhino demo bridge SHALL be aware of already-open Rhino instances
The system SHALL inspect running Rhino instances before attempting a live-Rhino launch so it can avoid stomping an active user session or creating ambiguous duplicate app instances.

#### Scenario: Reuse a known safe Rhino instance
- **WHEN** the bridge discovers exactly one compatible Rhino instance for the active session
- **THEN** the bridge reuses that instance instead of launching another Rhino process
- **THEN** the runtime response identifies the selected Rhino instance for diagnostics

#### Scenario: Fail clearly on ambiguous instance state
- **WHEN** the bridge discovers multiple running Rhino instances and cannot safely determine which one to use
- **THEN** the bridge returns a structured error instead of launching another Rhino instance
- **THEN** the error explains that instance selection must be resolved before live execution continues

### Requirement: The real Rhino demo bridge SHALL manage a document-scoped session
The system SHALL expose `rhino.document.open_headless`, `rhino.document.describe`, and `rhino.document.close` for the real Rhino demo bridge even if the implementation uses a visible Rhino application window under the hood.

#### Scenario: Open a real Rhino-backed session document
- **WHEN** the core requests `rhino.document.open_headless`
- **THEN** the bridge returns a stable `document_id`
- **THEN** the bridge associates that `document_id` with a deterministic `.3dm` path for the active session

#### Scenario: Describe an existing real Rhino-backed session document
- **WHEN** the core requests `rhino.document.describe` with a known `document_id`
- **THEN** the bridge returns the stored document metadata including `document_path`
- **THEN** the reported unit system remains millimeters for the demo bridge
