## Why

The current prototype proves the core loop, but it is still hard-wired to local defaults and a mock bridge. To move toward a real Rhino trial, the runtime needs a clean configuration layer and an explicit Rhino bridge boundary that can be prepared now and swapped in later.

This needs to happen before deeper Rhino integration work because otherwise the codebase will keep encoding mock-only assumptions in the CLI and storage flow.

## What Changes

- Add env-driven runtime configuration with support for `.env.local`, process environment variables, and CLI overrides.
- Introduce explicit bridge profile selection so the CLI can target either the existing mock Rhino bridge or a future real Rhino bridge profile.
- Scaffold the real Rhino bridge handoff surface with repo structure and contract files aligned to the current JSON-RPC flow.
- Add developer-facing commands and docs for inspecting effective runtime configuration before trying a Rhino-backed run.

## Capabilities

### New Capabilities

- `runtime-configuration`: Load effective runtime settings from `.env.local`, environment variables, and CLI flags so bridge selection and storage paths can be changed without code edits.
- `rhino-bridge-profile-selection`: Resolve a concrete bridge profile and transport endpoint before any bridge-facing command runs.
- `rhino-runtime-handshake`: Add deterministic bridge handshake methods that the core can use before geometry dispatch.
- `rhino-runtime-diagnostics`: Expose runtime inspection and bridge status commands so developers can see what will execute before trying Rhino-backed runs.

### Modified Capabilities

None.

## Impact

- Adds configuration loading and precedence rules to the Zig CLI
- Updates command handling to use bridge profiles and effective config
- Adds `.env.local.example` and runtime inspection documentation
- Extends `bridges/rhino/` and `schemas/rhino/` with runtime handshake contract details
- Prepares the repo for a real Rhino bridge without requiring Rhino/.NET verification in this environment
