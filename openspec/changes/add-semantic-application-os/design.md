## Context

The target system is an application OS that can convert semantic intent into working software. It must eventually understand deeper systems topics like rendering, browser constraints, OS/runtime trade-offs, and possibly GPU-style execution models. However, the path to that future should start with a compact semantic kernel and a narrow product wedge, not with infrastructure maximalism.

`autoresearch-playground` already contains the right cultural primitive: a disciplined loop that proposes, runs, measures, and keeps only what survives evidence. This design extends that loop from "experiment variants" to "application synthesis."

## Goals / Non-Goals

**Goals:**
- Define a smallest credible v1 for a semantic application OS
- Keep the semantic kernel small, inspectable, and compilable
- Make generated software verifiable and editable by humans
- Reuse boring runtime substrates first (`Convex`, `Postgres`, `DuckDB`)
- Use specialist agents with explicit responsibilities and tool boundaries
- Build a harness that can replay prompts, imports, change requests, and corrections

**Non-Goals:**
- Building a new database engine in v1
- Building a new browser engine, renderer, or OS kernel in v1
- Claiming support for all software categories from day one
- Putting LLMs in the critical path of every runtime operation
- Hiding system state inside prompts with no canonical IR

## Decisions

### Decision 1: The semantic kernel is the product boundary

**Choice**: Define a compact canonical IR as the system of record.

**IR primitives**:
- `Concept`
- `Entity`
- `Attribute`
- `Relation`
- `Statechart`
- `Action`
- `Constraint`
- `Policy`
- `View`
- `Effect`
- `Artifact`
- `Provenance`

**Rationale**: The durable moat is not storage. It is the ability to represent software meaningfully enough that multiple runtimes can be generated, verified, and evolved safely. A small IR also makes migrations, diffs, and review possible.

### Decision 2: Start with business applications, not arbitrary software

**Choice**: The initial wedge is multi-user, stateful business software.

**Included**:
- approvals and workflows
- CRM-ish object systems
- internal tools
- agent control planes
- structured knowledge systems

**Deferred**:
- full game engines
- arbitrary consumer apps
- browser-engine-like layout/render systems
- GPU compute pipelines as first-class targets

**Rationale**: These systems share the most leverageable semantics: entities, workflows, policies, permissions, dashboards, forms, queues, and automations.

### Decision 3: RALPH is a loop, not a one-shot generator

**Choice**: Formalize the loop as:
- `R` Research domain sources and adjacent systems
- `A` Abstract into canonical IR
- `L` Lower into runtime targets
- `P` Prove behavior through the harness
- `H` Harvest corrections back into concept and eval memory

**Rationale**: One-shot app generation is brittle. Durable systems need feedback loops, replay, and correction memory.

### Decision 4: Separate research-time intelligence from run-time determinism

**Choice**: Use LLMs and research agents for:
- concept extraction
- schema proposals
- workflow inference
- migration suggestions
- UI/view proposals

Keep runtime execution deterministic for:
- reads and writes
- transaction handling
- policy enforcement
- workflow transitions
- derived views

**Rationale**: This preserves correctness and operational clarity while still exploiting model intelligence where it is strongest.

### Decision 5: Use adapters around boring substrates first

**Choice**:
- `Convex` adapter for reactive, function-centric transactional apps
- `Postgres` adapter for relational durability, reporting, and ecosystem compatibility
- `DuckDB` adapter for local analytics, evaluation, replay analysis, and artifact inspection

**Rationale**: The semantic kernel should outlive any one backing store. V1 wins by proving the kernel and harness, not by reimplementing storage engines.

### Decision 6: Treat deep systems knowledge as target modules

**Choice**: Browser/rendering/kernel/GPU expertise informs the architecture, but it lands in target-specific effect systems and compilers rather than the v1 kernel.

**Examples**:
- browser-style layout and paint become future UI/runtime targets
- game/ECS-like state systems become future state/effect targets
- GPU pipelines become future compute graph targets

**Rationale**: These domains matter, but collapsing them into the first release would destroy focus. The kernel should be broad enough to host them later without pretending all targets are already solved.

