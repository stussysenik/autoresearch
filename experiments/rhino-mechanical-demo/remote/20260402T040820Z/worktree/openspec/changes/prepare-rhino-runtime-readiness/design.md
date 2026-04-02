## Context

The first prototype proves planning, persistence, and JSON-RPC dispatch, but it still hard-codes runtime defaults directly in the CLI handlers and assumes a single mock socket target. That is enough for local validation, but it is the wrong seam for moving toward a real Rhino trial where `.env.local`, Rhino-specific endpoints, and runtime diagnostics will matter.

This change introduces a typed configuration layer and a deterministic bridge handshake without attempting real RhinoCommon execution yet. The design keeps the current mock bridge usable while creating the contract boundary a Rhino.Inside worker will need later.

## Goals / Non-Goals

**Goals:**
- Resolve runtime settings from defaults, `.env.local`, process environment variables, and CLI flags with explicit precedence
- Track the source of each effective setting so inspection commands can explain what won
- Replace naked socket-path wiring with a typed bridge target that includes profile and transport
- Add `rhino.system.ping` and `rhino.system.describe_runtime` so the core can inspect bridge readiness before geometry dispatch
- Keep the existing mock bridge runnable and compatible with the current geometry methods

**Non-Goals:**
- Real Rhino.Inside or RhinoCommon execution
- License activation flows beyond surfacing reported status
- Windows named pipes or multi-transport support
- Broader natural-language command coverage
- LLM-backed planning or schema ingestion

## Decisions

### Decision: Add a dedicated config module with source tracking

`src/config.zig` will own defaults, dotenv parsing, process env reads, CLI override resolution, and effective config assembly. Each field will record its winning source (`default`, `dotenv`, `env`, `cli`) so `config show` can explain why the runtime is configured the way it is.

Alternative considered:
- Keep reading flags and defaults directly in each CLI handler. Rejected because that would continue duplicating precedence logic and would make Rhino-specific configuration harder to reason about.

### Decision: Introduce a typed bridge target now, even with one transport

The core will stop passing a raw socket path into bridge calls. Instead it will pass a bridge target that includes the selected profile and a typed endpoint. The first transport remains a Unix domain socket, but the calling code will no longer be hard-coded to that shape.

Alternative considered:
- Keep the socket path string and add a profile enum only in the CLI. Rejected because the transport boundary is exactly the abstraction that needs to stabilize before a real Rhino worker is added.

### Decision: Use `describe_runtime` as the preflight handshake before execution

The bridge contract will add `rhino.system.ping` and `rhino.system.describe_runtime`. `bridge status` will use both methods for diagnostics, and `run` will call `describe_runtime` before dispatching geometry methods so bridge failures surface before command execution is attempted.

Alternative considered:
- Add diagnostics commands only and leave `run` untouched. Rejected because the runtime handshake is most valuable when it guards the actual execution path.

### Decision: Resolve dotenv-relative paths against the env file directory

Values read from `.env.local` such as database and socket paths will be resolved relative to the env file location rather than the shell's current working directory. That keeps checked-in examples and per-environment config files portable.

Alternative considered:
- Treat all relative paths as cwd-relative. Rejected because moving an env file into a config directory would silently change behavior in surprising ways.

## Risks / Trade-offs

- [One more preflight round-trip on `run`] → Accept the extra request now because bridge readiness is more important than shaving a local mock call.
- [Typed config adds boilerplate] → Keep the config surface small: session, db path, bridge profile, and socket endpoint only.
- [Runtime diagnostics can drift from the real bridge] → Update the human-readable contract and JSON schemas in `bridges/rhino/` and `schemas/rhino/` in the same change.
- [Dotenv parsing can become a mini-language] → Support only a narrow `KEY=VALUE` format with comments and fail fast on malformed lines.

## Migration Plan

1. Add OpenSpec requirements for config precedence, profile resolution, handshake, and diagnostics.
2. Implement the typed config module and update CLI handlers to use effective config.
3. Extend the bridge client and mock bridge with handshake methods and typed endpoints.
4. Update Rhino contract docs and schemas to match the new runtime methods.
5. Verify `config show`, `bridge status`, and the existing create/move flow against the mock bridge.

Rollback is straightforward because the change is additive: revert the new config and handshake modules and return the CLI to direct socket-path dispatch.

## Open Questions

- Should the future Rhino.Inside worker expose richer runtime fields such as Rhino build number, active document path, and plugin load state, or should those be added only after the first real bridge exists?
- Should `runtime show` remain as an alias for `config show`, or should the CLI eventually standardize on a single inspection command name?
