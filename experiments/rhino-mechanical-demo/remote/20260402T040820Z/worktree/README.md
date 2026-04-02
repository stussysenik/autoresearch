# rhino-nlcli

`rhino-nlcli` is the starting point for a Universal Natural Language Command Interface (NLCI): a headless command hub that turns natural language into deterministic executions across Rhino, Rive, and Unreal Engine.

The core idea is simple:

1. A language model interprets user intent.
2. A deterministic Zig core validates, normalizes, and routes that intent.
3. Thin host bridges execute structured JSON-RPC commands inside target applications.

This project is currently in the architecture and planning stage. The repository is documentation-first so the implementation can start from clear technical constraints instead of vague ambition.

The repository now also includes a runnable prototype:

- a Zig CLI in `src/`
- a SQLite-backed local session store
- a mock Rhino bridge over Unix domain sockets
- an OpenSpec change set describing the first vertical slice

## Why This Exists

Creative tools are powerful but fragmented. Rhino is strong at geometry, Rive is strong at interactive motion, and Unreal is strong at scenes and rendering. Today, crossing those boundaries usually means manual export flows, custom scripts, or brittle integrations.

NLCI treats each host as a specialized execution engine rather than a monolithic app. The result should be a system where a prompt like:

`Create a 3m staircase in Rhino, expose step 1 as a named object, and trigger its intro animation in Rive.`

becomes a validated, auditable execution plan instead of a black-box chat response.

## Product Thesis

The system should deliver deterministic execution of stochastic intent.

The model is allowed to interpret what the user wants. It is not allowed to directly own precision, state, or execution safety. Those responsibilities belong to the core daemon and the bridge contracts.

## Current Scope

The first implementation wave focuses on:

- Rhino-first command execution
- Headless IPC between a Zig core and a Rhino bridge
- Schema-driven command planning using `docify` output
- SQLite-backed session memory for object references and undo history

Rive and Unreal support are planned, but Rhino is the proving ground for the architecture.

## Prototype Status

The current prototype proves the first local command loop:

1. Parse a supported natural-language prompt
2. Normalize it into a deterministic Rhino-targeted plan
3. Inspect bridge/runtime readiness through deterministic config and handshake calls
4. Resolve or create a headless Rhino document for the active CLI session
5. Send the validated plan through a document-scoped JSON-RPC Unix socket bridge
6. Persist returned object aliases and command history in SQLite
7. Resolve a named object in a follow-up move command against the same document

Supported prototype prompts:

- `create cube size 2m named block-a`
- `create sphere radius 1m named ball-a`
- `create cylinder radius 500mm height 2m named column-a`
- `create organic blob size 1.8m named pod-a`
- `create scientific shell size 2m named shell-a`
- `create mpc live ii button cap named play-start-cap`
- `create mpc live ii panel demo named mpc-live-ii-demo`
- `spiral staircase, 10 steps, 3m tall`
- `move staircase 500mm left`

This is intentionally narrow. It validates the orchestration model before adding real Rhino execution or LLM planning.

## Quick Start

Use the repo-local Zig wrapper:

```sh
./scripts/zig build
```

Inspect the effective runtime config:

```sh
./zig-out/bin/rhino-nlcli config show
```

Start the mock Rhino bridge:

```sh
./zig-out/bin/rhino-nlcli bridge mock-rhino
```

Check the bridge handshake:

```sh
./zig-out/bin/rhino-nlcli bridge status
```

In another terminal, inspect a plan:

```sh
./zig-out/bin/rhino-nlcli plan --prompt "spiral staircase, 10 steps, 3m tall"
```

Run a create command and persist it in the `demo` session:

```sh
./zig-out/bin/rhino-nlcli run \
  --prompt "spiral staircase, 10 steps, 3m tall" \
  --session demo
```

Try a basic solid:

```sh
./zig-out/bin/rhino-nlcli run \
  --prompt "create sphere radius 1m named ball-a" \
  --session demo
```

Try a more presentational Rhino demo shape:

```sh
./zig-out/bin/rhino-nlcli run \
  --profile rhino-inside \
  --prompt "create organic blob size 1.8m named pod-a" \
  --session demo
```

Run a staged scientific shell demo from zero and export a 3D artifact:

```sh
./zig-out/bin/rhino-nlcli run \
  --profile rhino-inside \
  --prompt "create scientific shell size 2m named shell-a" \
  --session live-shell
```

Run an MPC Live II button-cap reference demo and export the inferred cap artifact:

