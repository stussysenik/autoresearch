import { ConstraintModule, ConstraintAssertion } from './base.js'
import type { ComponentBlueprint, ColorData } from '../types/blueprint.js'

export class ColorConstraint extends ConstraintModule {
  readonly dimension = 'color' as const

  generate(component: ComponentBlueprint): ConstraintAssertion[] {
    if (!this.hasData(component)) return []
    const data = this.getData(component) as ColorData
    const assertions: ConstraintAssertion[] = []

    if (data.color) assertions.push(this.cssAssertion(component, 'color', data.color, { weight: 0.8 }))
    if (data.backgroundColor) assertions.push(this.cssAssertion(component, 'background-color', data.backgroundColor, { weight: 0.7 }))
    if (data.opacity) assertions.push(this.cssAssertion(component, 'opacity', data.opacity, { weight: 0.5 }))
    if (data.backgroundImage) assertions.push(this.cssAssertion(component, 'background-image', data.backgroundImage, { weight: 0.4 }))

    return assertions
  }
}
