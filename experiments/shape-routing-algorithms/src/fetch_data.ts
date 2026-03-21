/**
 * Phase 1: Generate control points for 5 test shapes.
 *
 * Produces data/input.json with control points for Heart, Star, Circle,
 * Triangle, and Letter A, all centred on Vinohrady, Prague.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { BBox, InputData } from "./types.js";
import {
  generateHeart,
  generateStar,
  generateCircle,
  generateTriangle,
  generateLetterA,
} from "./shapes.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const OUTPUT_FILE = join(DATA_DIR, "input.json");

// Vinohrady, Prague bounding box
const BBOX: BBox = {
  minLng: 14.425,
  minLat: 50.065,
  maxLng: 14.465,
  maxLat: 50.085,
};

const CENTER = {
  lng: (BBOX.minLng + BBOX.maxLng) / 2,
  lat: (BBOX.minLat + BBOX.maxLat) / 2,
};

// Shape diameter in degrees (~0.012 deg ~ 1.3 km -- fits nicely in the bbox)
const SCALE_DEG = 0.012;

function main() {
  console.log("Phase 1: Generating control points for 5 test shapes...\n");

  const shapes = [
    { name: "heart", controlPoints: generateHeart(CENTER, SCALE_DEG, 64) },
    { name: "star", controlPoints: generateStar(CENTER, SCALE_DEG, 5, 20) },
    { name: "circle", controlPoints: generateCircle(CENTER, SCALE_DEG, 48) },
    { name: "triangle", controlPoints: generateTriangle(CENTER, SCALE_DEG) },
    { name: "letterA", controlPoints: generateLetterA(CENTER, SCALE_DEG) },
  ];

  for (const s of shapes) {
    console.log(`  ${s.name}: ${s.controlPoints.length} control points`);
  }

  const inputData: InputData = { bbox: BBOX, shapes };

  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(inputData, null, 2));

  console.log(`\nWrote ${OUTPUT_FILE}`);
}

main();
