import { ConstraintModule, ConstraintAssertion } from './base.js'
import type { ComponentBlueprint, ShadowsData } from '../types/blueprint.js'

export class ShadowsConstraint extends ConstraintModule {
  readonly dimension = 'shadows' as const

  generate(component: ComponentBlueprint): ConstraintAssertion[] {
    if (!this.hasData(component)) return []
    const data = this.getData(component) as ShadowsData
    const assertions: ConstraintAssertion[] = []

    if (data.boxShadow) {
      assertions.push(this.computedStyleAssertion(component, 'boxShadow', data.boxShadow, { weight: 0.6 }))
    }
    if (data.textShadow) {
      assertions.push(this.computedStyleAssertion(component, 'textShadow', data.textShadow, { weight: 0.4 }))
    }
    if (data.elevationLevel !== undefined) {
      // Elevation is a semantic check: box-shadow should exist if elevation > 0
      const desc = `${component.name} should ${data.elevationLevel > 0 ? 'have' : 'not have'} box-shadow (elevation ${data.elevationLevel})`
      const hasShadow = data.elevationLevel > 0
      assertions.push({
        description: desc,
        dimension: 'shadows',
        property: 'elevationLevel',
        expected: String(data.elevationLevel),
        weight: 0.5,
        codegen(locatorVar: string): string {
          return [
            `  {`,
            `    const shadow = await ${locatorVar}.evaluate(el => getComputedStyle(el).boxShadow);`,
            hasShadow
              ? `    expect(shadow).not.toBe('none');`
              : `    expect(shadow).toBe('none');`,
            `  }`,
          ].join('\n')
        },
      })
    }

    return assertions
  }
}
