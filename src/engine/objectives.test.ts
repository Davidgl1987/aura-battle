import { describe, expect, it } from 'vitest'
import { met, meets, type ObjectiveCheck } from './objectives'
import type { BattleStats } from './stats'

const BLANK: BattleStats = {
  winner: null,
  reason: 'moves',
  mogged: false,
  turns: 0,
  totalAura: [0, 0],
  perfectCount: [0, 0],
  goodCount: [0, 0],
  missCount: [0, 0],
  lostComposureCount: [0, 0],
  bestStreak: [0, 0],
  maxMomentum: [0, 0],
  outauraCount: [0, 0],
  hardLanded: [0, 0],
  godAuraReached: [false, false],
}

const stats = (patch: Partial<BattleStats>): BattleStats => ({ ...BLANK, ...patch })

/** Every case in the union, so adding one without a test is a failing test. */
const EVERY_KIND: ObjectiveCheck[] = [
  { kind: 'win' },
  { kind: 'aura', amount: 4000 },
  { kind: 'mogged' },
  { kind: 'outaura', count: 1 },
  { kind: 'streak', length: 2 },
  { kind: 'perfects', count: 3 },
  { kind: 'godAura' },
  { kind: 'noMiss' },
  { kind: 'hardLanded', count: 3 },
  { kind: 'momentum', atLeast: 80 },
]

describe('what an objective asks', () => {
  it('is unmet on a battle where nothing happened', () => {
    // Except the clean sheet: playing nothing badly is, technically, clean.
    for (const check of EVERY_KIND) {
      const expected = check.kind === 'noMiss'
      expect(meets(check, BLANK, 0), check.kind).toBe(expected)
    }
  })

  it('reads the player it was asked about, never the other one', () => {
    const mine = stats({
      winner: 0,
      totalAura: [9000, 0],
      bestStreak: [4, 0],
      perfectCount: [5, 0],
      outauraCount: [2, 0],
      hardLanded: [3, 0],
      maxMomentum: [100, 0],
      godAuraReached: [true, false],
      mogged: true,
    })
    for (const check of EVERY_KIND) {
      expect(meets(check, mine, 0), `${check.kind} for me`).toBe(true)
      // Except the clean sheet, which the rival meets by having done nothing
      // at all. Every other objective has to be earned by the side asking.
      const expected = check.kind === 'noMiss'
      expect(meets(check, mine, 1), `${check.kind} for them`).toBe(expected)
    }
  })

  it('takes a threshold at exactly the number, not past it', () => {
    expect(meets({ kind: 'aura', amount: 4000 }, stats({ totalAura: [4000, 0] }), 0)).toBe(true)
    expect(meets({ kind: 'aura', amount: 4000 }, stats({ totalAura: [3950, 0] }), 0)).toBe(false)
    expect(meets({ kind: 'streak', length: 3 }, stats({ bestStreak: [3, 0] }), 0)).toBe(true)
    expect(meets({ kind: 'streak', length: 3 }, stats({ bestStreak: [2, 0] }), 0)).toBe(false)
  })

  it('only pays MOGGED to whoever did the mogging', () => {
    const beaten = stats({ mogged: true, winner: 1, reason: 'mogged' })
    expect(meets({ kind: 'mogged' }, beaten, 0)).toBe(false)
    expect(meets({ kind: 'mogged' }, beaten, 1)).toBe(true)
  })

  it('counts a frozen clock against a clean run', () => {
    // Losing composure is not a MISS, but a battle you spent staring at the
    // countdown is not one you got through without a mistake either.
    expect(meets({ kind: 'noMiss' }, stats({ lostComposureCount: [1, 0] }), 0)).toBe(false)
    expect(meets({ kind: 'noMiss' }, stats({ missCount: [1, 0] }), 0)).toBe(false)
    expect(meets({ kind: 'noMiss' }, stats({ perfectCount: [4, 0] }), 0)).toBe(true)
  })

})

describe('a rival\'s three', () => {
  it('answers each one independently and in order', () => {
    const objectives = [
      { check: { kind: 'win' } as ObjectiveCheck, reward: { kind: 'coins', amount: 1 } as const },
      { check: { kind: 'aura', amount: 5000 } as ObjectiveCheck, reward: { kind: 'coins', amount: 2 } as const },
      { check: { kind: 'godAura' } as ObjectiveCheck, reward: { kind: 'coins', amount: 3 } as const },
    ]
    // Lost the battle, out-scored the target anyway, never caught fire: the
    // three are separate questions and answering one is not answering another.
    const result = met(objectives, stats({ winner: 1, totalAura: [6000, 0] }), 0)
    expect(result).toEqual([false, true, false])
  })
})
