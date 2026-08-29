import { describe, expect, it } from 'vitest'
import { SOLO_SETTINGS } from './balance'
import { createMatch, qteWindow, step } from './match'
import { battleStats } from './stats'
import type { Judgement, MatchState, PlayerSetup } from './types'
import { getCard } from './cards'
import { runFor } from './qte'

const DECK = ['mewing', 'six-seven', 'lean', 'griddy-drop', 'beat-drop']

function opening(): MatchState {
  const setups: [PlayerSetup, PlayerSetup] = [
    { name: 'P1', characterId: 'blocky', deck: DECK },
    { name: 'CPU', characterId: 'noodle', deck: DECK, controller: 'cpu' },
  ]
  return step(createMatch(SOLO_SETTINGS, setups, 7), {
    type: 'START',
    now: 0,
    seed: 7,
    settings: SOLO_SETTINGS,
    setups,
  })
}

/** Plays one turn to a known grade, or lets the clock run out on it. */
function turn(
  state: MatchState,
  now: number,
  cardId: string | null,
  judgement?: Judgement,
): { state: MatchState; now: number } {
  let s = step(state, { type: 'READY', now })
  if (cardId === null) {
    // Freeze: run the choosing clock out.
    s = step(s, { type: 'TICK', now: now + SOLO_SETTINGS.chooseMs })
    return { state: s, now: now + SOLO_SETTINGS.chooseMs }
  }
  s = step(s, { type: 'SELECT_CARD', cardId, now })
  s = step(s, { type: 'TICK', now: now + 500 })
  const at = now + 500 + Math.min(600, qteWindow(cardId) - 100)
  s = step(s, { type: 'QTE_RESULT', outcome: runFor(getCard(cardId), judgement!), now: at })
  return { state: s, now: at }
}

describe('reading a battle into numbers', () => {
  it('starts at nothing', () => {
    const stats = battleStats(opening())
    expect(stats.turns).toBe(0)
    expect(stats.totalAura).toEqual([0, 0])
    expect(stats.godAuraReached).toEqual([false, false])
    expect(stats.winner).toBeNull()
  })

  it('counts every grade against the player who took it', () => {
    let now = 0
    let state = opening()
    ;({ state, now } = turn(state, now, 'mewing', 'PERFECT'))
    ;({ state, now } = turn(state, now, 'six-seven', 'MISS'))
    ;({ state, now } = turn(state, now, 'lean', 'PERFECT'))
    ;({ state, now } = turn(state, now, 'beat-drop', 'GOOD'))

    const stats = battleStats(state)
    expect(stats.turns).toBe(4)
    expect(stats.perfectCount).toEqual([2, 0])
    expect(stats.missCount).toEqual([0, 1])
    expect(stats.goodCount).toEqual([0, 1])
    // Two PERFECTs in a row, because the rival's turn sits between them and a
    // streak is the player's own, not the table's.
    expect(stats.bestStreak[0]).toBe(2)
    expect(stats.bestStreak[1]).toBe(0)
  })

  it('tells a frozen clock apart from a fumbled card', () => {
    let now = 0
    let state = opening()
    ;({ state, now } = turn(state, now, null))

    const stats = battleStats(state)
    expect(stats.lostComposureCount).toEqual([1, 0])
    expect(stats.missCount).toEqual([0, 0])
  })

  it('counts a hard card only when it was landed', () => {
    let now = 0
    let state = opening()
    ;({ state, now } = turn(state, now, 'griddy-drop', 'GOOD'))
    ;({ state, now } = turn(state, now, 'griddy-drop', 'MISS'))

    const stats = battleStats(state)
    expect(stats.hardLanded).toEqual([1, 0])
  })

  it('adds up the aura each side actually took', () => {
    let now = 0
    let state = opening()
    ;({ state, now } = turn(state, now, 'mewing', 'PERFECT'))

    const stats = battleStats(state)
    expect(stats.totalAura[0]).toBe(state.log[0].aura)
    expect(stats.totalAura[0]).toBeGreaterThan(0)
    expect(stats.totalAura[1]).toBe(0)
  })

  it('remembers the highest momentum reached, not the one left standing', () => {
    let now = 0
    let state = opening()
    ;({ state, now } = turn(state, now, 'mewing', 'PERFECT'))
    ;({ state, now } = turn(state, now, 'six-seven', 'PERFECT'))
    const peak = battleStats(state).maxMomentum[0]
    ;({ state, now } = turn(state, now, 'lean', 'MISS'))

    const after = battleStats(state)
    expect(peak).toBeGreaterThan(0)
    expect(after.maxMomentum[0]).toBe(peak)
    expect(state.players[0].momentum).toBeLessThan(peak)
  })

  it('reports the ending as soon as it is decided, before the screen shows it', () => {
    // `pendingEnd` is set on the scoring step and the phase only catches up
    // when the score sheet is dismissed. Results reads the stats off the
    // finished match, so both have to say the same thing.
    let now = 0
    let state = opening()
    for (const card of DECK) {
      ;({ state, now } = turn(state, now, card, 'PERFECT'))
      ;({ state, now } = turn(state, now, card, 'MISS'))
    }
    const stats = battleStats(state)
    expect(stats.winner).toBe(0)
    expect(stats.mogged).toBe(state.pendingEnd?.reason === 'mogged')
  })

  it('sees god aura even though it is long gone by the end', () => {
    let now = 0
    let state = opening()
    // Both sides land everything, so the bar stays level and nobody is mogged
    // out of the battle before the run can be broken on the last card.
    for (const card of ['mewing', 'six-seven', 'lean', 'beat-drop']) {
      ;({ state, now } = turn(state, now, card, 'PERFECT'))
      ;({ state, now } = turn(state, now, card, 'PERFECT'))
    }
    expect(state.players[0].godAura).toBe(true)
    ;({ state, now } = turn(state, now, 'griddy-drop', 'MISS'))

    // The live flag is gone; the fact that it happened is not, because the
    // stat is derived from the log rather than read off the player.
    expect(state.players[0].godAura).toBe(false)
    expect(battleStats(state).godAuraReached[0]).toBe(true)
  })
})
