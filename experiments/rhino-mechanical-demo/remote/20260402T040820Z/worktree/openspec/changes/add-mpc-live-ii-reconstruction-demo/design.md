## Context

The Rhino demo currently proves command execution, staged shape creation, viewport control, and export for generic geometry. It does not yet provide a believable hardware reconstruction workflow for a recognizable product.

The MPC Live II request changes the bar. The user wants a demo that reads like industrial reconstruction work rather than abstract modeling: official dimensions, official control naming, visible checkpoints, 2D-to-3D progression, and an exportable artifact.

The key constraint is source quality. Akai's official sources are strong enough to anchor:

- overall chassis dimensions and weight from the official product page
- control counts and hardware naming from the official product page
- top-panel control map and button naming from the official MPC user guide

Those same official sources do not expose exact button-cap manufacturing geometry. There is no official cap CAD, no service drawing, and no underside feature specification in the material reviewed so far. That means the system can produce a high-fidelity reference reconstruction, but it cannot honestly present the cap as factory-exact unless a measured or factory part reference is added later.

## Goals / Non-Goals

**Goals:**

- Add a source-backed MPC Live II reconstruction path to the Rhino demo.
- Split the work into two usable flows:
  - a single button-cap reference model for fast export and iteration
  - a staged top-panel demo that presents checkpoints live in Rhino
- Make provenance explicit so official dimensions, calibrated placement, and inferred geometry are not conflated.
- Use layers, view changes, and export so the Rhino session is presentation-ready.
- Reuse the current planner, mock bridge, live Rhino bridge, and session store without introducing a separate demo subsystem.

**Non-Goals:**

- Claim factory-exact cap geometry without a physical measurement or official part drawing.
- Reconstruct the entire MPC Live II mechanical assembly, internals, PCB stack, or injection-mold features.
- Build a photoreal marketing render pipeline.
- Generalize the system to every MPC model in this change.

## Decisions

### 1. Split the feature into `button cap reference` and `panel demo sequence`

The implementation should expose two distinct capabilities:

- `mpc-live-ii-button-cap-reference`
- `mpc-live-ii-panel-demo-sequence`

The button-cap flow gives the user a fast, exportable artifact. The panel-demo flow gives the user the impressive staged demo with checkpoints, layers, and view transitions.

This is better than a single overloaded prompt because the validation bar is different for each flow. A cap export can succeed without recreating the whole panel. A panel demo can be visually compelling even when only one cap family is modeled to higher detail.

Alternative considered:

- One monolithic `create mpc live ii` prompt.
  Rejected because it hides scope, makes provenance ambiguous, and makes it harder to verify what is actually source-backed.

### 2. Use a provenance tier model instead of claiming exactness

Every modeled feature should fall into one of three provenance tiers:

- `official`: directly supported by Akai documentation or official product specs
- `calibrated`: derived from official imagery or control-map artwork after scale alignment
- `inferred`: freeform reconstruction needed because no official geometry exists

The live result path should surface this distinction in saved metadata and the OpenSpec requirements should require it. The demo language should use `reference` or `source-backed reconstruction`, not `exact`, unless a future calibration artifact is introduced.

Alternative considered:

- Treat all generated geometry as authoritative.
  Rejected because it would overstate what the source material actually proves.

### 3. Model the live sequence as named checkpoints with dedicated layers and views

The panel demo should not generate the final form in one script block. It should create a visible checkpoint sequence:

1. Source envelope
2. Control-map anchors
3. Target button family footprint
4. 2D cap profile
5. 3D cap solid
6. Mesh/export artifact
7. Presentation framing

Recommended layer set:

- `MPCLiveII::Sources`
- `MPCLiveII::Envelope`
- `MPCLiveII::Anchors`
- `MPCLiveII::ButtonFamily`
- `MPCLiveII::Cap2D`
- `MPCLiveII::Cap3D`
- `MPCLiveII::Mesh`
- `MPCLiveII::Export`

Recommended view sequence:

- Top + Wireframe for calibration
- Right or Front for cap height/profile validation
- Perspective + Shaded or Rendered for final presentation

This keeps the Rhino demo legible and makes the modeling logic visible to an observer.

Alternative considered:

- Generate final solid only and rely on narration.
  Rejected because the user explicitly wants to see the sequence and checkpoints live.

### 4. Anchor geometry on official Akai sources first, then allow calibrated refinement

The base reconstruction should use official Akai sources only:

- product page for overall dimensions, weight, pad count, and Q-Link count
- user guide / control map for button names and panel grouping

If a later iteration introduces image-based calibration, it should prefer official Akai imagery already exposed by the Akai product page. That keeps the calibration chain primary-source-based.

Alternative considered:

- Use third-party teardown photos or community measurements immediately.
  Rejected for the first pass because the brief asked for the manual and official sources, and because primary-source fidelity matters for the demo narrative.

### 5. Extend the existing Rhino live demo path rather than building a separate hardware toolchain

The current architecture already has the right extension points:

- `src/types.zig` for new action kinds
- `src/planner.zig` for prompt parsing
- `src/mock_bridge.zig` for parity in non-live mode
- `src/rhino_live_demo.zig` for scripted live creation, layer management, viewport setup, and STL export
- bridge docs and schemas for surfaced methods

The MPC flow should use the same pattern as the scientific shell and organic blob flows so session persistence, Rhino instance safety, and export behavior stay consistent.

Alternative considered:

- Add a separate MPC-specific executable or external script entrypoint.
  Rejected because it would bypass the safety and persistence work already done in the CLI.

## Risks / Trade-offs

- [No official cap geometry] -> The system may produce an attractive but overstated result unless provenance is explicit. Mitigation: require `reference` wording and provenance tagging for inferred features.
- [Control placement drift from calibration] -> Panel anchors may be visually off if derived from a single image without enough checkpoints. Mitigation: keep the first live implementation focused on one button family and add validation overlays before expanding the panel.
- [Demo clutter] -> Too many construction objects will make the Rhino scene unreadable. Mitigation: use named layers, timed staging, and hide nonessential checkpoints before the final presentation frame.
- [Prompt ambiguity] -> `button cap` is underspecified because the device has multiple button families. Mitigation: first implementation should target a named transport button family and require or assume a canonical control such as `Play Start`.
- [Schema growth] -> Provenance metadata may expand the response surface. Mitigation: keep the first metadata payload small and additive.

## Migration Plan

This change is additive. No existing prompt or stored session data needs migration.

Implementation order:

1. Add OpenSpec requirements and tasks.
2. Add planner and type support for the new MPC flows.
3. Extend mock bridge and live Rhino bridge for staged reconstruction, layers, and export.
4. Update schemas and docs.
5. Verify on a clean Rhino session and record exported artifacts.

Rollback is straightforward: remove the new action kinds and prompt handlers. Existing geometry flows are unaffected.

## Open Questions

- Which control family should be the canonical first cap: `Play Start`, `Play`, `Stop`, or `Rec`?
- Should provenance be embedded in the JSON-RPC response, the Rhino-side result file, or both?
- Do we want a local reference bundle of official Akai images checked into the repo, or do we keep calibration inputs external?
- Should the first panel demo stop at the transport cluster, or place all top-panel control anchors before focusing on one cap family?
