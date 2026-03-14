/**
 * Hierarchy Constraint Module
 *
 * Tests visual hierarchy — the system of visual weight that guides users'
 * attention through a UI. Hierarchy is a Tier 3 (relational) dimension
 * because it describes relationships *between* elements, not properties
 * of a single element.
 *
 * Visual hierarchy is established through:
 *   - Font size ratios (larger = more prominent)
 *   - Font weight ratios (bolder = more prominent)
 *   - Contrast ratios (higher contrast = more prominent)
 *   - Prominence ranking (explicit ordering of visual weight)
 *
 * Unlike other dimensions that test absolute values ("font-size should be 16px"),
 * hierarchy tests *relative* values ("heading should be 1.5x the body text").
 * This makes hierarchy constraints more resilient to global style changes —
 * if a redesign increases all font sizes by 2px, hierarchy is preserved
 * as long as the ratios remain correct.
 *
 * Weights are lower (0.3-0.5) because hierarchy violations are subtler
 * than structural issues. A wrong font-size ratio degrades quality but
 * doesn't break the layout the way a wrong display value would.
 */

import { ConstraintModule, ConstraintAssertion } from './base.js'
import type { ComponentBlueprint, HierarchyData } from '../types/blueprint.js'

export class HierarchyConstraint extends ConstraintModule {
  readonly dimension = 'hierarchy' as const

  generate(component: ComponentBlueprint): ConstraintAssertion[] {
    if (!this.hasData(component)) return []
    const data = this.getData(component) as HierarchyData
    const assertions: ConstraintAssertion[] = []

    // ── Font Size Ratio ───────────────────────────────────────────────────
    // Verifies that this element's font-size maintains the expected ratio
    // relative to its parent's font-size. A heading with fontSizeRatio: 1.5
    // should be 1.5x the parent's font-size.
    //
    // Uses getComputedStyle to get the resolved px value, then divides
    // by the parent's resolved font-size. Tolerance of 0.1 accounts
    // for rounding in px-to-ratio conversion.

    if (data.fontSizeRatio !== undefined) {
      assertions.push(this.fontSizeRatioAssertion(component, data.fontSizeRatio))
    }

    // ── Font Weight Ratio ─────────────────────────────────────────────────
    // Similar to font-size ratio but for weight. CSS font-weight is numeric
    // (100-900), so the ratio is straightforward. A bold heading (700) over
    // normal body (400) has fontWeightRatio: 1.75.

    if (data.fontWeightRatio !== undefined) {
      assertions.push(this.fontWeightRatioAssertion(component, data.fontWeightRatio))
    }

    // ── Prominence Rank ───────────────────────────────────────────────────
    // A human-assigned rank (1 = most prominent) that documents the intended
    // visual hierarchy among siblings. This is a comment-only assertion
    // because prominence is a composite of many factors (size, weight,
    // color, position) and cannot be automatically tested with a single check.
    //
    // The comment serves as documentation for developers reviewing the
    // generated test file, making the design intent explicit.

    if (data.prominenceRank !== undefined) {
      assertions.push(this.prominenceRankAssertion(component, data.prominenceRank))
    }

    // ── Contrast Ratio ────────────────────────────────────────────────────
    // Tests the contrast between the element's text color and its background.
    // Higher contrast = more visual weight = higher hierarchy position.
    //
    // This complements WCAG accessibility checks (which enforce minimums)
    // by testing the *intended* contrast as a design choice. A secondary
    // label might intentionally have lower contrast (e.g., 5:1) than a
    // primary heading (e.g., 12:1).

    if (data.contrastRatio !== undefined) {
      assertions.push(this.contrastRatioAssertion(component, data.contrastRatio))
    }

    return assertions
  }

  /**
   * Assert that the element's font-size ratio to its parent matches the expected value.
   *
   * Generated code:
   *   1. Gets computed font-size of element (in px)
   *   2. Gets computed font-size of parent (in px)
   *   3. Computes ratio = element / parent
   *   4. Asserts ratio is within 0.1 of expected
   */
  private fontSizeRatioAssertion(
    component: ComponentBlueprint,
    expectedRatio: number
  ): ConstraintAssertion {
    const tolerance = 0.1
    return {
      description: `${component.name} font-size ratio to parent should be ~${expectedRatio}`,
      dimension: this.dimension,
      property: 'fontSizeRatio',
      expected: String(expectedRatio),
      weight: 0.5,
      codegen(locatorVar: string): string {
        return [
          `  // Verify font-size ratio between element and its parent`,
          `  {`,
          `    const fontSize = await ${locatorVar}.evaluate(el => {`,
          `      return parseFloat(getComputedStyle(el).fontSize);`,
          `    });`,
          `    const parentFontSize = await ${locatorVar}.evaluate(el => {`,
          `      return parseFloat(getComputedStyle(el.parentElement!).fontSize);`,
          `    });`,
          `    const ratio = fontSize / parentFontSize;`,
          `    expect(ratio).toBeGreaterThanOrEqual(${expectedRatio - tolerance});`,
          `    expect(ratio).toBeLessThanOrEqual(${expectedRatio + tolerance});`,
          `  }`,
        ].join('\n')
      },
    }
  }

