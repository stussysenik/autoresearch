## 1. Planner And Action Plumbing

- [x] 1.1 Add `create_mpc_live_ii_button_cap` and `create_mpc_live_ii_panel_demo` to `src/types.zig`
- [x] 1.2 Extend `src/planner.zig` help text, prompt parsing, and tests for both MPC Live II prompts
- [x] 1.3 Update `src/app.zig` so both actions persist session objects in the same way as existing create flows

## 2. Bridge And Demo Runtime

- [x] 2.1 Add both Rhino method names to `src/mock_bridge.zig` and runtime method reporting
- [x] 2.2 Extend `src/rhino_live_demo.zig` to generate a staged MPC Live II button-cap script with STL export
- [x] 2.3 Extend `src/rhino_live_demo.zig` to generate a staged MPC Live II panel reconstruction script with named layers, viewport changes, and provenance-aware summaries

## 3. Contracts And Documentation

- [x] 3.1 Update `schemas/rhino/plan.schema.json` and `schemas/rhino/request.schema.json` for the new action kinds and method names
- [x] 3.2 Update `bridges/rhino/README.md` and `bridges/rhino/json-rpc-contract.md` with the new operations
- [x] 3.3 Update `README.md` with the new MPC Live II demo prompts and the exact-vs-inferred geometry warning

## 4. Verification

- [x] 4.1 Run `./scripts/zig build`
- [x] 4.2 Run `./scripts/zig build test`
- [x] 4.3 Run a live Rhino proof for one button-cap export and one panel-demo session, then capture the resulting artifact paths
