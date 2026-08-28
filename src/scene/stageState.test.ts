import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, INTRO_MS } from '../engine/balance'
import { getCard } from '../engine/cards'
import { createMatch, step } from '../engine/match'
import type { MatchState, PlayerSetup } from '../engine/types'
import { SLOTS, actionProgress, fighterAction, slotOf } from './stageState'

const DECK = ['mewing', 'six-seven', 'split-focus', 'griddy-drop']
const setups: [PlayerSetup, PlayerSetup] = [
  { name: 'P1', characterId: 'blocky', deck: DECK },
  { name: 'P2', characterId: 'noodle', deck: DECK },
]

function opened(): { s: MatchState; t: number } {
  const t = 1000
  return {
    s: step(createMatch(DEFAULT_SETTINGS, setups, 7), {
      type: 'START',
      now: t,
      settings: DEFAULT_SETTINGS,
      setups,
      seed: 7,
    }),
    t,
  }
}

/** Play far enough to reach the QTE for `cardId`. */
function atQte(cardId: string) {
  const { s, t } = opened()
  let state = step(s, { type: 'READY', now: t })
  state = step(state, { type: 'SELECT_CARD', cardId, now: t })
  state = step(state, { type: 'TICK', now: t + INTRO_MS })
  return { state, t: t + INTRO_MS }
}

describe('who is on stage', () => {
  it('puts whoever is up out front and the other one back', () => {
    const { s } = opened()
    expect(slotOf(s, 0)).toBe('front')
    expect(slotOf(s, 1)).toBe('back')
    expect(SLOTS.back.z).toBeLessThan(SLOTS.front.z)
  })

  it('gives the winner the front at the end of the battle', () => {
    const { s } = opened()
    const ended: MatchState = {
      ...s,
      active: 0,
      phase: { kind: 'matchEnd', winner: 1, reason: 'moves' },
    }
    expect(slotOf(ended, 1)).toBe('front')
    expect(slotOf(ended, 0)).toBe('back')
  })

  it('sends one of them into a celebration and the other into a sulk', () => {
    const { s } = opened()
    const ended: MatchState = {
      ...s,
      phase: { kind: 'matchEnd', winner: 1, reason: 'mogged' },
    }
    expect(fighterAction(ended, 1)).toEqual({ kind: 'finale', won: true })
    expect(fighterAction(ended, 0)).toEqual({ kind: 'finale', won: false })
  })

  it('leaves a dead heat with nobody celebrating', () => {
    const { s } = opened()
    const draw: MatchState = {
      ...s,
      phase: { kind: 'matchEnd', winner: null, reason: 'moves' },
    }
    expect(fighterAction(draw, 0).kind).toBe('idle')
    expect(slotOf(draw, 0)).toBe('front')
  })
})

describe('what each body is doing', () => {
  it('leaves everyone idle while a card is being chosen', () => {
    const { s, t } = opened()
    const choosing = step(s, { type: 'READY', now: t })
    expect(fighterAction(choosing, 0).kind).toBe('idle')
    expect(fighterAction(choosing, 1).kind).toBe('idle')
  })

  it('winds up only the player who committed', () => {
    const { s, t } = opened()
    let state = step(s, { type: 'READY', now: t })
    state = step(state, { type: 'SELECT_CARD', cardId: 'six-seven', now: t })

    const wind = fighterAction(state, 0)
    expect(wind.kind).toBe('windUp')
    if (wind.kind === 'windUp') expect(wind.durationMs).toBe(INTRO_MS)
    expect(fighterAction(state, 1).kind).toBe('idle')
  })

  it('performs the gesture the card names, for as long as the card lasts', () => {
    const { state } = atQte('griddy-drop')
    const card = getCard('griddy-drop')
    const move = fighterAction(state, 0)

    expect(move.kind).toBe('move')
    if (move.kind === 'move') {
      expect(move.animation).toBe(card.animation)
      expect(move.durationMs).toBe(card.durationMs)
    }
    expect(fighterAction(state, 1).kind).toBe('idle')
  })

  it('reacts on the player the judgement landed on', () => {
    const { state, t } = atQte('mewing')
    const resolved = step(state, { type: 'QTE_RESULT', judgement: 'PERFECT', now: t + 50 })

    const react = fighterAction(resolved, 0)
    expect(react.kind).toBe('react')
    if (react.kind === 'react') {
      expect(react.judgement).toBe('PERFECT')
      // Anchored to the start of the resolve screen, not its end.
      expect(react.startedAt).toBe(t + 50)
    }
  })

  it('has the rival answer it rather than stand there', () => {
    const { state, t } = atQte('mewing')
    const resolved = step(state, { type: 'QTE_RESULT', judgement: 'PERFECT', now: t + 50 })

    const watching = fighterAction(resolved, 1)
    expect(watching.kind).toBe('watch')
    if (watching.kind === 'watch') {
      expect(watching.judgement).toBe('PERFECT')
      expect(watching.startedAt).toBe(t + 50)
    }
  })

  it('slumps the player who ran the clock out', () => {
    const { s, t } = opened()
    let state = step(s, { type: 'READY', now: t })
    state = step(state, { type: 'TICK', now: t + DEFAULT_SETTINGS.chooseMs })

    const react = fighterAction(state, 0)
    expect(react.kind).toBe('react')
    if (react.kind === 'react') expect(react.judgement).toBe('LOST_COMPOSURE')
  })
})

describe('timing an action', () => {
  it('runs 0 to 1 across the action and stops there', () => {
    const action = { kind: 'move', animation: 'tpose', startedAt: 500, durationMs: 1000 } as const
    expect(actionProgress(action, 500)).toBe(0)
    expect(actionProgress(action, 1000)).toBeCloseTo(0.5)
    expect(actionProgress(action, 1500)).toBe(1)
    expect(actionProgress(action, 9000)).toBe(1)
    expect(actionProgress(action, 0)).toBe(0)
  })

  it('has nothing to time for an idle fighter', () => {
    expect(actionProgress({ kind: 'idle' }, 12345)).toBe(0)
  })

  it('starts the reaction as the score lands, then holds it there', () => {
    const { state, t } = atQte('mewing')
    const resolved = step(state, { type: 'QTE_RESULT', judgement: 'GOOD', now: t + 50 })
    if (resolved.phase.kind !== 'resolve') throw new Error('expected a resolve')

    const react = fighterAction(resolved, 0)
    if (react.kind !== 'react') throw new Error('expected a reaction')
    expect(react.startedAt).toBe(resolved.phase.startedAt)
    // The score sheet has no clock of its own, so the reaction has to play out
    // and then settle rather than run to the end of a phase.
    expect(actionProgress(react, react.startedAt + react.durationMs * 4)).toBe(1)
  })
})
