/**
 * Parametric shape templates, ported from ghost-tracks backend/services/shape_templates.py.
 *
 * Each generator produces control points in geographic coordinates.
 * The shapes are defined in a normalised [-1, 1] space and then scaled
 * by `scaleDeg` (roughly the shape diameter in degrees; ~0.01 deg ~ 1.1 km).
 */

import type { Coordinate } from "./types.js";

// ---------------------------------------------------------------------------
// Heart  (64 points, parametric cardioid)
// ---------------------------------------------------------------------------

/**
 * Parametric heart curve: 16*sin(t)^3, 13*cos(t) - 5*cos(2t) - 2*cos(3t) - cos(4t).
 * The raw curve spans x in [-16, 16] and y in [-17, 17]; we normalise to [-1, 1].
 */
export function generateHeart(
  center: Coordinate,
  scaleDeg: number,
  n = 64,
): Coordinate[] {
  const points: Coordinate[] = [];
  for (let i = 0; i < n; i++) {
    const t = (2 * Math.PI * i) / (n - 1);
    const x = 16 * Math.sin(t) ** 3;
    const y =
      13 * Math.cos(t) -
      5 * Math.cos(2 * t) -
      2 * Math.cos(3 * t) -
      Math.cos(4 * t);
    points.push({
      lng: center.lng + (x / 17) * scaleDeg * 0.5,
      lat: center.lat + (y / 17) * scaleDeg * 0.5,
    });
  }
  // Close the shape
  points.push({ ...points[0] });
  return points;
}

// ---------------------------------------------------------------------------
// Star  (5-pointed, alternating outer/inner vertices + midpoints = 20 pts)
// ---------------------------------------------------------------------------

/**
 * Five-pointed star with midpoints on each edge for better street snapping.
 * Outer radius is 0.5 * scaleDeg; inner radius is 38 % of that.
 */
export function generateStar(
  center: Coordinate,
  scaleDeg: number,
  starPoints = 5,
  n = 20,
): Coordinate[] {
  const outerR = scaleDeg * 0.5;
  const innerR = outerR * 0.38;
  const totalVertices = starPoints * 2; // alternating outer/inner

  // Generate alternating outer/inner vertices
  const vertices: Array<[number, number]> = [];
  for (let i = 0; i < totalVertices; i++) {
    const angle = Math.PI / 2 + (2 * Math.PI * i) / totalVertices;
    const r = i % 2 === 0 ? outerR : innerR;
    vertices.push([
      center.lng + r * Math.cos(angle),
      center.lat + r * Math.sin(angle),
    ]);
  }

  // Interpolate: add midpoint between each consecutive pair
  const points: Coordinate[] = [];
  for (let i = 0; i < vertices.length; i++) {
    const [ax, ay] = vertices[i];
    const [bx, by] = vertices[(i + 1) % vertices.length];
    points.push({ lng: ax, lat: ay });
    points.push({ lng: (ax + bx) / 2, lat: (ay + by) / 2 });
  }
  // Close
  points.push({ ...points[0] });
  return points;
}

// ---------------------------------------------------------------------------
// Circle  (48 points)
// ---------------------------------------------------------------------------

export function generateCircle(
  center: Coordinate,
  scaleDeg: number,
  n = 48,
): Coordinate[] {
  const r = scaleDeg * 0.45;
  const points: Coordinate[] = [];
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n;
    points.push({
      lng: center.lng + r * Math.cos(angle),
      lat: center.lat + r * Math.sin(angle),
    });
  }
  // Close
  points.push({ ...points[0] });
  return points;
}

// ---------------------------------------------------------------------------
// Triangle  (equilateral, with interpolated edges)
// ---------------------------------------------------------------------------

export function generateTriangle(
  center: Coordinate,
  scaleDeg: number,
): Coordinate[] {
  const r = scaleDeg * 0.45;
  const corners: Array<[number, number]> = [];
  for (let i = 0; i < 3; i++) {
    const angle = Math.PI / 2 + (2 * Math.PI * i) / 3;
    corners.push([
      center.lng + r * Math.cos(angle),
      center.lat + r * Math.sin(angle),
    ]);
  }

  const points: Coordinate[] = [];
  const ptsPerEdge = 4; // intermediate points per edge
  for (let i = 0; i < 3; i++) {
    const [ax, ay] = corners[i];
    const [bx, by] = corners[(i + 1) % 3];
    for (let j = 0; j <= ptsPerEdge; j++) {
      const frac = j / (ptsPerEdge + 1);
      points.push({
        lng: ax + (bx - ax) * frac,
        lat: ay + (by - ay) * frac,
      });
    }
  }
  // Close
  points.push({ ...points[0] });
  return points;
}

// ---------------------------------------------------------------------------
// Letter A  (block-letter style, 6 key vertices)
// ---------------------------------------------------------------------------

/**
 * Simple block-letter "A" shape.
 * Defined the same way as the Python _letter("A", ...) template.
 */
export function generateLetterA(
  center: Coordinate,
  scaleDeg: number,
): Coordinate[] {
  const s = scaleDeg * 0.4;
  const h = scaleDeg * 0.5;

  const raw: Array<[number, number]> = [
    [-s, -h],
    [-s * 0.2, h],
    [s * 0.2, h],
    [s, -h],
    [s * 0.5, 0],
    [-s * 0.5, 0],
  ];

  return raw.map(([dx, dy]) => ({
    lng: center.lng + dx,
    lat: center.lat + dy,
  }));
}
