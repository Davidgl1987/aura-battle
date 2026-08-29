import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, INTRO_MS } from './balance'
import { createMatch, step } from './match'
import { recap } from './recap'
import type { Judgement, MatchState, PlayerSetup } from './types'
import { getCard } from './cards'
import { runFor } from './qte'

const DECK = ['mewing', 'six-seven', 'split-focus', 'griddy-drop']
const setups: [PlayerSetup, PlayerSetup] = [
  { name: 'ANA', characterId: 'blocky', deck: DECK },
  { name: 'BEA', characterId: 'noodle', deck: DECK },
]

/** Plays a scripted battle so the story is known in advance. */
function battle(script: (Judgement | 'FREEZE')[]): MatchState {
  let t = 1000
  let s = step(createMatch(DEFAULT_SETTINGS, setups, 3), {
    type: 'START',
    now: t,
    settings: DEFAULT_SETTINGS,
    setups,
    seed: 3,
  })

  for (const beat of script) {
    if (s.phase.kind === 'matchEnd') break
    s = step(s, { type: 'READY', now: t })

    if (beat === 'FREEZE') {
      t += DEFAULT_SETTINGS.chooseMs
      s = step(s, { type: 'TICK', now: t })
      t += 2000
      s = step(s, { type: 'READY', now: t })
      continue
    }

    const cardId = s.players[s.active].remaining[0]
    s = step(s, { type: 'SELECT_CARD', cardId, now: t })
    t += INTRO_MS
    s = step(s, { type: 'TICK', now: t })
    t += 50
    s = step(s, { type: 'QTE_RESULT', outcome: runFor(getCard(cardId), beat), now: t })
    t += 2000
    s = step(s, { type: 'READY', now: t })
  }
  return s
}

describe('the story of a battle', () => {
  it('splits the log by player, in order', () => {
    const s = battle(['PERFECT', 'MISS', 'GOOD', 'GOOD'])
    const [ana, bea] = recap(s)

    expect(ana.name).toBe('ANA')
    expect(ana.turns.map((t) => t.judgement)).toEqual(['PERFECT', 'GOOD'])
    expect(bea.turns.map((t) => t.judgement)).toEqual(['MISS', 'GOOD'])
    expect(ana.perfects).toBe(1)
    expect(bea.perfects).toBe(0)
  })

  it('adds up the aura each of them earned', () => {
    const s = battle(['PERFECT', 'MISS'])
    const [ana, bea] = recap(s)
    expect(ana.totalAura).toBeGreaterThan(0)
    expect(bea.totalAura).toBeLessThan(0)
  })

  it('remembers the move worth bragging about', () => {
    const s = battle(['GOOD', 'MISS', 'PERFECT', 'MISS'])
    const [ana] = recap(s)
    expect(ana.best?.judgement).toBe('PERFECT')
    expect(ana.best?.aura).toBe(Math.max(...ana.turns.map((t) => t.aura)))
  })

  it('has nothing to brag about when nothing landed', () => {
    const s = battle(['MISS', 'MISS'])
    const [ana] = recap(s)
    expect(ana.best).toBeNull()
  })

  it('counts the turns lost to a frozen clock', () => {
    const s = battle(['FREEZE', 'GOOD'])
    const [ana, bea] = recap(s)
    expect(ana.fumbles).toBe(1)
    expect(ana.turns[0].cardId).toBeNull()
    expect(bea.fumbles).toBe(0)
  })

  it('records who caught fire', () => {
    const s = battle(['PERFECT', 'MISS', 'PERFECT', 'MISS', 'PERFECT', 'MISS', 'PERFECT', 'MISS'])
    const [ana, bea] = recap(s)
    expect(ana.reachedGodAura).toBe(true)
    expect(bea.reachedGodAura).toBe(false)
  })

  it('has something to say about a battle nobody played', () => {
    const fresh = createMatch(DEFAULT_SETTINGS, setups, 1)
    const [ana, bea] = recap(fresh)
    expect(ana.turns).toEqual([])
    expect(ana.totalAura).toBe(0)
    expect(bea.best).toBeNull()
  })
})
