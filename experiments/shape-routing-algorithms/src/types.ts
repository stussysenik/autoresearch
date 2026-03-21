/**
 * Shared type definitions for the shape-routing-algorithms experiment.
 *
 * Coordinate order follows GeoJSON convention: [lng, lat].
 * All distances are in meters unless otherwise noted.
 */

/** A geographic coordinate (longitude, latitude). */
export interface Coordinate {
  lng: number;
  lat: number;
}

/** Axis-aligned bounding box: [minLng, minLat, maxLng, maxLat]. */
export interface BBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

/** Configuration for generating a single shape's control points. */
export interface ShapeConfig {
  name: string;
  /** Center of the shape. */
  center: Coordinate;
  /** Shape diameter in degrees (~0.01 deg ~ 1.1 km). */
  scaleDeg: number;
}

/** One of the five algorithm variants under test. */
export interface VariantConfig {
  id: string;
  name: string;
  description: string;
  /** The processing function: control points + bbox -> mapped waypoints. */
  process: (controlPoints: Coordinate[], bbox: BBox) => Coordinate[];
}

/** Result of a single trial (one variant x one shape). */
export interface TrialResult {
  variantId: string;
  shapeName: string;
  /** Number of waypoints sent to the router. */
  waypointCount: number;
  /** Number of points returned from the router. */
  routedPointCount: number;
  /** Blended similarity score 0-100. */
  blendedScore: number;
  /** Modified Hausdorff component score 0-100. */
  mhdScore: number;
  /** Ordered sampling component score 0-100. */
  orderedScore: number;
  /** Raster IoU component score 0-100. */
  iouScore: number;
  /** Shape diameter in meters (for context). */
  diameterM: number;
  /** Processing time in milliseconds. */
  processingTimeMs: number;
}

/** Input data written by fetch_data (Phase 1). */
export interface InputData {
  bbox: BBox;
  shapes: Array<{
    name: string;
    controlPoints: Coordinate[];
  }>;
}

/** Full experiment results written by run_experiment (Phase 2). */
export interface ExperimentResults {
  timestamp: string;
  bbox: BBox;
  routerMode: "simulated" | "mapbox";
  trials: TrialResult[];
}
