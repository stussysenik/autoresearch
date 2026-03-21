/**
 * Shape validation using blended algorithmic scoring.
 * Ported from ghost-tracks backend/services/shape_validator.py.
 *
 * Three scoring components:
 *   1. Modified Hausdorff Distance (90th-percentile) -- robust to outliers
 *   2. Ordered Sampling -- mean dist between resampled corresponding points
 *   3. Raster IoU -- pixel intersection-over-union using Bresenham's lines
 *
 * The final blended score is 55% mHD + 35% ordered + 10% IoU, mapped to [0, 100].
 */

import type { Coordinate } from "./types.js";
import { haversineDistanceM } from "./geo.js";

// ---------------------------------------------------------------------------
// Public scoring API
// ---------------------------------------------------------------------------

export interface ScoreBreakdown {
  blended: number;
  mhdScore: number;
  orderedScore: number;
  iouScore: number;
  diameterM: number;
}

/**
 * Compute a blended similarity score between an actual route and a target shape.
 *
 * @returns Object with blended score (0-100) and per-component breakdown.
 */
export function blendedScore(
  actual: Coordinate[],
  target: Coordinate[],
): ScoreBreakdown {
  if (!actual.length || !target.length) {
    return { blended: 0, mhdScore: 0, orderedScore: 0, iouScore: 0, diameterM: 0 };
  }

  const diameter = computeDiameter(target);
  if (diameter === 0) {
    return { blended: 0, mhdScore: 0, orderedScore: 0, iouScore: 0, diameterM: 0 };
  }

  // Component 1: Modified Hausdorff (90th percentile) -> score
  const mhd = modifiedHausdorffDistance(actual, target);
  const mhdNorm = Math.min(mhd / diameter, 1.0);
  const mhdScore = (1.0 - mhdNorm) * 100;

  // Component 2: Ordered sampling score
  const orderedScore = orderedSamplingScore(actual, target, diameter);

  // Component 3: Raster IoU score
  const iouScore = rasterIoUScore(actual, target);

  // Blend: 55% mHD, 35% ordered, 10% IoU
  const blended = Math.round(0.55 * mhdScore + 0.35 * orderedScore + 0.1 * iouScore);

  return { blended, mhdScore, orderedScore, iouScore, diameterM: diameter };
}

// ---------------------------------------------------------------------------
// Resample Curve
// ---------------------------------------------------------------------------

/**
 * Resample a polyline to exactly `n` equally-spaced points along its arc length.
 */
export function resampleCurve(
  points: Coordinate[],
  n = 50,
): Coordinate[] {
  if (points.length < 2 || n < 2) {
    return points.slice(0, n);
  }

  // Cumulative arc-length
  const cumLen: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    cumLen.push(cumLen[i - 1] + haversineDistanceM(points[i - 1], points[i]));
  }
  const total = cumLen[cumLen.length - 1];
  if (total === 0) {
    return Array.from({ length: n }, () => ({ ...points[0] }));
  }

  const result: Coordinate[] = [];
  for (let k = 0; k < n; k++) {
    const targetLen = (total * k) / (n - 1);
    // Find the segment containing this arc length
    for (let i = 1; i < cumLen.length; i++) {
      if (cumLen[i] >= targetLen) {
        const segLen = cumLen[i] - cumLen[i - 1];
        const frac = segLen === 0 ? 0 : (targetLen - cumLen[i - 1]) / segLen;
        result.push({
          lng: points[i - 1].lng + (points[i].lng - points[i - 1].lng) * frac,
          lat: points[i - 1].lat + (points[i].lat - points[i - 1].lat) * frac,
        });
        break;
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Diameter
// ---------------------------------------------------------------------------

/**
 * Approximate diameter of a point set (max pairwise distance in meters).
 * For sets > 60 points, uses deterministic sampling for efficiency.
 */
export function computeDiameter(points: Coordinate[]): number {
  if (points.length < 2) return 0;

  let maxDist = 0;
  const n = points.length;

  if (n <= 60) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const d = haversineDistanceM(points[i], points[j]);
        if (d > maxDist) maxDist = d;
      }
    }
  } else {
    // Deterministic pseudo-random sampling (seeded LCG)
    let seed = 42;
    const nextRand = () => {
      seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
      return seed;
    };

    for (let i = 0; i < n; i++) {
      const sampleCount = Math.min(50, n);
      for (let s = 0; s < sampleCount; s++) {
        const j = nextRand() % n;
        if (i !== j) {
          const d = haversineDistanceM(points[i], points[j]);
          if (d > maxDist) maxDist = d;
        }
      }
    }
  }

  return maxDist;
}

// ---------------------------------------------------------------------------
// Modified Hausdorff Distance
// ---------------------------------------------------------------------------

/**
 * Modified Hausdorff distance using 90th-percentile instead of max.
 * Robust to single-point outliers from routing API quirks.
 *
 * Returns distance in meters.
 */
