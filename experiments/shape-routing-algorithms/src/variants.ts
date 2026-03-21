/**
 * Five algorithm variants for converting shape control points into routable waypoints.
 *
 * Each variant exports a `process(controlPoints, bbox)` function that applies a
 * different mapping strategy. The experiment compares their quality via blendedScore.
 *
 * Variant A: Baseline           -- densify(80m), deduplicate(12m)
 * Variant B: Curvature-Adaptive -- segment-level densification based on angle delta
 * Variant C: Increased Density  -- more template points + tighter densify (40m)
 * Variant D: Post-Routing Fix   -- baseline + re-map worst 25% segments after routing
 * Variant E: Segment-Wise       -- split shape into 6 arcs, optimise each independently
 */

import type { BBox, Coordinate, VariantConfig } from "./types.js";
import { bearingDeg, haversineDistanceM } from "./geo.js";
import { scaleToBbox, densify, deduplicate } from "./street-mapper.js";

// ---------------------------------------------------------------------------
// Variant A: Baseline
// ---------------------------------------------------------------------------

function variantAProcess(controlPoints: Coordinate[], bbox: BBox): Coordinate[] {
  const scaled = scaleToBbox(controlPoints, bbox);
  const dense = densify(scaled, 80);
  return deduplicate(dense, 12);
}

// ---------------------------------------------------------------------------
// Variant B: Curvature-Adaptive Densification
// ---------------------------------------------------------------------------

/**
 * For each segment, measure the angle delta to the next segment.
 *   - delta > 60 deg (sharp turn): densify at 40m
 *   - delta 20-60 deg (moderate):  densify at 80m
 *   - delta < 20 deg (straight):   densify at 120m
 *
 * This concentrates waypoints where the route bends most.
 */
function variantBProcess(controlPoints: Coordinate[], bbox: BBox): Coordinate[] {
  const scaled = scaleToBbox(controlPoints, bbox);
  if (scaled.length < 3) return deduplicate(densify(scaled, 80), 12);

  const result: Coordinate[] = [scaled[0]];

  for (let i = 0; i < scaled.length - 1; i++) {
    const a = scaled[i];
    const b = scaled[i + 1];

    // Compute curvature: angle change at point b
    let angleDelta = 0;
    if (i + 2 < scaled.length) {
      const c = scaled[i + 2];
      const bIn = bearingDeg(a, b);
      const bOut = bearingDeg(b, c);
      angleDelta = Math.abs(bOut - bIn);
      if (angleDelta > 180) angleDelta = 360 - angleDelta;
    }

    // Choose densification threshold based on curvature
    let maxSegM: number;
    if (angleDelta > 60) {
      maxSegM = 40;
    } else if (angleDelta > 20) {
      maxSegM = 80;
    } else {
      maxSegM = 120;
    }

    const dist = haversineDistanceM(a, b);
    if (dist > maxSegM) {
      const nSegments = Math.ceil(dist / maxSegM);
      for (let j = 1; j < nSegments; j++) {
        const frac = j / nSegments;
        result.push({
          lng: a.lng + (b.lng - a.lng) * frac,
          lat: a.lat + (b.lat - a.lat) * frac,
        });
      }
    }
    result.push(b);
  }

  return deduplicate(result, 12);
}

// ---------------------------------------------------------------------------
// Variant C: Increased Density
// ---------------------------------------------------------------------------

/**
 * Double the template point count and tighten densification to 40m.
 * This tests whether sheer waypoint density improves fidelity.
 *
 * NOTE: The caller is expected to pass control points with higher N
 * (128-pt heart, 96-pt circle). Here we just apply the tighter pipeline.
 */
function variantCProcess(controlPoints: Coordinate[], bbox: BBox): Coordinate[] {
  const scaled = scaleToBbox(controlPoints, bbox);
  const dense = densify(scaled, 40);  // much tighter than baseline 80m
  return deduplicate(dense, 8);       // tighter dedup too (8m vs 12m)
}

// ---------------------------------------------------------------------------
// Variant D: Post-Routing Correction
// ---------------------------------------------------------------------------

/**
 * Start with the baseline. After receiving routed geometry, identify the
 * worst 25% of segments (by distance from target) and regenerate denser
 * waypoints for those segments.
 *
 * Since this variant's real benefit comes during routing, the `process`
 * function here returns baseline output BUT marks the variant so the
 * experiment runner can apply the correction step post-routing.
 *
 * For the purposes of the pure mapping stage, this is identical to Baseline,
 * but the experiment runner applies a second pass (see run_experiment.ts).
 */
