# Design Constraint Engine: Ablation Analysis

**Generated:** 2026-03-14T14:48:52.564Z

## Variant Fidelity Scores

| Variant | Dimensions | Composite | CPR | VDS | SSIM |
|---------|-----------|-----------|-----|-----|------|
| typography_color | 2 | **0.8531** | 0.5714 | 0.9750 | 0.9723 |
| tier1_only | 4 | **0.8178** | 0.4286 | 0.9848 | 0.9842 |
| tier3_only | 8 | **0.8115** | 0.4286 | 0.9765 | 0.9745 |
| tier1_tier2 | 8 | **0.7842** | 0.2857 | 0.9978 | 0.9977 |
| no_typography | 15 | **0.7778** | 0.2857 | 0.9898 | 0.9874 |
| all_16 | 16 | **0.7416** | 0.1429 | 0.9982 | 0.9981 |
| no_color | 15 | **0.7410** | 0.1429 | 0.9974 | 0.9972 |

## Dimension Contributions (Leave-One-Out)

| Rank | Dimension | Contribution | Impact (%) |
|------|-----------|-------------|------------|
| 1 | **color** | 0.0006 | 0.1% |
| 2 | **typography** | -0.0362 | -4.9% |

## Tier Analysis

- **Tier 1 (Structural)**: 0.8178 (110.3% of max)
- **Tier 1 + 2 (Structure + Surface)**: 0.7842 (105.7% of max)
- **Tier 3 (Relational Only)**: 0.8115 (109.4% of max)

## Minimum Viable Constraint Set

Target: >= 85% of maximum fidelity (0.6304)

- **typography_color**: 115.0% (meets threshold)
- **tier1_only**: 110.3% (meets threshold)
- **tier3_only**: 109.4% (meets threshold)
- **tier1_tier2**: 105.7% (meets threshold)
- **no_typography**: 104.9% (meets threshold)
- **all_16**: 100.0% (meets threshold)
- **no_color**: 99.9% (meets threshold)

**Minimum Viable Set**: `typography_color` (2 dimensions)

## Key Insights

1. **Most impactful dimension**: color (0.1% fidelity impact)
2. **Structural constraints (Tier 1)** provide a strong foundation
3. **Surface constraints (Tier 2)** add visual polish
4. **Relational constraints (Tier 3)** refine spatial relationships

## Recommendations

1. Always include Tier 1 dimensions (layout, spacing, sizing, typography)
2. Add color and shape for brand fidelity
3. Tier 3 dimensions are optional for "good enough" reproduction
4. The minimum viable set balances constraint overhead with fidelity