### Decision 7: Build a startup-team-style agent org with bounded contracts

**Choice**: Introduce explicit agent roles:
- `Research Lead`: gathers examples, repos, docs, schemas, screenshots, and norms
- `Semantic Architect`: drafts IR, concepts, constraints, and policies
- `Runtime Engineer`: chooses adapters, storage shapes, indexes, and execution boundaries
- `Product Engineer`: proposes views, forms, dashboards, and interaction surfaces
- `Verification Engineer`: writes replay suites, browser tests, policy checks, and migration checks
- `Integrator`: merges accepted outputs into the canonical change set

**Function-calling contracts**:
- No agent writes directly to production runtime artifacts without a structured diff
- Verifier must run after compilation and before acceptance
- Integrator is the only role allowed to advance the canonical IR snapshot

**Rationale**: This mirrors a disciplined startup team more closely than a monolithic "builder agent."

### Decision 8: Make migrations first-class and reviewable

**Choice**: Every change to the IR emits:
- semantic diff
- storage diff
- policy diff
- workflow diff
- data backfill requirements
- breakage risk summary

**Rationale**: Generated systems die when evolution is unsafe. Migration literacy must exist from the start.

### Decision 9: Keep the generated system editable, but make the studio authoritative

**Choice**: Humans can edit emitted code and configuration, but the canonical source of truth remains the semantic model plus explicit overrides.

**Rationale**: Pure generators trap users. Pure handwritten code loses the semantic layer. The balance is a model-first system with controlled escape hatches.

## Risks / Trade-offs

| Risk | Severity | Mitigation |
|------|----------|------------|
| The scope expands into "solve all software" | High | Hold the wedge to business applications until the harness shows repeatable wins |
| The IR becomes too abstract to compile well | High | Keep primitives minimal and drive additions through failed benchmarks |
| Prompt-derived models drift from reality | High | Use imports, examples, screenshots, existing schemas, and human review as grounding sources |
| Generated apps feel generic | Medium | Make views, workflows, and policy semantics first-class instead of stopping at CRUD |
| Adapter complexity fragments the architecture | Medium | Require the kernel to remain storage/runtime agnostic and keep targets behind narrow interfaces |
| Human escape hatches corrupt the model | Medium | Record overrides explicitly and fold accepted overrides back into the IR or adapter rules |
| Deep systems ambitions stall v1 | High | Treat render/kernel/GPU work as later target modules, not day-one deliverables |

## Delivery Plan

### Phase 0: Benchmark Corpus and Harness
- Define 10 benchmark application families
- Define 20 canonical change requests
- Define acceptance checks for compile, runtime, browser, policy, and migration behavior

### Phase 1: Semantic Kernel
- Implement IR schema and diff format
- Support prompt + structured-input + import workflows
- Build provenance tracking for every inferred concept

### Phase 2: Compiler and Runtime Adapters
- Lower the IR to a Convex-backed runtime first
- Add a Postgres adapter for comparison and compatibility
- Use DuckDB for analysis, replay, and trace introspection

### Phase 3: Studio and Review Loop
- Build model editing UI
- Show semantic diffs, workflow graphs, and migration previews
- Allow constrained overrides and regeneration

### Phase 4: Verification and Harvest Loop
- Replay prompts and changes
- Capture human edits and runtime failures
- Distill reusable concepts, policies, and workflow templates

### Phase 5: Expanded Targets
- Add richer interaction/view compilers
- Explore render, simulation, or compute targets where benchmarks justify it

## Open Questions

1. Should the first runtime target be Convex-only, or should Postgres ship in the first milestone for portability?
2. What is the minimum useful import set for grounding an app: prompt only, schema import, repo import, screenshot import, or all of the above?
3. Should policies be defined as a declarative DSL inside the IR, or emitted as host-language code with generated tests?
4. How much of the studio should itself be generated from the IR versus handcrafted for clarity?
5. When the system eventually targets richer render/simulation domains, do we extend the base IR or attach domain-specific effect algebras?
