# Architecture

## System Model

NLCI is a headless orchestration system built around one idea:

Treat creative hosts as execution microservices.

Rhino, Rive, and Unreal are not the center of the platform. They are specialized workers behind a stable command protocol. The core daemon owns planning, validation, routing, and state.

## High-Level Components

| Component | Role |
| :--- | :--- |
| Client / CLI | Accepts prompts, flags, and session context |
| Planner | Converts natural language into structured candidate actions |
| Validator | Enforces command shape, units, types, and policy checks |
| Router | Sends commands to the correct host bridge |
| Host bridges | Execute typed requests inside Rhino, Rive, or Unreal |
| Session store | Persists object references, history, and alias resolution |

## Responsibility Split

### The LLM Handles

- intent interpretation
- decomposition of a user prompt into one or more host actions
- parameter suggestion
- mapping user language onto known command capabilities

### The Core Handles

- schema lookup
- parameter validation
- unit conversion
- formula evaluation and math verification
- object alias resolution
- execution ordering
- retries and timeout policy
- persistence

### Bridges Handle

- receiving typed JSON-RPC commands
- translating them into host SDK calls
- returning structured success or failure payloads

This separation is the most important architectural rule in the project.

## Canonical Flow

1. The user submits a prompt through the CLI.
2. The core loads relevant session context and host capabilities.
3. The planner returns a structured action plan.
4. The core validates the plan against known schemas and runtime policy.
5. The core normalizes values such as units, coordinates, and references.
6. The router dispatches each action to the appropriate bridge over JSON-RPC.
7. Each bridge executes the request and returns status plus resulting identifiers.
8. The core persists results and exposes a human-readable summary back to the caller.

## Protocol Shape

All bridge communication should pass through a stable JSON-RPC 2.0 contract.

Example request:

```json
{
  "jsonrpc": "2.0",
  "id": "cmd_001",
  "method": "rhino.geometry.create_spiral_stair",
  "params": {
    "height_mm": 3000,
    "step_count": 10,
    "radius_mm": 1200
  }
}
```

Example response:

```json
{
  "jsonrpc": "2.0",
  "id": "cmd_001",
  "result": {
    "status": "ok",
    "objects": [
      {
        "alias": "staircase",
        "host_id": "GUID-EXAMPLE-001"
      }
    ]
  }
}
```

The contract should remain narrow and explicit. Host-specific complexity belongs inside bridge implementations, not in ad hoc protocol drift.

## Capability Model

The planner should not invent command vocabulary from scratch. It should work against a capability index built from authoritative sources such as `docify`.

That index should answer:

- what operations are available
- which host owns each operation
- required and optional parameters
- parameter types and units
- known constraints or preconditions

This is what lets the system move from "chatbot behavior" toward "execution engine behavior."

## Session Model

The session store exists so the system can maintain continuity across prompts.

Core records should include:

- `sessions`: active work context
- `objects`: aliases mapped to host-specific identifiers
- `commands`: executed requests, results, and timestamps
- `undo_log`: reversible operations where supported
- `bridge_status`: availability, health, and licensing signals

Example use:

- Prompt 1: "Create a red cube in Rhino."
- Prompt 2: "Move that cube 2m to the left."

Without a durable session model, prompt 2 becomes guesswork. With it, the system can resolve "that cube" into an exact object identifier.

## Multi-Host Orchestration

A single prompt may map to multiple hosts.

Example:

`Generate a staircase in Rhino, export the mesh, import it into Unreal, and trigger a matching UI state in Rive.`

To support this, the core needs:

- ordered execution plans
- explicit dependencies between steps
- normalized object handoff contracts
- partial failure reporting

The system should support mixed outcomes. A Rhino operation succeeding does not imply the Unreal import succeeded, and the session model must record that distinction.

## Failure Model

Failure isolation is a first-class requirement.

- A bridge crash must not crash the core.
- A malformed LLM plan must fail validation before dispatch.
- A timeout in one host must not silently invalidate state in another host.
- Persistence should happen only after execution results are known.

The default posture should be explicit failure over ambiguous success.

## Architecture Principles

- Keep the core deterministic.
- Keep bridges thin.
- Prefer schemas to prompt prose.
- Prefer typed contracts to implicit conventions.
- Persist identity early.
- Contain failure at process boundaries.

## First Architecture Milestone

The first complete slice should prove:

1. prompt to plan
2. plan to validated Rhino command
3. validated command to bridge execution
4. bridge result to persisted object identity

That slice is enough to validate the core architectural bet before expanding the host matrix.
