/**
 * Alignment Constraint Module
 *
 * Tests how elements are positioned relative to their containers and siblings.
 * Alignment is a Tier 3 (relational) dimension — it refines the spatial
 * relationships established by layout and spacing.
 *
 * Two categories of alignment tests:
 *
 * 1. CSS Property Assertions — straightforward toHaveCSS() checks for
 *    justifyContent, alignItems, alignSelf, justifySelf, textAlign, verticalAlign.
 *    These verify the *intent* declared in CSS.
 *
 * 2. Visual Centering Assertions — boundingBox() calculations that verify
 *    the *result* of centering. An element can be visually centered through
 *    many CSS mechanisms (margin: auto, flexbox, grid, transforms), so we
 *    test the outcome rather than the implementation.
 *
 * Why both? CSS properties tell us the developer's intent; bounding box
 * checks tell us the visual result. A button might have `text-align: center`
 * but still appear off-center if its container has asymmetric padding.
 */

import { ConstraintModule, ConstraintAssertion } from './base.js'
import type { ComponentBlueprint, AlignmentData } from '../types/blueprint.js'

export class AlignmentConstraint extends ConstraintModule {
  readonly dimension = 'alignment' as const

  generate(component: ComponentBlueprint): ConstraintAssertion[] {
    if (!this.hasData(component)) return []
    const data = this.getData(component) as AlignmentData
    const assertions: ConstraintAssertion[] = []

    // ── CSS Property Assertions ───────────────────────────────────────────
    // These test the declared alignment properties via toHaveCSS().
    // Weights reflect visual impact: justify/align on flex containers (0.7)
    // are more impactful than text-align on leaf nodes (0.5).

    if (data.justifyContent) {
      assertions.push(
        this.cssAssertion(component, 'justify-content', data.justifyContent, { weight: 0.7 })
      )
    }

    if (data.alignItems) {
      assertions.push(
        this.cssAssertion(component, 'align-items', data.alignItems, { weight: 0.7 })
      )
    }

    if (data.alignSelf) {
      assertions.push(
        this.cssAssertion(component, 'align-self', data.alignSelf, { weight: 0.6 })
      )
    }

    if (data.justifySelf) {
      assertions.push(
        this.cssAssertion(component, 'justify-self', data.justifySelf, { weight: 0.6 })
      )
    }

    if (data.textAlign) {
      assertions.push(
        this.cssAssertion(component, 'text-align', data.textAlign, { weight: 0.5 })
      )
    }

    if (data.verticalAlign) {
      assertions.push(
        this.cssAssertion(component, 'vertical-align', data.verticalAlign, { weight: 0.5 })
      )
    }

    // ── Visual Centering Assertions ───────────────────────────────────────
    // These use boundingBox() to verify the element is actually centered
    // within its parent, regardless of which CSS technique achieves it.
    //
    // The tolerance of 3px accounts for sub-pixel rendering and rounding.
    // This is intentionally tighter than sizing tolerance (5px) because
    // misalignment is more visually noticeable than size differences.

    if (data.isCenteredHorizontally) {
      assertions.push(this.centeredHorizontallyAssertion(component))
    }

    if (data.isCenteredVertically) {
      assertions.push(this.centeredVerticallyAssertion(component))
    }

    return assertions
  }

  /**
   * Assert that an element's horizontal center matches its parent's horizontal center.
   *
   * Algorithm:
   *   childCenterX = child.x + child.width / 2
   *   parentCenterX = parent.x + parent.width / 2
   *   |childCenterX - parentCenterX| <= 3px
   *
   * This catches off-center elements regardless of how centering was attempted.
   */
  private centeredHorizontallyAssertion(component: ComponentBlueprint): ConstraintAssertion {
    const tolerancePx = 3
    return {
      description: `${component.name} should be horizontally centered within its parent`,
      dimension: this.dimension,
      property: 'isCenteredHorizontally',
      expected: 'true',
      weight: 0.6,
      tolerance: { px: tolerancePx },
      codegen(locatorVar: string): string {
        return [
          `  // Verify horizontal centering by comparing midpoints of element and parent`,
          `  {`,
          `    const childBox = await ${locatorVar}.boundingBox();`,
          `    const parentBox = await ${locatorVar}.locator('..').boundingBox();`,
          `    expect(childBox).toBeTruthy();`,
          `    expect(parentBox).toBeTruthy();`,
          `    const childCenterX = childBox!.x + childBox!.width / 2;`,
          `    const parentCenterX = parentBox!.x + parentBox!.width / 2;`,
          `    expect(Math.abs(childCenterX - parentCenterX)).toBeLessThanOrEqual(${tolerancePx});`,
          `  }`,
        ].join('\n')
      },
    }
  }

  /**
   * Assert that an element's vertical center matches its parent's vertical center.
   *
   * Algorithm:
   *   childCenterY = child.y + child.height / 2
   *   parentCenterY = parent.y + parent.height / 2
   *   |childCenterY - parentCenterY| <= 3px
   *
   * Vertical centering is often harder to achieve in CSS (requires flexbox
   * or grid), so this assertion catches the common case where vertical
   * centering is intended but not correctly implemented.
   */
  private centeredVerticallyAssertion(component: ComponentBlueprint): ConstraintAssertion {
    const tolerancePx = 3
    return {
      description: `${component.name} should be vertically centered within its parent`,
      dimension: this.dimension,
      property: 'isCenteredVertically',
      expected: 'true',
      weight: 0.6,
      tolerance: { px: tolerancePx },
      codegen(locatorVar: string): string {
        return [
          `  // Verify vertical centering by comparing midpoints of element and parent`,
          `  {`,
          `    const childBox = await ${locatorVar}.boundingBox();`,
          `    const parentBox = await ${locatorVar}.locator('..').boundingBox();`,
          `    expect(childBox).toBeTruthy();`,
          `    expect(parentBox).toBeTruthy();`,
          `    const childCenterY = childBox!.y + childBox!.height / 2;`,
          `    const parentCenterY = parentBox!.y + parentBox!.height / 2;`,
          `    expect(Math.abs(childCenterY - parentCenterY)).toBeLessThanOrEqual(${tolerancePx});`,
          `  }`,
        ].join('\n')
      },
    }
  }
}
