## Context

The repo already has the right core abstractions for a real bridge trial: bridge profile selection, JSON-RPC dispatch, document-scoped sessions, and deterministic basic-solid planning. What it does not have is a bridge implementation that can create visible geometry in Rhino itself.

On this machine, Rhino 8 is installed but `dotnet` is not. During local probing, Rhino successfully executed repo-local Python scripts through startup commands, and Rhino reported interpreter constraints consistent with an older embedded Python environment. That makes startup-script-driven Python the shortest credible live-demo path, while `Rhino.Inside` remains the long-term production direction.

The bridge also has to coexist with already-open Rhino windows. The live demo cannot assume a clean desktop, and it cannot blindly launch additional Rhino instances when the target instance is ambiguous.

## Goals / Non-Goals

**Goals:**
- Add a real Rhino-backed bridge server without changing the core bridge client API
- Keep the existing `rhino-inside` profile usable for a first live demo
- Be explicit and safe around already-open Rhino instances
- Support document open/describe/close and cube/sphere/cylinder creation
- Return structured JSON results compatible with the current store/session flow

**Non-Goals:**
- Final `Rhino.Inside` or RhinoCommon worker packaging
- Real move-object support against persisted Rhino identifiers
- Spiral staircase creation on the real bridge
- Viewport presets or camera choreography in this change

## Decisions

### Decision: Add a sibling bridge server instead of branching inside core dispatch

The new implementation will live in a dedicated server module alongside `mock_bridge.zig`. The existing client-side bridge code and document-session flow already abstract over JSON-RPC methods and do not need a profile-specific fast path.

Alternative considered:
- Call Rhino directly from `src/bridge.zig`. Rejected because it would fork the contract boundary and couple the core to one tactical implementation.

### Decision: Keep the `rhino-inside` profile label for the first live demo

The config surface and schemas already support a non-mock real-Rhino profile through `rhino-inside`. Reusing that profile avoids extra config churn while the bridge implementation underneath remains a tactical demo adapter.

Alternative considered:
- Add a brand-new profile such as `rhino-app`. Rejected for now because it adds more config and documentation churn than the first demo slice needs.

### Decision: Execute Rhino work through startup-run Python scripts

The bridge will generate small Python scripts and invoke Rhino with `-runscript "-_RunPythonScript <path>"`. Script output will be written to a JSON result file that the bridge reads after Rhino completes the command.

Alternative considered:
- Use `rhinocode script` as the primary execution path. Rejected for this slice because it depends on `StartScriptServer` lifecycle behavior that proved less reliable during local probing than direct startup-run scripts.

### Decision: Use Rhino instance discovery as a safety gate before launch

The bridge will inspect running Rhino instances before executing live work. If it finds a single compatible target for the active session, it may reuse that instance. If the running-instance state is ambiguous, it will fail with a clear error instead of spawning another Rhino process blindly.

Alternative considered:
- Always launch a new Rhino instance for every command. Rejected because it ignores user state and creates a high risk of trampling active sessions.

### Decision: Use deterministic document file paths and synthetic document identifiers

The bridge will manage a simple in-memory registry of `document_id` to `.3dm` file paths under `var/real-rhino/`. The `document_id` remains stable for the session while the Python script opens or writes the mapped file on each create request.

Alternative considered:
- Depend on Rhino-managed document identifiers directly. Rejected because the first live demo only needs stable session scoping, not full Rhino document introspection.

### Decision: Return true object identifiers when the script can provide them

The Python script will return the Rhino object GUID produced by `AddBox`, `AddSphere`, or `AddCylinder`, and the bridge will forward it as `host_id`.

Alternative considered:
- Generate synthetic object identifiers in Zig. Rejected because the live demo benefits from returning actual Rhino object ids when available.

## Risks / Trade-offs

- [Real Rhino automation is slower than the mock path] → Accept this for the first live demo because credibility matters more than throughput.
- [Startup-script execution is tactical and macOS-specific] → Keep the implementation narrow and documented as a demo bridge, not the final production backend.
- [Rhino script execution environment is older than modern CPython] → Keep generated scripts legacy-safe and avoid newer stdlib conveniences.
- [Existing user-open Rhino sessions may be ambiguous] → Treat instance discovery as a hard gate and fail safely when the target instance is unclear.
- [Document close cannot truly guarantee headless semantics] → Preserve the existing method names but document that the real demo bridge uses a visible Rhino app window.

## Migration Plan

1. Add the new bridge server and wire CLI startup for the real profile.
2. Add script generation and result parsing for document lifecycle and basic-solid creation.
3. Verify the live demo manually against a local Rhino 8 install.
4. Update README and bridge docs so the live-demo path is explicit.

## Open Questions

- Should the next change add viewport presets and named-view setup after basic solid creation succeeds reliably?
- Should the real demo bridge eventually prefer `rhinocode list` only for runtime discovery while keeping startup-run scripts for execution?