export function modifiedHausdorffDistance(
  pointsA: Coordinate[],
  pointsB: Coordinate[],
  percentile = 90,
): number {
  const directedDistances = (
    src: Coordinate[],
    tgt: Coordinate[],
  ): number[] => {
    return src.map((s) => {
      let minD = Infinity;
      for (const t of tgt) {
        const d = haversineDistanceM(s, t);
        if (d < minD) minD = d;
      }
      return minD;
    });
  };

  const dAB = directedDistances(pointsA, pointsB);
  const dBA = directedDistances(pointsB, pointsA);
  const allDists = [...dAB, ...dBA].sort((a, b) => a - b);

  const idx = Math.min(
    Math.floor((percentile / 100) * allDists.length),
    allDists.length - 1,
  );
  return allDists[idx];
}

// ---------------------------------------------------------------------------
// Ordered Sampling Score
// ---------------------------------------------------------------------------

/**
 * Score based on mean distance between corresponding resampled points.
 * Returns a score in [0, 100] -- lower mean distance means higher score.
 */
export function orderedSamplingScore(
  actual: Coordinate[],
  target: Coordinate[],
  diameter: number,
  nSamples = 50,
): number {
  const tResampled = resampleCurve(target, nSamples);
  const aResampled = resampleCurve(actual, nSamples);

  if (!tResampled.length || !aResampled.length) return 0;

  let totalDist = 0;
  const count = Math.min(tResampled.length, aResampled.length);
  for (let i = 0; i < count; i++) {
    totalDist += haversineDistanceM(tResampled[i], aResampled[i]);
  }
  const meanDist = totalDist / count;

  if (diameter === 0) return 0;

  const normalized = Math.min(meanDist / diameter, 1.0);
  return Math.round((1.0 - normalized) * 100);
}

// ---------------------------------------------------------------------------
// Raster IoU Score (Bresenham, no Canvas dependency)
// ---------------------------------------------------------------------------

/**
 * Raster intersection-over-union score.
 *
 * Rasterises both shapes onto a 2D boolean grid using Bresenham's line
 * algorithm with thick lines, then computes pixel IoU.
 *
 * Returns a score in [0, 100].
 */
export function rasterIoUScore(
  actual: Coordinate[],
  target: Coordinate[],
  size = 128,
  lineWidth = 4,
): number {
  const bbox = computeSharedBbox(actual, target);

  const rasterA = rasterize(actual, bbox, size, lineWidth);
  const rasterT = rasterize(target, bbox, size, lineWidth);

  let intersection = 0;
  let union = 0;
  for (let i = 0; i < size * size; i++) {
    const a = rasterA[i];
    const t = rasterT[i];
    if (a || t) union++;
    if (a && t) intersection++;
  }

  if (union === 0) return 0;
  return Math.round((intersection / union) * 100);
}

// ---------------------------------------------------------------------------
// Rasterization helpers
// ---------------------------------------------------------------------------

function computeSharedBbox(
  pointsA: Coordinate[],
  pointsB: Coordinate[],
  paddingPct = 0.1,
): [number, number, number, number] {
  const allLngs = [...pointsA.map((p) => p.lng), ...pointsB.map((p) => p.lng)];
  const allLats = [...pointsA.map((p) => p.lat), ...pointsB.map((p) => p.lat)];
  const minLng = Math.min(...allLngs);
  const maxLng = Math.max(...allLngs);
  const minLat = Math.min(...allLats);
  const maxLat = Math.max(...allLats);
  const w = maxLng - minLng || 1e-6;
  const h = maxLat - minLat || 1e-6;
  return [
    minLng - w * paddingPct,
    minLat - h * paddingPct,
    maxLng + w * paddingPct,
    maxLat + h * paddingPct,
  ];
}

/**
 * Rasterize a polyline onto a flat boolean array of size*size.
 */
function rasterize(
  coords: Coordinate[],
  bbox: [number, number, number, number],
  size: number,
  lineWidth: number,
): Uint8Array {
  const grid = new Uint8Array(size * size);
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const w = maxLng - minLng;
  const h = maxLat - minLat;

  const toPixel = (c: Coordinate): [number, number] => {
    const x = Math.round(((c.lng - minLng) / w) * (size - 1));
    const y = Math.round(((maxLat - c.lat) / h) * (size - 1)); // flip Y
    return [
      Math.max(0, Math.min(size - 1, x)),
      Math.max(0, Math.min(size - 1, y)),
    ];
  };

  const halfW = Math.floor(lineWidth / 2);

  // Draw each segment using Bresenham's with thickness
  for (let i = 0; i < coords.length - 1; i++) {
    const [x0, y0] = toPixel(coords[i]);
    const [x1, y1] = toPixel(coords[i + 1]);
    bresenhamThick(grid, size, x0, y0, x1, y1, halfW);
  }

  return grid;
}

/**
 * Bresenham's line algorithm with a square brush of radius `halfW`.
 */
function bresenhamThick(
  grid: Uint8Array,
  size: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  halfW: number,
): void {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  let cx = x0;
  let cy = y0;

  while (true) {
    // Stamp a square brush centred on (cx, cy)
    for (let bx = -halfW; bx <= halfW; bx++) {
      for (let by = -halfW; by <= halfW; by++) {
        const px = cx + bx;
        const py = cy + by;
        if (px >= 0 && px < size && py >= 0 && py < size) {
          grid[py * size + px] = 1;
        }
      }
    }

    if (cx === x1 && cy === y1) break;

    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      cx += sx;
    }
    if (e2 < dx) {
      err += dx;
      cy += sy;
    }
  }
}
