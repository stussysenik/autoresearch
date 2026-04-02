# Rhino JSON-RPC Contract

## Overview

The Rhino bridge is a deterministic execution worker. It receives JSON-RPC 2.0 messages from the Zig core and returns structured results that can be persisted and replayed.

The bridge does not interpret natural language. It only executes validated actions.

## Transport

The current prototype uses a Unix domain socket on macOS. The same contract should also work over named pipes on Windows when the real Rhino bridge is added there.

## Request Shape

Each request MUST include:

- `jsonrpc: "2.0"`
- a unique `id`
- a Rhino-scoped `method`
- a `params` object

## Handshake Methods

### `rhino.system.ping`

Returns a minimal health response that confirms the bridge is reachable.

Required params:

- none

Successful responses SHOULD return only `status: "ok"` unless the implementation needs to add low-risk diagnostic metadata.

### `rhino.system.describe_runtime`

Returns runtime metadata used by the core to assess readiness.

Required params:

- none

The runtime descriptor MUST include:

- `bridge_kind`
- `runtime_version`
- `transport`
- `endpoint`
- `license_status`
- `supported_methods`

The bridge SHOULD return that descriptor as `result.runtime` inside the standard JSON-RPC success envelope.

## Document Methods

### `rhino.document.open_headless`

Opens or creates the active headless Rhino document for the session.

Required params:

- none

Optional params:

- `document_path` as a hint when opening an existing file

Successful responses MUST return document metadata under `result.document`.

### `rhino.document.describe`

Returns the current document metadata.

Required params:

- `document_id`

Successful responses MUST return document metadata under `result.document`.

### `rhino.document.close`

Closes the active document for the session.

Required params:

- `document_id`

Successful responses SHOULD return `status: "ok"` and MAY include a summary.

## Current Methods

The geometry methods below remain part of the contract and MUST continue to work alongside the runtime handshake methods.

### `rhino.geometry.create_cube`

Creates a cube in Rhino.

Required params:

- `document_id`
- `size_mm`

Optional params:

- `alias`

### `rhino.geometry.create_sphere`

Creates a sphere in Rhino.

Required params:

- `document_id`
- `radius_mm`

Optional params:

- `alias`

### `rhino.geometry.create_cylinder`

Creates a cylinder in Rhino.

Required params:

- `document_id`
- `radius_mm`
- `height_mm`

Optional params:

- `alias`

### `rhino.geometry.create_organic_blob`

Creates a deterministic organic demo blob in Rhino.

Required params:

- `document_id`
- `size_mm`

Optional params:

- `alias`

### `rhino.geometry.create_scientific_shell`

Creates a staged scientific shell demo in Rhino and exports an STL artifact.

Required params:

- `document_id`
- `size_mm`

Optional params:

- `alias`

### `rhino.geometry.create_mpc_live_ii_button_cap`

Creates a source-backed MPC Live II Play Start button-cap reference model in Rhino and exports an STL artifact.

Required params:

- `document_id`

Optional params:

- `size_mm`
- `alias`

### `rhino.geometry.create_mpc_live_ii_panel_demo`

Creates a staged MPC Live II panel reconstruction demo in Rhino with named layers, view transitions, and STL export for the highlighted cap artifact.

Required params:

- `document_id`

Optional params:

- `size_mm`
- `alias`

### `rhino.geometry.create_spiral_staircase`

Creates a staircase in Rhino.

Required params:

- `document_id`
- `height_mm`
- `step_count`

Optional params:

- `radius_mm`
- `alias`

### `rhino.objects.translate`

Translates an existing object.

Required params:

- `document_id`
- `host_id` or a resolved host identifier provided by the core
- `distance_mm`
- `direction`

Optional params:

- `alias`

## Response Shape

Successful responses SHOULD include:

- `jsonrpc: "2.0"`
- the matching `id`
- a `result` object
- `status: "ok"`
- `export_path` when the operation generates an artifact
- a list of returned host objects

Handshake responses MAY instead return runtime metadata under `result.runtime` or simple health status, depending on the method.

Document responses MUST return document metadata under `result.document` for `open_headless` and `describe`.

Each returned host object SHOULD include:

- `alias` when one exists
- `host_id`
- `kind`

The document metadata object SHOULD include:

- `document_id`
- `unit_system`
- `model_tolerance_mm`
- `headless`
- `document_path` when available

## Error Shape

Failed responses SHOULD include:

- `jsonrpc: "2.0"`
- the matching `id` when available
- an `error` object
- a numeric error `code`
- a human-readable `message`

## Rhino.Inside Expectations

The eventual bridge should keep the same protocol shape while changing only its execution backend:

- request parsing stays the same
- planning stays in the core
- RhinoCommon performs the actual geometry work
- license and environment failures are reported as bridge errors, not hidden from the core

## Compatibility Rule

If the real Rhino bridge changes a method or response shape, the JSON schemas in `schemas/rhino/` must change with it. The contract is the source of truth, not the implementation.
