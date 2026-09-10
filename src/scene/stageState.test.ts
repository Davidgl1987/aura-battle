import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, INTRO_MS } from '../engine/balance'
import { getCard } from '../engine/cards'
import { createMatch, step } from '../engine/match'
import type { MatchState, PlayerSetup, TurnResult } from '../engine/types'
import { runFor } from '../engine/qte'
import { REST_STAGGER_MS, SLOTS, actionProgress, beatOf, fighterAction, slotOf } from './stageState'

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
    const resolved = step(state, { type: 'QTE_RESULT', outcome: runFor(getCard('mewing'), 'PERFECT'), now: t + 50 })

    const react = fighterAction(resolved, 0)
    expect(react.kind).toBe('react')
    if (react.kind === 'react') {
      expect(react.beat).toBe('PERFECT')
      // Anchored to the start of the resolve screen, not its end.
      expect(react.startedAt).toBe(t + 50)
    }
  })

  it('has the rival answer it rather than stand there', () => {
    const { state, t } = atQte('mewing')
    const resolved = step(state, { type: 'QTE_RESULT', outcome: runFor(getCard('mewing'), 'PERFECT'), now: t + 50 })

    const watching = fighterAction(resolved, 1)
    expect(watching.kind).toBe('watch')
    if (watching.kind === 'watch') {
      expect(watching.beat).toBe('PERFECT')
      expect(watching.startedAt).toBe(t + 50)
    }
  })

  it('slumps the player who ran the clock out', () => {
    const { s, t } = opened()
    let state = step(s, { type: 'READY', now: t })
    state = step(state, { type: 'TICK', now: t + DEFAULT_SETTINGS.chooseMs })

    const react = fighterAction(state, 0)
    expect(react.kind).toBe('react')
    if (react.kind === 'react') expect(react.beat).toBe('LOST_COMPOSURE')
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
    const resolved = step(state, { type: 'QTE_RESULT', outcome: runFor(getCard('mewing'), 'GOOD'), now: t + 50 })
    if (resolved.phase.kind !== 'resolve') throw new Error('expected a resolve')

    const react = fighterAction(resolved, 0)
    if (react.kind !== 'react') throw new Error('expected a reaction')
    expect(react.startedAt).toBe(resolved.phase.startedAt)
    // The score sheet has no clock of its own, so the reaction has to play out
    // and then settle rather than run to the end of a phase.
    expect(actionProgress(react, react.startedAt + react.durationMs * 4)).toBe(1)
  })
})

/**
 * What a turn is worth showing, which is not always the grade it was given: a
 * PERFECT that lights GOD AURA is a different moment from a PERFECT, and the
 * stage used to be told only the grade.
 */
describe('what a result is worth showing', () => {
  const result = (over: Partial<TurnResult> = {}): TurnResult => ({
    player: 0,
    cardId: 'mewing',
    judgement: 'PERFECT',
    freshness: 'FRESH',
    aura: 1000,
    impact: 1000,
    outcome: null,
    lines: [],
    perfectStreak: 0,
    momentumBefore: 0,
    momentumAfter: 0,
    godAuraBefore: false,
    godAuraAfter: false,
    ...over,
  })

  it('is the grade when nothing louder happened', () => {
    expect(beatOf(result())).toBe('PERFECT')
    expect(beatOf(result({ judgement: 'MISS' }))).toBe('MISS')
    expect(beatOf(result({ judgement: 'LOST_COMPOSURE' }))).toBe('LOST_COMPOSURE')
  })

  it('reads the loudest thing first', () => {
    const everything = {
      godAuraAfter: true,
      perfectStreak: 4,
      lines: [{ key: 'outaurad' as const, label: "OUTAURA'D", value: 0 }],
    }
    expect(beatOf(result(everything))).toBe('GOD_AURA')
    expect(beatOf(result({ ...everything, godAuraAfter: false }))).toBe('OUTAURA')
    expect(beatOf(result({ ...everything, godAuraAfter: false, lines: [] }))).toBe('STREAK')
  })

  /** Already alight is not the same moment as catching fire. */
  it('does not light a meter that was already lit', () => {
    expect(beatOf(result({ godAuraBefore: true, godAuraAfter: true }))).toBe('PERFECT')
  })

  it('needs a run rather than one of them for a streak', () => {
    expect(beatOf(result({ perfectStreak: 1 }))).toBe('PERFECT')
    expect(beatOf(result({ perfectStreak: 2 }))).toBe('STREAK')
  })
})

describe('two of them standing there', () => {
  /**
   * Idling is the same for both of them, because it is not something either is
   * doing — it is what the resting animation underneath is doing when nothing
   * has been asked. What keeps them out of step is where they stand, and the
   * stage passes that to the body rather than putting it in the action.
   */
  it('asks nothing of either fighter', () => {
    const { s } = opened()
    expect(fighterAction(s, 0)).toEqual({ kind: 'idle' })
    expect(fighterAction(s, 1)).toEqual({ kind: 'idle' })
    expect(REST_STAGGER_MS).toBeGreaterThan(0)
  })
})

/**
 * The shape of a turn, as a fighter lives it.
 *
 * Written down as a sequence because that is the thing that was wrong: every
 * one of these actions was correct on its own, and the body still ended up
 * holding whichever of them had run most recently. What makes the sequence
 * true is that nothing in it persists — see `clipForAction`, which loops the
 * ending and nothing else, and `clipPlayer.ts`, which keeps the resting
 * animation under every frame of all of it.
 */
describe('the shape of a turn', () => {
  const kindsOf = (state: MatchState) =>
    [0, 1].map((id) => fighterAction(state, id as 0 | 1).kind)

  it('walks the active fighter from idle, through the card, to the answer', () => {
    const { s, t } = opened()
    expect(kindsOf(s)).toEqual(['idle', 'idle'])

    let state = step(s, { type: 'READY', now: t })
    expect(kindsOf(state), 'choosing a card').toEqual(['idle', 'idle'])

    state = step(state, { type: 'SELECT_CARD', cardId: 'mewing', now: t })
    expect(kindsOf(state), 'the crouch before it').toEqual(['windUp', 'idle'])

    state = step(state, { type: 'TICK', now: t + INTRO_MS })
    expect(kindsOf(state), 'performing it').toEqual(['move', 'idle'])

    const outcome = runFor(getCard('mewing'), 'PERFECT')
    state = step(state, { type: 'QTE_RESULT', outcome, now: t + INTRO_MS + 50 })
    // One owns the result, the other answers it. Neither of them is the card.
    expect(kindsOf(state), 'and answering for it').toEqual(['react', 'watch'])
  })

  /**
   * The one exception, and the reason it is worth naming: an ending is the only
   * thing on screen that nothing follows, so it is the only thing allowed to
   * stay. Everything above hands the body back to the idle underneath.
   */
  it('leaves only the ending standing', () => {
    const { s } = opened()
    const ended: MatchState = {
      ...s,
      phase: { kind: 'matchEnd', winner: 0, reason: 'moves' },
    }
    expect(kindsOf(ended)).toEqual(['finale', 'finale'])
  })
})
