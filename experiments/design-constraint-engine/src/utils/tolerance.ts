/**
 * Tolerance Utilities
 *
 * Fuzzy matching for CSS values. Design reproduction is never pixel-perfect,
 * so we need configurable tolerance ranges. A value within tolerance counts
 * as "passing" — this prevents false failures from sub-pixel rendering
 * differences, font metric variations, and anti-aliasing.
 *
 * Default tolerances are tuned to catch real design violations
 * while ignoring rendering noise.
 */

/** Default tolerance values per CSS property type */
export const DEFAULT_TOLERANCES = {
  // Spacing properties: +/- 2px (tight — spacing errors are very visible)
  padding: { px: 2 },
  margin: { px: 2 },
  gap: { px: 2 },

  // Sizing: +/- 5px (slightly more forgiving for widths/heights)
  width: { px: 5 },
  height: { px: 5 },

  // Typography: exact match for font-size, family, weight
  fontSize: { px: 1 },
  fontWeight: { px: 0 },
  lineHeight: { px: 2 },

  // Position: +/- 3px
  position: { px: 3 },

  // Border: +/- 1px
  borderWidth: { px: 1 },
  borderRadius: { px: 2 },

  // Opacity: +/- 0.05
  opacity: { percent: 5 },
} as const

/**
 * Parse a CSS px value to a number.
 * '16px' -> 16, '1.5rem' -> NaN (not supported)
 */
export function parsePx(value: string): number {
  const match = value.match(/^(-?[\d.]+)px$/)
  return match ? parseFloat(match[1]) : NaN
}

/**
 * Check if two px values are within tolerance.
 * Returns true if |a - b| <= tolerance.
 */
export function withinPxTolerance(actual: string, expected: string, tolerancePx: number): boolean {
  const a = parsePx(actual)
  const b = parsePx(expected)
  if (isNaN(a) || isNaN(b)) return actual === expected
  return Math.abs(a - b) <= tolerancePx
}

/**
 * Check if two numeric values are within percentage tolerance.
 * tolerance is a percentage (e.g., 5 means +/- 5%).
 */
export function withinPercentTolerance(actual: number, expected: number, tolerancePercent: number): boolean {
  if (expected === 0) return actual === 0
  const diff = Math.abs(actual - expected) / Math.abs(expected) * 100
  return diff <= tolerancePercent
}

/**
 * Get the tolerance for a given CSS property.
 * Falls back to { px: 3 } for unknown properties.
 */
export function getToleranceForProperty(property: string): { px?: number; percent?: number } {
  const key = property.replace(/-([a-z])/g, (_, c) => c.toUpperCase()) as keyof typeof DEFAULT_TOLERANCES
  return DEFAULT_TOLERANCES[key] ?? { px: 3 }
}

/**
 * Generate a Playwright tolerance check expression.
 * Used by assertion codegen to create fuzzy matching code.
 */
export function toleranceCheckCode(actualVar: string, expected: number, tolerancePx: number): string {
  return `expect(${actualVar}).toBeGreaterThanOrEqual(${expected - tolerancePx}); expect(${actualVar}).toBeLessThanOrEqual(${expected + tolerancePx});`
}
