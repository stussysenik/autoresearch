/**
 * Research phase definitions v2: Math + Visualization + Architecture
 *
 * Key changes from v1:
 * - 15-min timeout (was 5 min)
 * - Context summarization (was raw concatenation)
 * - New phases: math foundation, visualization engine, data model, creative exploration
 * - Lighter dependency chains to avoid context bloat
 */

import type { ResearchPhase } from './types.js'

export const phases: ResearchPhase[] = [
  // ─── Phase 0: Seed Discovery ───────────────────────────────────
  {
    id: 'phase-0',
    name: 'Seed Discovery',
    description: 'Map the complete research landscape for breakdancing analysis + visualization',
    seedQuestions: [
      'What systems exist for movement visualization in 3D? Cover: MotionBuilder, Rokoko Studio, Move.ai, DeepMotion, Cascadeur. How do they represent skeleton data, joint trajectories, and temporal motion trails?',
      'What are ALL the sub-problems in building a breakdancing analysis + 3D visualization system? Cover: pose estimation (COCO problem for inversions), audio analysis (beat detection, musicality), scoring (TRIVIUM system), physics simulation, and multi-engine rendering (Blender, UE5, Godot, Unity, Three.js).',
      'What mathematical frameworks exist for dance/movement analysis? Cover: Laban Movement Analysis, biomechanical modeling, information-theoretic measures of movement complexity, and spectral analysis of motion data.',
    ],
    dependencies: [],
    maxFollowups: 3,
    timeBudgetMinutes: 30,
    promptTemplate: `You are a research architect specializing in computer vision, 3D visualization, biomechanics, and music technology. Map the COMPLETE research landscape for building a breakdancing battle analysis system with multi-engine 3D visualization.

## Research Questions

{questions}

## Output Requirements

1. **Problem Taxonomy**: Every sub-problem, at least 3 levels deep
2. **Existing Systems**: Name specific tools, papers, engines with capabilities
3. **Visualization Landscape**: How do existing tools render motion trails, skeleton playback, temporal data?
4. **Mathematical Frameworks**: What formal models exist for dance analysis?
5. **Gap Analysis**: What doesn't exist yet? Where is the innovation opportunity?

Be exhaustive. This drives all subsequent research.`,
  },

  // ─── Phase 1: Mathematical Foundation ──────────────────────────
  {
    id: 'phase-1',
    name: 'Mathematical Foundation',
    description: 'TRIVIUM scoring model, physics simulation, movement spectrogram, formal proofs',
    seedQuestions: [
      'Design the complete TRIVIUM-extended scoring model for breakdancing. BODY (40%): technique = Σ(difficulty × execution)/N, vocabulary = Shannon entropy of move distribution, progression = slope(difficulty vs time), cleanliness = 1 - mean(wobble). SOUL (35%): musicality = corr(M(t), H(t)) where H(t) is the audio hotness from an 8-dimensional psychoacoustic signature, accent_hits, phrasing via DTW, groove_lock, creativity via novelty. MIND (25%): flow = velocity continuity, energy_mgmt, response quality, stage_use = spatial entropy. Formalize each sub-score mathematically with proofs of boundedness [0,1] and monotonicity.',
      'Define the Movement Spectrogram formally: S_m(j, t) = velocity(joint_j, t) where j indexes body joints and t is time. How does this relate to the audio spectrogram S_a(f, t) = |STFT(audio)|²? Derive the cross-correlation musicality metric μ = max_τ corr(M(t), H(t-τ)) for τ ∈ [-200ms, +200ms]. Prove it is bounded, continuous, and that negative τ (anticipation) scores higher than positive τ (reaction).',
      'Model breakdancing physics: For a 3D skeleton J(t) with joint positions, derive angular momentum L = Σ mᵢ(rᵢ × vᵢ), moment of inertia tensor I, kinetic energy KE = ½Σmᵢ|vᵢ|². During a windmill, L = Iω = constant. Show how I changes as the dancer extends/contracts limbs and prove ω adjusts to conserve L. Define an "execution quality" metric as deviation from ideal conservation: Q = 1 - ||ΔL|| / ||L||.',
      'Define the 8-dimensional audio signature from the existing MATLAB engine: BPM stability (autocorrelation), bass energy (20-250Hz RMS), vocal presence (300-3400Hz + HNR), beat strength (onset peaks), spectral flux (frame-to-frame change), rhythm complexity (onset density + syncopation CV), harmonic richness (peak count + tonality), dynamic range (crest factor). Show how H(t) = Σ wᵢDᵢ(t) maps to the movement spectrogram for cross-modal scoring.',
    ],
    dependencies: ['phase-0'],
    maxFollowups: 3,
    timeBudgetMinutes: 60,
    promptTemplate: `You are a mathematical physicist and music information retrieval researcher. You are building the formal mathematical foundation for a breakdancing analysis system.

## Prior Research Context

{context}

## Research Questions

{questions}

## Output Requirements

1. **Formal Definitions**: Every metric as a mathematical function with domain, range, units
2. **Proofs**: Boundedness, monotonicity, continuity for each scoring function. Use standard notation.
3. **Physics**: Angular momentum, energy conservation with concrete equations for breakdancing moves
4. **Cross-Modal**: How audio features map to movement features mathematically
5. **Notation**: Use LaTeX-compatible math notation throughout

Depth over breadth. Every claim must be mathematically justified.`,
  },

  // ─── Phase 2: Visualization Engine ─────────────────────────────
  {
    id: 'phase-2',
    name: 'Visualization Engine Design',
    description: 'Joint trajectory trails, voxel skeleton, color encoding, multi-engine rendering',
    seedQuestions: [
      'Design the core visualization concept: A 3D skeleton puppet replaying extracted motion, where each joint leaves a colored trail through (x,y,z) space. The trail encodes: velocity → hue (slow=blue, medium=green, fast=red), acceleration → brightness (decelerating=dim, accelerating=bright), time → alpha (older=transparent). The skeleton uses a voxelized/diced pixel-cube aesthetic. The camera supports seamless projection switching: (x,y) front view ↔ (x,z) top view ↔ (y,z) side view ↔ full 3D orbit. Define the data structures, color mapping functions, and rendering pipeline.',
      'For BLENDER (Python bpy): How to implement joint trajectory trails using Grease Pencil strokes or curve objects? How to create the voxelized skeleton using geometry nodes (cube instances at joint positions)? How to set up camera constraints for projection switching (orthographic with axis alignment)? How to sync animation playback with audio waveform? Provide specific Blender Python API patterns.',
      'For UNREAL ENGINE 5: How to implement joint trails using Niagara VFX system (ribbon renderers or particle trails)? How to drive skeleton animation via Control Rig from imported joint data? How to use Sequencer for synchronized audio-visual playback? How to implement the projection switching camera system? What about Nanite for the voxelized skeleton mesh?',
      'For GODOT 4, UNITY, and THREE.JS: (A) Godot: GPUParticles3D for trails, MeshInstance3D with MultiMesh for voxel cubes, AnimationPlayer for skeleton. (B) Unity: VFX Graph for particle trails, DOTS/ECS for performance with thousands of voxels, Timeline for sequenced playback. (C) Three.js: InstancedMesh for voxel cubes, Line2/TubeGeometry for trails, OrbitControls for camera, WebAudio API for sync. Compare performance characteristics for real-time playback at 30fps with 33 joints × 1000 trail points each.',
      'CREATIVE/RETRO modes: (A) PS1/PS2 aesthetic: vertex jitter shader (random vertex displacement per frame), low-poly skeleton, affine texture warping, limited color palette. (B) GTA V mod: ScriptHookV to inject custom bone visualization into RAGE engine, draw debug lines for trails. (C) ASCII terminal renderer: map joint positions to character grid, use ANSI color codes for velocity encoding. (D) LED light installation: map joint velocities to DMX channels for physical light show. What are the technical approaches for each?',
    ],
    dependencies: ['phase-0'],
    maxFollowups: 3,
    timeBudgetMinutes: 60,
    promptTemplate: `You are a technical artist and graphics programmer with expertise in Blender, Unreal Engine 5, Godot 4, Unity, and Three.js/WebGL. You are designing a multi-engine motion visualization system for breakdancing analysis.

## Prior Research Context

{context}

## Research Questions

{questions}

## Output Requirements

1. **Data Structures**: Define the rendering data model (joint positions, trail buffers, color maps)
2. **Per-Engine Implementation**: Specific API calls, node setups, shader approaches for EACH engine
3. **Performance Analysis**: FPS estimates for 33 joints × 1000 trail points per engine
4. **Color Mapping Functions**: Mathematical definition of velocity→hue, acceleration→brightness, time→alpha
5. **Projection System**: Camera rig design for seamless (x,y)↔(x,z)↔(y,z)↔3D switching
6. **Creative Modes**: Technical approach for PS2 jitter, GTA V mod, ASCII renderer, LED light show

Include code snippets (Python/GDScript/C#/GLSL) where helpful.`,
  },

  // ─── Phase 3: Data Model & Universal Format ────────────────────
  {
    id: 'phase-3',
    name: 'Data Model & Universal Format',
    description: 'Skeleton format, trajectory encoding, audio sync, multi-engine export',
    seedQuestions: [
      'Design a universal skeleton data format (JSON + binary) that feeds ALL rendering targets (Blender, UE5, Godot, Unity, Three.js). Must include: joint hierarchy (33 joints), per-frame positions (x,y,z), per-frame rotations (quaternion), timestamps, confidence scores. Also include: audio sync markers (beat timestamps, hotness values H(t)), move annotations (start/end frame, move family, difficulty). Define both a verbose JSON format (human-readable, debugging) and a compact binary format (streaming, real-time).',
      'Design the joint trajectory encoding: For each joint, the trail is a time series of (x,y,z,velocity,acceleration,timestamp). With 33 joints × 30fps × 60 seconds = 59,400 data points per minute. How to compress this efficiently? Delta encoding? Spline interpolation? Lossy quantization? What is the byte budget for: (a) real-time streaming over WebSocket, (b) file export for Blender, (c) iPhone local storage?',
      'Define the color mapping specification as a standalone config that all renderers share: velocity_to_hue(v) mapping function, acceleration_to_brightness(a), time_to_alpha(t, t_now). Also define alternative color schemes: (a) move-family coloring (toprock=blue, footwork=green, power=red, freeze=yellow), (b) scoring coloring (technique=gradient, musicality=pulse on beats), (c) physics coloring (kinetic energy magnitude). How to implement HSL color space transformations efficiently in each engine?',
      'Design the audio-visual sync format: How to align the MATLAB 8D audio features (500ms windows, 50% overlap) with the skeleton data (30fps)? Interpolation strategy? What about variable frame rates? Define a master timeline format that both audio and skeleton data reference. Include beat grid, downbeat markers, phrase boundaries, and hotness envelope H(t) as synchronized tracks.',
    ],
    dependencies: ['phase-1', 'phase-2'],
    maxFollowups: 2,
    timeBudgetMinutes: 45,
    promptTemplate: `You are a data architect specializing in real-time 3D data formats, motion capture pipelines, and cross-platform serialization. You are designing the universal data model for a breakdancing visualization system.

## Prior Research Context

{context}

## Research Questions

{questions}

## Output Requirements

1. **JSON Schema**: Complete, valid JSON Schema for the skeleton + audio format
2. **Binary Format**: Byte layout with field sizes, endianness, compression
3. **Size Estimates**: Bytes per second for each encoding at 30fps, 33 joints
4. **Color Mapping**: Mathematical functions with domain/range, implementable in any language
5. **Sync Protocol**: Timeline alignment strategy with concrete interpolation formulas
6. **Import/Export**: How each engine (Blender/UE5/Godot/Unity/Three.js) reads this format`,
  },

  // ─── Phase 4: Architecture & Integration ───────────────────────
  {
    id: 'phase-4',
    name: 'Architecture & Integration',
    description: 'Processing pipeline, MATLAB port, iPhone deployment, engine import paths',
    seedQuestions: [
      'Design the complete processing pipeline: (1) Video input (iPhone camera or file) → (2) MediaPipe BlazePose at 15-30fps (with rotation augmentation for inversions: run 0°/90°/180°/270°, pick highest confidence) → (3) 3D skeleton in normalized coordinates → (4) Movement feature extraction (velocity, angular momentum, energy, contacts) → (5) Move family classification (heuristic: velocity thresholds + contact patterns) → (6) Scoring (TRIVIUM model from Phase 1). What are the data formats between each stage? Latency budget per stage?',
      'Specify the MATLAB 8D audio engine port to Python: Map each MATLAB function to its Python equivalent using librosa + numpy + scipy. computeBPM → librosa.beat.beat_track + custom autocorrelation, computeBassEnergy → scipy.signal.butter bandpass + RMS, computeVocalPresence → librosa.feature.spectral_centroid + custom HNR, etc. What are the gotchas in porting MATLAB signal processing to Python (1-indexed vs 0-indexed, column-major vs row-major, FFT conventions)?',
      'iPhone deployment architecture: CoreML pose model (MoveNet or MediaPipe) + on-device audio processing (AVAudioEngine + Accelerate framework for FFT) + real-time scoring + export to universal format. What can run at 30fps on iPhone 14 Pro? What must be offloaded to post-processing? How to export skeleton + audio data for visualization in Blender/UE5/Three.js?',
      'How does each engine import the universal skeleton format? (A) Blender: Python script that creates armature + keyframes from JSON. (B) UE5: Custom C++ asset importer or LiveLink protocol. (C) Godot: GDScript parser loading into AnimationPlayer. (D) Unity: ScriptableObject or custom EditorWindow importer. (E) Three.js: fetch JSON, build BufferGeometry. Define the import pipeline for each.',
    ],
    dependencies: ['phase-1', 'phase-3'],
    maxFollowups: 2,
    timeBudgetMinutes: 45,
    promptTemplate: `You are a systems architect specializing in real-time ML pipelines, cross-platform development, and mobile deployment. You are designing the end-to-end architecture for a breakdancing analysis and visualization system.

## Prior Research Context

{context}

## Research Questions

{questions}

## Output Requirements

1. **Pipeline Diagram**: ASCII or mermaid diagram showing all stages with data formats
2. **MATLAB→Python Port Table**: Function-by-function mapping with gotchas
3. **iPhone Performance Budget**: Per-stage latency and memory on A16+ chip
4. **Per-Engine Import Code**: Pseudocode or snippets for each engine's importer
5. **Storage Estimates**: Bytes per minute of captured data at each quality level`,
  },

  // ─── Phase 5: Creative Exploration ─────────────────────────────
  {
    id: 'phase-5',
    name: 'Creative Exploration',
    description: 'AR/VR, broadcast overlay, generative art, battle replay, coaching modes',
    seedQuestions: [
      'What visualization modes would be most insightful for COACHING? Consider: (a) side-by-side comparison (your attempt vs. reference move), (b) ghost overlay (semi-transparent reference skeleton doing the move while you try), (c) timing graph (movement peaks vs beat alignment shown as a timeline), (d) energy heatmap (body regions colored by effort level), (e) vocabulary wheel (pie chart of move types used, updating in real-time).',
      'Design a "battle replay" experience for each engine: After a battle round, replay both dancers\' skeletons in 3D with trails, synced to the music. Overlay scores per move. Allow slow-motion, freeze-frame, camera orbit. What would this look like in (a) Blender (cinematic render), (b) UE5 (interactive real-time), (c) Three.js (shareable web link), (d) Godot (lightweight app)?',
      'Explore AR and VR possibilities: (a) iPhone ARKit: overlay joint trails on real video feed in real-time — see your motion trails as you dance. (b) Apple Vision Pro: spatial computing, 3D trails floating in your practice space. (c) Meta Quest: step inside the cypher, see trails from any angle including dancer\'s POV. What are the technical requirements for each? What SDKs and rendering approaches?',
      'Generative art and creative applications: (a) Using movement data to generate visual art (trail paths as brush strokes, velocity as color). (b) Music video production: automatic choreography visualization with stylized rendering. (c) LED light installation: map real-time joint data to physical lights at a venue. (d) Projection mapping: project trail visualization onto the dance floor during a battle. (e) NFT/digital collectible: mint a dancer\'s signature move as a unique 3D visualization. What technologies enable each?',
    ],
    dependencies: ['phase-2'],
    maxFollowups: 3,
    timeBudgetMinutes: 45,
    promptTemplate: `You are a creative technologist, AR/VR designer, and digital artist. You are exploring the creative possibilities of a breakdancing motion visualization system.

## Prior Research Context

{context}

## Research Questions

{questions}

## Output Requirements

1. **Coaching Modes**: Detailed UX design for each mode with wireframe descriptions
2. **Battle Replay**: Per-engine implementation approach with visual style guide
3. **AR/VR**: SDK requirements, rendering pipeline, performance constraints
4. **Generative Art**: Algorithmic art generation from motion data — include example algorithms
5. **Wild Ideas**: Push beyond the obvious. What would blow a dancer's mind?

Be creative. This phase is about possibilities, not constraints.`,
  },
]

/**
 * Prompt for the self-identification gap analysis loop.
 */
export const GAP_ANALYSIS_PROMPT = `You are a critical research reviewer. Given the following research output, identify the most important gaps:

## Research Output

{research}

## Task

Identify 1-3 gaps in the research. For each gap:
1. **What's missing**: Specific question or analysis that's absent
2. **Why it matters**: How this gap affects the overall system design
3. **Priority**: critical / important / nice-to-have

Only list gaps rated "critical" or "important". If the research is thorough and no meaningful gaps exist, respond with exactly: "NO_GAPS"

Format each gap as:
### Gap N: [title]
**Missing**: [specific question]
**Why**: [impact]
**Priority**: [critical/important]`
