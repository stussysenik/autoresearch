/**
 * Micro-Interactions Constraint Module
 *
 * Tests CSS transition, animation, and cursor properties that create the
 * "feel" of a UI. These are Tier 3 refinements — removing transitions
 * won't break layout, but the UI will feel cheap and unpolished.
 *
 * All properties in this dimension map directly to CSS properties, so
 * we use the base `cssAssertion()` helper for clean, standard assertions.
 *
 * camelCase -> kebab-case mapping:
 *   transitionProperty       -> transition-property
 *   transitionDuration       -> transition-duration
 *   transitionTimingFunction -> transition-timing-function
 *
 * Weight range: 0.3-0.4 — micro-interactions are the lowest-weight visual
 * dimension. They matter for perceived quality but don't affect layout fidelity.
 */

import { ConstraintModule, ConstraintAssertion } from './base.js'
import type { ComponentBlueprint } from '../types/blueprint.js'
import type { MicroInteractionsData } from '../types/blueprint.js'

/**
 * Maps MicroInteractionsData property names (camelCase) to their CSS equivalents (kebab-case).
 *
 * Each entry: [dataKey, cssProperty, weight]
 *
 * Weight rationale:
 *   - transition (shorthand): 0.4 — defines the overall interaction feel
 *   - transitionProperty: 0.3 — specifies which properties animate
 *   - transitionDuration: 0.4 — timing is the most perceptible part
 *   - transitionTimingFunction: 0.3 — easing is subtle but noticeable
 *   - animation: 0.4 — full animation declarations are visually significant
 *   - cursor: 0.3 — important for affordance but not visual fidelity
 */
const PROPERTY_MAP: Array<[keyof MicroInteractionsData, string, number]> = [
  ['transition', 'transition', 0.4],
  ['transitionProperty', 'transition-property', 0.3],
  ['transitionDuration', 'transition-duration', 0.4],
  ['transitionTimingFunction', 'transition-timing-function', 0.3],
  ['animation', 'animation', 0.4],
  ['cursor', 'cursor', 0.3],
]

export class MicroInteractionsConstraint extends ConstraintModule {
  readonly dimension = 'micro-interactions' as const

  generate(component: ComponentBlueprint): ConstraintAssertion[] {
    if (!this.hasData(component)) return []
    const data = this.getData(component) as MicroInteractionsData
    const assertions: ConstraintAssertion[] = []

    for (const [dataKey, cssProp, weight] of PROPERTY_MAP) {
      const value = data[dataKey]
      if (value !== undefined) {
        assertions.push(
          this.cssAssertion(component, cssProp, value, { weight })
        )
      }
    }

    return assertions
  }
}
