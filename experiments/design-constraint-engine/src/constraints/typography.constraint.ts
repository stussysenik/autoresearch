import { ConstraintModule, ConstraintAssertion } from './base.js'
import type { ComponentBlueprint, TypographyData } from '../types/blueprint.js'

export class TypographyConstraint extends ConstraintModule {
  readonly dimension = 'typography' as const

  generate(component: ComponentBlueprint): ConstraintAssertion[] {
    if (!this.hasData(component)) return []
    const data = this.getData(component) as TypographyData
    const assertions: ConstraintAssertion[] = []

    if (data.fontSize) assertions.push(this.cssAssertion(component, 'font-size', data.fontSize, { weight: 0.9, tolerance: { px: 1 } }))
    if (data.fontWeight) assertions.push(this.cssAssertion(component, 'font-weight', data.fontWeight, { weight: 0.8 }))
    if (data.lineHeight) assertions.push(this.cssAssertion(component, 'line-height', data.lineHeight, { weight: 0.6, tolerance: { px: 2 } }))
    if (data.fontFamily) assertions.push(this.cssAssertion(component, 'font-family', data.fontFamily, { weight: 0.7 }))
    if (data.letterSpacing) assertions.push(this.cssAssertion(component, 'letter-spacing', data.letterSpacing, { weight: 0.4 }))
    if (data.textAlign) assertions.push(this.cssAssertion(component, 'text-align', data.textAlign, { weight: 0.6 }))
    if (data.textTransform) assertions.push(this.cssAssertion(component, 'text-transform', data.textTransform, { weight: 0.5 }))
    if (data.textDecoration) assertions.push(this.cssAssertion(component, 'text-decoration', data.textDecoration, { weight: 0.3 }))

    return assertions
  }
}
