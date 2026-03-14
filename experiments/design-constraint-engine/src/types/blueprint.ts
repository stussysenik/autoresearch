/**
 * Design Blueprint Type System
 *
 * The Blueprint is the machine-readable representation of a visual design.
 * It captures *what constraints make the design look right* across 16 dimensions.
 *
 * Think of it as a "design contract" — if a built UI satisfies all constraints
 * in the blueprint, it must look like the original design.
 *
 * Architecture:
 *   Screenshot -> AI Vision -> DesignBlueprint (this file)
 *   DesignBlueprint -> ConstraintModules -> PlaywrightAssertions -> .spec.ts
 */

import { z } from 'zod'

// ─── Dimension Names ─────────────────────────────────────────────────────────
// The 16 testable dimensions of visual design, organized by visual impact tier.

export const DIMENSION_NAMES = [
  // Tier 1: Structural (highest visual impact)
  'layout', 'spacing', 'sizing', 'typography',
  // Tier 2: Surface (medium visual impact)
  'color', 'borders', 'shape', 'shadows',
  // Tier 3: Relational (refinement)
  'alignment', 'hierarchy', 'composition', 'density',
  'state', 'responsive', 'accessibility', 'micro-interactions',
] as const

export type DimensionName = typeof DIMENSION_NAMES[number]

export const TIERS: Record<number, DimensionName[]> = {
  1: ['layout', 'spacing', 'sizing', 'typography'],
  2: ['color', 'borders', 'shape', 'shadows'],
  3: ['alignment', 'hierarchy', 'composition', 'density', 'state', 'responsive', 'accessibility', 'micro-interactions'],
}

// ─── Dimension Data Interfaces ───────────────────────────────────────────────
// Each dimension has its own typed data shape extracted by the AI vision model.

export interface LayoutData {
  display: string                        // flex, grid, block, inline-flex, etc.
  flexDirection?: string                 // row, column, row-reverse
  flexWrap?: string                      // wrap, nowrap
  gridTemplateColumns?: string           // e.g., '1fr 1fr 1fr'
  gridTemplateRows?: string
  position?: string                      // relative, absolute, fixed, sticky
  zIndex?: number
  overflow?: string                      // hidden, scroll, auto, visible
}

export interface SpacingData {
  padding?: string                       // e.g., '24px', '16px 24px'
  paddingTop?: string
  paddingRight?: string
  paddingBottom?: string
  paddingLeft?: string
  margin?: string
  marginTop?: string
  marginRight?: string
  marginBottom?: string
  marginLeft?: string
  gap?: string                           // flex/grid gap
  rowGap?: string
  columnGap?: string
}

export interface SizingData {
  width?: string                         // e.g., '100%', '320px'
  height?: string
  minWidth?: string
  maxWidth?: string
  minHeight?: string
  maxHeight?: string
  aspectRatio?: string                   // e.g., '16/9'
}

export interface TypographyData {
  fontFamily?: string                    // e.g., 'Inter, sans-serif'
  fontSize?: string                      // e.g., '16px'
  fontWeight?: string                    // e.g., '600', 'bold'
  lineHeight?: string                    // e.g., '1.5', '24px'
  letterSpacing?: string                 // e.g., '-0.02em'
  textAlign?: string                     // left, center, right
  textTransform?: string                 // uppercase, capitalize
  textDecoration?: string                // underline, none
}

export interface ColorData {
  color?: string                         // text color, e.g., 'rgb(17, 24, 39)'
  backgroundColor?: string              // e.g., 'rgb(255, 255, 255)'
  opacity?: string                       // e.g., '0.8'
  backgroundImage?: string              // for gradients
}

export interface BordersData {
  border?: string                        // shorthand: '1px solid rgb(209, 213, 219)'
  borderTop?: string
  borderRight?: string
  borderBottom?: string
  borderLeft?: string
  borderWidth?: string
  borderStyle?: string
  borderColor?: string
}

export interface ShapeData {
  borderRadius?: string                  // e.g., '8px', '50%'
  borderTopLeftRadius?: string
  borderTopRightRadius?: string
  borderBottomRightRadius?: string
  borderBottomLeftRadius?: string
  clipPath?: string                      // e.g., 'circle(50%)'
}

