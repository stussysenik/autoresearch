/**
 * Street-mapping pipeline, ported from ghost-tracks backend/services/street_mapper.py.
 *
 * Transforms abstract shape control points into waypoints suitable for
 * routing APIs (Mapbox Directions, Google Routes, etc.).
 *
 * Pipeline: scaleToBbox -> densify -> deduplicate
 */

import type { BBox, Coordinate } from "./types.js";
import { bearingDeg, haversineDistanceM, interpolate } from "./geo.js";

/**
 * Scale and centre control points to fit within a target bounding box,
 * preserving aspect ratio.
 *
 * @param points     Raw control points (any coordinate space).
 * @param bbox       Target geographic bounding box.
 * @param paddingPct Fraction of bbox reserved as padding on each side.
 */
export function scaleToBbox(
  points: Coordinate[],
  bbox: BBox,
  paddingPct = 0.1,
): Coordinate[] {
  if (points.length === 0) return [];

  // Shape bounds
  const lngs = points.map((p) => p.lng);
  const lats = points.map((p) => p.lat);
  const sMinLng = Math.min(...lngs);
  const sMaxLng = Math.max(...lngs);
  const sMinLat = Math.min(...lats);
  const sMaxLat = Math.max(...lats);
  const sWidth = sMaxLng - sMinLng || 1e-6;
  const sHeight = sMaxLat - sMinLat || 1e-6;
  const sCx = (sMinLng + sMaxLng) / 2;
  const sCy = (sMinLat + sMaxLat) / 2;

  // Target bounds with padding
  const bboxW = bbox.maxLng - bbox.minLng;
  const bboxH = bbox.maxLat - bbox.minLat;
  const padLng = bboxW * paddingPct;
  const padLat = bboxH * paddingPct;
  const tWidth = bboxW - 2 * padLng;
  const tHeight = bboxH - 2 * padLat;
  const tCx = (bbox.minLng + bbox.maxLng) / 2;
  const tCy = (bbox.minLat + bbox.maxLat) / 2;

  // Uniform scale to preserve aspect ratio
  const scale = Math.min(tWidth / sWidth, tHeight / sHeight);

  return points.map((p) => ({
    lng: tCx + (p.lng - sCx) * scale,
    lat: tCy + (p.lat - sCy) * scale,
  }));
}

/**
 * Interpolate additional points along segments that are longer than `maxSegmentM`.
 *
 * This ensures the routing API receives enough waypoints to follow tight curves.
 */
export function densify(
  points: Coordinate[],
  maxSegmentM = 80,
): Coordinate[] {
  if (points.length < 2) return [...points];

  const result: Coordinate[] = [points[0]];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dist = haversineDistanceM(a, b);

    if (dist > maxSegmentM) {
      const nSegments = Math.ceil(dist / maxSegmentM);
      for (let j = 1; j < nSegments; j++) {
        const frac = j / nSegments;
        result.push(interpolate(a, b, frac));
      }
    }
    result.push(b);
  }
  return result;
}

/**
 * Remove waypoints that are too close together, preserving sharp turns.
 *
 * Points where the bearing changes by more than `bearingThreshold` degrees
 * are always kept, even if closer than `minDistM`. This preserves corners,
 * star tips, and tight curves.
 */
export function deduplicate(
  points: Coordinate[],
  minDistM = 12,
  bearingThreshold = 20,
): Coordinate[] {
  if (points.length < 2) return [...points];

  const result: Coordinate[] = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    const dist = haversineDistanceM(result[result.length - 1], p);

    if (dist >= minDistM) {
      result.push(p);
    } else if (i < points.length - 1) {
      // Curvature-aware: keep if bearing changes sharply
      const prev = result[result.length - 1];
      const next = points[i + 1];
      const bIn = bearingDeg(prev, p);
      const bOut = bearingDeg(p, next);
      let angleChange = Math.abs(bOut - bIn);
      if (angleChange > 180) angleChange = 360 - angleChange;
      if (angleChange > bearingThreshold) {
        result.push(p);
      }
    }
  }

  // Always keep the last point
  const last = points[points.length - 1];
  const resultLast = result[result.length - 1];
  if (resultLast.lng !== last.lng || resultLast.lat !== last.lat) {
    result.push(last);
  }

  return result;
}

/**
 * Full mapping pipeline: scale -> densify -> deduplicate.
 *
 * The resulting waypoints are close enough to real streets that a routing
 * API will snap them when building directions.
 */
export function mapToStreets(
  controlPoints: Coordinate[],
  bbox: BBox,
): Coordinate[] {
  const scaled = scaleToBbox(controlPoints, bbox);
  const dense = densify(scaled, 80);
  const clean = deduplicate(dense, 12);
  return clean;
}
