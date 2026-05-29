## ADDED Requirements

### Requirement: Semantic Model Inspection
The system SHALL expose the world model to humans in an editable studio surface.

#### Scenario: Inspect generated model
- WHEN a generated application is opened in the studio
- THEN the user can inspect the domain graph, workflows, policies, artifacts, and provenance

### Requirement: Safe Recompile Flow
The studio SHALL support semantic edits followed by controlled recompilation.

#### Scenario: Human adjusts business rules
- WHEN the user changes a policy or workflow in the studio
- THEN the system shows semantic diffs and migration impact before recompiling

### Requirement: Proof Visibility
The studio SHALL surface proof and benchmark status next to generated artifacts.

#### Scenario: Verify a benchmark revision
- WHEN a compile completes
- THEN the studio shows whether proof passed, what failed, and which metrics changed
