import { describe, expect, it } from 'vitest'
import { ACCESSORIES, getAccessory } from './accessories'
import { SOLO_DECK_SIZE, SOLO_SETTINGS } from './balance'
import { LOCKED_CARD_IDS, STARTER_CARD_IDS, getCard } from './cards'
import { getCharacter } from './characters'
import { RIVALS, getRival, nextRival, rivalIndex } from './rivals'
import { PROFILES, rivalProfile, tally, type Tally } from './simulate'

const MATCHES = 2000

/** Run with `npm run balance` to see the ladder this is asserting against. */
function ladder(): { name: string; solid: number; ace: number }[] {
  return RIVALS.map((rival) => {
    const cpu = rivalProfile(rival.name, rival.strategy, [...rival.deck])
    const rate = (t: Tally) => t.winsP0 / t.matches
    return {
      name: rival.name,
      solid: rate(tally(SOLO_SETTINGS, [PROFILES.solid, cpu], MATCHES)),
      ace: rate(tally(SOLO_SETTINGS, [PROFILES.ace, cpu], MATCHES)),
    }
  })
}

describe('the six of them, as data', () => {
  it('brings exactly the solo format to the table', () => {
    for (const rival of RIVALS) {
      expect(rival.deck, rival.name).toHaveLength(SOLO_DECK_SIZE)
      expect(new Set(rival.deck).size, `${rival.name} has no duplicates`).toBe(SOLO_DECK_SIZE)
      for (const id of rival.deck) expect(() => getCard(id)).not.toThrow()
    }
  })

  /**
   * The whole point of the signature card: you watch the move you are playing
   * for, performed by the one holding it, several turns before you own it.
   */
  it('plays the card it is going to give up', () => {
    for (const rival of RIVALS) {
      expect(rival.deck, rival.name).toContain(rival.signatureCardId)
      expect(getCard(rival.signatureCardId).difficulty, rival.name).toBe(3)
    }
  })

  it('wears the accessory its challenge pays out', () => {
    for (const rival of RIVALS) {
      const reward = rival.objectives[2].reward
      expect(reward.kind, rival.name).toBe('accessory')
      if (reward.kind !== 'accessory') return
      expect(rival.look.accessories, rival.name).toContain(reward.accessoryId)
      expect(() => getAccessory(reward.accessoryId)).not.toThrow()
    }
  })

  it('pays out in the order win · aura · challenge, every time', () => {
    for (const rival of RIVALS) {
      const [win, aura, challenge] = rival.objectives
      expect(win.check.kind, rival.name).toBe('win')
      expect(win.reward).toEqual({ kind: 'card', cardId: rival.signatureCardId })
      expect(aura.check.kind, rival.name).toBe('aura')
      expect(aura.reward.kind, rival.name).toBe('coins')
      expect(challenge.reward.kind, rival.name).toBe('accessory')
    }
  })

  it('is a body the stage knows how to build, in a colour of its own', () => {
    for (const rival of RIVALS) {
      expect(() => getCharacter(rival.characterId)).not.toThrow()
      // Four builds over six rivals means two of them get reused, so colour is
      // what carries the difference and no two may share one.
      expect(rival.look.color, rival.name).toBeTruthy()
    }
    const colors = RIVALS.map((r) => r.look.color)
    expect(new Set(colors).size).toBe(RIVALS.length)
  })

  it('never puts the same silhouette in front of you twice in a row', () => {
    for (let i = 1; i < RIVALS.length; i++) {
      expect(RIVALS[i].characterId, RIVALS[i].name).not.toBe(RIVALS[i - 1].characterId)
    }
  })
})

describe('what the ladder unlocks', () => {
  it('hands out every locked card exactly once, and no starter twice', () => {
    const dropped = RIVALS.map((r) => r.signatureCardId)
    expect(new Set(dropped).size).toBe(dropped.length)
    expect([...dropped].sort()).toEqual([...LOCKED_CARD_IDS].sort())
    for (const id of dropped) expect(STARTER_CARD_IDS).not.toContain(id)
  })

  it('covers the pool between what you start with and what you win', () => {
    expect(STARTER_CARD_IDS).toHaveLength(9)
    expect(LOCKED_CARD_IDS).toHaveLength(6)
    // Three of each kind to start, so a deck can be built out of the box.
    for (const kind of ['timing', 'speed', 'control'] as const) {
      expect(STARTER_CARD_IDS.filter((id) => getCard(id).kind === kind)).toHaveLength(3)
      expect(LOCKED_CARD_IDS.filter((id) => getCard(id).kind === kind)).toHaveLength(2)
    }
    expect(STARTER_CARD_IDS.length).toBeGreaterThanOrEqual(SOLO_DECK_SIZE)
  })

  it('gets harder as it goes, by its own labelling', () => {
    for (let i = 1; i < RIVALS.length; i++) {
      expect(RIVALS[i].difficulty).toBeGreaterThanOrEqual(RIVALS[i - 1].difficulty)
    }
  })

  it('runs from the first to the last and then stops', () => {
    expect(rivalIndex(RIVALS[0].id)).toBe(0)
    expect(nextRival(RIVALS[0].id)?.id).toBe(RIVALS[1].id)
    expect(nextRival(RIVALS[RIVALS.length - 1].id)).toBeNull()
    expect(() => getRival('nobody')).toThrow()
  })

  it('leaves no accessory in the catalogue that nobody hands out', () => {
    const given = RIVALS.flatMap((r) => r.look.accessories ?? [])
    for (const accessory of ACCESSORIES) expect(given).toContain(accessory.id)
  })
})

/**
 * The ladder is measured, not asserted by eye. `rivalProfile` drives the real
 * `chooseCard` and `judgeQte` with the real deck, so this is the rival a
 * player actually meets — not a stand-in that happens to be nearby.
 *
 * Measured against `solid`: 88 / 74 / 54 / 49 / 41 / 15. The bounds below are
 * those numbers with room, so a strategy tweak that quietly flattens the climb
 * fails here instead of shipping.
 */
describe('the ladder, measured', () => {
  const rates = ladder()

  it('never gets easier as you climb', () => {
    if (import.meta.env.VITE_BALANCE) {
      console.log('\n=== THE RIVAL LADDER ===')
      for (const r of rates) {
        console.log(
          `${r.name.padEnd(13)} solid ${(r.solid * 100).toFixed(0).padStart(3)}%` +
            `   ace ${(r.ace * 100).toFixed(0).padStart(3)}%`,
        )
      }
    }
    for (let i = 1; i < rates.length; i++) {
      expect(rates[i].solid, `${rates[i].name} vs ${rates[i - 1].name}`).toBeLessThan(
        rates[i - 1].solid,
      )
    }
  })

  it('opens on somebody a decent player beats most of the time', () => {
    expect(rates[0].solid).toBeGreaterThan(0.78)
    expect(rates[0].ace).toBeGreaterThan(0.9)
  })

  it('sits the middle of the ladder near a coin toss', () => {
    // Rivals three and four are where a battle stops being a formality. Either
    // side of even, and the aura and challenge objectives lose their point.
    for (const i of [2, 3]) {
      expect(rates[i].solid, rates[i].name).toBeGreaterThan(0.35)
      expect(rates[i].solid, rates[i].name).toBeLessThan(0.65)
    }
  })

  it('ends on somebody who is hard without being a wall', () => {
    const demon = rates[rates.length - 1]
    expect(demon.solid).toBeLessThan(0.3)
    // A good player has to be able to actually finish the ladder.
    expect(demon.ace).toBeGreaterThan(0.3)
  })
})
