## ADDED Requirements

### Requirement: Adapter Boundary
The system SHALL define a runtime adapter interface that isolates semantic compilation from storage/runtime implementation details.

#### Scenario: Compile against different substrates
- WHEN the same semantic model targets different runtime adapters
- THEN each adapter receives the same abstract artifact contract for schema, functions, jobs, policies, and reactive queries

### Requirement: Convex-First Execution
The first runtime adapter SHALL support a Convex-backed application slice.

#### Scenario: First benchmark target
- WHEN the first benchmark app is compiled for execution
- THEN the system can emit and run a Convex-backed version with schema, functions, policies, and reactive views

### Requirement: Analytics and Evaluation Outputs
The adapter system SHALL support analysis-oriented outputs separate from transactional execution.

#### Scenario: Benchmark introspection
- WHEN the harness needs offline analysis of benchmark revisions
- THEN the system can emit or export data suitable for DuckDB-class evaluation workflows
