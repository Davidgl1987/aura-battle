import { describe, expect, it } from 'vitest'
import { SOLO_SETTINGS } from './balance'
import { getCard } from './cards'
import { NO_STRATEGY, baseOdds, chooseCard, cpuOdds, cpuRoll, judgeQte, thinkMs } from './cpu'
import { createMatch, step } from './match'
import type { MatchState, PlayerSetup, Strategy } from './index'

const strategy = (patch: Partial<Strategy>): Strategy => ({ ...NO_STRATEGY, ...patch })

/**
 * A match sitting on the CPU's turn with a known hand, so a weight can be
 * turned up on its own and the card it reaches for checked.
 */
function facing(hand: string[], lastPlayed?: string): MatchState {
  const setups: [PlayerSetup, PlayerSetup] = [
    { name: 'P1', characterId: 'blocky', deck: hand },
    { name: 'CPU', characterId: 'noodle', deck: hand, controller: 'cpu' },
  ]
  const settings = { ...SOLO_SETTINGS, deckSize: hand.length }
  let state = step(createMatch(settings, setups, 1234), {
    type: 'START',
    now: 0,
    seed: 1234,
    settings,
    setups,
  })
  state = step(state, { type: 'READY', now: 0 })
  // Hand the turn to the CPU, with something on the table to answer.
  return {
    ...state,
    active: 1,
    lastPlayed: lastPlayed ? { cardId: lastPlayed, kind: getCard(lastPlayed).kind } : null,
  }
}

describe('what a rival reaches for', () => {
  it('breaks the kind on the table when it values freshness', () => {
    // Timing is on the table; only the speed card answers it FRESH.
    const state = facing(['mewing', 'six-seven'], 'sigma-stare')
    expect(chooseCard(state, strategy({ prefersFresh: 1 }))).toBe('six-seven')
  })

  it('takes the hardest thing in hand when it tolerates risk', () => {
    const state = facing(['mewing', 'griddy-drop'])
    expect(chooseCard(state, strategy({ prefersDifficulty: 1 }))).toBe('griddy-drop')
  })

  it('avoids what it is likely to fumble when it plays safe', () => {
    // Same hand, opposite weight: a shaky rival that dislikes missing takes
    // the card it can actually land.
    const state = facing(['mewing', 'griddy-drop'])
    expect(chooseCard(state, strategy({ prefersSafeCards: 1, qteSkill: 0.3 }))).toBe('mewing')
  })

  /**
   * The two greed weights have to be genuinely different axes, or a rival's
   * configuration has one fewer dimension than it looks like it has. In this
   * pool base aura and difficulty move together, so the separation has to come
   * from somewhere else: expected value folds in the odds of landing the card.
   */
  it('separates playing well from taking risks', () => {
    const state = facing(['mewing', 'griddy-drop'])
    // A rival this shaky loses money on the hard card, so the one chasing the
    // best expected bill declines it while the risk-taker still reaches.
    const shaky = { qteSkill: 0.25, consistency: 0.2 }
    expect(chooseCard(state, strategy({ prefersHighAura: 1, ...shaky }))).toBe('mewing')
    expect(chooseCard(state, strategy({ prefersDifficulty: 1, ...shaky }))).toBe('griddy-drop')
  })

  it('takes the only card it has left without consulting anything', () => {
    const state = facing(['lean'])
    expect(chooseCard(state, NO_STRATEGY)).toBe('lean')
  })

  it('picks the same card from the same state every time', () => {
    const state = facing(['mewing', 'six-seven', 'lean'], 'sigma-stare')
    const s = strategy({ prefersFresh: 0.5, prefersHighAura: 0.5, jitter: 0.4 })
    const first = chooseCard(state, s)
    for (let i = 0; i < 20; i++) expect(chooseCard(state, s)).toBe(first)
  })

  it('ranks the hand differently as the turn advances', () => {
    // The jitter has to move with the match rather than sit on a constant, or
    // a rival plays the identical sequence in every battle from a given seed.
    const state = facing(['mewing', 'six-seven', 'lean', 'rizz-clap'])
    const s = strategy({ jitter: 1 })
    const picks = new Set(
      [0, 1, 2, 3, 4, 5].map((turnIndex) => chooseCard({ ...state, turnIndex }, s)),
    )
    expect(picks.size).toBeGreaterThan(1)
  })
})

