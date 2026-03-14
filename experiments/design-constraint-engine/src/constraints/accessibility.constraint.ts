/**
 * Accessibility Constraint Module
 *
 * Tests WCAG-critical properties: color contrast, focus ring visibility,
 * minimum target sizes, and ARIA roles. This is a Tier 3 dimension but
 * carries higher weight (0.5-0.7) because accessibility failures are
 * not just visual — they block real users.
 *
 * Key WCAG 2.1 thresholds:
 *   - Contrast ratio >= 4.5:1 for normal text (AA)
 *   - Contrast ratio >= 3:1 for large text (AA) or UI components
 *   - Minimum target size: 44x44px for touch (WCAG 2.5.5 AAA), 24x24px (AA)
 *   - Focus must be visible (WCAG 2.4.7)
 *
 * Contrast calculation is inlined in the generated code (not referencing
 * imported functions) because codegen produces self-contained test strings
 * that must work standalone in Playwright spec files.
 */

import { ConstraintModule, ConstraintAssertion } from './base.js'
import type { ComponentBlueprint } from '../types/blueprint.js'
import type { AccessibilityData } from '../types/blueprint.js'

export class AccessibilityConstraint extends ConstraintModule {
  readonly dimension = 'accessibility' as const

  generate(component: ComponentBlueprint): ConstraintAssertion[] {
    if (!this.hasData(component)) return []
    const data = this.getData(component) as AccessibilityData
    const assertions: ConstraintAssertion[] = []

    if (data.contrastRatio !== undefined) {
      assertions.push(this.contrastAssertion(component, data.contrastRatio))
    }

    if (data.hasFocusRing !== undefined) {
      assertions.push(this.focusRingAssertion(component, data.hasFocusRing))
    }

    if (data.minTargetSize !== undefined) {
      assertions.push(this.targetSizeAssertion(component, data.minTargetSize))
    }

    if (data.ariaRole !== undefined) {
      assertions.push(this.ariaRoleAssertion(component, data.ariaRole))
    }

    return assertions
  }

  /**
   * WCAG contrast ratio assertion.
   *
   * Generates self-contained Playwright code that:
   *   1. Reads computed `color` and `background-color` from the element
   *   2. Parses RGB values from the CSS strings
   *   3. Calculates relative luminance per WCAG 2.1 formula
   *   4. Computes contrast ratio and asserts it meets the minimum
   *
   * The entire calculation is inlined because generated test code must be
   * standalone — it cannot import project utility functions at runtime.
   *
   * Weight: 0.7 — contrast failures are high-severity accessibility issues.
   */
  private contrastAssertion(
    component: ComponentBlueprint,
    minRatio: number,
  ): ConstraintAssertion {
    return {
      description: `${component.name} contrast ratio should be >= ${minRatio}:1`,
      dimension: this.dimension,
      property: 'contrastRatio',
      expected: String(minRatio),
      weight: 0.7,
      codegen(locatorVar: string): string {
        // Inline the full WCAG contrast calculation in generated code
        return [
          `  {`,
          `    // WCAG 2.1 contrast ratio check (self-contained calculation)`,
          `    const fgColor = await ${locatorVar}.evaluate(el => getComputedStyle(el).color);`,
          `    const bgColor = await ${locatorVar}.evaluate(el => {`,
          `      let node: Element | null = el;`,
          `      while (node) {`,
          `        const bg = getComputedStyle(node).backgroundColor;`,
          `        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;`,
          `        node = node.parentElement;`,
          `      }`,
          `      return 'rgb(255, 255, 255)'; // default to white background`,
          `    });`,
          ``,
          `    function parseRGB(color: string): [number, number, number] {`,
          `      const m = color.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);`,
          `      return m ? [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])] : [0, 0, 0];`,
          `    }`,
          ``,
          `    function luminance(r: number, g: number, b: number): number {`,
          `      const [rs, gs, bs] = [r, g, b].map(c => {`,
          `        const s = c / 255;`,
          `        return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);`,
          `      });`,
          `      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;`,
          `    }`,
          ``,
          `    const [fgR, fgG, fgB] = parseRGB(fgColor);`,
          `    const [bgR, bgG, bgB] = parseRGB(bgColor);`,
          `    const fgL = luminance(fgR, fgG, fgB);`,
          `    const bgL = luminance(bgR, bgG, bgB);`,
          `    const ratio = (Math.max(fgL, bgL) + 0.05) / (Math.min(fgL, bgL) + 0.05);`,
          ``,
          `    expect(ratio).toBeGreaterThanOrEqual(${minRatio});`,
          `  }`,
        ].join('\n')
      },
    }
  }

