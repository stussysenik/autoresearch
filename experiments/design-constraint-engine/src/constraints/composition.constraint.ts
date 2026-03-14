/**
 * Composition Constraint Module
 *
 * Tests spatial composition — how elements relate to each other in 2D space.
 * Composition is a Tier 3 (relational) dimension that verifies the spatial
 * "grammar" of a design: containment, non-overlap, and reading order.
 *
 * Four composition rules are tested:
 *
 * 1. Containment — child elements must stay within parent bounds.
 *    Overflow is intentional (overflow: visible) or a bug. This test
 *    catches the bug case by verifying bounding box containment.
 *
 * 2. Non-overlap — specified element pairs must not have intersecting
 *    bounding boxes. Overlapping elements create visual clutter and
 *    indicate z-index or positioning errors.
 *
 * 3. Reading Order — elements should appear in the expected left-to-right,
 *    top-to-bottom reading order. This is critical for accessibility and
 *    for designs where visual order must match DOM/tab order.
 *
 * 4. DOM-Visual Order Match — the DOM source order should match the visual
 *    presentation order. Mismatches (via CSS order, flexbox reverse, or
 *    absolute positioning) can confuse screen readers and keyboard users.
 *
 * This module imports spatial helpers from '../utils/custom-matchers.js'
 * for containment and overlap checks, keeping the generated test code
 * self-contained and readable.
 */

import { ConstraintModule, ConstraintAssertion } from './base.js'
import type { ComponentBlueprint, CompositionData } from '../types/blueprint.js'
import { toBeContainedWithinCode, toNotOverlapWithCode } from '../utils/custom-matchers.js'

export class CompositionConstraint extends ConstraintModule {
  readonly dimension = 'composition' as const

  generate(component: ComponentBlueprint): ConstraintAssertion[] {
    if (!this.hasData(component)) return []
    const data = this.getData(component) as CompositionData
    const assertions: ConstraintAssertion[] = []

    // ── Containment ───────────────────────────────────────────────────────
    // Verifies that this element's bounding box is fully within its parent's
    // bounding box. Uses a 1px tolerance to account for sub-pixel rendering
    // and anti-aliasing at element edges.
    //
    // This catches common layout bugs:
    //   - Text overflowing a card container
    //   - Absolutely positioned children escaping their relative parent
    //   - Flex items exceeding their container due to missing min-width: 0

    if (data.isContainedWithinParent) {
      assertions.push(this.containmentAssertion(component))
    }

    // ── Non-Overlap ───────────────────────────────────────────────────────
    // For each element name in the noOverlapWith array, generates a bounding
    // box intersection test. Two elements overlap when their rectangles
    // intersect on both axes.
    //
    // The generated code references the other element by selector, which
    // requires the test file to have both locators available. The codegen
    // uses page.locator() with the target's selector directly.

    if (data.noOverlapWith && data.noOverlapWith.length > 0) {
      for (const targetName of data.noOverlapWith) {
        assertions.push(this.noOverlapAssertion(component, targetName))
      }
    }

    // ── Reading Order ─────────────────────────────────────────────────────
    // Asserts that this element appears at the expected position in the
    // visual reading order (left-to-right, top-to-bottom). Position is
    // determined by comparing the element's top-left corner coordinates
    // against siblings.
    //
    // readingOrder is 1-indexed: 1 means this element should appear first
    // in the reading flow among its siblings.

    if (data.readingOrder !== undefined) {
      assertions.push(this.readingOrderAssertion(component, data.readingOrder))
    }

    // ── DOM-Visual Order Match ────────────────────────────────────────────
    // Verifies that sibling elements appear in the same order visually
    // as they do in the DOM. This is important for accessibility — screen
    // readers follow DOM order, so a mismatch means sighted and non-sighted
    // users experience different content sequences.

    if (data.domMatchesVisualOrder) {
      assertions.push(this.domVisualOrderAssertion(component))
    }

    return assertions
  }

  /**
   * Generate containment assertion using the custom matcher helper.
   *
   * The toBeContainedWithinCode helper generates inline boundingBox checks
   * that verify all four edges of the child are within the parent's bounds.
   */
  private containmentAssertion(component: ComponentBlueprint): ConstraintAssertion {
    return {
      description: `${component.name} should be fully contained within its parent`,
      dimension: this.dimension,
      property: 'isContainedWithinParent',
      expected: 'true',
      weight: 0.6,
      codegen(locatorVar: string): string {
        // Use the parent locator pattern consistent with the codebase
        const parentVar = `${locatorVar}.locator('..')`
        return toBeContainedWithinCode(locatorVar, parentVar, 1)
      },
    }
  }