export interface ShadowsData {
  boxShadow?: string                     // e.g., '0 4px 6px rgba(0,0,0,0.1)'
  textShadow?: string
  /** Numeric elevation level for comparison (0 = flat, 5 = highest) */
  elevationLevel?: number
}

export interface AlignmentData {
  justifyContent?: string                // flex-start, center, space-between
  alignItems?: string                    // center, stretch, baseline
  alignSelf?: string
  justifySelf?: string
  textAlign?: string
  verticalAlign?: string
  /** Whether the element appears visually centered in its parent */
  isCenteredHorizontally?: boolean
  isCenteredVertically?: boolean
}

export interface HierarchyData {
  /** Ratio of this element's font-size to its sibling/parent */
  fontSizeRatio?: number
  /** Ratio of this element's font-weight to its sibling/parent */
  fontWeightRatio?: number
  /** Visual prominence rank among siblings (1 = most prominent) */
  prominenceRank?: number
  /** Contrast ratio against background for visual weight */
  contrastRatio?: number
}

export interface CompositionData {
  /** Whether this element is fully contained within its parent bounds */
  isContainedWithinParent?: boolean
  /** Element names this must not overlap with */
  noOverlapWith?: string[]
  /** Visual reading order index (left-to-right, top-to-bottom) */
  readingOrder?: number
  /** DOM ordering matches visual ordering */
  domMatchesVisualOrder?: boolean
}

export interface DensityData {
  /** Ratio of whitespace to content area (0-1) */
  whitespaceRatio?: number
  /** Number of items per row */
  itemsPerRow?: number
  /** Average gap between items in px */
  averageGap?: number
}

export interface StateData {
  /** CSS changes on hover */
  hover?: Record<string, string>
  /** CSS changes on focus */
  focus?: Record<string, string>
  /** CSS changes when active */
  active?: Record<string, string>
  /** CSS changes when disabled */
  disabled?: Record<string, string>
}

export interface ResponsiveData {
  /** Breakpoint-specific overrides */
  breakpoints?: {
    width: number
    changes: Record<string, string>
  }[]
}

export interface AccessibilityData {
  /** WCAG contrast ratio (should be >= 4.5 for normal text, >= 3 for large) */
  contrastRatio?: number
  /** Whether a visible focus ring is present */
  hasFocusRing?: boolean
  /** Minimum touch/click target size in px */
  minTargetSize?: number
  /** ARIA role if applicable */
  ariaRole?: string
}

export interface MicroInteractionsData {
  transition?: string                    // e.g., 'all 0.2s ease-in-out'
  transitionProperty?: string
  transitionDuration?: string
  transitionTimingFunction?: string
  animation?: string
  cursor?: string                        // pointer, default, not-allowed
}

/** Map from dimension name to its data type */
export interface DimensionDataMap {
  layout: LayoutData
  spacing: SpacingData
  sizing: SizingData
  typography: TypographyData
  color: ColorData
  borders: BordersData
  shape: ShapeData
  shadows: ShadowsData
  alignment: AlignmentData
  hierarchy: HierarchyData
  composition: CompositionData
  density: DensityData
  state: StateData
  responsive: ResponsiveData
  accessibility: AccessibilityData
  'micro-interactions': MicroInteractionsData
}

// ─── Relationships ───────────────────────────────────────────────────────────

export interface RelationshipConstraint {
  type: 'containedWithin' | 'spacedFrom' | 'noOverlap' | 'alignedWith' | 'sameSize'
  targetSelector: string
  /** For spacedFrom: expected gap in px */
  value?: number
  /** Tolerance in px */
  tolerance?: number
}

// ─── Design Tokens ───────────────────────────────────────────────────────────
// Global design tokens extracted from the overall design.

export interface DesignTokens {
  colors: {
    primary?: string
    secondary?: string
    background?: string
    surface?: string
    text?: string
    textSecondary?: string
    border?: string
    error?: string
    success?: string
    [key: string]: string | undefined
  }
  typography: {
    fontFamily?: string
    /** Map of scale names to sizes, e.g., { h1: '32px', body: '16px' } */
    scale?: Record<string, string>
  }
  spacing: {
    /** Base spacing unit in px, e.g., 8 */
    unit?: number
  }
  radii?: Record<string, string>
  shadows?: Record<string, string>
}

// ─── Component Blueprint ─────────────────────────────────────────────────────
// A single UI element with its dimensional constraints.

