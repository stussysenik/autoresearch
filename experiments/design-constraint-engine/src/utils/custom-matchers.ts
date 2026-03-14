/**
 * Custom Playwright Matchers
 *
 * Spatial relationship assertions that go beyond toHaveCSS().
 * These test design *relationships* — containment, centering, overlap,
 * and even spacing — which are critical for Tier 3 dimensions.
 *
 * These are generated as inline test code (not actual Playwright custom matchers)
 * since the generated .spec.ts files need to be self-contained.
 */

/**
 * Generate code that asserts element A is fully contained within element B.
 * Tests: A.x >= B.x && A.y >= B.y && A.right <= B.right && A.bottom <= B.bottom
 */
export function toBeContainedWithinCode(childVar: string, parentVar: string, tolerancePx = 1): string {
  return [
    `  // Assert ${childVar} is contained within ${parentVar}`,
    `  {`,
    `    const childBox = await ${childVar}.boundingBox();`,
    `    const parentBox = await ${parentVar}.boundingBox();`,
    `    expect(childBox).toBeTruthy();`,
    `    expect(parentBox).toBeTruthy();`,
    `    expect(childBox!.x).toBeGreaterThanOrEqual(parentBox!.x - ${tolerancePx});`,
    `    expect(childBox!.y).toBeGreaterThanOrEqual(parentBox!.y - ${tolerancePx});`,
    `    expect(childBox!.x + childBox!.width).toBeLessThanOrEqual(parentBox!.x + parentBox!.width + ${tolerancePx});`,
    `    expect(childBox!.y + childBox!.height).toBeLessThanOrEqual(parentBox!.y + parentBox!.height + ${tolerancePx});`,
    `  }`,
  ].join('\n')
}

/**
 * Generate code that asserts element A is horizontally centered within element B.
 * Tests: |A.centerX - B.centerX| <= tolerance
 */
export function toBeCenteredInCode(childVar: string, parentVar: string, tolerancePx = 3): string {
  return [
    `  // Assert ${childVar} is centered in ${parentVar}`,
    `  {`,
    `    const childBox = await ${childVar}.boundingBox();`,
    `    const parentBox = await ${parentVar}.boundingBox();`,
    `    expect(childBox).toBeTruthy();`,
    `    expect(parentBox).toBeTruthy();`,
    `    const childCenter = childBox!.x + childBox!.width / 2;`,
    `    const parentCenter = parentBox!.x + parentBox!.width / 2;`,
    `    expect(Math.abs(childCenter - parentCenter)).toBeLessThanOrEqual(${tolerancePx});`,
    `  }`,
  ].join('\n')
}

/**
 * Generate code that asserts two elements do NOT overlap.
 * Tests: no intersection between bounding boxes.
 */
export function toNotOverlapWithCode(varA: string, varB: string): string {
  return [
    `  // Assert ${varA} does not overlap with ${varB}`,
    `  {`,
    `    const boxA = await ${varA}.boundingBox();`,
    `    const boxB = await ${varB}.boundingBox();`,
    `    expect(boxA).toBeTruthy();`,
    `    expect(boxB).toBeTruthy();`,
    `    const noOverlap = (`,
    `      boxA!.x + boxA!.width <= boxB!.x ||`,
    `      boxB!.x + boxB!.width <= boxA!.x ||`,
    `      boxA!.y + boxA!.height <= boxB!.y ||`,
    `      boxB!.y + boxB!.height <= boxA!.y`,
    `    );`,
    `    expect(noOverlap).toBe(true);`,
    `  }`,
  ].join('\n')
}

/**
 * Generate code that asserts a list of elements have even spacing between them.
 * Tests: all gaps between consecutive elements are within tolerance of each other.
 */
export function toHaveEvenSpacingCode(locatorVars: string[], direction: 'horizontal' | 'vertical' = 'vertical', tolerancePx = 3): string {
  if (locatorVars.length < 3) return '  // Need at least 3 elements to test even spacing'

  const prop = direction === 'horizontal' ? 'x' : 'y'
  const size = direction === 'horizontal' ? 'width' : 'height'

  return [
    `  // Assert even spacing between ${locatorVars.join(', ')}`,
    `  {`,
    `    const boxes = await Promise.all([`,
    ...locatorVars.map(v => `      ${v}.boundingBox(),`),
    `    ]);`,
    `    const gaps: number[] = [];`,
    `    for (let i = 1; i < boxes.length; i++) {`,
    `      const prev = boxes[i - 1]!;`,
    `      const curr = boxes[i]!;`,
    `      gaps.push(curr.${prop} - (prev.${prop} + prev.${size}));`,
    `    }`,
    `    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;`,
    `    for (const gap of gaps) {`,
    `      expect(Math.abs(gap - avgGap)).toBeLessThanOrEqual(${tolerancePx});`,
    `    }`,
    `  }`,
  ].join('\n')
}
