# Vision

## North Star

Build a universal command layer for creative software that lets users describe intent in natural language and get deterministic, auditable results across geometry, animation, and scene tools.

The long-term goal is not a chatbot for desktop apps. The goal is an execution system that can sit behind CLIs, agents, internal tools, or productized creation workflows.

## The Problem

Advanced creative pipelines are still tool-siloed.

- Rhino excels at precise geometry and NURBS operations.
- Rive excels at interactive vector animation and state machines.
- Unreal excels at scenes, assets, lighting, and rendering.

Crossing those environments usually requires handoffs, manual export/import steps, and tool-specific scripting knowledge. That makes multi-tool creation slower than it should be and harder to automate safely.

## The Product Bet

The central bet of NLCI is that natural language is a good interface for intent, but a poor interface for execution.

That leads to a strict split of responsibilities:

- The LLM interprets what the user means.
- The core system decides whether the interpretation is executable.
- The bridges perform narrow, typed, host-specific actions.

This split is what makes the system suitable for precision-heavy domains like CAD and technical content pipelines.

## Who This Is For

### Power Designers

Users who know what they want to build in Rhino but want to avoid repetitive command choreography and menu traversal.

### Technical Artists

Users who need coordinated outcomes across tools, such as changing geometry in Rhino while updating motion states in Rive or sequencing content in Unreal.

### Tool Builders

Developers building higher-level creation products who need a stable execution substrate instead of custom one-off automations for every host.

## Product Principles

### Deterministic Execution Over Chat Fluency

A pleasant prompt interface matters, but trustworthy execution matters more. Plans must be inspectable, type-checked, and reversible.

### Headless-First Integration

Preferred integrations are SDKs, runtimes, and embedded engines. Screen driving and GUI automation are fallback strategies, not the platform foundation.

### Schema-Derived Capability

Where possible, the system should derive its command vocabulary from authoritative SDK documentation and machine-readable schemas instead of hand-maintained prompt prose.

### Host Workers Stay Dumb

Bridges should not become mini-agents. They should receive structured requests, execute them, and report results or errors. Intelligence belongs in the planner and validator layers.

### State Must Be Durable

If the user says "move the red stair tread I made earlier," the system needs stable identifiers, aliases, and a trustworthy session model. Stateless prompting is not enough.

### Precision Is a System Responsibility

Unit conversion, coordinate normalization, formula evaluation, and safety checks should be handled by deterministic code, not delegated to a language model.

## v1 Boundaries

The initial version should prove four things:

1. Natural language can be mapped onto a real SDK-derived command space.
2. A Zig core can validate and route commands to a headless bridge.
3. The system can preserve object identity across follow-up prompts.
4. Failures in one host do not crash the rest of the system.

The first version does not need to solve every creative workflow. It needs to prove the architecture under real constraints.

## What We Are Not Building First

- A general-purpose autonomous design agent
- A GUI-heavy desktop product
- A plugin marketplace
- Visual workflow builders
- End-user collaboration features

Those can come later if the execution substrate is strong. They should not shape the first implementation.

## Success Signals

The product is moving in the right direction if it can:

- Turn free-form prompts into valid, executable command plans
- Maintain low-latency execution startup
- Preserve object references across a working session
- Execute a single prompt across multiple hosts with clear result reporting
- Recover cleanly from bridge failure without corrupting session state