export interface ComponentBlueprint {
  name: string
  selector: string
  semanticRole: string
  textContent?: string
  dimensions: {
    [K in DimensionName]?: DimensionDataMap[K]
  }
  children?: ComponentBlueprint[]
  relationships?: RelationshipConstraint[]
}

// ─── Design Blueprint (top-level) ────────────────────────────────────────────

export interface DesignBlueprint {
  id: string
  name: string
  schemaVersion: '1.0.0'
  source: {
    imagePath: string
    viewport: { width: number; height: number }
    analyzerModel: string
  }
  tokens: DesignTokens
  components: ComponentBlueprint[]
  /** 0-1 score of how constrained this blueprint is (more dimensions = higher) */
  specificityScore: number
}

// ─── Zod Validation Schemas ──────────────────────────────────────────────────
// Runtime validation for Blueprint JSON coming from AI vision models.
// These catch malformed outputs before they reach the constraint engine.

const LayoutDataSchema = z.object({
  display: z.string(),
  flexDirection: z.string().optional(),
  flexWrap: z.string().optional(),
  gridTemplateColumns: z.string().optional(),
  gridTemplateRows: z.string().optional(),
  position: z.string().optional(),
  zIndex: z.number().optional(),
  overflow: z.string().optional(),
}).passthrough()

const SpacingDataSchema = z.object({
  padding: z.string().optional(),
  paddingTop: z.string().optional(),
  paddingRight: z.string().optional(),
  paddingBottom: z.string().optional(),
  paddingLeft: z.string().optional(),
  margin: z.string().optional(),
  marginTop: z.string().optional(),
  marginRight: z.string().optional(),
  marginBottom: z.string().optional(),
  marginLeft: z.string().optional(),
  gap: z.string().optional(),
  rowGap: z.string().optional(),
  columnGap: z.string().optional(),
}).passthrough()

const SizingDataSchema = z.object({
  width: z.string().optional(),
  height: z.string().optional(),
  minWidth: z.string().optional(),
  maxWidth: z.string().optional(),
  minHeight: z.string().optional(),
  maxHeight: z.string().optional(),
  aspectRatio: z.string().optional(),
}).passthrough()

const TypographyDataSchema = z.object({
  fontFamily: z.string().optional(),
  fontSize: z.string().optional(),
  fontWeight: z.string().optional(),
  lineHeight: z.string().optional(),
  letterSpacing: z.string().optional(),
  textAlign: z.string().optional(),
  textTransform: z.string().optional(),
  textDecoration: z.string().optional(),
}).passthrough()

const ColorDataSchema = z.object({
  color: z.string().optional(),
  backgroundColor: z.string().optional(),
  opacity: z.string().optional(),
  backgroundImage: z.string().optional(),
}).passthrough()

const BordersDataSchema = z.object({
  border: z.string().optional(),
  borderTop: z.string().optional(),
  borderRight: z.string().optional(),
  borderBottom: z.string().optional(),
  borderLeft: z.string().optional(),
  borderWidth: z.string().optional(),
  borderStyle: z.string().optional(),
  borderColor: z.string().optional(),
}).passthrough()

const ShapeDataSchema = z.object({
  borderRadius: z.string().optional(),
  borderTopLeftRadius: z.string().optional(),
  borderTopRightRadius: z.string().optional(),
  borderBottomRightRadius: z.string().optional(),
  borderBottomLeftRadius: z.string().optional(),
  clipPath: z.string().optional(),
}).passthrough()

const ShadowsDataSchema = z.object({
  boxShadow: z.string().optional(),
  textShadow: z.string().optional(),
  elevationLevel: z.number().min(0).max(5).optional(),
}).passthrough()

const AlignmentDataSchema = z.object({
  justifyContent: z.string().optional(),
  alignItems: z.string().optional(),
  alignSelf: z.string().optional(),
  justifySelf: z.string().optional(),
  textAlign: z.string().optional(),
  verticalAlign: z.string().optional(),
  isCenteredHorizontally: z.boolean().optional(),
  isCenteredVertically: z.boolean().optional(),
}).passthrough()

const HierarchyDataSchema = z.object({
  fontSizeRatio: z.number().optional(),
  fontWeightRatio: z.number().optional(),
  prominenceRank: z.number().optional(),
  contrastRatio: z.number().optional(),
}).passthrough()

