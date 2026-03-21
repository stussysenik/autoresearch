/**
 * Routing layer: snaps waypoints to streets (or simulates it).
 *
 * Two modes:
 *   1. Simulated (default) -- snaps to a pseudo-grid with realistic noise.
 *      Allows the experiment to run without an API key.
 *   2. Mapbox (behind ROUTING_API_KEY env) -- real directions API with
 *      25-waypoint chunking.
 */

import type { Coordinate } from "./types.js";

const ROUTING_API_KEY = process.env.ROUTING_API_KEY ?? "";
const USE_REAL_ROUTER = ROUTING_API_KEY.length > 10;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Route a list of waypoints through streets (or a simulation thereof).
 *
 * Returns the routed polyline as Coordinate[].
 */
export async function routeWaypoints(
  waypoints: Coordinate[],
): Promise<Coordinate[]> {
  if (USE_REAL_ROUTER) {
    return mapboxRoute(waypoints);
  }
  return simulatedRoute(waypoints);
}

/**
 * Whether we're using the real router or the simulation.
 */
export function routerMode(): "simulated" | "mapbox" {
  return USE_REAL_ROUTER ? "mapbox" : "simulated";
}

// ---------------------------------------------------------------------------
// Simulated Router
// ---------------------------------------------------------------------------

/**
 * Simulated street-snapping router.
 *
 * Design goals:
 *   - Introduce realistic deviation (streets don't follow curves perfectly)
 *   - Snap to a virtual grid to simulate block structure
 *   - Add intermediate points between waypoints (like a real router would)
 *   - Be deterministic for reproducibility
 *
 * Algorithm:
 *   1. For each waypoint, snap to the nearest grid intersection
 *      (grid spacing ~ 50m in both lat/lng)
 *   2. Add Gaussian-like noise scaled to 20-40m
 *   3. Between consecutive snapped points, insert 1-3 intermediate points
 *      to simulate the router returning a detailed polyline
 */
function simulatedRoute(waypoints: Coordinate[]): Coordinate[] {
  if (waypoints.length < 2) return [...waypoints];

  // Deterministic pseudo-random (seeded LCG)
  let seed = 12345;
  const rand = (): number => {
    seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  // Gaussian-ish via Box-Muller (uses two uniform samples)
  const randGauss = (): number => {
    const u1 = Math.max(rand(), 1e-10);
    const u2 = rand();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };

  // Virtual grid spacing in degrees (~50m at Prague latitude)
  const gridLng = 0.00065;
  const gridLat = 0.00045;

  // Noise magnitude in degrees (~25m)
  const noiseLng = 0.00025;
  const noiseLat = 0.00020;

  const snapToGrid = (c: Coordinate): Coordinate => ({
    lng: Math.round(c.lng / gridLng) * gridLng + randGauss() * noiseLng,
    lat: Math.round(c.lat / gridLat) * gridLat + randGauss() * noiseLat,
  });

  const result: Coordinate[] = [];

  for (let i = 0; i < waypoints.length; i++) {
    const snapped = snapToGrid(waypoints[i]);

    if (i > 0) {
      // Insert 1-3 intermediate points between previous and current
      const prev = result[result.length - 1];
      const nInterp = 1 + Math.floor(rand() * 3);
      for (let j = 1; j <= nInterp; j++) {
        const frac = j / (nInterp + 1);
        result.push({
          lng: prev.lng + (snapped.lng - prev.lng) * frac + randGauss() * noiseLng * 0.3,
          lat: prev.lat + (snapped.lat - prev.lat) * frac + randGauss() * noiseLat * 0.3,
        });
      }
    }

    result.push(snapped);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Mapbox Directions API
// ---------------------------------------------------------------------------

/**
 * Real Mapbox Directions API with 25-waypoint chunking.
 *
 * Mapbox allows max 25 coordinates per request, so we split into chunks
 * of 25 with 1-coordinate overlap and concatenate the results.
 */
async function mapboxRoute(waypoints: Coordinate[]): Promise<Coordinate[]> {
  const CHUNK_SIZE = 25;
  const allPoints: Coordinate[] = [];

  for (let start = 0; start < waypoints.length; start += CHUNK_SIZE - 1) {
    const chunk = waypoints.slice(start, start + CHUNK_SIZE);
    if (chunk.length < 2) break;

    const coordStr = chunk.map((c) => `${c.lng},${c.lat}`).join(";");
    const url = `https://api.mapbox.com/directions/v5/mapbox/cycling/${coordStr}?geometries=geojson&overview=full&access_token=${ROUTING_API_KEY}`;

    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`Mapbox API error: ${resp.status} ${resp.statusText}`);
    }

    const data = (await resp.json()) as {
      routes: Array<{
        geometry: { coordinates: Array<[number, number]> };
      }>;
    };

    if (!data.routes?.[0]?.geometry?.coordinates) {
      throw new Error("Mapbox returned no routes");
    }

    const coords = data.routes[0].geometry.coordinates.map(
      ([lng, lat]: [number, number]) => ({ lng, lat }),
    );

    // Skip first point of subsequent chunks (overlap)
    if (allPoints.length > 0 && coords.length > 0) {
      coords.shift();
    }
    allPoints.push(...coords);
  }

  return allPoints;
}
