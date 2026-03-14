/**
 * Ablation Study Variants
 *
 * Each variant represents a different subset of the 16 design dimensions.
 * By measuring fidelity with and without specific dimensions, we learn
 * which constraints contribute most to reproducing a design faithfully.
 *
 * The ablation study answers: "What's the minimum set of design constraints
 * needed to achieve 85% of the maximum fidelity?"
 *
 * Key metric:
 *   Contribution(D) = Fidelity(all) - Fidelity(all \ D)
 *   Higher contribution = more critical dimension
 */

import type { DimensionName } from './types/blueprint.js'
import { DIMENSION_NAMES, TIERS } from './types/blueprint.js'

export interface AblationVariant {
  name: string
  description: string
  dimensions: readonly DimensionName[]
  /** What this variant tests in the ablation study */
  purpose: string
}

/**
 * The 9 ablation variants.
 *
 * Designed to isolate each dimension's contribution through controlled removal:
 * - `all_16`: Upper bound (maximum constraint)
 * - `tier*` variants: Measure tier contributions
 * - `no_*` variants: Measure individual dimension contributions (leave-one-out)
 * - `*_only` variants: Measure sufficiency of single dimensions/combinations
 */
export const variants: AblationVariant[] = [
  {
    name: 'all_16',
    description: 'All 16 dimensions — maximum constraint',
    dimensions: DIMENSION_NAMES,
    purpose: 'Upper bound: best possible fidelity with full constraint set',
  },
  {
    name: 'tier1_only',
    description: 'Layout + Spacing + Sizing + Typography',
    dimensions: TIERS[1],
    purpose: 'Test if structural constraints alone are sufficient',
  },
  {
    name: 'tier1_tier2',
    description: 'Tier 1 + Tier 2 (8 dimensions)',
    dimensions: [...TIERS[1], ...TIERS[2]],
    purpose: 'Test mid-range constraint set (structure + surface)',
  },
  {
    name: 'no_color',
    description: 'All 16 except Color',
    dimensions: DIMENSION_NAMES.filter(d => d !== 'color'),
    purpose: 'Measure color\'s contribution to fidelity',
  },
  {
    name: 'no_spacing',
    description: 'All 16 except Spacing',
    dimensions: DIMENSION_NAMES.filter(d => d !== 'spacing'),
    purpose: 'Measure spacing\'s contribution to fidelity',
  },
  {
    name: 'no_typography',
    description: 'All 16 except Typography',
    dimensions: DIMENSION_NAMES.filter(d => d !== 'typography'),
    purpose: 'Measure typography\'s contribution to fidelity',
  },
  {
    name: 'layout_only',
    description: 'Layout dimension only',
    dimensions: ['layout'] as const,
    purpose: 'Absolute minimum: can layout alone produce recognizable output?',
  },
  {
    name: 'typography_color',
    description: 'Typography + Color only',
    dimensions: ['typography', 'color'] as const,
    purpose: 'Test if identity-defining dimensions alone are sufficient',
  },
  {
    name: 'tier3_only',
    description: 'Tier 3 relational dimensions only',
    dimensions: TIERS[3],
    purpose: 'Test if relational constraints alone have value without structural base',
  },
]

/** Get a variant by name */
export function getVariant(name: string): AblationVariant | undefined {
  return variants.find(v => v.name === name)
}

/** Get all variant names */
export function getVariantNames(): string[] {
  return variants.map(v => v.name)
}
