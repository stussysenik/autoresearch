/**
 * Core geodesic utilities, ported from ghost-tracks backend/services/street_mapper.py.
 *
 * All functions operate on { lng, lat } Coordinate objects.
 * Distances are in meters; bearings in degrees [0, 360).
 */

import type { Coordinate } from "./types.js";

/** Earth's mean radius in meters (WGS-84 approximation). */
const R_EARTH = 6_371_000;

/**
 * Haversine distance between two coordinates, in meters.
 *
 * Uses the standard spherical-earth formula:
 *   a = sin(dlat/2)^2 + cos(lat1)*cos(lat2)*sin(dlng/2)^2
 *   d = 2 * R * atan2(sqrt(a), sqrt(1-a))
 */
export function haversineDistanceM(a: Coordinate, b: Coordinate): number {
  const phi1 = toRad(a.lat);
  const phi2 = toRad(b.lat);
  const dPhi = toRad(b.lat - a.lat);
  const dLambda = toRad(b.lng - a.lng);

  const aVal =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;

  return R_EARTH * 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
}

/**
 * Initial bearing from coordinate `a` to `b`, in degrees [0, 360).
 *
 * Ported directly from _bearing_deg in street_mapper.py.
 */
export function bearingDeg(a: Coordinate, b: Coordinate): number {
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const x = Math.sin(dLng) * Math.cos(lat2);
  const y =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  return ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
}

/**
 * Linear interpolation between two coordinates.
 *
 * @param a Start coordinate
 * @param b End coordinate
 * @param fraction Value in [0, 1]: 0 returns `a`, 1 returns `b`.
 */
export function interpolate(
  a: Coordinate,
  b: Coordinate,
  fraction: number,
): Coordinate {
  return {
    lng: a.lng + (b.lng - a.lng) * fraction,
    lat: a.lat + (b.lat - a.lat) * fraction,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
