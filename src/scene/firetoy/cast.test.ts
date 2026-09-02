import { describe, expect, it } from 'vitest'
import { ACCESSORIES, getAccessory } from '../../engine/accessories'
import { RIVALS } from '../../engine/rivals'
import type { FiretoyLook } from '../../engine/types'
import { type Gender, findPart, getPart, otherGlove } from './characterParts'
import {
  ACCESSORY_PIECES,
  DEFAULT_PLAYER_CHARACTER,
  PLAYER_CHARACTERS,
  RIVAL_CHARACTER_PRESETS,
} from './cast'
import { fitsGender } from './outfit'

const CAST: [string, FiretoyLook][] = [
  ...Object.entries(RIVAL_CHARACTER_PRESETS),
  ...Object.entries(PLAYER_CHARACTERS),
]

const GENDERS: readonly Gender[] = ['male', 'female']

describe('everyone on the stage is dressed in real pieces', () => {
  it.each(CAST)('%s wears nodes the model has', (_who, look) => {
    for (const node of look.outfit) {
      expect(findPart(look.gender, node), node).toBeDefined()
    }
    expect(fitsGender(look.gender, look.outfit)).toBe(true)
  })

  it.each(CAST)('%s wears one thing per category', (_who, look) => {
    const seen = new Set<string>()
    for (const node of look.outfit) {
      const part = getPart(look.gender, node)
      // Anatomy is a checklist and gloves come in twos; everything else is a
      // choice, and two hats at once is a mistake nothing else would catch.
      if (part.category === 'anatomy' || part.category === 'gloves') continue
      expect(seen.has(part.category), `${_who} wears two ${part.category}`).toBe(false)
      seen.add(part.category)
    }
  })

  it.each(CAST)('%s wears gloves as a pair', (_who, look) => {
    const gloves = look.outfit.filter((n) => getPart(look.gender, n).category === 'gloves')
    expect(gloves).toHaveLength(2)
    expect(otherGlove(look.gender, gloves[0])).toBe(gloves[1])
  })

  it.each(CAST)('%s has a head and eyes to act with', (_who, look) => {
    const anatomy = look.outfit.filter((n) => getPart(look.gender, n).category === 'anatomy')
    expect(anatomy.some((n) => n.endsWith('_Head'))).toBe(true)
    expect(anatomy.some((n) => n.endsWith('_Eyes'))).toBe(true)
  })

  it.each(CAST)('%s does not wear a full body over separates', (_who, look) => {
    const categories = look.outfit.map((n) => getPart(look.gender, n).category)
    if (!categories.includes('fullbody')) return
    expect(categories).not.toContain('torso')
    expect(categories).not.toContain('pants')
    expect(categories).not.toContain('shoes')
  })
})

/**
 * The rule the whole ladder rests on: you watch the accessory for a battle,
 * meet the challenge, and it is yours. A rival who is not wearing their own
 * reward turns the challenge back into a line of text.
 */
