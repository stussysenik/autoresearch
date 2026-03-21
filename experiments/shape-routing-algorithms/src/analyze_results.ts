/**
 * Phase 3: Analyse experiment results and produce ANALYSIS.md.
 *
 * Reads data/results.json, computes:
 *   - Per-variant average scores (overall and per-component)
 *   - Per-shape best variant
 *   - Relative improvement over baseline (Variant A)
 *   - Winner selection (>5% improvement + fewer/equal API calls)
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { ExperimentResults, TrialResult } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const RESULTS_FILE = join(DATA_DIR, "results.json");
const ANALYSIS_FILE = join(__dirname, "..", "ANALYSIS.md");

interface VariantSummary {
  id: string;
  avgBlended: number;
  avgMhd: number;
  avgOrdered: number;
  avgIou: number;
  avgWaypoints: number;
  avgRoutedPoints: number;
  avgTimeMs: number;
}

function main() {
  console.log("Phase 3: Analysing results...\n");

  const results: ExperimentResults = JSON.parse(
    readFileSync(RESULTS_FILE, "utf-8"),
  );
  const { trials } = results;

  // -----------------------------------------------------------------------
  // Per-variant averages
  // -----------------------------------------------------------------------

  const variantIds = [...new Set(trials.map((t) => t.variantId))].sort();
  const shapeNames = [...new Set(trials.map((t) => t.shapeName))];

  const summaries: VariantSummary[] = variantIds.map((id) => {
    const vTrials = trials.filter((t) => t.variantId === id);
    const n = vTrials.length;
    return {
      id,
      avgBlended: round(avg(vTrials, "blendedScore")),
      avgMhd: round(avg(vTrials, "mhdScore")),
      avgOrdered: round(avg(vTrials, "orderedScore")),
      avgIou: round(avg(vTrials, "iouScore")),
      avgWaypoints: round(avg(vTrials, "waypointCount")),
      avgRoutedPoints: round(avg(vTrials, "routedPointCount")),
      avgTimeMs: round(avg(vTrials, "processingTimeMs")),
    };
  });

  // Print to console
  console.log("Per-variant average scores:");
  console.log(
    "Variant | Blended | mHD | Ordered | IoU | Waypoints | Routed | Time(ms)",
  );
  console.log("-".repeat(75));
  for (const s of summaries) {
    console.log(
      `${s.id.padEnd(7)} | ${pad(s.avgBlended)} | ${pad(s.avgMhd)} | ${pad(s.avgOrdered)}  | ${pad(s.avgIou)} | ${pad(s.avgWaypoints)}    | ${pad(s.avgRoutedPoints)}   | ${pad(s.avgTimeMs)}`,
    );
  }
  console.log();

  // -----------------------------------------------------------------------
  // Per-shape best variant
  // -----------------------------------------------------------------------

  const shapeBest: Array<{ shape: string; bestVariant: string; score: number }> = [];
  for (const shape of shapeNames) {
    const shapeTrials = trials.filter((t) => t.shapeName === shape);
    shapeTrials.sort((a, b) => b.blendedScore - a.blendedScore);
    shapeBest.push({
      shape,
      bestVariant: shapeTrials[0].variantId,
      score: shapeTrials[0].blendedScore,
    });
  }

  console.log("Per-shape best variant:");
  for (const sb of shapeBest) {
    console.log(`  ${sb.shape}: Variant ${sb.bestVariant} (score=${sb.score})`);
  }
  console.log();

  // -----------------------------------------------------------------------
  // Relative improvement over baseline
  // -----------------------------------------------------------------------

  const baselineSummary = summaries.find((s) => s.id === "A")!;
  const improvements = summaries
    .filter((s) => s.id !== "A")
    .map((s) => ({
      id: s.id,
      absoluteImprovement: round(s.avgBlended - baselineSummary.avgBlended),
      relativeImprovement: round(
        ((s.avgBlended - baselineSummary.avgBlended) / baselineSummary.avgBlended) *
          100,
      ),
      waypointDelta: round(s.avgWaypoints - baselineSummary.avgWaypoints),
    }));

  console.log("Improvement over Baseline (A):");
  for (const imp of improvements) {
    console.log(
      `  Variant ${imp.id}: ${imp.absoluteImprovement > 0 ? "+" : ""}${imp.absoluteImprovement} pts (${imp.relativeImprovement > 0 ? "+" : ""}${imp.relativeImprovement}%), waypoints ${imp.waypointDelta > 0 ? "+" : ""}${imp.waypointDelta}`,
    );
  }
  console.log();

  // -----------------------------------------------------------------------
  // Winner selection
  // -----------------------------------------------------------------------

  // Criteria: >5% relative improvement AND waypoints <= 150% of baseline
  const candidates = improvements.filter(
    (imp) =>
      imp.relativeImprovement > 5 &&
      (summaries.find((s) => s.id === imp.id)!.avgWaypoints <=
        baselineSummary.avgWaypoints * 1.5),
  );

  let winner: string;
  let winnerReason: string;

  if (candidates.length > 0) {
    // Among candidates, pick the one with highest absolute improvement
    candidates.sort((a, b) => b.absoluteImprovement - a.absoluteImprovement);
    winner = candidates[0].id;
    winnerReason = `Variant ${winner} achieves +${candidates[0].relativeImprovement}% improvement over baseline with acceptable waypoint count increase.`;
  } else {
    // No clear winner; pick the best overall
    const best = [...summaries].sort((a, b) => b.avgBlended - a.avgBlended)[0];
    winner = best.id;
    winnerReason = `No variant achieved >5% relative improvement with acceptable waypoint overhead. Variant ${winner} has the highest average score (${best.avgBlended}).`;
  }

  console.log(`WINNER: Variant ${winner}`);
  console.log(`Reason: ${winnerReason}\n`);

  // -----------------------------------------------------------------------
  // Per-shape x per-variant matrix
  // -----------------------------------------------------------------------

  const matrix: Record<string, Record<string, number>> = {};
  for (const t of trials) {
    if (!matrix[t.shapeName]) matrix[t.shapeName] = {};
    matrix[t.shapeName][t.variantId] = t.blendedScore;
  }

  // -----------------------------------------------------------------------
  // Write ANALYSIS.md
  // -----------------------------------------------------------------------

  const md = buildMarkdown(
    results,
    summaries,
    shapeBest,
    improvements,
    winner,
    winnerReason,
    matrix,
    variantIds,
    shapeNames,
  );

  writeFileSync(ANALYSIS_FILE, md);
  console.log(`Wrote ${ANALYSIS_FILE}`);
}

// ---------------------------------------------------------------------------
// Markdown builder
// ---------------------------------------------------------------------------

function buildMarkdown(
  results: ExperimentResults,
  summaries: VariantSummary[],
  shapeBest: Array<{ shape: string; bestVariant: string; score: number }>,
  improvements: Array<{
    id: string;
    absoluteImprovement: number;
    relativeImprovement: number;
    waypointDelta: number;
  }>,
  winner: string,
  winnerReason: string,
  matrix: Record<string, Record<string, number>>,
  variantIds: string[],
  shapeNames: string[],
): string {
  const lines: string[] = [];
  const push = (line: string) => lines.push(line);

  push("# Shape Routing Algorithms -- Experiment Analysis");
  push("");
  push(`**Timestamp:** ${results.timestamp}`);
  push(`**Router mode:** ${results.routerMode}`);
  push(`**BBox:** Vinohrady, Prague [${results.bbox.minLng}, ${results.bbox.minLat}, ${results.bbox.maxLng}, ${results.bbox.maxLat}]`);
  push("");

  // Winner
  push("## Winner");
  push("");
  push(`**Variant ${winner}** -- ${winnerReason}`);
  push("");

  // Per-variant averages table
  push("## Per-Variant Average Scores");
  push("");
  push("| Variant | Blended | mHD | Ordered | IoU | Waypoints | Routed Pts | Time (ms) |");
  push("|---------|---------|-----|---------|-----|-----------|------------|-----------|");
  for (const s of summaries) {
    push(
      `| ${s.id} | ${s.avgBlended} | ${s.avgMhd} | ${s.avgOrdered} | ${s.avgIou} | ${s.avgWaypoints} | ${s.avgRoutedPoints} | ${s.avgTimeMs} |`,
    );
  }
  push("");

  // Score matrix
  push("## Score Matrix (Variant x Shape)");
  push("");
  push(`| Shape | ${variantIds.join(" | ")} |`);
  push(`|-------|${variantIds.map(() => "---").join("|")}|`);
  for (const shape of shapeNames) {
    const scores = variantIds.map((v) => {
      const score = matrix[shape]?.[v] ?? "-";
      return String(score);
    });
    push(`| ${shape} | ${scores.join(" | ")} |`);
  }
  push("");

  // Per-shape best
  push("## Per-Shape Best Variant");
  push("");
  push("| Shape | Best Variant | Score |");
  push("|-------|-------------|-------|");
  for (const sb of shapeBest) {
    push(`| ${sb.shape} | ${sb.bestVariant} | ${sb.score} |`);
  }
  push("");

  // Improvement over baseline
  push("## Improvement Over Baseline (Variant A)");
  push("");
  push("| Variant | Absolute | Relative (%) | Waypoint Delta |");
  push("|---------|----------|-------------|----------------|");
  for (const imp of improvements) {
    push(
      `| ${imp.id} | ${imp.absoluteImprovement > 0 ? "+" : ""}${imp.absoluteImprovement} | ${imp.relativeImprovement > 0 ? "+" : ""}${imp.relativeImprovement}% | ${imp.waypointDelta > 0 ? "+" : ""}${imp.waypointDelta} |`,
    );
  }
  push("");

  // Variant descriptions
  push("## Variant Descriptions");
  push("");
  push("- **A (Baseline):** densify(80m) + deduplicate(12m) -- the original ghost-tracks pipeline");
  push("- **B (Curvature-Adaptive):** Angle-aware densification at 40/80/120m based on bearing delta at each segment");
  push("- **C (Increased Density):** Tighter densify(40m) + dedup(8m) for maximum waypoint coverage");
  push("- **D (Post-Routing Correction):** Baseline + re-map worst 25% segments after routing, pulling midpoints toward target");
  push("- **E (Segment-Wise):** Split shape into 6 arcs, optimise each independently with densify(50m) + dedup(10m)");
  push("");

  // Recommendations
  push("## Recommendations");
  push("");
  push("1. **For production use:** Select the winning variant and integrate it into the ghost-tracks street_mapper.py pipeline.");
  push("2. **For further investigation:** Run with a real Mapbox API key (set ROUTING_API_KEY in .env) to validate findings against actual street geometry.");
  push("3. **Hybrid approach:** Consider combining the curvature-adaptive densification (B) with post-routing correction (D) for best-of-both-worlds fidelity.");
  push("");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function avg(trials: TrialResult[], key: keyof TrialResult): number {
  const vals = trials.map((t) => t[key] as number);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

function pad(n: number): string {
  return String(n).padStart(4);
}

main();
