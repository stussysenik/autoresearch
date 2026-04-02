## Context

The repository currently contains only product and architecture documents. The first implementation needs to prove the main system model under local development constraints: Zig is available, SQLite is available, but Rhino and the .NET bridge runtime are not present in this environment.

That means the design should preserve the intended production architecture while using a local mock bridge so the command loop can be executed and tested immediately.

## Goals / Non-Goals

**Goals:**
- Create a runnable Zig CLI prototype that accepts prompts and emits deterministic plans
- Preserve the planned architecture by keeping planning, session state, and bridge execution separate
- Use a real JSON-RPC transport boundary instead of an in-process mock
- Persist command and object state in SQLite so follow-up commands can work
- Make the first prototype easy to inspect, debug, and extend

**Non-Goals:**
- Real RhinoCommon or Rhino.Inside execution
- LLM-backed intent planning
- Full `docify` ingestion
- Windows named-pipe support in the first slice
- Rich geometry output beyond mock host object identifiers and echoed payloads

## Decisions

### Decision: Build the prototype in Zig now rather than deferring implementation

The PRD already commits the core daemon to Zig, and Zig 0.15.2 is available locally. Building the prototype in Zig validates the intended core technology early and avoids creating a throwaway implementation in another language.

Alternative considered:
- Use Python or Node.js for faster prototyping. Rejected because it would validate the workflow but not the core technology choice.

### Decision: Use a mock Rhino bridge over Unix domain sockets

The production architecture expects a process boundary and structured JSON-RPC. A mock Rhino bridge running as a separate Zig command keeps that shape intact while avoiding the unavailable Rhino and .NET dependencies in this environment.

Alternative considered:
- In-process mock execution. Rejected because it would collapse the boundary we most need to validate.

### Decision: Use deterministic rule-based planning for the first command set

The first executable slice should prove the orchestration loop, not model quality. A small supported prompt grammar for cube creation, staircase creation, and object translation is enough to validate planning, normalization, dispatch, and persistence.

Alternative considered:
- Stub an LLM interface immediately. Rejected because it would add configuration and network dependencies before the transport and state model are proven.

### Decision: Persist state with SQLite via the system `sqlite3` library

The prototype needs durable local state and SQLite is already part of the technical plan. Linking against the system SQLite library keeps the prototype aligned with the planned storage model and avoids shelling out to the CLI for every query.

Alternative considered:
- JSON file persistence. Rejected because it would create a migration immediately after the prototype.

### Decision: Keep the first CLI surface small and explicit

The first commands should be:

- `plan --prompt <text>`
- `run --prompt <text> [--session <id>] [--socket <path>]`
- `session show [--session <id>]`
- `bridge mock-rhino --socket <path>`

This is enough to prove planning, execution, and inspection without inventing a broad command surface too early.

## Risks / Trade-offs

- [Prototype grammar is narrow] → Keep the planner isolated so an LLM or schema-driven planner can replace it later without touching transport or storage.
- [Unix domain sockets are macOS-only in this slice] → Scope the prototype explicitly to local development and add named-pipe support later.
- [Mock bridge may hide host-integration issues] → Keep the JSON-RPC contract explicit so the mock bridge can be replaced by a real Rhino bridge with minimal core changes.
- [SQLite C interop adds implementation complexity] → Limit the wrapper to schema bootstrap and a few focused queries for this slice.

## Migration Plan

1. Add the Zig project scaffold and core modules.
2. Implement the deterministic planner and JSON plan model.
3. Add SQLite schema bootstrap and session/object/command persistence.
4. Add the mock Rhino bridge over Unix domain sockets.
5. Verify the full local loop with plan, create, persist, and follow-up move commands.

There is no production deployment yet, so rollback is simply reverting the scaffold and change files if the approach proves unsound.

## Open Questions

- Should the eventual planner contract use one action per prompt or a multi-step action list from the start?
- How much of the Rhino method naming should be normalized into generic actions versus host-specific method names?
- Should session selection default to a fixed `default` session or a generated timestamped session in later revisions?