```sh
./zig-out/bin/rhino-nlcli run \
  --profile rhino-inside \
  --prompt "create mpc live ii button cap named play-start-cap" \
  --session mpc-cap
```

Run an MPC Live II staged panel demo with checkpoint layers and a cap export:

```sh
./zig-out/bin/rhino-nlcli run \
  --profile rhino-inside \
  --prompt "create mpc live ii panel demo named mpc-live-ii-demo" \
  --session mpc-panel
```

Run a follow-up move command against the stored alias:

```sh
./zig-out/bin/rhino-nlcli run \
  --prompt "move staircase 500mm left" \
  --session demo
```

Inspect the session store:

```sh
./zig-out/bin/rhino-nlcli session show --session demo
```

Close the active headless document and clear its scoped aliases:

```sh
./zig-out/bin/rhino-nlcli document close --session demo
```

The supported runtime config surface is checked in as [.env.local.example](/Users/s3nik/Desktop/rhino-nlcli/.env.local.example). The CLI resolves values in this order: built-in defaults, `.env.local`, process environment variables, then CLI flags.

Accuracy note for the MPC Live II demo: the system uses official Akai chassis dimensions and official control naming, but the button-cap geometry is still a reference reconstruction. Until a factory part drawing or physical calibration measurement is added, it should be treated as inferred geometry rather than an exact production-cap model.

## Tooling Note

The Homebrew `zig` install on this machine failed to link even fresh `zig init` projects, so the repository includes an official Zig dev build under `.tools/` and exposes it through [`scripts/zig`](/Users/s3nik/Desktop/rhino-nlcli/scripts/zig) for repeatable local builds.

## Documentation Map

- [PRD.md](./PRD.md): original product requirements draft
- [VISION.md](./VISION.md): product direction, target users, and guiding principles
- [TECHSTACK.md](./TECHSTACK.md): implementation choices and technical rationale
- [ARCHITECTURE.md](./ARCHITECTURE.md): system decomposition, contracts, and execution flow
- [ROADMAP.md](./ROADMAP.md): phased delivery plan and milestone gates
- [CONTRIBUTING.md](./CONTRIBUTING.md): working agreements for future contributors
- [openspec/changes/bootstrap-rhino-first-cli/proposal.md](./openspec/changes/bootstrap-rhino-first-cli/proposal.md): first OpenSpec change proposal
- [openspec/changes/bootstrap-rhino-first-cli/design.md](./openspec/changes/bootstrap-rhino-first-cli/design.md): implementation design for the prototype slice
- [openspec/changes/bootstrap-rhino-first-cli/tasks.md](./openspec/changes/bootstrap-rhino-first-cli/tasks.md): implementation checklist for the prototype slice
- [openspec/changes/prepare-rhino-runtime-readiness/proposal.md](./openspec/changes/prepare-rhino-runtime-readiness/proposal.md): runtime configuration and Rhino readiness change proposal
- [openspec/changes/introduce-rhino-document-session/proposal.md](./openspec/changes/introduce-rhino-document-session/proposal.md): document-scoped Rhino execution change proposal
- [openspec/changes/expand-basic-rhino-solids/proposal.md](./openspec/changes/expand-basic-rhino-solids/proposal.md): expanded demo solid set change proposal

## Planned System Shape

| Layer | Responsibility |
| :--- | :--- |
| CLI / Client | Accept natural language, flags, and session context |
| Zig Core | Planning, validation, routing, math, persistence orchestration |
| Schema Layer | Ingest `docify` and other SDK-derived command definitions |
| Bridge Layer | Execute JSON-RPC commands in Rhino, Rive, and Unreal |
| Session Store | Track objects, aliases, command history, and bridge state |

## Guiding Constraints

- Headless-first: no GUI automation as a primary integration path
- Protocol-first: every execution path must be representable as structured JSON
- Deterministic core: math, units, validation, and routing live outside the LLM
- Dumb bridges: host workers should execute, report, and fail clearly
- App-agnostic growth: new hosts should plug into the same planning and IPC model

## What Success Looks Like

The first meaningful milestone is not "chatting with Rhino." It is a full closed loop:

1. Accept a prompt in the CLI.
2. Produce a structured plan against known Rhino commands.
3. Validate units and parameter types in Zig.
4. Execute via a headless Rhino bridge.
5. Persist returned object identifiers in SQLite.
6. Surface a result that can be referenced in a follow-up command.

Once that loop works reliably, the architecture can expand to Rive and Unreal without changing the core product model.
