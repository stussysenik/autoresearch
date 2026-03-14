import { ConstraintModule, ConstraintAssertion } from './base.js'
import type { ComponentBlueprint, SizingData } from '../types/blueprint.js'
import { parsePx } from '../utils/tolerance.js'

export class SizingConstraint extends ConstraintModule {
  readonly dimension = 'sizing' as const

  generate(component: ComponentBlueprint): ConstraintAssertion[] {
    if (!this.hasData(component)) return []
    const data = this.getData(component) as SizingData
    const assertions: ConstraintAssertion[] = []
    const sizeTolerance = { px: 5 }

    // For px values, use boundingBox; for %, auto, etc., use toHaveCSS
    for (const [prop, cssName] of [['width', 'width'], ['height', 'height']] as const) {
      const val = data[prop]
      if (!val) continue
      const px = parsePx(val)
      if (!isNaN(px)) {
        assertions.push(this.boundingBoxAssertion(component, prop, px, { weight: 0.8, tolerancePx: 5 }))
      } else {
        assertions.push(this.cssAssertion(component, cssName, val, { weight: 0.7, tolerance: sizeTolerance }))
      }
    }

    if (data.minWidth) assertions.push(this.cssAssertion(component, 'min-width', data.minWidth, { weight: 0.5 }))
    if (data.maxWidth) assertions.push(this.cssAssertion(component, 'max-width', data.maxWidth, { weight: 0.6 }))
    if (data.minHeight) assertions.push(this.cssAssertion(component, 'min-height', data.minHeight, { weight: 0.5 }))
    if (data.maxHeight) assertions.push(this.cssAssertion(component, 'max-height', data.maxHeight, { weight: 0.5 }))
    if (data.aspectRatio) assertions.push(this.cssAssertion(component, 'aspect-ratio', data.aspectRatio, { weight: 0.6 }))

    return assertions
  }
}
