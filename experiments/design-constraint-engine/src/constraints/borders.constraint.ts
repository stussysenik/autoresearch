import { ConstraintModule, ConstraintAssertion } from './base.js'
import type { ComponentBlueprint, BordersData } from '../types/blueprint.js'

export class BordersConstraint extends ConstraintModule {
  readonly dimension = 'borders' as const

  generate(component: ComponentBlueprint): ConstraintAssertion[] {
    if (!this.hasData(component)) return []
    const data = this.getData(component) as BordersData
    const assertions: ConstraintAssertion[] = []

    if (data.border) assertions.push(this.cssAssertion(component, 'border', data.border, { weight: 0.6 }))
    if (data.borderTop) assertions.push(this.cssAssertion(component, 'border-top', data.borderTop, { weight: 0.5 }))
    if (data.borderRight) assertions.push(this.cssAssertion(component, 'border-right', data.borderRight, { weight: 0.5 }))
    if (data.borderBottom) assertions.push(this.cssAssertion(component, 'border-bottom', data.borderBottom, { weight: 0.5 }))
    if (data.borderLeft) assertions.push(this.cssAssertion(component, 'border-left', data.borderLeft, { weight: 0.5 }))
    if (data.borderWidth) assertions.push(this.cssAssertion(component, 'border-width', data.borderWidth, { weight: 0.5, tolerance: { px: 1 } }))
    if (data.borderStyle) assertions.push(this.cssAssertion(component, 'border-style', data.borderStyle, { weight: 0.5 }))
    if (data.borderColor) assertions.push(this.cssAssertion(component, 'border-color', data.borderColor, { weight: 0.5 }))

    return assertions
  }
}
