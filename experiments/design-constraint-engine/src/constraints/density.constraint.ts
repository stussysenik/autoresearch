/**
 * Density Constraint Module
 *
 * Tests information density — how tightly or loosely content is packed
 * within a container. Density is a Tier 3 (relational) dimension that
 * measures the spatial relationship between content and whitespace.
 *
 * Three density metrics are tested:
 *
 * 1. Whitespace Ratio — the proportion of the parent's area not occupied
 *    by children. A ratio of 0.3 means 30% whitespace (dense), while
 *    0.7 means 70% whitespace (spacious). Good designs typically maintain
 *    consistent density within component types (all cards similar, all
 *    form fields similar).
 *
 * 2. Items Per Row — how many child elements share the same Y coordinate
 *    (are on the same visual row). This tests grid-like layouts where
 *    a specific number of columns is expected (e.g., 3 cards per row).
 *
 * 3. Average Gap — the mean distance between consecutive child elements.
 *    Consistent gaps indicate a well-structured layout with intentional
 *    spacing. Irregular gaps suggest layout issues.
 *
 * All three tests use boundingBox() calculations rather than CSS properties
 * because density is a *visual* metric — it describes what users see,
 * not what CSS declares. A `gap: 16px` might produce different visual
 * densities depending on element sizes.
 *
 * Weights are 0.3-0.4 (lowest tier) because density violations are
 * the subtlest visual issue — users notice them as "something feels off"
 * rather than identifying specific problems.
 */

import { ConstraintModule, ConstraintAssertion } from './base.js'
import type { ComponentBlueprint, DensityData } from '../types/blueprint.js'

export class DensityConstraint extends ConstraintModule {
  readonly dimension = 'density' as const

  generate(component: ComponentBlueprint): ConstraintAssertion[] {
    if (!this.hasData(component)) return []
    const data = this.getData(component) as DensityData
    const assertions: ConstraintAssertion[] = []

    // ── Whitespace Ratio ──────────────────────────────────────────────────
    // Measures the fraction of the parent's area that is NOT covered by
    // child elements. This is a proxy for visual breathing room.
    //
    // Calculation:
    //   childrenArea = sum(child.width * child.height for each child)
    //   parentArea = parent.width * parent.height
    //   whitespaceRatio = 1 - (childrenArea / parentArea)
    //
    // Tolerance of 0.1 (10%) accounts for:
    //   - Sub-pixel rendering differences
    //   - Dynamic content length variations
    //   - Minor padding/margin adjustments during responsive scaling

    if (data.whitespaceRatio !== undefined) {
      assertions.push(this.whitespaceRatioAssertion(component, data.whitespaceRatio))
    }

    // ── Items Per Row ─────────────────────────────────────────────────────
    // Counts how many children share approximately the same Y position
    // (within 5px tolerance). This verifies grid column counts and
    // flex wrap behavior.
    //
    // We measure the first visual row (smallest Y cluster) because
    // subsequent rows may be incomplete (e.g., 3-column grid with 7 items
    // has 3, 3, 1 — we test the first row of 3).

    if (data.itemsPerRow !== undefined) {
      assertions.push(this.itemsPerRowAssertion(component, data.itemsPerRow))
    }

    // ── Average Gap ───────────────────────────────────────────────────────
    // Measures the mean gap between consecutive child elements.
    // "Consecutive" means adjacent in DOM order; the gap is measured
    // along the primary axis (horizontal for same-row elements,
    // vertical for elements on different rows).
    //
    // Tolerance of 3px matches the spacing dimension's tolerance,
    // since average gap is essentially a statistical measure of spacing.

    if (data.averageGap !== undefined) {
      assertions.push(this.averageGapAssertion(component, data.averageGap))
    }

    return assertions
  }

  /**
   * Assert that the whitespace ratio within this element matches expectations.
   *
   * Whitespace ratio = 1 - (total children area / parent area).
   * A value of 0.0 means children completely fill the parent (no whitespace).
   * A value of 1.0 means no children are visible (all whitespace).
   *
   * Typical values:
   *   - Dense data table: 0.1 - 0.2
   *   - Card grid: 0.2 - 0.4
   *   - Hero section: 0.5 - 0.8
   *   - Minimalist landing page: 0.7 - 0.9
   */
  private whitespaceRatioAssertion(
    component: ComponentBlueprint,
    expectedRatio: number
  ): ConstraintAssertion {
    const tolerance = 0.1
    return {
      description: `${component.name} whitespace ratio should be ~${expectedRatio}`,
      dimension: this.dimension,
      property: 'whitespaceRatio',
      expected: String(expectedRatio),
      weight: 0.4,
      codegen(locatorVar: string): string {
        return [
          `  // Measure whitespace ratio: 1 - (children area / parent area)`,
          `  {`,
          `    const parentBox = await ${locatorVar}.boundingBox();`,
          `    expect(parentBox).toBeTruthy();`,
          `    const children = ${locatorVar}.locator('> *');`,
          `    const count = await children.count();`,
          `    let childrenArea = 0;`,
          `    for (let i = 0; i < count; i++) {`,
          `      const childBox = await children.nth(i).boundingBox();`,
          `      if (childBox) {`,
          `        childrenArea += childBox.width * childBox.height;`,
          `      }`,
          `    }`,
          `    const parentArea = parentBox!.width * parentBox!.height;`,
          `    const whitespaceRatio = parentArea > 0 ? 1 - (childrenArea / parentArea) : 1;`,
          `    expect(whitespaceRatio).toBeGreaterThanOrEqual(${expectedRatio - tolerance});`,
          `    expect(whitespaceRatio).toBeLessThanOrEqual(${expectedRatio + tolerance});`,
          `  }`,
        ].join('\n')
      },
    }
  }

