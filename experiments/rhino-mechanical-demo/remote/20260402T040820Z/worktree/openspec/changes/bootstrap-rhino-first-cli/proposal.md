## Why

The repository has a strong product direction but no executable slice yet. We need a concrete Rhino-first prototype that proves the core model: accept a natural-language prompt, turn it into a deterministic plan, execute through a bridge contract, and persist session state locally.

This needs to happen now because the architecture should be validated by a working loop, not only by docs. Without a runnable slice, the project risks over-designing the platform before proving the orchestration model.

## What Changes

- Add a Zig-based CLI prototype that accepts natural-language prompts and produces deterministic Rhino-targeted action plans.
- Add a local JSON-RPC bridge contract and a mock Rhino bridge that can execute the first command set on this machine.
- Add a SQLite-backed session store for sessions, object aliases, and command history.
- Add development fixtures and commands so the prototype can be run and inspected without Rhino, .NET, or external LLM providers.

## Capabilities

### New Capabilities

- `rhino-first-command-loop`: Accept a user prompt, normalize it into a typed Rhino-targeted execution plan, and dispatch it through a JSON-RPC bridge contract.
- `local-session-memory`: Persist sessions, command history, and host object identifiers so follow-up commands can reference prior results.

### Modified Capabilities

None.

## Impact

- Adds a Zig project scaffold and CLI entrypoint
- Adds local SQLite storage and schema management
- Adds a mock Rhino bridge and JSON-RPC message contract
- Adds OpenSpec artifacts for the first vertical slice
- Establishes the first runnable developer workflow for the repository
