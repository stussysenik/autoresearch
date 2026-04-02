# Part 1

To build this fast and keep it universal, you should lean into the **"Headless Hub"** model. Since you're targeting Rhino, Rive, and Unreal, the goal is to stop treating them as "apps" and start treating them as **Geometry/Animation Microservices**.

Here is how to build this "NLCI" (Natural Language Command Interface) at high speed using the 2026 stack.

-----

## 1\. The Strategy: Command Mapping via `docify`

Don't write your own command schemas. Use McNeel’s `docify` project to scrape the **RhinoCommon SDK** directly. This gives you a JSON object of every possible Rhino command, its required inputs (Point3d, Vector3d, etc.), and descriptions.

  * **Fast Path**: Feed the `docify` JSON outputs directly into your LLM's context window (or a RAG vector DB). Now, your agent "knows" exactly what `Rhino.Geometry.Brep.CreateFromOffsetCurve` requires without you ever typing a line of CAD code.

## 2\. The Universal "Nervous System" (The IPC Bridge)

To be "universal for anything," you need a standard way to talk to these apps. Use **JSON-RPC over Named Pipes** (on Windows) or **Unix Domain Sockets** (on macOS).

  * **Why?** It’s faster than HTTP and doesn't require managing ports.
  * **The Zig Core**: Your main agent (the "Brain") stays in **Zig**. It manages the state and sends JSON packets to "Workers" (Rhino, Rive, Unreal).

| App | Bridge Method | Best Use Case |
| :--- | :--- | :--- |
| **Rhino 8** | `Rhino.Inside` (.NET Console) | Heavy geometry generation & NURBS calculations. |
| **Rive** | `rive-cpp` + Luau | Real-time UI, vector animation, and state machines. |
| **Unreal** | Python Editor Scripting | Scene orchestration, lighting, and cinematic rendering. |

## 3\. High-Speed Architecture: The NLCI Pattern

### Layer 1: The Brain (Zig + LLM)

Your Zig daemon takes the prompt: *"Draw a 5m spiral staircase in Rhino and animate the first step in Rive."* 1.  **Intent Extraction**: LLM identifies two targets: `rhino` and `rive`.
2\.  **Constraint Solving**: LLM generates the parameters (Radius=5.0, Steps=20).
3\.  **Dispatch**: Zig sends a JSON packet to the Rhino Pipe and the Rive Pipe.

### Layer 2: The Adapters (Headless Workers)

  * **Rhino Bridge**: A headless C\# app using `Rhino.Inside`. It receives `{"cmd": "AddSpiral", "params": {...}}`, executes it in a virtual `RhinoDoc`, and returns the GUID of the created geometry.
  * **Rive Bridge**: A C++ wrapper around `rive-runtime`. It can trigger a state machine transition or update a "StepVisible" boolean in the `.riv` file programmatically.

-----

## 4\. Risks & Reality Check

  * **Licensing**: Even in headless mode, **Rhino requires a valid license**. If you're building this for a cloud service, you’ll need to manage a "Zoo" license server to check out seats for your worker instances.
  * **Rive Rendering**: The open-source `rive-cpp` runtime is great for logic, but if you want the high-end "Renderer" features (like blurry shadows or complex gradients), you need to ensure your bridge is linked to the correct graphics backend (Sokol, GL, etc.).
  * **Precision**: LLMs are bad at math. **Pro-tip**: Have the LLM output a formula or a Zig script, then execute that script in Zig to get the *exact* coordinates before sending them to Rhino.

-----

### Implementation Roadmap

1.  **Week 1**: Set up a **Zig** daemon that can send a "Hello World" JSON to a C\# **Rhino.Inside** console app.
2.  **Week 2**: Use `docify` to generate a command list. Give it to **GLM-4.7** and ask it to "map user intent to these JSON commands."
3.  **Week 3**: Implement the "Session Manager" in **SQLite** so the agent remembers that "the staircase" is `Object_ID: 98234-AX`.