const CompositionDataSchema = z.object({
  isContainedWithinParent: z.boolean().optional(),
  noOverlapWith: z.array(z.string()).optional(),
  readingOrder: z.number().optional(),
  domMatchesVisualOrder: z.boolean().optional(),
}).passthrough()

const DensityDataSchema = z.object({
  whitespaceRatio: z.number().min(0).max(1).optional(),
  itemsPerRow: z.number().optional(),
  averageGap: z.number().optional(),
}).passthrough()

const StateDataSchema = z.object({
  hover: z.record(z.string()).optional(),
  focus: z.record(z.string()).optional(),
  active: z.record(z.string()).optional(),
  disabled: z.record(z.string()).optional(),
}).passthrough()

const ResponsiveDataSchema = z.object({
  breakpoints: z.array(z.object({
    width: z.number(),
    changes: z.record(z.string()),
  })).optional(),
}).passthrough()

const AccessibilityDataSchema = z.object({
  contrastRatio: z.number().optional(),
  hasFocusRing: z.boolean().optional(),
  minTargetSize: z.number().optional(),
  ariaRole: z.string().optional(),
}).passthrough()

const MicroInteractionsDataSchema = z.object({
  transition: z.string().optional(),
  transitionProperty: z.string().optional(),
  transitionDuration: z.string().optional(),
  transitionTimingFunction: z.string().optional(),
  animation: z.string().optional(),
  cursor: z.string().optional(),
}).passthrough()

const DimensionsSchema = z.object({
  layout: LayoutDataSchema.optional(),
  spacing: SpacingDataSchema.optional(),
  sizing: SizingDataSchema.optional(),
  typography: TypographyDataSchema.optional(),
  color: ColorDataSchema.optional(),
  borders: BordersDataSchema.optional(),
  shape: ShapeDataSchema.optional(),
  shadows: ShadowsDataSchema.optional(),
  alignment: AlignmentDataSchema.optional(),
  hierarchy: HierarchyDataSchema.optional(),
  composition: CompositionDataSchema.optional(),
  density: DensityDataSchema.optional(),
  state: StateDataSchema.optional(),
  responsive: ResponsiveDataSchema.optional(),
  accessibility: AccessibilityDataSchema.optional(),
  'micro-interactions': MicroInteractionsDataSchema.optional(),
})

const RelationshipConstraintSchema = z.object({
  type: z.enum(['containedWithin', 'spacedFrom', 'noOverlap', 'alignedWith', 'sameSize']),
  targetSelector: z.string(),
  value: z.number().optional(),
  tolerance: z.number().optional(),
})

const ComponentBlueprintSchema: z.ZodType<ComponentBlueprint> = z.lazy(() =>
  z.object({
    name: z.string(),
    selector: z.string(),
    semanticRole: z.string(),
    textContent: z.string().optional(),
    dimensions: DimensionsSchema,
    children: z.array(ComponentBlueprintSchema).optional(),
    relationships: z.array(RelationshipConstraintSchema).optional(),
  })
)

const DesignTokensSchema = z.object({
  colors: z.record(z.string().optional()).default({}),
  typography: z.object({
    fontFamily: z.string().optional(),
    scale: z.record(z.string()).optional(),
  }).default({}),
  spacing: z.object({
    unit: z.number().optional(),
  }).default({}),
  radii: z.record(z.string()).optional(),
  shadows: z.record(z.string()).optional(),
})

export const DesignBlueprintSchema = z.object({
  id: z.string(),
  name: z.string(),
  schemaVersion: z.literal('1.0.0'),
  source: z.object({
    imagePath: z.string(),
    viewport: z.object({
      width: z.number(),
      height: z.number(),
    }),
    analyzerModel: z.string(),
  }),
  tokens: DesignTokensSchema,
  components: z.array(ComponentBlueprintSchema),
  specificityScore: z.number().min(0).max(1),
})

/** Validate a raw JSON object as a DesignBlueprint */
export function validateBlueprint(data: unknown): DesignBlueprint {
  return DesignBlueprintSchema.parse(data)
}

/** Safely validate, returning errors instead of throwing */
export function safeParse(data: unknown) {
  return DesignBlueprintSchema.safeParse(data)
}
