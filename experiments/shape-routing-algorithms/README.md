# Shape Routing Algorithms Experiment

Finds the best algorithm for converting NLP geometric descriptions into valid runnable Strava routes by comparing 5 mapping variants.

## Background

The ghost-tracks backend converts shape descriptions (heart, star, circle, etc.) into GPS waypoints that get routed along real streets. The baseline pipeline is: **generate control points -> scale to bounding box -> densify long segments -> deduplicate close points -> send to routing API**.

This experiment tests whether alternative mapping strategies improve shape fidelity (how closely the routed path resembles the intended shape).

## Variants Under Test

| ID | Name | Strategy |
|----|------|----------|
| A | Baseline | densify(80m) + dedup(12m) -- the original pipeline |
| B | Curvature-Adaptive | 40/80/120m densification based on bearing delta per segment |
| C | Increased Density | Tighter densify(40m) + dedup(8m) for more waypoints |
| D | Post-Routing Correction | Baseline + re-map worst 25% segments after routing |
| E | Segment-Wise | Split shape into 6 arcs, optimise each independently |

## Scoring

Each trial is scored with a blended metric (0-100):

- **55% Modified Hausdorff Distance** -- 90th-percentile nearest-neighbour distance, robust to routing outliers
- **35% Ordered Sampling** -- mean distance between resampled corresponding points along the curve
- **10% Raster IoU** -- pixel intersection-over-union using Bresenham line rasterisation

## Running

```bash
# Full pipeline (fetch -> run -> analyse)
bun run experiment

# Individual phases
bun run fetch           # Generate control points -> data/input.json
bun run run:experiment  # Run 25 trials -> data/results.json
bun run analyze         # Produce ANALYSIS.md
```

By default the experiment uses a **simulated router** (no API key needed). To use real Mapbox routing:

```bash
cp .env.example .env
# Edit .env and set ROUTING_API_KEY to your Mapbox access token
bun run experiment
```

## Output

- `data/input.json` -- Control points for 5 shapes
- `data/results.json` -- All 25 trial results with per-component scores
- `ANALYSIS.md` -- Summary tables, winner selection, and recommendations

## Ported From

Algorithms faithfully ported from the ghost-tracks Python backend:

- `backend/services/street_mapper.py` -- haversine, bearing, densify, deduplicate, scale_to_bbox
- `backend/services/shape_templates.py` -- heart (64pts), star (20pts), circle (48pts), triangle, letter A
- `backend/services/shape_validator.py` -- modified Hausdorff, ordered sampling, raster IoU, resample_curve
