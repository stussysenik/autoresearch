# Tech Stack

## Stack Summary

| Area | Initial Choice | Why |
| :--- | :--- | :--- |
| Core daemon | Zig | Fast, portable, static binaries, strong fit for IPC and systems work |
| LLM interface | Provider-abstracted local/cloud adapter | Keeps model choice flexible while preserving a stable planner contract |
| Rhino bridge | C# with `Rhino.Inside` / RhinoCommon | Best access path to Rhino's geometry engine in headless workflows |
| Rive bridge | C++ with `rive-cpp` | Direct runtime access for state machines and property control |
| Unreal bridge | Python editor scripting | Fastest path to orchestration inside Unreal tooling |
| IPC | JSON-RPC 2.0 over named pipes / Unix domain sockets | Simple framing, low overhead, clean multi-process boundaries |
| Persistence | SQLite | Durable local state with minimal operational burden |
| Schema ingestion | `docify` JSON | Machine-readable Rhino command vocabulary from source documentation |

## Selection Principles

The stack is optimized for determinism, portability, and incremental delivery rather than novelty.

- The core must stay small and dependable.
- Host integrations should use the strongest official or de facto supported embedding path.
- The protocol boundary must be stable even if individual bridge implementations change.
- LLM providers must be replaceable without changing execution semantics.

## Core Daemon: Zig

Zig is the anchor technology for the system.

It is responsible for:

- session lifecycle
- bridge discovery and health tracking
- unit normalization and math verification
- JSON-RPC request construction and dispatch
- schema loading and capability indexing
- persistence orchestration
- execution policy and failure containment

Zig is a strong fit here because the project needs a small systems layer, predictable binaries, and explicit control over memory and concurrency.

## LLM Layer

The model layer should be treated as a planning dependency, not an infrastructure foundation.

### Requirements

- Structured output support
- Predictable latency
- Good long-context behavior for schema-grounded prompts
- Swappable local and cloud backends

### Initial Direction

The PRD names:

- `GLM-4.7` for local execution
- `Claude 3.5` for cloud execution

Those should be treated as initial candidates, not permanent commitments. The system should expose a provider-neutral planning interface so model choice can evolve without forcing a protocol rewrite.

## Rhino Bridge

### Language

C# / .NET

### Runtime path

`Rhino.Inside` plus RhinoCommon in a headless or embedded document context

### Why this path

- It gives direct access to Rhino's geometry engine.
- It avoids brittle UI automation.
- It aligns with the PRD's goal of precise SDK-level execution.

### Responsibilities

- receive JSON-RPC commands
- resolve and execute RhinoCommon operations
- report created or updated object identifiers
- surface host-specific errors without crashing the core

## Rive Bridge

### Language

C++

### Runtime path

`rive-cpp` plus the target rendering backend required by the chosen runtime environment

### Responsibilities

- trigger artboard state machine inputs
- set properties on runtime objects
- report execution and state updates back to the core

## Unreal Bridge

### Language

Python

### Runtime path

Unreal Editor scripting as the fastest initial integration route

### Responsibilities

- spawn and modify actors
- assign materials
- control sequencing and scene operations
- return stable identifiers and execution status

## IPC Layer

JSON-RPC 2.0 is the shared protocol contract.

Why it fits:

- easy to debug
- host-language agnostic
- simple request/response semantics
- extensible for notifications, health checks, and streaming later

Transport choices:

- Windows: named pipes
- macOS: Unix domain sockets

This keeps the system local-first and avoids HTTP port management for the common case.

## Persistence Layer

SQLite is the right first database because it matches the product stage and deployment model.

It should initially store:

- sessions
- user-facing object aliases
- host object identifiers
- command history
- undo/redo metadata
- bridge health snapshots

If the product later grows into remote or collaborative deployments, the storage model can evolve. The local data contract should stay stable.

## Schema and Capability Layer

The first schema source is `docify` output for RhinoCommon.

That data should be normalized into a capability index that answers questions like:

- what commands exist
- what parameters are required
- what types each parameter expects
- what descriptions or examples are available

The important design choice is that this layer is not prompt text. It is machine-usable capability data the planner and validator can both consume.

## Development Tooling

The implementation should stay light on tooling until the core contracts stabilize.

Recommended early investments:

- JSON schema fixtures for planner output
- golden tests for prompt-to-plan translation
- bridge contract tests with sample requests and failures
- deterministic unit tests for units, coordinates, and conversions
- basic structured logs from the core and bridges

## Explicit Non-Choices For Now

The current plan intentionally avoids:

- HTTP as the primary local transport
- a heavy external database
- GUI automation as the integration baseline
- hard-coding one model vendor into the execution contract
- embedding business logic inside host bridges
