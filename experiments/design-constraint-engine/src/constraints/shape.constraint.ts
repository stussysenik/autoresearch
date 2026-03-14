import { ConstraintModule, ConstraintAssertion } from './base.js'
import type { ComponentBlueprint, ShapeData } from '../types/blueprint.js'

export class ShapeConstraint extends ConstraintModule {
  readonly dimension = 'shape' as const

  generate(component: ComponentBlueprint): ConstraintAssertion[] {
    if (!this.hasData(component)) return []
    const data = this.getData(component) as ShapeData
    const assertions: ConstraintAssertion[] = []

    if (data.borderRadius) assertions.push(this.cssAssertion(component, 'border-radius', data.borderRadius, { weight: 0.6, tolerance: { px: 2 } }))
    if (data.borderTopLeftRadius) assertions.push(this.cssAssertion(component, 'border-top-left-radius', data.borderTopLeftRadius, { weight: 0.5, tolerance: { px: 2 } }))
    if (data.borderTopRightRadius) assertions.push(this.cssAssertion(component, 'border-top-right-radius', data.borderTopRightRadius, { weight: 0.5, tolerance: { px: 2 } }))
    if (data.borderBottomRightRadius) assertions.push(this.cssAssertion(component, 'border-bottom-right-radius', data.borderBottomRightRadius, { weight: 0.5, tolerance: { px: 2 } }))
    if (data.borderBottomLeftRadius) assertions.push(this.cssAssertion(component, 'border-bottom-left-radius', data.borderBottomLeftRadius, { weight: 0.5, tolerance: { px: 2 } }))
    if (data.clipPath) assertions.push(this.cssAssertion(component, 'clip-path', data.clipPath, { weight: 0.5 }))

    return assertions
  }
}
