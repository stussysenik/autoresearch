/**
 * Base Constraint Module
 *
 * Every design dimension (layout, spacing, color, etc.) is a ConstraintModule
 * that knows how to extract testable assertions from Blueprint data.
 *
 * The key insight: constraints are composable. You can combine any subset of
 * dimensions to create a test suite of varying specificity. This enables the
 * ablation study — remove one dimension, measure fidelity drop.
 *
 * Pattern:
 *   ConstraintModule.generate(componentData) -> ConstraintAssertion[]
 *   Each assertion is a self-contained test that can be serialized to Playwright code.
 */

import type { DimensionName, ComponentBlueprint } from '../types/blueprint.js'

/**
 * A single testable assertion about a UI element.
 *
 * Each assertion maps to exactly one Playwright expect() call.
 * The `codegen()` method produces the actual test code string.
 */
export interface ConstraintAssertion {
  /** Human-readable description, e.g., "submit-button font-size should be 16px" */
  description: string
  /** Which dimension this assertion belongs to */
  dimension: DimensionName
  /** The CSS property or DOM attribute being tested */
  property: string
  /** Expected value */
  expected: string
  /** Acceptable deviation range (e.g., { px: 2 } means +/- 2px) */
  tolerance?: { px?: number; percent?: number }
  /** Importance weight 0-1 for scoring (higher = more visually impactful) */
  weight: number
  /**
   * Generate Playwright test code for this assertion.
   * @param locatorVar - The variable name holding the Playwright locator, e.g., 'submitBtn'
   * @returns A string of Playwright assertion code
   */
  codegen(locatorVar: string): string
}

/**
 * Abstract base for all 16 dimension modules.
 *
 * Each subclass implements `generate()` to convert dimension-specific data
 * from the Blueprint into an array of ConstraintAssertions.
 *
 * Example:
 *   class TypographyConstraint extends ConstraintModule {
 *     readonly dimension = 'typography'
 *     generate(component) { return [{ ... font-size assertion ... }] }
 *   }
 */
export abstract class ConstraintModule {
  abstract readonly dimension: DimensionName

  /**
   * Generate assertions from a component's dimension data.
   * Returns empty array if the component has no data for this dimension.
   */
  abstract generate(component: ComponentBlueprint): ConstraintAssertion[]

  /** Check if a component has data for this module's dimension */
  protected hasData(component: ComponentBlueprint): boolean {
    return component.dimensions[this.dimension] !== undefined
  }

  /** Get this module's dimension data from a component, typed as Record<string, any> */
  protected getData(component: ComponentBlueprint): Record<string, any> | undefined {
    return component.dimensions[this.dimension] as Record<string, any> | undefined
  }

  /**
   * Helper: create a CSS property assertion.
   * Generates: `await expect(locator).toHaveCSS('property', 'value')`
   */
  protected cssAssertion(
    component: ComponentBlueprint,
    property: string,
    expected: string,
    opts: { weight?: number; tolerance?: { px?: number; percent?: number } } = {}
  ): ConstraintAssertion {
    return {
      description: `${component.name} ${property} should be ${expected}`,
      dimension: this.dimension,
      property,
      expected,
      weight: opts.weight ?? 0.5,
      tolerance: opts.tolerance,
      codegen(locatorVar: string): string {
        return `  await expect(${locatorVar}).toHaveCSS('${property}', '${expected}');`
      },
    }
  }

  /**
   * Helper: create a bounding box assertion.
   * Generates code that checks boundingBox() properties.
   */
  protected boundingBoxAssertion(
    component: ComponentBlueprint,
    property: 'width' | 'height' | 'x' | 'y',
    expected: number,
    opts: { weight?: number; tolerancePx?: number } = {}
  ): ConstraintAssertion {
    const tol = opts.tolerancePx ?? 5
    return {
      description: `${component.name} bounding box ${property} should be ~${expected}px`,
      dimension: this.dimension,
      property: `boundingBox.${property}`,
      expected: String(expected),
      weight: opts.weight ?? 0.5,
      tolerance: { px: tol },
      codegen(locatorVar: string): string {
        return [
          `  {`,
          `    const box = await ${locatorVar}.boundingBox();`,
          `    expect(box).toBeTruthy();`,
          `    expect(box!.${property}).toBeGreaterThanOrEqual(${expected - tol});`,
          `    expect(box!.${property}).toBeLessThanOrEqual(${expected + tol});`,
          `  }`,
        ].join('\n')
      },
    }
  }

  /**
   * Helper: create a computed style assertion via evaluate().
   * For properties not directly supported by toHaveCSS().
   */
  protected computedStyleAssertion(
    component: ComponentBlueprint,
    property: string,
    expected: string,
    opts: { weight?: number } = {}
  ): ConstraintAssertion {
    return {
      description: `${component.name} computed ${property} should be ${expected}`,
      dimension: this.dimension,
      property,
      expected,
      weight: opts.weight ?? 0.4,
      codegen(locatorVar: string): string {
        return [
          `  {`,
          `    const value = await ${locatorVar}.evaluate(el => getComputedStyle(el).${property});`,
          `    expect(value).toBe('${expected}');`,
          `  }`,
        ].join('\n')
      },
    }
  }
}
