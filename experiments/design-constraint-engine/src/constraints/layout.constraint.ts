import { ConstraintModule, ConstraintAssertion } from './base.js'
import type { ComponentBlueprint, LayoutData } from '../types/blueprint.js'

export class LayoutConstraint extends ConstraintModule {
  readonly dimension = 'layout' as const

  generate(component: ComponentBlueprint): ConstraintAssertion[] {
    if (!this.hasData(component)) return []
    const data = this.getData(component) as LayoutData
    const assertions: ConstraintAssertion[] = []

    // Test display property (flex, grid, block, etc.) - highest weight as it defines structure
    if (data.display) {
      assertions.push(this.cssAssertion(component, 'display', data.display, { weight: 0.9 }))
    }
    if (data.flexDirection) {
      assertions.push(this.cssAssertion(component, 'flex-direction', data.flexDirection, { weight: 0.8 }))
    }
    if (data.flexWrap) {
      assertions.push(this.cssAssertion(component, 'flex-wrap', data.flexWrap, { weight: 0.5 }))
    }
    if (data.gridTemplateColumns) {
      assertions.push(this.cssAssertion(component, 'grid-template-columns', data.gridTemplateColumns, { weight: 0.7 }))
    }
    if (data.gridTemplateRows) {
      assertions.push(this.cssAssertion(component, 'grid-template-rows', data.gridTemplateRows, { weight: 0.6 }))
    }
    if (data.position) {
      assertions.push(this.cssAssertion(component, 'position', data.position, { weight: 0.7 }))
    }
    if (data.zIndex !== undefined) {
      assertions.push(this.cssAssertion(component, 'z-index', String(data.zIndex), { weight: 0.4 }))
    }
    if (data.overflow) {
      assertions.push(this.cssAssertion(component, 'overflow', data.overflow, { weight: 0.5 }))
    }
    return assertions
  }
}