function variantDProcess(controlPoints: Coordinate[], bbox: BBox): Coordinate[] {
  // First pass: baseline
  return variantAProcess(controlPoints, bbox);
}

/**
 * Post-routing correction: given the routed points and the original target,
 * identify the worst 25% of segments and replace them with densified versions.
 */
export function variantDCorrect(
  routedPoints: Coordinate[],
  targetPoints: Coordinate[],
): Coordinate[] {
  if (routedPoints.length < 4) return routedPoints;

  // Compute per-segment deviation from target
  const segDeviations: Array<{ idx: number; deviation: number }> = [];
  for (let i = 0; i < routedPoints.length - 1; i++) {
    const mid: Coordinate = {
      lng: (routedPoints[i].lng + routedPoints[i + 1].lng) / 2,
      lat: (routedPoints[i].lat + routedPoints[i + 1].lat) / 2,
    };
    // Distance from midpoint to nearest target point
    let minDist = Infinity;
    for (const t of targetPoints) {
      const d = haversineDistanceM(mid, t);
      if (d < minDist) minDist = d;
    }
    segDeviations.push({ idx: i, deviation: minDist });
  }

  // Sort by deviation (worst first) and pick top 25%
  segDeviations.sort((a, b) => b.deviation - a.deviation);
  const worstCount = Math.ceil(segDeviations.length * 0.25);
  const worstIndices = new Set(
    segDeviations.slice(0, worstCount).map((s) => s.idx),
  );

  // Rebuild: for worst segments, insert midpoints
  const corrected: Coordinate[] = [routedPoints[0]];
  for (let i = 0; i < routedPoints.length - 1; i++) {
    if (worstIndices.has(i)) {
      // Find the closest target point to the segment midpoint
      const mid: Coordinate = {
        lng: (routedPoints[i].lng + routedPoints[i + 1].lng) / 2,
        lat: (routedPoints[i].lat + routedPoints[i + 1].lat) / 2,
      };
      let closestTarget = targetPoints[0];
      let closestDist = Infinity;
      for (const t of targetPoints) {
        const d = haversineDistanceM(mid, t);
        if (d < closestDist) {
          closestDist = d;
          closestTarget = t;
        }
      }
      // Insert: pull the midpoint toward the target
      const pullFraction = 0.5;
      corrected.push({
        lng: mid.lng + (closestTarget.lng - mid.lng) * pullFraction,
        lat: mid.lat + (closestTarget.lat - mid.lat) * pullFraction,
      });
    }
    corrected.push(routedPoints[i + 1]);
  }

  return corrected;
}

// ---------------------------------------------------------------------------
// Variant E: Segment-Wise Optimization
// ---------------------------------------------------------------------------

/**
 * Split the shape into 6 roughly-equal arcs. Map each arc independently
 * with tighter parameters, then stitch them together.
 *
 * This avoids the routing API "smoothing over" tight corners because each
 * segment is short enough to route accurately.
 */
function variantEProcess(controlPoints: Coordinate[], bbox: BBox): Coordinate[] {
  const scaled = scaleToBbox(controlPoints, bbox);
  if (scaled.length < 6) return deduplicate(densify(scaled, 80), 12);

  const nSegments = 6;
  const segSize = Math.ceil(scaled.length / nSegments);
  const result: Coordinate[] = [];

  for (let s = 0; s < nSegments; s++) {
    const start = s * segSize;
    const end = Math.min(start + segSize + 1, scaled.length); // +1 for overlap
    const segment = scaled.slice(start, end);

    // Each segment gets tighter processing
    const dense = densify(segment, 50);  // tighter than baseline
    const clean = deduplicate(dense, 10);

    // Avoid duplicating the stitch point
    if (result.length > 0 && clean.length > 0) {
      clean.shift(); // remove first point (duplicate of previous segment's last)
    }
    result.push(...clean);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const VARIANTS: VariantConfig[] = [
  {
    id: "A",
    name: "Baseline",
    description: "densify(80m) + deduplicate(12m) — the original ghost-tracks pipeline",
    process: variantAProcess,
  },
  {
    id: "B",
    name: "Curvature-Adaptive",
    description: "Angle-aware densification: 40/80/120m based on bearing delta",
    process: variantBProcess,
  },
  {
    id: "C",
    name: "Increased Density",
    description: "Tighter densify(40m) + dedup(8m) for maximum waypoint coverage",
    process: variantCProcess,
  },
  {
    id: "D",
    name: "Post-Routing Correction",
    description: "Baseline + re-map worst 25% segments after routing",
    process: variantDProcess,
  },
  {
    id: "E",
    name: "Segment-Wise",
    description: "Split shape into 6 arcs, optimise each independently",
    process: variantEProcess,
  },
];
