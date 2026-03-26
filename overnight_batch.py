"""
Overnight CPU Batch Job — Breaking Analytics Engine Validation

Runs on Lightning.ai CPU job using the shared /teamspace filesystem.
No GPU needed. Validates the engine on real BRACE data.

Tasks:
1. Load BRACE segments.csv → MoveEvent format
2. Build transition graph from 1,352 labeled segments
3. Compute style signatures for all 64 dancers
4. Extract MoveSignature from seq4 3D skeleton (23 segments)
5. Test signature discrimination (toprock vs power vs footwork)
6. Generate first real pitch PDF
7. Write validation report
"""

import csv
import json
import os
import sys
import time
from pathlib import Path
from collections import defaultdict
from datetime import datetime

import numpy as np

# Ensure project root is on path
PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

BRACE_DIR = Path("/teamspace/studios/this_studio/data/brace")
RESULTS_DIR = Path("/teamspace/studios/this_studio/experiments/results")
OUTPUT_DIR = PROJECT_ROOT / "overnight" / "batch_results"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

report_lines = []
def log(msg):
    ts = datetime.now().strftime("%H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    report_lines.append(line)


# ─────────────────────────────────────────────────────────────────
# TASK 1: Load BRACE segments → MoveEvent
# ─────────────────────────────────────────────────────────────────
log("TASK 1: Loading BRACE segments.csv → MoveEvent format")
from graphs.transition import MoveEvent

segments_path = BRACE_DIR / "annotations" / "segments.csv"
all_events = []
events_by_video = defaultdict(list)
events_by_dancer = defaultdict(list)

with open(segments_path) as f:
    reader = csv.DictReader(f)
    for row in reader:
        # Map BRACE dance_type to our taxonomy
        move_type_map = {
            "toprock": "toprock",
            "powermove": "power",
            "footwork": "footwork",
        }
        move_type = move_type_map.get(row["dance_type"], row["dance_type"])

        event = MoveEvent(
            move_type=move_type,
            start_frame=int(row["start_frame"]),
            end_frame=int(row["end_frame"]),
            dancer_id=row["dancer"],
            difficulty=0.5,  # default, no BRACE difficulty labels
            quality=0.5,
        )
        all_events.append(event)
        events_by_video[row["video_id"]].append(event)
        events_by_dancer[row["dancer"]].append(event)

log(f"  Loaded {len(all_events)} segments from {len(events_by_video)} videos, {len(events_by_dancer)} dancers")

from collections import Counter
type_counts = Counter(e.move_type for e in all_events)
for t, c in type_counts.most_common():
    log(f"    {t}: {c}")


# ─────────────────────────────────────────────────────────────────
# TASK 2: Build transition graph from ALL labeled segments
# ─────────────────────────────────────────────────────────────────
log("\nTASK 2: Building transition graph from 1,352 labeled segments")
from graphs.transition import build_transition_graph, get_top_transitions, get_transition_matrix, steady_state_distribution

# Build sequences per video (segments are already ordered by frame)
sequences = []
for vid, events in events_by_video.items():
    sorted_events = sorted(events, key=lambda e: e.start_frame)
    sequences.append(sorted_events)

graph = build_transition_graph(sequences, min_count=2)
log(f"  Transition graph: {graph.number_of_nodes()} nodes, {graph.number_of_edges()} edges")

# Top transitions per move type
for move in ["toprock", "power", "footwork"]:
    top = get_top_transitions(graph, move, k=3)
    log(f"  After {move}: {[(m, f'{p:.2f}') for m, p in top]}")

# Steady state
steady = steady_state_distribution(graph)
log(f"  Steady-state distribution: {dict(sorted(steady.items(), key=lambda x: -x[1]))}")

# Transition matrix
matrix, labels = get_transition_matrix(graph)
np.save(OUTPUT_DIR / "transition_matrix.npy", matrix)
log(f"  Transition matrix saved ({matrix.shape})")


# ─────────────────────────────────────────────────────────────────
# TASK 3: Style signatures for all 64 dancers
# ─────────────────────────────────────────────────────────────────
log("\nTASK 3: Computing style signatures for 64 dancers")
from graphs.style import compute_style_signature, compare_styles

dancer_sequences = {}
for dancer, events in events_by_dancer.items():
    # Group by video to get proper sequences
    by_vid = defaultdict(list)
    for e in events:
        # Find which video this event belongs to
        for vid, vid_events in events_by_video.items():
            if e in vid_events:
                by_vid[vid].append(e)
                break
    dancer_sequences[dancer] = [sorted(evts, key=lambda e: e.start_frame) for evts in by_vid.values()]

signatures = []
dancer_names = []
for dancer, seqs in dancer_sequences.items():
    try:
        sig = compute_style_signature(seqs, dancer)
        signatures.append(sig)
        dancer_names.append(dancer)
    except Exception as exc:
        log(f"  WARNING: Failed for {dancer}: {exc}")

log(f"  Computed {len(signatures)} style signatures")

# Most central moves per dancer
from collections import Counter
central_moves = Counter(s.most_central_move for s in signatures)
log(f"  Most common central move: {central_moves.most_common()}")

# Pairwise similarity
if len(signatures) >= 2:
    sim_matrix = compare_styles(signatures)
    np.save(OUTPUT_DIR / "style_similarity_matrix.npy", sim_matrix)
    log(f"  Style similarity matrix: {sim_matrix.shape}")
    log(f"    Mean similarity: {sim_matrix[sim_matrix < 0.99].mean():.3f}")
    log(f"    Min similarity: {sim_matrix.min():.3f}")
    log(f"    Max similarity (non-self): {sim_matrix[sim_matrix < 0.99].max():.3f}")

    # Most similar pair
    mask = np.triu(np.ones_like(sim_matrix, dtype=bool), k=1)
    masked = sim_matrix.copy()
    masked[~mask] = -1
    i, j = np.unravel_index(np.argmax(masked), sim_matrix.shape)
    log(f"    Most similar dancers: {dancer_names[i]} & {dancer_names[j]} ({sim_matrix[i,j]:.3f})")

    # Most different pair
    masked[~mask] = 2
    i, j = np.unravel_index(np.argmin(masked), sim_matrix.shape)
    log(f"    Most different dancers: {dancer_names[i]} & {dancer_names[j]} ({sim_matrix[i,j]:.3f})")


# ─────────────────────────────────────────────────────────────────
# TASK 4: Extract MoveSignatures from seq4 real 3D data
# ─────────────────────────────────────────────────────────────────
log("\nTASK 4: Extracting MoveSignatures from seq4 real 3D skeleton")

joints_3d = np.load(RESULTS_DIR / "joints_3d_REAL_seq4.npy").astype(np.float64)
log(f"  Loaded joints_3d_REAL_seq4.npy: {joints_3d.shape}")

# Get seq4 segment boundaries from BRACE
seq4_vid = "RS0mFARO1x4"
seq4_segments = sorted(events_by_video.get(seq4_vid, []), key=lambda e: e.start_frame)
log(f"  RS0mFARO1x4 has {len(seq4_segments)} labeled segments")

# seq4 = frames 3802-4801 in the original video
SEQ4_OFFSET = 3802
from algebra.signature import extract_signature
from algebra.similarity import move_distance, pairwise_distances

seg_signatures = []
seg_labels = []

for seg in seq4_segments:
    # Map to seq4 local frame indices
    local_start = seg.start_frame - SEQ4_OFFSET
    local_end = seg.end_frame - SEQ4_OFFSET

    # Skip segments outside seq4 range
    if local_start < 0 or local_end > joints_3d.shape[0]:
        continue
    if local_end - local_start < 15:  # need at least 15 frames
        continue

    seg_joints = joints_3d[local_start:local_end]
    try:
        sig = extract_signature(seg_joints, fps=30.0, move_type=seg.move_type)
        seg_signatures.append(sig)
        seg_labels.append(seg.move_type)
        log(f"    {seg.move_type} [{local_start}:{local_end}] ({local_end-local_start} frames): "
            f"complexity={sig.complexity:.3f}, smoothness={sig.smoothness:.3f}, symmetry={sig.symmetry:.3f}")
    except Exception as exc:
        log(f"    SKIP {seg.move_type} [{local_start}:{local_end}]: {exc}")

log(f"  Extracted {len(seg_signatures)} signatures from seq4")

# Also extract full-clip signature
full_sig = extract_signature(joints_3d, fps=30.0, move_type="unknown")
log(f"  Full clip signature: complexity={full_sig.complexity:.3f}, smoothness={full_sig.smoothness:.3f}")
log(f"    rotation_count={full_sig.rotation_count}, pivot_stability={full_sig.pivot_stability}")


# ─────────────────────────────────────────────────────────────────
# TASK 5: Signature discrimination test
# ─────────────────────────────────────────────────────────────────
log("\nTASK 5: Signature discrimination — do move types separate?")

if len(seg_signatures) >= 2:
    distances = pairwise_distances(seg_signatures)
    np.save(OUTPUT_DIR / "signature_distances.npy", distances)

    # Compute within-type and between-type distances
    n = len(seg_signatures)
    within_dists = []
    between_dists = []

    for i in range(n):
        for j in range(i + 1, n):
            d = distances[i, j]
            if seg_labels[i] == seg_labels[j]:
                within_dists.append(d)
            else:
                between_dists.append(d)

    if within_dists and between_dists:
        mean_within = np.mean(within_dists)
        mean_between = np.mean(between_dists)
        log(f"  Within-type distance:  mean={mean_within:.4f} (n={len(within_dists)})")
        log(f"  Between-type distance: mean={mean_between:.4f} (n={len(between_dists)})")
        log(f"  Discrimination ratio:  {mean_between/mean_within:.2f}x (>1.0 = types separate)")

        if mean_between > mean_within:
            log(f"  PASS — signatures discriminate between move types")
        else:
            log(f"  FAIL — signatures do NOT discriminate (need tuning)")
    else:
        log(f"  Not enough variety in seq4 segments for discrimination test")
        log(f"  Labels found: {Counter(seg_labels).most_common()}")
else:
    log(f"  Not enough signatures extracted ({len(seg_signatures)})")


# ─────────────────────────────────────────────────────────────────
# TASK 6: Generate visualizations from real data
# ─────────────────────────────────────────────────────────────────
log("\nTASK 6: Generating visualizations from real data")

# Transition graph plot
try:
    from viz.graph_plots import plot_transition_graph
    path = plot_transition_graph(graph, output=str(OUTPUT_DIR / "real_transition_graph.png"),
                                  title="BRACE Dataset — Move Transitions (1,352 segments)")
    log(f"  Transition graph: {path}")
except Exception as exc:
    log(f"  Transition graph FAILED: {exc}")

# Distance matrix heatmap
if len(seg_signatures) >= 2:
    try:
        from viz.matrix_heatmaps import plot_distance_matrix
        path = plot_distance_matrix(distances, seg_labels,
                                     output=str(OUTPUT_DIR / "real_signature_distances.png"),
                                     title="Move Signature Distance Matrix (seq4)")
        log(f"  Distance matrix: {path}")
    except Exception as exc:
        log(f"  Distance matrix FAILED: {exc}")

# Energy time series from real data
try:
    from engine import analyze, AnalysisContext
    ctx = AnalysisContext(mode="move_drill", data=joints_3d, fps=30.0)
    ctx = analyze(ctx)
    physics = ctx.results.get("physics")
    if physics:
        from viz.energy_plots import plot_energy_series
        plot_data = {}
        for key in ["angular_momentum", "kinetic_energy", "center_of_mass", "bone_angular_velocity"]:
            if key in physics.arrays:
                plot_data[key] = physics.arrays[key]
        if plot_data:
            # Load beat times if available
            beat_times = None
            beats_path = BRACE_DIR / "annotations" / "audio_beats.json"
            if beats_path.exists():
                with open(beats_path) as f:
                    beats_data = json.load(f)
                # Look for seq4 beats
                for key in beats_data:
                    if seq4_vid in key:
                        beat_times = np.array(beats_data[key].get("beats_sec", []))
                        # Offset to seq4 local time
                        seq4_start_sec = SEQ4_OFFSET / 30.0
                        beat_times = beat_times - seq4_start_sec
                        beat_times = beat_times[(beat_times >= 0) & (beat_times <= joints_3d.shape[0] / 30.0)]
                        break

            path = plot_energy_series(plot_data, fps=30.0,
                                       output=str(OUTPUT_DIR / "real_energy_series.png"),
                                       beat_times=beat_times)
            log(f"  Energy time series: {path}")
except Exception as exc:
    log(f"  Energy series FAILED: {exc}")

# Style similarity heatmap
if len(signatures) >= 2:
    try:
        from viz.matrix_heatmaps import plot_distance_matrix
        # Convert similarity to distance for the heatmap
        style_dist = 1.0 - sim_matrix
        # Top 20 dancers by segment count
        dancer_counts = Counter(e.dancer_id for e in all_events)
        top_dancers = [d for d, _ in dancer_counts.most_common(20)]
        top_idx = [i for i, name in enumerate(dancer_names) if name in top_dancers]
        if len(top_idx) >= 2:
            sub_dist = style_dist[np.ix_(top_idx, top_idx)]
            sub_names = [dancer_names[i] for i in top_idx]
            path = plot_distance_matrix(sub_dist, sub_names,
                                         output=str(OUTPUT_DIR / "real_style_distances.png"),
                                         title="Style Distance — Top 20 Dancers (BRACE)")
            log(f"  Style distances: {path}")
    except Exception as exc:
        log(f"  Style distances FAILED: {exc}")

# Pitch PDF
try:
    from viz.pitch_export import export_pitch_pdf
    pdf_results = {
        "mode": "move_drill",
        "title": "Breaking Analysis — BRACE seq4 (Real Data)",
        "metadata": {
            "dataset": "BRACE",
            "video": "RS0mFARO1x4",
            "sequence": "seq4 (frames 3802-4801)",
            "duration": f"{joints_3d.shape[0]/30:.1f}s",
            "date": datetime.now().strftime("%Y-%m-%d"),
        },
        "scores": {},
        "figures": [],
    }

    # Add scores from analysis
    if "motion" in ctx.results:
        for k, v in ctx.results["motion"].metrics.items():
            pdf_results["scores"][k] = v
    if "physics" in ctx.results:
        for k, v in ctx.results["physics"].metrics.items():
            pdf_results["scores"][k] = v

    # Add generated figures
    for fig_name in ["real_transition_graph.png", "real_signature_distances.png",
                      "real_energy_series.png", "real_style_distances.png"]:
        fig_path = OUTPUT_DIR / fig_name
        if fig_path.exists():
            pdf_results["figures"].append(str(fig_path))

    path = export_pitch_pdf(pdf_results, output=str(OUTPUT_DIR / "real_pitch.pdf"),
                             title="Breaking Analysis — BRACE Dataset")
    log(f"  Pitch PDF: {path}")
except Exception as exc:
    log(f"  Pitch PDF FAILED: {exc}")


# ─────────────────────────────────────────────────────────────────
# TASK 7: Graph metrics analysis
# ─────────────────────────────────────────────────────────────────
log("\nTASK 7: Graph metrics and community detection")

from graphs.metrics import compute_centrality_metrics, detect_communities, graph_summary

summary = graph_summary(graph)
log(f"  Graph summary: {json.dumps(summary, indent=2, default=str)}")

communities = detect_communities(graph)
log(f"  Communities detected: {len(communities)}")
for i, comm in enumerate(communities):
    log(f"    Community {i+1}: {comm}")

centrality = compute_centrality_metrics(graph)
for metric_name, values in centrality.items():
    sorted_vals = sorted(values.items(), key=lambda x: -x[1])
    log(f"  {metric_name}: {[(n, f'{v:.3f}') for n, v in sorted_vals[:3]]}")


# ─────────────────────────────────────────────────────────────────
# WRITE REPORT
# ─────────────────────────────────────────────────────────────────
report_path = OUTPUT_DIR / "validation_report.txt"
with open(report_path, "w") as f:
    f.write("BREAKING ANALYTICS ENGINE — OVERNIGHT VALIDATION REPORT\n")
    f.write(f"Generated: {datetime.now().isoformat()}\n")
    f.write("=" * 60 + "\n\n")
    f.write("\n".join(report_lines))
    f.write("\n")

log(f"\nReport saved: {report_path}")
log("OVERNIGHT BATCH COMPLETE")