  /**
   * Focus ring visibility assertion.
   *
   * Generates code that focuses the element then checks whether an outline
   * or box-shadow is present — the two most common focus indicator techniques.
   *
   * "Visible" means outline-style is not 'none' OR box-shadow is not 'none'.
   * If `hasFocusRing` is false, asserts that NO focus indicator is shown
   * (uncommon but valid for decorative elements).
   *
   * Weight: 0.6 — focus visibility is a WCAG 2.4.7 requirement.
   */
  private focusRingAssertion(
    component: ComponentBlueprint,
    shouldHaveFocusRing: boolean,
  ): ConstraintAssertion {
    return {
      description: `${component.name} ${shouldHaveFocusRing ? 'should' : 'should not'} show a visible focus ring`,
      dimension: this.dimension,
      property: 'hasFocusRing',
      expected: String(shouldHaveFocusRing),
      weight: 0.6,
      codegen(locatorVar: string): string {
        return [
          `  {`,
          `    // Focus the element and check for visible focus indicator`,
          `    await ${locatorVar}.focus();`,
          `    const outlineStyle = await ${locatorVar}.evaluate(el => getComputedStyle(el).outlineStyle);`,
          `    const boxShadow = await ${locatorVar}.evaluate(el => getComputedStyle(el).boxShadow);`,
          `    const hasFocusIndicator = (outlineStyle !== 'none' && outlineStyle !== '') || (boxShadow !== 'none' && boxShadow !== '');`,
          `    expect(hasFocusIndicator).toBe(${shouldHaveFocusRing});`,
          `  }`,
        ].join('\n')
      },
    }
  }

  /**
   * Minimum target size assertion (WCAG 2.5.5 / 2.5.8).
   *
   * Uses `boundingBox()` to measure the element's clickable area and asserts
   * both width and height meet the minimum. Generates a single assertion
   * block that checks both dimensions.
   *
   * Weight: 0.5 — target size affects touch usability significantly.
   */
  private targetSizeAssertion(
    component: ComponentBlueprint,
    minSize: number,
  ): ConstraintAssertion {
    return {
      description: `${component.name} target size should be >= ${minSize}x${minSize}px`,
      dimension: this.dimension,
      property: 'minTargetSize',
      expected: String(minSize),
      weight: 0.5,
      tolerance: { px: 2 },
      codegen(locatorVar: string): string {
        return [
          `  {`,
          `    // WCAG minimum target size check`,
          `    const box = await ${locatorVar}.boundingBox();`,
          `    expect(box).toBeTruthy();`,
          `    expect(box!.width).toBeGreaterThanOrEqual(${minSize});`,
          `    expect(box!.height).toBeGreaterThanOrEqual(${minSize});`,
          `  }`,
        ].join('\n')
      },
    }
  }

  /**
   * ARIA role assertion.
   *
   * Checks that the element exposes the correct ARIA role for assistive
   * technology. Uses Playwright's `toHaveAttribute()` for a clean assertion.
   *
   * Weight: 0.5 — ARIA roles are essential for screen reader navigation.
   */
  private ariaRoleAssertion(
    component: ComponentBlueprint,
    expectedRole: string,
  ): ConstraintAssertion {
    return {
      description: `${component.name} should have ARIA role '${expectedRole}'`,
      dimension: this.dimension,
      property: 'ariaRole',
      expected: expectedRole,
      weight: 0.5,
      codegen(locatorVar: string): string {
        return `  await expect(${locatorVar}).toHaveAttribute('role', '${expectedRole}');`
      },
    }
  }
}
