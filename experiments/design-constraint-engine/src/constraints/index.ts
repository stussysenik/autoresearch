/**
 * Constraint Compositor
 *
 * The heart of the ablation study: compose any subset of the 16 dimensions
 * into a test suite. By including/excluding dimensions, we measure each one's
 * contribution to design fidelity.
 *
 * Usage:
 *   // Full constraint set (all 16)
 *   const assertions = applyConstraints(component, DIMENSION_NAMES);
 *
 *   // Tier 1 only (structural minimum)
 *   const assertions = applyConstraints(component, ['layout', 'spacing', 'sizing', 'typography']);
 *
 *   // All except color (measure color's contribution)
 *   const assertions = applyConstraints(component, DIMENSION_NAMES.filter(d => d !== 'color'));
 */

import type { ComponentBlueprint, DimensionName } from '../types/blueprint.js'
import type { ConstraintAssertion } from './base.js'
import { LayoutConstraint } from './layout.constraint.js'
import { SpacingConstraint } from './spacing.constraint.js'
import { SizingConstraint } from './sizing.constraint.js'
import { TypographyConstraint } from './typography.constraint.js'
import { ColorConstraint } from './color.constraint.js'
import { BordersConstraint } from './borders.constraint.js'
import { ShapeConstraint } from './shape.constraint.js'
import { ShadowsConstraint } from './shadows.constraint.js'
import { AlignmentConstraint } from './alignment.constraint.js'
import { HierarchyConstraint } from './hierarchy.constraint.js'
import { CompositionConstraint } from './composition.constraint.js'
import { DensityConstraint } from './density.constraint.js'
import { StateConstraint } from './state.constraint.js'
import { ResponsiveConstraint } from './responsive.constraint.js'
import { AccessibilityConstraint } from './accessibility.constraint.js'
import { MicroInteractionsConstraint } from './micro-interactions.constraint.js'
import { DIMENSION_NAMES } from '../types/blueprint.js'

/** Registry of all constraint modules, keyed by dimension name */
const MODULES: Record<DimensionName, InstanceType<any>> = {
  layout: new LayoutConstraint(),
  spacing: new SpacingConstraint(),
  sizing: new SizingConstraint(),
  typography: new TypographyConstraint(),
  color: new ColorConstraint(),
  borders: new BordersConstraint(),
  shape: new ShapeConstraint(),
  shadows: new ShadowsConstraint(),
  alignment: new AlignmentConstraint(),
  hierarchy: new HierarchyConstraint(),
  composition: new CompositionConstraint(),
  density: new DensityConstraint(),
  state: new StateConstraint(),
  responsive: new ResponsiveConstraint(),
  accessibility: new AccessibilityConstraint(),
  'micro-interactions': new MicroInteractionsConstraint(),
}

/**
 * Apply a subset of constraint dimensions to a component, producing assertions.
 *
 * @param component - The component blueprint to generate assertions for
 * @param dimensions - Which dimensions to include (default: all 16)
 * @returns Array of ConstraintAssertions, ready for codegen
 */
export function applyConstraints(
  component: ComponentBlueprint,
  dimensions: readonly DimensionName[] = DIMENSION_NAMES,
): ConstraintAssertion[] {
  const assertions: ConstraintAssertion[] = []

  for (const dim of dimensions) {
    const mod = MODULES[dim]
    if (mod) {
      const dimAssertions = mod.generate(component)
      assertions.push(...dimAssertions)
    }
  }

  return assertions
}

/**
 * Apply constraints recursively to a component tree.
 * Returns a flat array of { selector, assertions } for all components.
 */
export function applyConstraintsRecursive(
  components: ComponentBlueprint[],
  dimensions: readonly DimensionName[] = DIMENSION_NAMES,
): { selector: string; name: string; assertions: ConstraintAssertion[] }[] {
  const results: { selector: string; name: string; assertions: ConstraintAssertion[] }[] = []

  function walk(comps: ComponentBlueprint[]) {
    for (const comp of comps) {
      const assertions = applyConstraints(comp, dimensions)
      if (assertions.length > 0) {
        results.push({ selector: comp.selector, name: comp.name, assertions })
      }
      if (comp.children) walk(comp.children)
    }
  }

  walk(components)
  return results
}

/**
 * Compute specificity score for a blueprint given active dimensions.
 *
 * Specificity = (active dimensions with data / total possible dimensions).
 * A blueprint with all 16 dimensions populated scores 1.0.
 * A blueprint with only layout data scores 1/16 = 0.0625.
 *
 * This metric helps the ablation study: higher specificity should correlate
 * with higher fidelity scores.
 */
export function computeSpecificityScore(
  components: ComponentBlueprint[],
  dimensions: readonly DimensionName[] = DIMENSION_NAMES,
): number {
  if (components.length === 0) return 0

  let totalSlots = 0
  let filledSlots = 0

  function walk(comps: ComponentBlueprint[]) {
    for (const comp of comps) {
      for (const dim of dimensions) {
        totalSlots++
        if (comp.dimensions[dim] !== undefined) filledSlots++
      }
      if (comp.children) walk(comp.children)
    }
  }

  walk(components)
  return totalSlots > 0 ? filledSlots / totalSlots : 0
}