  /**
   * Generate non-overlap assertion for a specific target element.
   *
   * The toNotOverlapWithCode helper generates a bounding box intersection
   * test — two rectangles do NOT overlap when they are separated on at
   * least one axis (left/right or top/bottom).
   */
  private noOverlapAssertion(
    component: ComponentBlueprint,
    targetName: string
  ): ConstraintAssertion {
    return {
      description: `${component.name} should not overlap with ${targetName}`,
      dimension: this.dimension,
      property: `noOverlapWith:${targetName}`,
      expected: 'true',
      weight: 0.5,
      codegen(locatorVar: string): string {
        // The target element is referenced by a generated variable name
        // derived from its component name (camelCase, sanitized)
        const targetVar = `page.locator('[data-testid="${targetName}"]')`
        return toNotOverlapWithCode(locatorVar, targetVar)
      },
    }
  }

  /**
   * Assert reading order position among siblings.
   *
   * Generated code:
   *   1. Gets bounding boxes of all sibling elements
   *   2. Sorts siblings by Y position (primary) then X position (secondary)
   *   3. Finds this element's index in the sorted order
   *   4. Asserts the index matches the expected readingOrder (1-indexed)
   *
   * This tests left-to-right, top-to-bottom reading order — the standard
   * Western reading pattern. For RTL layouts, the X-axis comparison would
   * need to be reversed (not yet implemented).
   */
  private readingOrderAssertion(
    component: ComponentBlueprint,
    expectedOrder: number
  ): ConstraintAssertion {
    return {
      description: `${component.name} should be at reading order position ${expectedOrder}`,
      dimension: this.dimension,
      property: 'readingOrder',
      expected: String(expectedOrder),
      weight: 0.5,
      codegen(locatorVar: string): string {
        return [
          `  // Verify reading order position among siblings (1-indexed, LTR top-to-bottom)`,
          `  {`,
          `    const parentEl = ${locatorVar}.locator('..');`,
          `    const siblings = parentEl.locator('> *');`,
          `    const count = await siblings.count();`,
          `    const boxes: { index: number; x: number; y: number }[] = [];`,
          `    for (let i = 0; i < count; i++) {`,
          `      const box = await siblings.nth(i).boundingBox();`,
          `      if (box) boxes.push({ index: i, x: box.x, y: box.y });`,
          `    }`,
          `    // Sort by Y (row) then X (column) for LTR reading order`,
          `    boxes.sort((a, b) => {`,
          `      const rowDiff = a.y - b.y;`,
          `      return Math.abs(rowDiff) < 5 ? a.x - b.x : rowDiff;`,
          `    });`,
          `    const thisBox = await ${locatorVar}.boundingBox();`,
          `    expect(thisBox).toBeTruthy();`,
          `    const position = boxes.findIndex(b =>`,
          `      Math.abs(b.x - thisBox!.x) < 3 && Math.abs(b.y - thisBox!.y) < 3`,
          `    );`,
          `    expect(position + 1).toBe(${expectedOrder}); // 1-indexed`,
          `  }`,
        ].join('\n')
      },
    }
  }

  /**
   * Assert that DOM order matches visual presentation order.
   *
   * Generated code compares the DOM-order bounding boxes with a
   * spatially-sorted version. If the two orderings match, the DOM
   * order is consistent with the visual reading flow.
   *
   * This is an important accessibility check — CSS reordering
   * (flexbox order, grid placement, absolute positioning) can create
   * a disconnect between what users see and what screen readers announce.
   */
  private domVisualOrderAssertion(component: ComponentBlueprint): ConstraintAssertion {
    return {
      description: `${component.name} children DOM order should match visual order`,
      dimension: this.dimension,
      property: 'domMatchesVisualOrder',
      expected: 'true',
      weight: 0.5,
      codegen(locatorVar: string): string {
        return [
          `  // Verify DOM order matches visual (reading) order for children`,
          `  {`,
          `    const children = ${locatorVar}.locator('> *');`,
          `    const count = await children.count();`,
          `    const domOrder: { domIndex: number; x: number; y: number }[] = [];`,
          `    for (let i = 0; i < count; i++) {`,
          `      const box = await children.nth(i).boundingBox();`,
          `      if (box) domOrder.push({ domIndex: i, x: box.x, y: box.y });`,
          `    }`,
          `    // Sort by visual position (top-to-bottom, left-to-right)`,
          `    const visualOrder = [...domOrder].sort((a, b) => {`,
          `      const rowDiff = a.y - b.y;`,
          `      return Math.abs(rowDiff) < 5 ? a.x - b.x : rowDiff;`,
          `    });`,
          `    // DOM indices in visual order should be monotonically increasing`,
          `    const visualDomIndices = visualOrder.map(v => v.domIndex);`,
          `    const isMonotonic = visualDomIndices.every((v, i) =>`,
          `      i === 0 || v > visualDomIndices[i - 1]`,
          `    );`,
          `    expect(isMonotonic).toBe(true);`,
          `  }`,
        ].join('\n')
      },
    }
  }
}
