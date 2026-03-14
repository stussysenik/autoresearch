import { ConstraintModule, ConstraintAssertion } from './base.js'
import type { ComponentBlueprint, SpacingData } from '../types/blueprint.js'

export class SpacingConstraint extends ConstraintModule {
  readonly dimension = 'spacing' as const

  generate(component: ComponentBlueprint): ConstraintAssertion[] {
    if (!this.hasData(component)) return []
    const data = this.getData(component) as SpacingData
    const assertions: ConstraintAssertion[] = []
    const spacingTolerance = { px: 2 }

    // Padding
    if (data.padding) assertions.push(this.cssAssertion(component, 'padding', data.padding, { weight: 0.8, tolerance: spacingTolerance }))
    if (data.paddingTop) assertions.push(this.cssAssertion(component, 'padding-top', data.paddingTop, { weight: 0.7, tolerance: spacingTolerance }))
    if (data.paddingRight) assertions.push(this.cssAssertion(component, 'padding-right', data.paddingRight, { weight: 0.7, tolerance: spacingTolerance }))
    if (data.paddingBottom) assertions.push(this.cssAssertion(component, 'padding-bottom', data.paddingBottom, { weight: 0.7, tolerance: spacingTolerance }))
    if (data.paddingLeft) assertions.push(this.cssAssertion(component, 'padding-left', data.paddingLeft, { weight: 0.7, tolerance: spacingTolerance }))
    // Margin
    if (data.margin) assertions.push(this.cssAssertion(component, 'margin', data.margin, { weight: 0.7, tolerance: spacingTolerance }))
    if (data.marginTop) assertions.push(this.cssAssertion(component, 'margin-top', data.marginTop, { weight: 0.6, tolerance: spacingTolerance }))
    if (data.marginRight) assertions.push(this.cssAssertion(component, 'margin-right', data.marginRight, { weight: 0.6, tolerance: spacingTolerance }))
    if (data.marginBottom) assertions.push(this.cssAssertion(component, 'margin-bottom', data.marginBottom, { weight: 0.6, tolerance: spacingTolerance }))
    if (data.marginLeft) assertions.push(this.cssAssertion(component, 'margin-left', data.marginLeft, { weight: 0.6, tolerance: spacingTolerance }))
    // Gap
    if (data.gap) assertions.push(this.cssAssertion(component, 'gap', data.gap, { weight: 0.7, tolerance: spacingTolerance }))
    if (data.rowGap) assertions.push(this.cssAssertion(component, 'row-gap', data.rowGap, { weight: 0.6, tolerance: spacingTolerance }))
    if (data.columnGap) assertions.push(this.cssAssertion(component, 'column-gap', data.columnGap, { weight: 0.6, tolerance: spacingTolerance }))

    return assertions
  }
}
