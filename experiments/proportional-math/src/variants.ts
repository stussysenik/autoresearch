/**
 * 6 ratio variants to benchmark.
 * Each derives from music theory or mathematics.
 */

export interface RatioVariant {
  name: string
  description: string
  ratio: number
  origin: string
}

export const variants: RatioVariant[] = [
  {
    name: 'phi',
    ratio: 1.618033988749895,
    origin: 'Golden ratio',
    description: 'The golden ratio (1+√5)/2 — found in nature, art, architecture',
  },
  {
    name: 'sqrt2',
    ratio: 1.4142135623730951,
    origin: 'Square root of 2',
    description: 'ISO paper sizes (A4/A3), octave doubling per 2 steps',
  },
  {
    name: 'minor_third',
    ratio: 1.2,
    origin: 'Musical minor third (6:5)',
    description: 'Compact scale, many usable steps in practical range',
  },
  {
    name: 'major_third',
    ratio: 1.25,
    origin: 'Musical major third (5:4)',
    description: 'Popular type scale ratio, balanced density',
  },
  {
    name: 'perfect_fourth',
    ratio: 1.3333333333333333,
    origin: 'Musical perfect fourth (4:3)',
    description: 'Classic type scale, moderate jumps between steps',
  },
  {
    name: 'perfect_fifth',
    ratio: 1.5,
    origin: 'Musical perfect fifth (3:2)',
    description: 'Bold scale, dramatic size differences',
  },
]
