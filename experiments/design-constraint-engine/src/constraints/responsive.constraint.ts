/**
 * Responsive Constraint Module
 *
 * Tests that a component's CSS adapts correctly at specified viewport breakpoints.
 * This is a Tier 3 "Relational" dimension — responsiveness refines the design
 * across device sizes rather than defining baseline structure.
 *
 * Unlike static assertions, responsive constraints generate multi-step Playwright
 * code that resizes the viewport before checking CSS changes. Each breakpoint
 * generates a separate test block so failures pinpoint which breakpoint broke.
 *
 * Pattern:
 *   1. Set viewport to the breakpoint width via `page.setViewportSize()`
 *   2. Assert each CSS property that should change at that breakpoint
 *
 * IMPORTANT: The generated test code requires access to the Playwright `page`
 * object, not just the locator. The codegen includes a comment noting this
 * dependency so test harness authors know to provide `page` in scope.
 *
 * Weight: 0.4 — responsive adaptations matter for cross-device fidelity
 * but individual breakpoint changes are less critical than core structure.
 */

import { ConstraintModule, ConstraintAssertion } from './base.js'
import type { ComponentBlueprint } from '../types/blueprint.js'
import type { ResponsiveData } from '../types/blueprint.js'

export class ResponsiveConstraint extends ConstraintModule {
  readonly dimension = 'responsive' as const

  generate(component: ComponentBlueprint): ConstraintAssertion[] {
    if (!this.hasData(component)) return []
    const data = this.getData(component) as ResponsiveData
    const assertions: ConstraintAssertion[] = []

    if (!data.breakpoints) return assertions

    // Each breakpoint generates assertions for all CSS properties that change at that width
    for (const breakpoint of data.breakpoints) {
      for (const [cssProp, expectedValue] of Object.entries(breakpoint.changes)) {
        assertions.push(
          this.breakpointAssertion(component, breakpoint.width, cssProp, expectedValue)
        )
      }
    }

    return assertions
  }

  /**
   * Create an assertion that resizes the viewport then checks a CSS property.
   *
   * The generated Playwright code:
   *   1. Calls `page.setViewportSize()` to simulate the breakpoint
   *   2. Asserts the expected CSS change with `toHaveCSS()`
   *
   * NOTE: The generated code assumes `page` is available in the test scope.
   * This is standard for Playwright test files but worth noting since most
   * other assertions only need the locator variable.
   */
  private breakpointAssertion(
    component: ComponentBlueprint,
    width: number,
    cssProp: string,
    expectedValue: string,
  ): ConstraintAssertion {
    return {
      description: `${component.name} at ${width}px viewport: ${cssProp} should be ${expectedValue}`,
      dimension: this.dimension,
      property: `@${width}:${cssProp}`,
      expected: expectedValue,
      weight: 0.4,
      codegen(locatorVar: string): string {
        return [
          `  {`,
          `    // Responsive: resize viewport to ${width}px breakpoint`,
          `    // NOTE: requires \`page\` object in scope (standard in Playwright test files)`,
          `    await page.setViewportSize({ width: ${width}, height: 720 });`,
          `    await expect(${locatorVar}).toHaveCSS('${cssProp}', '${expectedValue}');`,
          `  }`,
        ].join('\n')
      },
    }
  }
}
