## Why

`autoresearch-playground` already has a strong experiment backbone, but it does not yet have a stable architecture for the larger problem the user is aiming at: turning semantic intent into working full-stack software and improving it through an autonomous research loop.

Current app builders are strong at prompt-to-code or prompt-to-UI, but they still leak too much manual work into schema design, workflows, permissions, migrations, and long-term product evolution. Existing database-centric thinking is also too low-level for the target outcome. The real missing layer is a compact semantic kernel plus a proof harness that can compile intent into operational software and survive iterative change.

This proposal introduces **RALPH** as a new architecture direction inside the repo:

- **Research** the domain from prompts, examples, existing systems, and product artifacts
- **Abstract** that into a compact semantic intermediate representation
- **Lower** the IR into runtime targets such as storage, APIs, jobs, UI, and agent tools
- **Prove** the result with benchmarked verification
- **Harvest** every correction, failure, and edit as reusable signal

## What Changes

- Add a formal **semantic kernel** capability with a small inspectable IR
- Add an **application compiler** that lowers the IR into runtime adapters instead of generating one-off code blobs
- Add a **verification harness** that benchmarks generated systems and gates progress
- Add a **semantic studio** where humans inspect, edit, and diff the world model
- Add **runtime adapter** requirements, starting with Convex-first and expanding to Postgres/DuckDB-class targets
- Define how deep systems concepts from browsers, renderers, runtimes, and kernels inform the design without forcing a v1 storage engine rewrite

## Capabilities

### New Capabilities
- `semantic-kernel`: compact world model for entities, relations, state, policy, views, effects, and provenance
- `app-compiler`: deterministic compile pipeline from semantic IR to schema, functions, policies, UI surfaces, and agent tools
- `verification-harness`: benchmark corpus, migration replay, permission checks, workflow invariants, and cost/quality scoring
- `semantic-studio`: inspectable model editor with diffs, generated artifacts, and proof results
- `runtime-adapters`: adapter interface for Convex-first execution with later Postgres, DuckDB, and specialized targets

### Modified Capabilities
- `experiments-framework`: expands from isolated experiments to application-generation evaluation loops and benchmark replays

## Impact

- Creates a coherent path from the repo's autoresearch DNA into an **application OS** effort
- Shifts the center of gravity from ad hoc generation toward **semantic compilation + proof**
- Keeps v1 intentionally narrow: operational business software and agent-facing systems, not arbitrary consumer software or a new database engine
- Reuses the existing experiment framework as the measurement and iteration backbone
