import { describe, expect, it } from 'vitest'
import ASSET_MAP from '../../../public/models/characters/FIRETOY_ASSET_MAP.md?raw'
import {
  COLORWAY_COUNT,
  FIRETOY_PARTS,
  type Gender,
  anatomyOf,
  designCount,
  findPart,
  otherGlove,
  partAt,
  partsIn,
} from './characterParts'

/**
 * The catalogue is generated from a naming pattern, so what has to be checked
 * is that the pattern still describes the asset. These are the numbers from
 * the asset map's inventory (§4 and §13), which were themselves read off the
 * two GLB files.
 */
const EXPECTED = {
  male: {
    total: 166,
    families: {
      anatomy: 7,
      eyebrows: 33,
      beard: 24,
      glasses: 6,
      mask: 6,
      hair: 15,
      hat: 12,
      headphones: 3,
      fullbody: 3,
      torso: 15,
      pants: 15,
      shoes: 15,
      gloves: 12,
    },
  },
  female: {
    total: 144,
    families: {
      anatomy: 9,
      eyebrows: 33,
      beard: 0,
      glasses: 6,
      mask: 6,
      hair: 12,
      hat: 12,
      headphones: 3,
      fullbody: 3,
      torso: 15,
      pants: 15,
      shoes: 18,
      gloves: 12,
    },
  },
} as const

const GENDERS: readonly Gender[] = ['male', 'female']

describe('the catalogue counts what the GLBs contain', () => {
  it.each(GENDERS)('%s has the expected number of pieces', (gender) => {
    expect(FIRETOY_PARTS[gender]).toHaveLength(EXPECTED[gender].total)
  })

  it.each(GENDERS)('%s families add up', (gender) => {
    const counted = Object.fromEntries(
      Object.keys(EXPECTED[gender].families).map((category) => [
        category,
        partsIn(gender, category as keyof (typeof EXPECTED)['male']['families']).length,
      ]),
    )
    expect(counted).toEqual(EXPECTED[gender].families)
  })

  it('gives every piece a unique node name', () => {
    for (const gender of GENDERS) {
      const names = FIRETOY_PARTS[gender].map((p) => p.node)
      expect(new Set(names).size).toBe(names.length)
    }
  })

  it('keeps the two genders apart', () => {
    for (const part of FIRETOY_PARTS.male) expect(part.node.startsWith('Ib_MALE_01_')).toBe(true)
    for (const part of FIRETOY_PARTS.female) {
      expect(part.node.startsWith('Ib_FEMALE_01_')).toBe(true)
      // No male part answers to a female name or the wardrobes would leak.
      expect(findPart('male', part.node)).toBeUndefined()
    }
  })

  it('has no beards on the female body', () => {
    expect(partsIn('female', 'beard')).toHaveLength(0)
  })
})

describe('the shape of a part', () => {
  it('carries design, colorway and side', () => {
    const glove = findPart('male', 'Ib_MALE_01_Gloves_2_3_Left')
    expect(glove).toEqual({
      node: 'Ib_MALE_01_Gloves_2_3_Left',
      gender: 'male',
      category: 'gloves',
      design: 2,
      colorway: 3,
      side: 'left',
    })
  })

  it('leaves anatomy without indices', () => {
    expect(findPart('female', 'Ib_FEMALE_01_Female_Bra')).toMatchObject({
      category: 'anatomy',
      design: null,
      colorway: null,
      side: null,
    })
  })

  it('offers three colorways of every design', () => {
    expect(COLORWAY_COUNT).toBe(3)
    for (const gender of GENDERS) {
      for (const part of FIRETOY_PARTS[gender]) {
        if (part.category === 'anatomy') continue
        expect(part.colorway).toBeGreaterThanOrEqual(1)
        expect(part.colorway).toBeLessThanOrEqual(3)
        expect(part.design).toBeLessThanOrEqual(designCount(gender, part.category))
      }
    }
  })

  it('finds a piece by its coordinates', () => {
    expect(partAt('female', 'shoes', 6, 1)?.node).toBe('Ib_FEMALE_01_Shoes_6_1')
    // Gloves answer with their left half; the pair rule brings the right.
    expect(partAt('male', 'gloves', 1, 2)?.node).toBe('Ib_MALE_01_Gloves_1_2_Left')
    expect(partAt('female', 'shoes', 7, 1)).toBeUndefined()
  })
})

/**
 * The one name that cannot be generated. Firetoy shipped this eyebrow with a
 * full stop on the end and every export kept it, so tidying it up would point
 * the wardrobe at a node that is not there.
 */
describe('the eyebrow with a full stop', () => {
  it('exists under its literal name', () => {
    expect(findPart('male', 'Ib_MALE_01_Male_Eyebrows_10_1.')).toBeDefined()
    expect(findPart('male', 'Ib_MALE_01_Male_Eyebrows_10_1')).toBeUndefined()
  })

  it('is the only one', () => {
    for (const gender of GENDERS) {
      const dotted = FIRETOY_PARTS[gender].filter((p) => p.node.endsWith('.'))
      expect(dotted.map((p) => p.node)).toEqual(
        gender === 'male' ? ['Ib_MALE_01_Male_Eyebrows_10_1.'] : [],
      )
    }
  })

  it('is spelled the way the asset map spells it', () => {
    expect(ASSET_MAP).toContain('Ib_MALE_01_Male_Eyebrows_10_1.\n')
  })

  it('did not swallow its neighbours', () => {
    expect(findPart('male', 'Ib_MALE_01_Male_Eyebrows_10_2')).toBeDefined()
    expect(findPart('male', 'Ib_MALE_01_Male_Eyebrows_11_1')).toBeDefined()
    // The female eleven are clean: only the male ten carries the typo.
    expect(findPart('female', 'Ib_FEMALE_01_Female_Eyebrows_10_1')).toBeDefined()
  })
})

describe('gloves', () => {
  it.each(GENDERS)('%s gloves come in matching pairs', (gender) => {
    const gloves = partsIn(gender, 'gloves')
    expect(gloves.filter((g) => g.side === 'left')).toHaveLength(6)
    expect(gloves.filter((g) => g.side === 'right')).toHaveLength(6)

    for (const glove of gloves) {
      const twin = otherGlove(gender, glove.node)
      expect(findPart(gender, twin)).toMatchObject({
        design: glove.design,
        colorway: glove.colorway,
        side: glove.side === 'left' ? 'right' : 'left',
      })
      // The pairing is symmetric, so either half finds the other.
      expect(otherGlove(gender, twin)).toBe(glove.node)
    }
  })

  it('refuses to pair anything else', () => {
    expect(() => otherGlove('male', 'Ib_MALE_01_Hat_1_1')).toThrow(/Not a glove/)
  })
})

describe('anatomy', () => {
  it('is one combined mesh on the male hands and two on the female', () => {
    expect(anatomyOf('male')).toContain('Ib_MALE_01_Male_Hands')
    expect(anatomyOf('female')).toContain('Ib_FEMALE_01_Female_Left_Hand')
    expect(anatomyOf('female')).toContain('Ib_FEMALE_01_Female_Right_Hand')
    expect(anatomyOf('male')).not.toContain('Ib_MALE_01_Male_Left_Hand')
  })

  it('leads the catalogue, so an outfit reads from the skin outwards', () => {
    for (const gender of GENDERS) {
      const anatomy = anatomyOf(gender)
      expect(FIRETOY_PARTS[gender].slice(0, anatomy.length).map((p) => p.node)).toEqual(anatomy)
    }
  })
})
