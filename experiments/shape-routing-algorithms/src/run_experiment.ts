/**
 * Phase 2: Run all 25 trials (5 variants x 5 shapes).
 *
 * For each combination:
 *   1. Apply the variant's mapping process to get waypoints
 *   2. Route through the router (simulated or Mapbox)
 *   3. For Variant D, apply post-routing correction
 *   4. Validate with blendedScore against the original control points
 *   5. Record metrics
 *
 * Writes data/results.json.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { ExperimentResults, InputData, TrialResult } from "./types.js";
import { VARIANTS } from "./variants.js";
import { variantDCorrect } from "./variants.js";
import { routeWaypoints, routerMode } from "./router.js";
import { blendedScore } from "./validator.js";
import { scaleToBbox } from "./street-mapper.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const INPUT_FILE = join(DATA_DIR, "input.json");
const OUTPUT_FILE = join(DATA_DIR, "results.json");

async function main() {
  console.log("Phase 2: Running experiment (5 variants x 5 shapes = 25 trials)\n");
  console.log(`Router mode: ${routerMode()}\n`);

  const inputData: InputData = JSON.parse(readFileSync(INPUT_FILE, "utf-8"));
  const { bbox, shapes } = inputData;

  const trials: TrialResult[] = [];

  for (const variant of VARIANTS) {
    console.log(`--- Variant ${variant.id}: ${variant.name} ---`);

    for (const shape of shapes) {
      const t0 = performance.now();

      // 1. Map control points through variant's process
      const waypoints = variant.process(shape.controlPoints, bbox);

      // 2. Route through streets (simulated or real)
      let routed = await routeWaypoints(waypoints);

      // 3. For Variant D, apply post-routing correction
      if (variant.id === "D") {
        const scaledTarget = scaleToBbox(shape.controlPoints, bbox);
        routed = variantDCorrect(routed, scaledTarget);
      }

      // 4. Score against original control points (scaled to bbox for fair comparison)
      const scaledTarget = scaleToBbox(shape.controlPoints, bbox);
      const score = blendedScore(routed, scaledTarget);

      const elapsed = performance.now() - t0;

      const trial: TrialResult = {
        variantId: variant.id,
        shapeName: shape.name,
        waypointCount: waypoints.length,
        routedPointCount: routed.length,
        blendedScore: score.blended,
        mhdScore: Math.round(score.mhdScore),
        orderedScore: score.orderedScore,
        iouScore: score.iouScore,
        diameterM: Math.round(score.diameterM),
        processingTimeMs: Math.round(elapsed),
      };

      trials.push(trial);

      console.log(
        `  ${shape.name.padEnd(10)} -> ` +
          `score=${trial.blendedScore} ` +
          `(mHD=${trial.mhdScore}, ord=${trial.orderedScore}, iou=${trial.iouScore}) ` +
          `wp=${trial.waypointCount} routed=${trial.routedPointCount} ` +
          `${trial.processingTimeMs}ms`,
      );
    }
    console.log();
  }

  const results: ExperimentResults = {
    timestamp: new Date().toISOString(),
    bbox,
    routerMode: routerMode(),
    trials,
  };

  writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
  console.log(`Wrote ${OUTPUT_FILE}`);
}

main();