describe('a rival wears what their challenge pays out', () => {
  it.each(RIVALS.map((r) => [r.id, r] as const))('%s', (id, rival) => {
    const look = RIVAL_CHARACTER_PRESETS[id]
    expect(look, `no character for ${id}`).toBeDefined()

    const payouts = rival.objectives
      .map((o) => o.reward)
      .filter((r) => r.kind === 'accessory')
    expect(payouts).toHaveLength(1)

    const piece = ACCESSORY_PIECES[payouts[0].accessoryId]
    expect(piece, `no Firetoy piece for ${payouts[0].accessoryId}`).toBeDefined()

    const worn = piece[look.gender]
    expect(look.outfit, `${id} is not wearing ${worn}`).toContain(worn)
    // Gloves are handed over as a pair, so both halves have to be on show.
    if (getPart(look.gender, worn).category === 'gloves') {
      expect(look.outfit).toContain(otherGlove(look.gender, worn))
    }
  })

  it('gives every rival a body of their own', () => {
    expect(Object.keys(RIVAL_CHARACTER_PRESETS).sort()).toEqual(RIVALS.map((r) => r.id).sort())
  })

  /**
   * Six rivals you can tell apart with the sound off. Not a style rule — the
   * ladder is six battles against what is meant to be six different people.
   */
  it('never puts two rivals in the same outfit', () => {
    const worn = Object.values(RIVAL_CHARACTER_PRESETS).map(
      (look) => `${look.gender}:${[...look.outfit].sort().join(',')}`,
    )
    expect(new Set(worn).size).toBe(worn.length)
  })

  it('alternates the two bodies down the ladder', () => {
    const genders = RIVALS.map((r) => RIVAL_CHARACTER_PRESETS[r.id].gender)
    for (let i = 1; i < genders.length; i++) {
      expect(genders[i], `rivals ${i} and ${i - 1} share a body`).not.toBe(genders[i - 1])
    }
  })

  it('gives each of them a different head', () => {
    // Hat, hair, mask: whatever is above the shoulders is what you recognise
    // from across the stage, and no two of them may match.
    const heads = RIVALS.map((r) => {
      const look = RIVAL_CHARACTER_PRESETS[r.id]
      return look.outfit
        .filter((n) => ['hat', 'hair', 'mask', 'glasses', 'headphones'].includes(
          getPart(look.gender, n).category,
        ))
        .join(',')
    })
    expect(new Set(heads).size).toBe(heads.length)
  })
})

describe('the accessories are real pieces', () => {
  it('has a Firetoy piece for every accessory in the catalogue', () => {
    expect(Object.keys(ACCESSORY_PIECES).sort()).toEqual(ACCESSORIES.map((a) => a.id).sort())
  })

  it.each(Object.entries(ACCESSORY_PIECES))('%s exists on both bodies', (id, pieces) => {
    for (const gender of GENDERS) {
      const part = findPart(gender, pieces[gender])
      expect(part, `${id} has no ${gender} piece`).toBeDefined()
      // The slot the game files it under is the Firetoy category it really is.
      expect(part!.category).toBe(getAccessory(id).slot)
    }
  })

  it('means the same thing on both bodies', () => {
    // Hat_2 is a helmet either way, Glasses_2 the aggressive shades. Families
    // where the two catalogues disagree — Hat_3 is a paper bag on one body and
    // a chicken head on the other — are not what a shared reward is made of.
    for (const pieces of Object.values(ACCESSORY_PIECES)) {
      const male = getPart('male', pieces.male)
      const female = getPart('female', pieces.female)
      expect(female.category).toBe(male.category)
      expect(female.design).toBe(male.design)
      expect(female.colorway).toBe(male.colorway)
    }
  })
})

describe('the player', () => {
  it('plays as the character solo hands them', () => {
    expect(PLAYER_CHARACTERS.blocky).toBe(DEFAULT_PLAYER_CHARACTER)
  })

  it('starts in nothing the ladder pays out', () => {
    // The six accessories should read as new when they arrive, not as
    // something the player has been standing in since the first battle.
    const rewards = new Set(
      Object.values(ACCESSORY_PIECES).flatMap((p) => [
        p.male,
        p.female,
        ...GENDERS.map((g) => otherGloveOrNull(g, p[g])),
      ]),
    )
    for (const [who, look] of Object.entries(PLAYER_CHARACTERS)) {
      for (const node of look.outfit) {
        expect(rewards.has(node), `${who} already wears ${node}`).toBe(false)
      }
    }
  })

  it('gives each hot-seat character a different body to wear', () => {
    const worn = Object.values(PLAYER_CHARACTERS).map(
      (look) => `${look.gender}:${[...look.outfit].sort().join(',')}`,
    )
    expect(new Set(worn).size).toBe(worn.length)
  })
})

function otherGloveOrNull(gender: Gender, node: string): string {
  return getPart(gender, node).category === 'gloves' ? otherGlove(gender, node) : node
}