  /**
   * Assert that the first visual row contains the expected number of items.
   *
   * Algorithm:
   *   1. Get bounding boxes for all direct children
   *   2. Find the minimum Y value (top of first row)
   *   3. Count children whose Y is within 5px of that minimum
   *   4. Assert count matches expected itemsPerRow
   *
   * The 5px Y-tolerance groups elements that are on the "same row" even
   * if they have slight vertical offsets from baseline alignment or
   * different top margins.
   */
  private itemsPerRowAssertion(
    component: ComponentBlueprint,
    expectedCount: number
  ): ConstraintAssertion {
    return {
      description: `${component.name} should have ${expectedCount} items per row`,
      dimension: this.dimension,
      property: 'itemsPerRow',
      expected: String(expectedCount),
      weight: 0.4,
      codegen(locatorVar: string): string {
        return [
          `  // Count items in the first visual row (same Y position within 5px)`,
          `  {`,
          `    const children = ${locatorVar}.locator('> *');`,
          `    const count = await children.count();`,
          `    const yPositions: number[] = [];`,
          `    for (let i = 0; i < count; i++) {`,
          `      const box = await children.nth(i).boundingBox();`,
          `      if (box) yPositions.push(box.y);`,
          `    }`,
          `    // Find the first row: elements with Y close to the minimum Y`,
          `    const minY = Math.min(...yPositions);`,
          `    const firstRowCount = yPositions.filter(y => Math.abs(y - minY) <= 5).length;`,
          `    expect(firstRowCount).toBe(${expectedCount});`,
          `  }`,
        ].join('\n')
      },
    }
  }

  /**
   * Assert that the average gap between consecutive children matches expectations.
   *
   * Algorithm:
   *   1. Get bounding boxes for all direct children in DOM order
   *   2. For consecutive pairs, measure the gap:
   *      - If same row (Y within 5px): gap = next.x - (current.x + current.width)
   *      - If different row: gap = next.y - (current.y + current.height)
   *   3. Compute the mean of all gaps
   *   4. Assert the mean is within 3px of the expected averageGap
   *
   * Measuring along the appropriate axis ensures we capture both horizontal
   * gaps (inline/row layouts) and vertical gaps (block/column layouts).
   */
  private averageGapAssertion(
    component: ComponentBlueprint,
    expectedGap: number
  ): ConstraintAssertion {
    const tolerancePx = 3
    return {
      description: `${component.name} average gap between children should be ~${expectedGap}px`,
      dimension: this.dimension,
      property: 'averageGap',
      expected: String(expectedGap),
      weight: 0.3,
      tolerance: { px: tolerancePx },
      codegen(locatorVar: string): string {
        return [
          `  // Measure average gap between consecutive child elements`,
          `  {`,
          `    const children = ${locatorVar}.locator('> *');`,
          `    const count = await children.count();`,
          `    expect(count).toBeGreaterThanOrEqual(2); // Need at least 2 children to measure gaps`,
          `    const boxes: { x: number; y: number; width: number; height: number }[] = [];`,
          `    for (let i = 0; i < count; i++) {`,
          `      const box = await children.nth(i).boundingBox();`,
          `      if (box) boxes.push(box);`,
          `    }`,
          `    const gaps: number[] = [];`,
          `    for (let i = 1; i < boxes.length; i++) {`,
          `      const prev = boxes[i - 1];`,
          `      const curr = boxes[i];`,
          `      // Determine axis: same row (horizontal gap) or different row (vertical gap)`,
          `      const sameRow = Math.abs(prev.y - curr.y) < 5;`,
          `      if (sameRow) {`,
          `        gaps.push(curr.x - (prev.x + prev.width));`,
          `      } else {`,
          `        gaps.push(curr.y - (prev.y + prev.height));`,
          `      }`,
          `    }`,
          `    const avgGap = gaps.reduce((sum, g) => sum + g, 0) / gaps.length;`,
          `    expect(avgGap).toBeGreaterThanOrEqual(${expectedGap - tolerancePx});`,
          `    expect(avgGap).toBeLessThanOrEqual(${expectedGap + tolerancePx});`,
          `  }`,
        ].join('\n')
      },
    }
  }
}