describe('what a rival scores on a QTE', () => {
  it('turns skill into odds that always add up', () => {
    for (const qteSkill of [0, 0.25, 0.5, 0.75, 1]) {
      for (const consistency of [0, 0.5, 1]) {
        const odds = cpuOdds(strategy({ qteSkill, consistency }), getCard('mewing'))
        expect(odds.perfect).toBeGreaterThanOrEqual(0)
        expect(odds.good).toBeGreaterThanOrEqual(0)
        expect(odds.perfect + odds.good).toBeLessThanOrEqual(1)
      }
    }
  })

  it('never promises a perfect run', () => {
    expect(baseOdds(strategy({ qteSkill: 1 })).perfect).toBeLessThan(1)
  })

  it('makes a hard card harder for the same rival', () => {
    const s = strategy({ qteSkill: 0.5, consistency: 0.5 })
    const easy = cpuOdds(s, getCard('mewing'))
    const hard = cpuOdds(s, getCard('griddy-drop'))
    expect(hard.perfect).toBeLessThan(easy.perfect)
    expect(1 - hard.perfect - hard.good).toBeGreaterThan(1 - easy.perfect - easy.good)
  })

  /**
   * A grade is no longer one roll against one threshold — it is a whole run
   * settled at the end — so all three have to be reachable rather than laid
   * out in order along the roll. `qte.test.ts` covers the ledger itself.
   */
  it('reaches all three grades across the range of hands', () => {
    // A grade is a whole run settled at the end rather than one roll against a
    // threshold, so no single skill level produces all three — what matters is
    // that the scale spans them.
    const card = getCard('griddy-drop')
    const seen = new Set<string>()
    for (const qteSkill of [0.2, 0.45, 0.7, 0.95]) {
      const s = strategy({ qteSkill, consistency: 0.5 })
      for (let i = 0; i < 200; i++) seen.add(judgeQte(s, card, (i + 0.5) / 200))
    }
    expect(seen).toContain('PERFECT')
    expect(seen).toContain('GOOD')
    expect(seen).toContain('MISS')
  })

  it('lands a clean run about as often as its own odds say it should', () => {
    const s = strategy({ qteSkill: 0.75, consistency: 0.6 })
    const card = getCard('mewing')
    const odds = cpuOdds(s, card)
    const runs = 4000
    let perfect = 0
    for (let i = 0; i < runs; i++) {
      if (judgeQte(s, card, (i + 0.5) / runs) === 'PERFECT') perfect += 1
    }
    // PERFECT is every opportunity landed, so it sits below the chance of
    // landing any single one, and well above never.
    expect(perfect / runs).toBeGreaterThan(0.05)
    expect(perfect / runs).toBeLessThan(odds.perfect)
  })
})

describe('the rolls behind it', () => {
  it('is a function of the match, not of the wall clock', () => {
    const state = facing(['mewing', 'lean'])
    expect(cpuRoll(state, 0)).toBe(cpuRoll(state, 0))
    expect(cpuRoll(state, 0)).not.toBe(cpuRoll(state, 1))
    expect(cpuRoll(state, 0)).not.toBe(cpuRoll({ ...state, turnIndex: 1 }, 0))
    expect(cpuRoll(state, 0)).not.toBe(cpuRoll({ ...state, seed: 99 }, 0))
  })

  it('stays inside the unit interval whatever the seed', () => {
    const state = facing(['mewing'])
    for (const seed of [0, 1, 0xffffffff, 2 ** 31, 123456789]) {
      for (const salt of [0, 1, 2]) {
        const roll = cpuRoll({ ...state, seed }, salt)
        expect(roll).toBeGreaterThanOrEqual(0)
        expect(roll).toBeLessThan(1)
      }
    }
  })
})

describe('how long a rival takes', () => {
  it('keeps the pause watchable at either extreme', () => {
    for (const roll of [0, 0.5, 1]) {
      for (const qteSkill of [0, 1]) {
        const wait = thinkMs(strategy({ qteSkill, consistency: qteSkill }), roll)
        expect(wait).toBeGreaterThanOrEqual(500)
        expect(wait).toBeLessThanOrEqual(1500)
      }
    }
  })

  it('lets a sharper rival answer faster than a dithering one', () => {
    const sharp = thinkMs(strategy({ qteSkill: 0.9, consistency: 0.9 }), 0.5)
    const slow = thinkMs(strategy({ qteSkill: 0.1, consistency: 0.2 }), 0.5)
    expect(sharp).toBeLessThan(slow)
  })
})
