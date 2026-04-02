# Rhino Bridge

This directory is the handoff point for the real Rhino integration.

The current prototype uses a mock bridge so the local command loop can be exercised without Rhino installed. The next step is to replace that mock with a `Rhino.Inside`-backed worker that speaks the same JSON-RPC contract.

## Contract Summary

The bridge is intentionally narrow:

- JSON-RPC 2.0 over a local socket transport
- typed request envelopes
- typed execution results
- runtime handshake endpoints for readiness and capability discovery
- document-scoped lifecycle methods for opening, describing, and closing a Rhino document
- no planner logic in the bridge
- no session or alias resolution in the bridge

The core daemon owns planning, validation, unit normalization, and session state. The Rhino bridge only executes host-specific operations.

## Supported Operations

The current prototype uses these methods:

- `rhino.system.ping`
- `rhino.system.describe_runtime`
- `rhino.document.open_headless`
- `rhino.document.describe`
- `rhino.document.close`
- `rhino.geometry.create_cube`
- `rhino.geometry.create_sphere`
- `rhino.geometry.create_cylinder`
- `rhino.geometry.create_organic_blob`
- `rhino.geometry.create_scientific_shell`
- `rhino.geometry.create_mpc_live_ii_button_cap`
- `rhino.geometry.create_mpc_live_ii_panel_demo`
- `rhino.geometry.create_spiral_staircase`
- `rhino.objects.translate`

The future Rhino.Inside bridge should preserve those method names where possible so the mock bridge can be swapped out without changing the core contract.

## Runtime Readiness

The runtime handshake is part of the bridge contract, not an implementation detail.

- `rhino.system.ping` is the minimal health check. It confirms the bridge process is alive and reachable.
- `rhino.system.describe_runtime` returns the runtime descriptor needed by the core to decide whether the bridge is usable for a given session.

`describe_runtime` MUST return:

- `bridge_kind`
- `runtime_version`
- `transport`
- `endpoint`
- `license_status`
- `supported_methods`

That descriptor currently lives at `result.runtime` so the handshake flow keeps the same top-level JSON-RPC shape as geometry responses.

That response is what lets the core distinguish between "bridge reachable" and "bridge ready for Rhino work."

## Document Scope

The bridge now manages a single Rhino document boundary per active session.

- `rhino.document.open_headless` opens or creates the active headless document.
- `rhino.document.describe` returns document metadata for an existing document.
- `rhino.document.close` closes the active document when the session is done.

The document metadata returned by `open_headless` and `describe` MUST include:

- `document_id`
- `unit_system`
- `model_tolerance_mm`
- `headless`
- `document_path` when the bridge can provide it

Geometry methods are document-scoped. Requests for `rhino.geometry.create_cube`, `rhino.geometry.create_sphere`, `rhino.geometry.create_cylinder`, `rhino.geometry.create_organic_blob`, `rhino.geometry.create_scientific_shell`, `rhino.geometry.create_mpc_live_ii_button_cap`, `rhino.geometry.create_mpc_live_ii_panel_demo`, `rhino.geometry.create_spiral_staircase`, and `rhino.objects.translate` should carry `document_id` so the core can route work into the correct Rhino document.

## Future Rhino.Inside Shape

The intended production path is:

1. Receive JSON-RPC requests from the core daemon.
2. Map each request to RhinoCommon or Rhino.Inside calls.
3. Create or mutate objects in a headless or embedded Rhino document.
4. Return stable host object identifiers and structured status.

## File Guide

- `json-rpc-contract.md`: human-readable contract for request and response behavior
- `schemas/request.schema.json`: request envelope schema
- `schemas/response.schema.json`: response envelope schema
- `schemas/rhino/document.schema.json`: document metadata schema used by open/describe responses
- `schemas/plan.schema.json`: normalized internal plan schema used before dispatch
- `schemas/runtime.schema.json`: runtime handshake descriptor schema
