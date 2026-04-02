# Roadmap

## Current Stage

The project is in Phase 0: architecture definition and implementation setup.

The goal of this roadmap is not to predict every future detail. It is to define the sequence that reduces technical risk fastest.

## Phase 0: Foundations

### Goal

Turn the PRD into an implementation-ready repo structure and make the execution contract explicit.

### Deliverables

- core product and technical docs
- first-pass architecture and responsibility split
- JSON-RPC contract draft
- initial repository structure plan

### Exit Criteria

- the team agrees on the core daemon and bridge model
- Rhino is confirmed as the first host target
- the first development milestones are clear enough to execute without re-litigating the architecture

## Phase 1: Core Daemon + Rhino Hello World

### Goal

Prove end-to-end IPC between a Zig core and a headless Rhino bridge.

### Deliverables

- Zig daemon skeleton
- local transport setup for named pipes or Unix domain sockets
- Rhino bridge process in C# / .NET
- "hello world" JSON-RPC request and response
- bridge health check command

### Exit Criteria

- the core can start, discover, and talk to the Rhino bridge
- the bridge can execute a trivial command and return a structured result
- bridge failure is contained without crashing the core

## Phase 2: Schema-Driven Planning

### Goal

Ground the planner in real Rhino capabilities instead of free-form prompt engineering.

### Deliverables

- `docify` ingestion pipeline
- normalized capability index for Rhino commands
- first planner contract for prompt-to-command mapping
- validation layer for parameter types and required inputs

### Exit Criteria

- a prompt can be translated into a structured Rhino action plan
- the plan is validated against known capability data before execution
- invalid plans fail clearly and early

## Phase 3: Session Memory and Object Identity

### Goal

Make follow-up commands reliable by persisting object references and execution history.

### Deliverables

- SQLite schema for sessions, objects, and command history
- alias resolution for user-facing references
- command logging and undo metadata
- basic sync mechanism between persisted state and bridge-reported state

### Exit Criteria

- the system can reference previously created Rhino objects in a later prompt
- command history is queryable and useful for debugging
- divergent state can be detected and reported

## Phase 4: Multi-Step Rhino Workflows

### Goal

Move beyond single commands into real structured creation tasks.

### Deliverables

- sequenced execution plans
- dependency-aware command ordering
- richer unit handling and formula evaluation in Zig
- confirmation or review step for high-risk geometry deltas

### Exit Criteria

- a non-trivial Rhino workflow executes reliably from one prompt
- geometry-affecting commands can be reviewed before dispatch when needed
- validation catches common precision and type errors

## Phase 5: Additional Hosts

### Goal

Extend the same architecture to Rive and Unreal without compromising the core model.

### Deliverables

- Rive bridge prototype
- Unreal bridge prototype
- multi-host execution planner
- cross-host asset handoff conventions

### Exit Criteria

- at least one prompt successfully triggers actions in two different hosts
- partial failures are reported per host
- the same session model can track cross-host object references

## Phase 6: Hardening

### Goal

Make the system durable enough for serious daily use and broader experimentation.

### Deliverables

- retry and timeout policy
- structured logging and diagnostics
- contract tests for bridges
- benchmark coverage for latency targets
- licensing and environment checks for host dependencies

### Exit Criteria

- average prompt-to-execution-start latency is measured and tracked
- the system fails predictably under missing host, licensing, and schema errors
- the core protocol is stable enough for external tooling or API consumers

## Immediate Next Tasks

1. Initialize the repository structure around the core docs and future implementation directories.
2. Draft the JSON-RPC method naming convention and payload schema.
3. Stand up the Zig daemon skeleton and Rhino bridge stub.
4. Define the SQLite schema for sessions, objects, and command history.

## Risks That Shape Sequencing

- Rhino licensing and headless execution need to be proven early.
- Planner quality depends on good capability ingestion, so `docify` integration cannot be an afterthought.
- Multi-host orchestration should wait until Rhino-first execution is stable.
- Precision checks must be built into the core before the system is trusted for geometry-heavy workflows.
