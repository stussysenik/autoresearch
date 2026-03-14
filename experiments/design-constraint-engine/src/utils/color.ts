/**
 * Color Utilities
 *
 * Parsing, conversion, and contrast computation for CSS color values.
 * Used by the color and accessibility constraint modules to validate
 * that designs meet WCAG contrast requirements and color accuracy.
 *
 * Key concept: WCAG 2.1 defines contrast ratio as (L1 + 0.05) / (L2 + 0.05)
 * where L1/L2 are relative luminances. Normal text needs >= 4.5:1, large text >= 3:1.
 */

export interface RGB {
  r: number  // 0-255
  g: number  // 0-255
  b: number  // 0-255
}

export interface RGBA extends RGB {
  a: number  // 0-1
}

/**
 * Parse a CSS color string into RGB components.
 * Handles: rgb(r, g, b), rgba(r, g, b, a), #hex, named colors (common subset).
 */
export function parseColor(color: string): RGBA {
  const trimmed = color.trim().toLowerCase()

  // rgb(r, g, b) or rgba(r, g, b, a)
  const rgbaMatch = trimmed.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/)
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1], 10),
      g: parseInt(rgbaMatch[2], 10),
      b: parseInt(rgbaMatch[3], 10),
      a: rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1,
    }
  }

  // #hex (3, 4, 6, or 8 digits)
  const hexMatch = trimmed.match(/^#([0-9a-f]{3,8})$/)
  if (hexMatch) {
    const hex = hexMatch[1]
    if (hex.length === 3) {
      return { r: parseInt(hex[0] + hex[0], 16), g: parseInt(hex[1] + hex[1], 16), b: parseInt(hex[2] + hex[2], 16), a: 1 }
    }
    if (hex.length === 4) {
      return { r: parseInt(hex[0] + hex[0], 16), g: parseInt(hex[1] + hex[1], 16), b: parseInt(hex[2] + hex[2], 16), a: parseInt(hex[3] + hex[3], 16) / 255 }
    }
    if (hex.length === 6) {
      return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16), a: 1 }
    }
    if (hex.length === 8) {
      return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16), a: parseInt(hex.slice(6, 8), 16) / 255 }
    }
  }

  // Common named colors
  const named: Record<string, RGB> = {
    white: { r: 255, g: 255, b: 255 },
    black: { r: 0, g: 0, b: 0 },
    red: { r: 255, g: 0, b: 0 },
    green: { r: 0, g: 128, b: 0 },
    blue: { r: 0, g: 0, b: 255 },
    transparent: { r: 0, g: 0, b: 0 },
  }
  if (named[trimmed]) {
    return { ...named[trimmed], a: trimmed === 'transparent' ? 0 : 1 }
  }

  // Fallback: black
  return { r: 0, g: 0, b: 0, a: 1 }
}

/**
 * Convert sRGB channel (0-255) to linear luminance component.
 * Applies the sRGB transfer function (gamma correction).
 */
function sRGBtoLinear(channel: number): number {
  const c = channel / 255
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/**
 * Calculate relative luminance per WCAG 2.1.
 * L = 0.2126 * R + 0.7152 * G + 0.0722 * B (with linearized channels)
 */
export function relativeLuminance(color: RGB): number {
  return 0.2126 * sRGBtoLinear(color.r) + 0.7152 * sRGBtoLinear(color.g) + 0.0722 * sRGBtoLinear(color.b)
}

/**
 * Calculate WCAG 2.1 contrast ratio between two colors.
 * Returns a value from 1 (identical) to 21 (black on white).
 *
 * WCAG requirements:
 *   - Normal text (< 18px or < 14px bold): >= 4.5:1 (AA), >= 7:1 (AAA)
 *   - Large text (>= 18px or >= 14px bold): >= 3:1 (AA), >= 4.5:1 (AAA)
 */
export function contrastRatio(fg: RGB, bg: RGB): number {
  const l1 = relativeLuminance(fg)
  const l2 = relativeLuminance(bg)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

/** Convert RGB to CSS rgb() string */
export function toRGBString(color: RGB): string {
  return `rgb(${color.r}, ${color.g}, ${color.b})`
}

/** Convert RGBA to CSS rgba() string */
export function toRGBAString(color: RGBA): string {
  if (color.a === 1) return toRGBString(color)
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`
}

/** Check if two colors are perceptually similar within a tolerance */
export function colorsMatch(a: string, b: string, tolerance = 10): boolean {
  const ca = parseColor(a)
  const cb = parseColor(b)
  return (
    Math.abs(ca.r - cb.r) <= tolerance &&
    Math.abs(ca.g - cb.g) <= tolerance &&
    Math.abs(ca.b - cb.b) <= tolerance &&
    Math.abs(ca.a - cb.a) <= 0.1
  )
}
