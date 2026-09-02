import { describe, expect, it } from 'vitest'
import ASSET_MAP from '../../../public/models/characters/FIRETOY_ASSET_MAP.md?raw'
import { type Gender, findPart } from './characterParts'
import {
  FEMALE_PRESET_IDS,
  FIRETOY_PRESETS,
  MALE_PRESET_IDS,
  PRESET_IDS,
  type PresetId,
} from './characterPresets'
import { choiceFromOutfit, resolveOutfit } from './outfit'

const genderOf = (id: PresetId): Gender => (id.startsWith('male') ? 'male' : 'female')

/**
 * The twenty presets read straight out of the asset map's §5, so the map can
 * check the transcription. It lists only the meshes each prefab switches on,
 * one backticked node name at a time, under a `#### Ib_MALE_07` style heading.
 *
 * This is the test that would have caught a mistyped colorway — the kind of
 * slip that produces a character who is nearly right, and that nobody notices
 * until they are next to the original.
 */
function presetsInTheMap(): Map<string, string[]> {
  const section = ASSET_MAP.slice(
    ASSET_MAP.indexOf('## 5. Presets originales'),
    ASSET_MAP.indexOf('## 6. Reglas de compatibilidad'),
  )
  const blocks = section.split(/^#### /m).slice(1)
  return new Map(
    blocks.map((block) => {
      const heading = block.slice(0, block.indexOf('\n')).trim()
      const names = [...block.matchAll(/`(Ib_[A-Za-z0-9_]+\.?)`/g)].map((m) => m[1])
      return [heading, names]
    }),
  )
}

/** `male07` is the map's `Ib_MALE_07`. */
const headingFor = (id: PresetId): string =>
  id.startsWith('male') ? `Ib_MALE_${id.slice(4)}` : `Ib_FEMALE_${id.slice(6)}`

describe('the twenty originals', () => {
  it('has ten of each', () => {
    expect(MALE_PRESET_IDS).toHaveLength(10)
    expect(FEMALE_PRESET_IDS).toHaveLength(10)
    expect(PRESET_IDS).toHaveLength(20)
  })

  it.each(PRESET_IDS)('%s names only nodes the model has', (id) => {
    const gender = genderOf(id)
    for (const node of FIRETOY_PRESETS[id]) {
      expect(findPart(gender, node), `${id} wants ${node}`).toBeDefined()
    }
  })

  it.each(PRESET_IDS)('%s matches the asset map piece for piece', (id) => {
    const inTheMap = presetsInTheMap().get(headingFor(id))
    expect(inTheMap, `no ${headingFor(id)} in the asset map`).toBeDefined()
    expect([...FIRETOY_PRESETS[id]].sort()).toEqual([...inTheMap!].sort())
  })

  it.each(PRESET_IDS)('%s wears one gender only', (id) => {
    const other: Gender = genderOf(id) === 'male' ? 'female' : 'male'
    for (const node of FIRETOY_PRESETS[id]) expect(findPart(other, node)).toBeUndefined()
  })

  it.each(PRESET_IDS)('%s survives a round trip through the editor', (id) => {
    const gender = genderOf(id)
    const outfit = FIRETOY_PRESETS[id]
    // Picking a preset apart into categories and putting it back has to give
    // the same character, or the lab would quietly redress everything it
    // opens. Order is not part of it: a resolved outfit comes out in catalogue
    // order, while a preset is written in the order the map lists it.
    const resolved = resolveOutfit(gender, choiceFromOutfit(gender, outfit))
    expect([...resolved].sort()).toEqual([...outfit].sort())
  })
})

describe('what the originals do and do not do', () => {
  it('never wears a full body over a torso, trousers or shoes', () => {
    for (const id of PRESET_IDS) {
      const gender = genderOf(id)
      const outfit = FIRETOY_PRESETS[id]
      if (!outfit.some((n) => findPart(gender, n)?.category === 'fullbody')) continue
      const categories = outfit.map((n) => findPart(gender, n)?.category)
      expect(categories).not.toContain('torso')
      expect(categories).not.toContain('pants')
      expect(categories).not.toContain('shoes')
    }
  })

  it('always wears gloves as a matching pair', () => {
    for (const id of PRESET_IDS) {
      const gender = genderOf(id)
      const gloves = FIRETOY_PRESETS[id]
        .map((n) => findPart(gender, n))
        .filter((p) => p?.category === 'gloves')
      expect(gloves, id).toHaveLength(2)
      expect(gloves[0]!.design).toBe(gloves[1]!.design)
      expect(gloves[0]!.colorway).toBe(gloves[1]!.colorway)
      expect([gloves[0]!.side, gloves[1]!.side].sort()).toEqual(['left', 'right'])
    }
  })

  it('never switches on the spare body mesh', () => {
    for (const id of PRESET_IDS) {
      expect(FIRETOY_PRESETS[id]).not.toContain('Ib_MALE_01_Male_Body')
      expect(FIRETOY_PRESETS[id]).not.toContain('Ib_FEMALE_01_Fem_Body')
    }
  })

  /**
   * The awkward ones, kept because they are what Firetoy shipped. If a future
   * pass "fixes" them, this is the test that will say so out loud.
   */
  it('keeps male 05, 08 and 09 blind', () => {
    for (const id of ['male05', 'male08', 'male09'] as const) {
      expect(FIRETOY_PRESETS[id]).not.toContain('Ib_MALE_01_Male_Eyes')
      expect(FIRETOY_PRESETS[id]).toContain('Ib_MALE_01_Male_Head')
    }
  })

  it('keeps male 07 in a hat and hair at once', () => {
    expect(FIRETOY_PRESETS.male07).toContain('Ib_MALE_01_Hair_4_1')
    expect(FIRETOY_PRESETS.male07).toContain('Ib_MALE_01_Hat_3_2')
  })

  it('keeps female 01 in a bra under her torso', () => {
    expect(FIRETOY_PRESETS.female01).toContain('Ib_FEMALE_01_Female_Bra')
    expect(FIRETOY_PRESETS.female01).toContain('Ib_FEMALE_01_Torso_1_1')
  })

  it('lends eyelashes to two of the ten', () => {
    const lashed = FEMALE_PRESET_IDS.filter((id) =>
      FIRETOY_PRESETS[id].includes('Ib_FEMALE_01_Female_Eyelashes'),
    )
    expect(lashed).toEqual(['female01', 'female09'])
  })

  it('wears the one eyebrow whose name ends in a full stop', () => {
    expect(FIRETOY_PRESETS.male09).toContain('Ib_MALE_01_Male_Eyebrows_10_1.')
  })
})
