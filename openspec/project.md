# Project Context

## Purpose
`autoresearch-playground` started as a Karpathy-style autonomous experimentation repo. It now also serves as the planning ground for a broader system: a semantic application OS that can research, model, compile, verify, and evolve software from intent.

## Tech Direction
- **Current repo strengths:** experiment loops, variant evaluation, audit trails, reproducible workflows
- **Planned core stack:** TypeScript/Bun for orchestration and studio tooling, Python for research/modeling pipelines, Convex/Postgres adapters for transactional runtime, DuckDB for analytics/evals, browser automation for verification
- **Deferred systems work:** custom storage engines, custom rendering engines, OS/runtime kernels

## Project Conventions

### Product Philosophy
- Start with a narrow wedge that proves the abstraction
- Optimize for human-editable outputs, not opaque generation
- Prefer a small semantic IR over large prompt-only systems
- Every autonomous step must have a verification boundary

### Architecture Patterns
- Semantic kernel first, storage/runtime second
- Deterministic compiler passes before free-form generation
- Adapters around runtime targets (`Convex`, `Postgres`, `DuckDB`, future render/game/GPU targets)
- Research loops feed a reusable concept library and eval corpus

### Testing Strategy
- Build verification harnesses before broad capability claims
- Validate generated systems through compile checks, migration checks, API tests, browser flows, policy tests, and replayed change requests
- Treat human corrections as first-class feedback artifacts

## Domain Context
- Business applications are the initial wedge: workflows, approvals, CRM-ish systems, internal tools, agent control planes
- The long-term system may expand to richer targets such as interactive simulations, game-like state systems, and GPU-backed tooling, but those are not v1 requirements
- Prior local project patterns worth reusing include hybrid multi-runtime systems (`own-net`), autoresearch loops (`autoresearch-playground`), shader/render experiments (`lua-shaders`, `zig-image-carousel`), and semantic/product-heavy apps (`mymind-clone-web`, `coda`)

## Important Constraints
- Do not build a new database in v1
- Do not put an LLM in the critical path of ordinary reads/writes
- Generated systems must be inspectable, editable, and migratable
- Custom runtime/kernel work only begins after the semantic kernel and harness prove durable value