  /**
   * Assert that the element's font-weight ratio to its parent matches the expected value.
   *
   * CSS font-weight resolves to numeric values (100-900), making ratio
   * computation straightforward. We use a tolerance of 0.15 because
   * font-weight steps are coarser (100, 200, 300...) than font-size.
   */
  private fontWeightRatioAssertion(
    component: ComponentBlueprint,
    expectedRatio: number
  ): ConstraintAssertion {
    const tolerance = 0.15
    return {
      description: `${component.name} font-weight ratio to parent should be ~${expectedRatio}`,
      dimension: this.dimension,
      property: 'fontWeightRatio',
      expected: String(expectedRatio),
      weight: 0.4,
      codegen(locatorVar: string): string {
        return [
          `  // Verify font-weight ratio between element and its parent`,
          `  {`,
          `    const fontWeight = await ${locatorVar}.evaluate(el => {`,
          `      return parseFloat(getComputedStyle(el).fontWeight);`,
          `    });`,
          `    const parentFontWeight = await ${locatorVar}.evaluate(el => {`,
          `      return parseFloat(getComputedStyle(el.parentElement!).fontWeight);`,
          `    });`,
          `    const ratio = fontWeight / parentFontWeight;`,
          `    expect(ratio).toBeGreaterThanOrEqual(${expectedRatio - tolerance});`,
          `    expect(ratio).toBeLessThanOrEqual(${expectedRatio + tolerance});`,
          `  }`,
        ].join('\n')
      },
    }
  }

  /**
   * Document the expected prominence rank as a comment assertion.
   *
   * Prominence rank is a subjective, human-assigned value that cannot be
   * automatically verified through a single CSS check. Instead, we generate
   * a documentation comment that makes the design intent explicit in the
   * test file. Developers can visually verify this during test review.
   *
   * Weight is 0.3 (lowest) because this is informational, not executable.
   */
  private prominenceRankAssertion(
    component: ComponentBlueprint,
    rank: number
  ): ConstraintAssertion {
    return {
      description: `${component.name} should have visual prominence rank ${rank} among siblings`,
      dimension: this.dimension,
      property: 'prominenceRank',
      expected: String(rank),
      weight: 0.3,
      codegen(locatorVar: string): string {
        return [
          `  // Visual hierarchy: ${locatorVar} should have prominence rank ${rank} among siblings`,
          `  // (1 = most prominent). Verify visually that this element's size, weight,`,
          `  // and contrast position it at rank ${rank} in the visual hierarchy.`,
          `  // This is a design-intent comment — no automated assertion possible.`,
        ].join('\n')
      },
    }
  }

  /**
   * Assert that the element's text-to-background contrast ratio matches expectations.
   *
   * Generated code uses getComputedStyle to read both the element's color
   * and its effective background-color, then computes the WCAG relative
   * luminance contrast ratio inline.
   *
   * The tolerance of 0.5 accounts for:
   *   - Anti-aliasing affecting perceived contrast
   *   - Background color inheritance traversal stopping at first opaque ancestor
   *   - Minor color differences from system color schemes
   */
  private contrastRatioAssertion(
    component: ComponentBlueprint,
    expectedRatio: number
  ): ConstraintAssertion {
    const tolerance = 0.5
    return {
      description: `${component.name} contrast ratio should be ~${expectedRatio}`,
      dimension: this.dimension,
      property: 'contrastRatio',
      expected: String(expectedRatio),
      weight: 0.4,
      codegen(locatorVar: string): string {
        return [
          `  // Compute and verify contrast ratio between text color and background`,
          `  {`,
          `    const { fg, bg } = await ${locatorVar}.evaluate(el => {`,
          `      const style = getComputedStyle(el);`,
          `      const fgColor = style.color;`,
          `      // Walk up ancestors to find the first opaque background`,
          `      let bgColor = style.backgroundColor;`,
          `      let current: Element | null = el;`,
          `      while (current && (bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent')) {`,
          `        current = current.parentElement;`,
          `        if (current) bgColor = getComputedStyle(current).backgroundColor;`,
          `      }`,
          `      if (!current) bgColor = 'rgb(255, 255, 255)'; // fallback to white`,
          `      return { fg: fgColor, bg: bgColor };`,
          `    });`,
          `    // Parse rgb values and compute WCAG contrast ratio`,
          `    const parseRgb = (s: string) => {`,
          `      const m = s.match(/\\d+/g)!.map(Number);`,
          `      return { r: m[0], g: m[1], b: m[2] };`,
          `    };`,
          `    const luminance = (c: { r: number; g: number; b: number }) => {`,
          `      const [rs, gs, bs] = [c.r, c.g, c.b].map(v => {`,
          `        const s = v / 255;`,
          `        return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);`,
          `      });`,
          `      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;`,
          `    };`,
          `    const fgLum = luminance(parseRgb(fg));`,
          `    const bgLum = luminance(parseRgb(bg));`,
          `    const ratio = (Math.max(fgLum, bgLum) + 0.05) / (Math.min(fgLum, bgLum) + 0.05);`,
          `    expect(ratio).toBeGreaterThanOrEqual(${expectedRatio - tolerance});`,
          `    expect(ratio).toBeLessThanOrEqual(${expectedRatio + tolerance});`,
          `  }`,
        ].join('\n')
      },
    }
  }
}
