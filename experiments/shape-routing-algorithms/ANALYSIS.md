# Shape Routing Algorithms -- Experiment Analysis

**Timestamp:** 2026-03-21T17:42:48.406Z
**Router mode:** simulated
**BBox:** Vinohrady, Prague [14.425, 50.065, 14.465, 50.085]

## Winner

**Variant E** -- No variant achieved >5% relative improvement with acceptable waypoint overhead. Variant E has the highest average score (91.4).

## Per-Variant Average Scores

| Variant | Blended | mHD | Ordered | IoU | Waypoints | Routed Pts | Time (ms) |
|---------|---------|-----|---------|-----|-----------|------------|-----------|
| A | 91.2 | 91.2 | 97.8 | 69.4 | 81.8 | 241.8 | 3 |
| B | 90.8 | 91 | 97 | 68.6 | 81.4 | 241.6 | 1.2 |
| C | 91.2 | 91 | 97.4 | 69.4 | 145 | 435 | 2 |
| D | 90.8 | 91.6 | 95 | 70.6 | 81.8 | 302.4 | 2.2 |
| E | 91.4 | 91.2 | 97.8 | 70 | 121.4 | 364.4 | 1.4 |

## Score Matrix (Variant x Shape)

| Shape | A | B | C | D | E |
|-------|---|---|---|---|---|
| heart | 95 | 94 | 95 | 95 | 94 |
| star | 92 | 92 | 92 | 92 | 92 |
| circle | 95 | 95 | 95 | 95 | 95 |
| triangle | 91 | 91 | 91 | 90 | 92 |
| letterA | 83 | 82 | 83 | 82 | 84 |

## Per-Shape Best Variant

| Shape | Best Variant | Score |
|-------|-------------|-------|
| heart | A | 95 |
| star | A | 92 |
| circle | A | 95 |
| triangle | E | 92 |
| letterA | E | 84 |

## Improvement Over Baseline (Variant A)

| Variant | Absolute | Relative (%) | Waypoint Delta |
|---------|----------|-------------|----------------|
| B | -0.4 | -0.4% | -0.4 |
| C | 0 | 0% | +63.2 |
| D | -0.4 | -0.4% | 0 |
| E | +0.2 | +0.2% | +39.6 |

## Variant Descriptions

- **A (Baseline):** densify(80m) + deduplicate(12m) -- the original ghost-tracks pipeline
- **B (Curvature-Adaptive):** Angle-aware densification at 40/80/120m based on bearing delta at each segment
- **C (Increased Density):** Tighter densify(40m) + dedup(8m) for maximum waypoint coverage
- **D (Post-Routing Correction):** Baseline + re-map worst 25% segments after routing, pulling midpoints toward target
- **E (Segment-Wise):** Split shape into 6 arcs, optimise each independently with densify(50m) + dedup(10m)

## Recommendations

1. **For production use:** Select the winning variant and integrate it into the ghost-tracks street_mapper.py pipeline.
2. **For further investigation:** Run with a real Mapbox API key (set ROUTING_API_KEY in .env) to validate findings against actual street geometry.
3. **Hybrid approach:** Consider combining the curvature-adaptive densification (B) with post-routing correction (D) for best-of-both-worlds fidelity.
