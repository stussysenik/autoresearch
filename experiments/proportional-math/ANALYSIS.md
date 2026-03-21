# Proportional Math — Experiment Results

## Winner: `minor_third` (y = 1.2)

Musical minor third (6:5) — composite score **92.7%**

## Ranking

| # | Variant | Ratio | Density | Max Gap | Alignment | Composite |
|---|---------|-------|---------|---------|-----------|-----------|
| 1 | minor_third | 1.2000 | 14 steps | 20.0% | 75.6% | **92.7%** |
| 2 | major_third | 1.2500 | 14 steps | 25.0% | 71.5% | **87.9%** |
| 3 | perfect_fourth | 1.3333 | 14 steps | 33.3% | 65.8% | **80.2%** |
| 4 | sqrt2 | 1.4142 | 13 steps | 41.4% | 61.4% | **70.2%** |
| 5 | perfect_fifth | 1.5000 | 13 steps | 50.0% | 57.5% | **62.9%** |
| 6 | phi | 1.6180 | 11 steps | 61.8% | 53.4% | **47.4%** |

## Scale Comparison (values in em)

| Step | minor_third | major_third | perfect_fourth | sqrt2 | perfect_fifth | phi |
|------|----- | ----- | ----- | ----- | ----- | ----- |
| s-n4 | 0.482 | 0.410 | 0.316 | 0.250 | 0.198 | 0.146 |
| s-n3 | 0.579 | 0.512 | 0.422 | 0.354 | 0.296 | 0.236 |
| s-n2 | 0.694 | 0.640 | 0.563 | 0.500 | 0.444 | 0.382 |
| s-n1 | 0.833 | 0.800 | 0.750 | 0.707 | 0.667 | 0.618 |
| s-0 | 1.000 | 1.000 | 1.000 | 1.000 | 1.000 | 1.000 |
| s-1 | 1.200 | 1.250 | 1.333 | 1.414 | 1.500 | 1.618 |
| s-2 | 1.440 | 1.563 | 1.778 | 2.000 | 2.250 | 2.618 |
| s-3 | 1.728 | 1.953 | 2.370 | 2.828 | 3.375 | 4.236 |
| s-4 | 2.074 | 2.441 | 3.160 | 4.000 | 5.063 | 6.854 |
| s-5 | 2.488 | 3.052 | 4.214 | 5.657 | 7.594 | 11.090 |
| s-6 | 2.986 | 3.815 | 5.619 | 8.000 | 11.391 | 17.944 |
| s-7 | 3.583 | 4.768 | 7.492 | 11.314 | 17.086 | 29.034 |
| s-8 | 4.300 | 5.960 | 9.989 | 16.000 | 25.629 | 46.979 |
| s-9 | 5.160 | 7.451 | 13.318 | 22.627 | 38.443 | 76.013 |

## Derived Values

| Value | Formula | minor_third | major_third | perfect_fourth | sqrt2 | perfect_fifth | phi |
|-------|---------|----- | ----- | ----- | ----- | ----- | ----- |
| v-pad | √y/y² | 0.761 | 0.716 | 0.650 | 0.595 | 0.544 | 0.486 |
| h-pad | x/y | 0.833 | 0.800 | 0.750 | 0.707 | 0.667 | 0.618 |
| radius | x·√y | 1.095 | 1.118 | 1.155 | 1.189 | 1.225 | 1.272 |

## Quality Metrics

- **Density**: Steps in usable range (0.25–64em). More = finer control. Winner: perfect_fourth
- **Max Gap**: Largest jump between consecutive steps. Smaller = smoother. Winner: minor_third
- **Alignment**: How close derived values (v-pad, h-pad, radius) land to scale steps. Higher = more internally consistent. Winner: minor_third

## Visual Comparison

Open `data/results/{variant}.html` in a browser to see components rendered with each ratio.

---
*Generated 2026-03-21T14:15:28.603Z*
