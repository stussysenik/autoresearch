/**
 * State Constraint Module
 *
 * Tests that interactive states (hover, focus, active, disabled) produce the
 * expected CSS changes. This is a Tier 3 "Relational" dimension because state
 * changes refine the user experience rather than define structure.
 *
 * Unlike static CSS assertions, state constraints generate multi-step Playwright
 * code: first trigger the state (hover, focus, etc.), then assert CSS changes.
 * Each state-property pair becomes its own assertion so ablation can measure
 * the contribution of individual interaction states.
 *
 * Pattern:
 *   1. Trigger state on the locator (e.g., `await locator.hover()`)
 *   2. Assert each CSS property that should change in that state
 *
 * Weight range: 0.4-0.5 — state changes are important for usability but
 * less structurally impactful than layout or typography.
 */

import { ConstraintModule, ConstraintAssertion } from './base.js'
import type { ComponentBlueprint } from '../types/blueprint.js'
import type { StateData } from '../types/blueprint.js'

/**
 * Maps each interactive state to its Playwright trigger action.
 *
 * - hover:    `await locator.hover()` — simulates mouseover
 * - focus:    `await locator.focus()` — simulates keyboard/programmatic focus
 * - active:   `await locator.hover()` followed by `await page.mouse.down()`
 *             — simulates mousedown (active pseudo-class)
 * - disabled: No trigger needed — the element should already be in a disabled
 *             state; we just check the CSS as-is (assuming the element has
 *             the `disabled` attribute set for the test scenario)
 */
const STATE_TRIGGERS: Record<string, (locatorVar: string) => string> = {
  hover: (lv) => `await ${lv}.hover();`,
  focus: (lv) => `await ${lv}.focus();`,
  active: (lv) => [
    `await ${lv}.hover();`,
    `await ${lv}.page().mouse.down();`,
  ].join('\n    '),
  disabled: (_lv) =>
    `// Disabled state — assumes the element has the 'disabled' attribute set in this test scenario`,
}

export class StateConstraint extends ConstraintModule {
  readonly dimension = 'state' as const

  generate(component: ComponentBlueprint): ConstraintAssertion[] {
    if (!this.hasData(component)) return []
    const data = this.getData(component) as StateData
    const assertions: ConstraintAssertion[] = []

    // Iterate each interactive state that has defined CSS changes
    for (const stateName of ['hover', 'focus', 'active', 'disabled'] as const) {
      const changes = data[stateName]
      if (!changes) continue

      // Each CSS property changed in this state gets its own assertion
      for (const [cssProp, expectedValue] of Object.entries(changes)) {
        assertions.push(
          this.stateAssertion(component, stateName, cssProp, expectedValue)
        )
      }
    }

    return assertions
  }

  /**
   * Create an assertion that triggers an interactive state then checks a CSS property.
   *
   * The generated Playwright code:
   *   1. Triggers the state (hover, focus, etc.)
   *   2. Asserts the expected CSS value with `toHaveCSS()`
   *   3. Wraps in a block scope to isolate the state trigger
   *
   * Weight varies by state importance:
   *   - hover/focus: 0.5 (critical for interactive feedback)
   *   - active: 0.4 (brief visual state, less persistent)
   *   - disabled: 0.45 (important for accessibility/UX clarity)
   */
  private stateAssertion(
    component: ComponentBlueprint,
    state: 'hover' | 'focus' | 'active' | 'disabled',
    cssProp: string,
    expectedValue: string,
  ): ConstraintAssertion {
    const weight = state === 'hover' || state === 'focus'
      ? 0.5
      : state === 'disabled'
        ? 0.45
        : 0.4

    const trigger = STATE_TRIGGERS[state]

    return {
      description: `${component.name} on ${state}: ${cssProp} should be ${expectedValue}`,
      dimension: this.dimension,
      property: `${state}:${cssProp}`,
      expected: expectedValue,
      weight,
      codegen(locatorVar: string): string {
        return [
          `  {`,
          `    // Trigger ${state} state`,
          `    ${trigger(locatorVar)}`,
          `    await expect(${locatorVar}).toHaveCSS('${cssProp}', '${expectedValue}');`,
          `  }`,
        ].join('\n')
      },
    }
  }
}
