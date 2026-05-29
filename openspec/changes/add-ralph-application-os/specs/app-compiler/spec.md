## ADDED Requirements

### Requirement: Deterministic Compilation
The system SHALL compile the semantic model through deterministic passes after IR materialization.

#### Scenario: Repeatable compile output
- WHEN the same semantic model is compiled twice against the same adapter and configuration
- THEN the emitted artifacts are semantically identical

### Requirement: Multi-Artifact Lowering
The compiler SHALL lower a semantic model into multiple artifact classes, not just storage definitions.

#### Scenario: Generate a runnable application slice
- WHEN a benchmark app is compiled
- THEN the compiler emits schema/storage plans, backend functions, policies, workflows, views, and agent-tool definitions

### Requirement: Migration Diffing
The compiler SHALL generate semantic and runtime migration diffs between model revisions.

#### Scenario: Workflow rule changes after app generation
- WHEN a user changes a workflow threshold or permission rule
- THEN the compiler produces a diff describing semantic changes and required runtime migrations