[Learn how Rhino.Inside works for headless automation](https://www.google.com/search?q=https://www.youtube.com/watch%3Fv%3DFjIuX8Kx_6I)
This video is relevant because it demonstrates how to run Rhino's geometry engine inside other applications without the GUI, which is the core requirement for your headless "Rhino Bridge."

# Part 2

This Product Requirements Document (PRD) outlines the development of the **Universal Natural Language Command Interface (NLCI)**. This system acts as a headless "Command Hub" that translates natural language into deterministic API executions for Rhino, Rive, and Unreal Engine.

---

# PRD: Universal NLCI (Natural Language Command Interface)

## 1. Executive Summary
**Objective**: Build a high-speed, headless agent that allows users to create, manipulate, and orchestrate assets across Rhino (Geometry), Rive (UI/Animation), and Unreal (Scene/Render) using natural language.
**Core Philosophy**: "Deterministic Execution of Stochastic Intent." The LLM identifies the *intent*, but a Zig-based core handles the *logic and routing* to ensure CAD-grade precision.

---

## 2. Target Persona & Use Cases
* **The Power Designer**: Rapidly prototyping complex Rhino geometry without manual menu-diving.
* **The Technical Artist**: Orchestrating a scene in Unreal while simultaneously updating UI state machines in Rive.
* **The Developer**: Using the system as a "Creation API" to build generative design tools.

---

## 3. Functional Requirements

### 3.1. Intent Extraction & Command Mapping (The Brain)
* **SDK Parsing**: The system must ingest JSON schemas generated by McNeel’s `docify` to maintain an up-to-date vocabulary of RhinoCommon.
* **Multi-App Planning**: The agent must be able to decompose a single prompt into a sequence of commands across different apps (e.g., "Export from Rhino, Import to Unreal").
* **Parameter Validation**: Before execution, the system must validate that LLM-generated coordinates and types match the target SDK (e.g., `Point3d` vs. `Vector3d`).

### 3.2. Headless Host Bridges (The Nervous System)
Each bridge must be a lightweight, "dumb" listener that executes structured JSON.
* **Rhino Bridge**: C# / .NET Core using `Rhino.Inside`. Must support `HeadlessDoc` creation and `RhinoCommon` command execution.
* **Rive Bridge**: C++ runtime using `rive-cpp`. Must support artboard state machine triggers and property manipulation.
* **Unreal Bridge**: Python-based editor bridge. Must support Actor spawning, Material assignment, and Sequencer control.

### 3.3. Communication & Persistence
* **IPC Protocol**: Use **JSON-RPC 2.0** over **Named Pipes** (Windows) or **Unix Domain Sockets** (macOS) for sub-millisecond latency.
* **State Management**: A **SQLite** database must track:
    * `Object_IDs`: Mapping "that red cube" to a specific GUID in Rhino or an Actor in Unreal.
    * `Undo/Redo Stack`: A historical log of JSON commands for state reversal.

---

## 4. Technical Architecture


| Component | Tech Stack | Responsibility |
| :--- | :--- | :--- |
| **Core Daemon** | Zig | Orchestration, IPC management, and math verification. |
| **LLM Engine** | GLM-4.7 (Local) / Claude 3.5 (Cloud) | NL to JSON-RPC translation. |
| **Database** | SQLite | Session context and GUID mapping. |
| **Bridges** | C# (Rhino), C++ (Rive), Python (Unreal) | Executing SDK-specific calls. |

---

## 5. User Flow
1.  **Input**: User types "Spiral staircase, 10 steps, 3m tall" in the CLI/Interface.
2.  **Analysis**: The Zig Core sends the prompt to the LLM with the `docify` schema context.
3.  **Refinement**: LLM returns a JSON sequence for `Rhino.Geometry`.
4.  **Verification**: Zig Core checks if "3m" needs unit conversion to "3000mm" based on the active RhinoDoc.
5.  **Execution**: JSON is pushed to the Rhino Named Pipe.
6.  **Feedback**: Rhino returns a `Success` message and the `GUIDs` of the steps.
7.  **Sync**: SQLite updates the session: `{"Step_1": "GUID_XYZ..."}`.

---

## 6. Non-Functional Requirements
* **Performance**: Total round-trip latency (Prompt to Execution Start) should be $< 2$ seconds.
* **Portability**: Core daemon must be a single static binary (Zig advantage).
* **Reliability**: The Bridge must fail gracefully; a crash in the Unreal Python script must not crash the Zig Core.

---

## 7. Risks & Mitigations
* **Risk**: LLM Hallucinations in CAD coordinates.
    * *Mitigation*: Implement a "Review Step" where the Zig Core prints the planned coordinates for confirmation if the delta is $> X$ units.
* **Risk**: Rhino Licensing in Headless mode.
    * *Mitigation*: Build a license-check heartbeat in the C# bridge to alert the user if Rhino/Zoo is unreachable.
* **Risk**: Divergent State (Object deleted in Rhino but still in SQLite).
    * *Mitigation*: Implement a periodic "Sync" command that polls the Host Bridge for current scene GUIDs.

---

## 8. Success Metrics
* **Command Accuracy**: $\%$ of NL prompts resulting in valid, executable JSON.
* **Latency**: Average time from prompt to visual feedback in the target app.
* **Cross-Pollination**: Successful execution of a single prompt affecting two or more apps simultaneously.
*
