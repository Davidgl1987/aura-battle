import { describe, expect, it } from 'vitest'
import { SOLO_SETTINGS } from '../engine/balance'
import { getCard } from '../engine/cards'
import { beatsOf } from '../engine/perform'
import { judgeQte, cpuRoll } from '../engine/cpu'
import { createMatch, step } from '../engine/match'
import { RIVALS, getRival } from '../engine/rivals'
import type { MatchState, PlayerSetup } from '../engine/types'
import { cpuPerformance, cpuPlan } from './useCpuTurn'

const ROOKIE = RIVALS[0]
/** No hesitation, so a plan is always an action: the mechanics show through. */
const DEMON = RIVALS[RIVALS.length - 1]

function battle(rivalId = DEMON.id, seed = 42): MatchState {
  const rival = getRival(rivalId)
  const setups: [PlayerSetup, PlayerSetup] = [
    { name: 'YOU', characterId: 'blocky', deck: ['mewing', 'six-seven', 'lean', 'beat-drop', 'rizz-clap'] },
    {
      name: rival.name,
      characterId: rival.characterId,
      deck: [...rival.deck],
      controller: 'cpu',
      look: rival.look,
    },
  ]
  return step(createMatch(SOLO_SETTINGS, setups, seed), {
    type: 'START',
    now: 0,
    seed,
    settings: SOLO_SETTINGS,
    setups,
  })
}

/** Runs the match forward to the rival's turn to choose. */
function toRivalChoosing(state: MatchState): MatchState {
  let s = step(state, { type: 'READY', now: 0 })
  s = step(s, { type: 'SELECT_CARD', cardId: 'mewing', now: 0 })
  s = step(s, { type: 'TICK', now: 500 })
  s = step(s, { type: 'QTE_RESULT', judgement: 'GOOD', now: 1000 })
  return step(s, { type: 'READY', now: 1200 })
}

describe('what the rival does next', () => {
  it('leaves the human alone at every phase of their own turn', () => {
    const opening = battle()
    // The opening handoff is the player picking the phone up.
    expect(cpuPlan(opening, DEMON.strategy)).toBeNull()

    let s = step(opening, { type: 'READY', now: 0 })
    expect(cpuPlan(s, DEMON.strategy), 'choosing').toBeNull()

    s = step(s, { type: 'SELECT_CARD', cardId: 'mewing', now: 0 })
    s = step(s, { type: 'TICK', now: 500 })
    expect(cpuPlan(s, DEMON.strategy), 'qte').toBeNull()

    s = step(s, { type: 'QTE_RESULT', judgement: 'GOOD', now: 1000 })
    // The player's own score sheet waits for the player.
    expect(cpuPlan(s, DEMON.strategy), 'resolve').toBeNull()
  })

  it('picks a card out of its own hand after a pause', () => {
    const s = toRivalChoosing(battle())
    expect(s.phase.kind).toBe('choosing')
    expect(s.active).toBe(1)

    const plan = cpuPlan(s, DEMON.strategy)!
    expect(plan.action?.type).toBe('SELECT_CARD')
    expect(plan.waitMs).toBeGreaterThan(0)
    if (plan.action?.type !== 'SELECT_CARD') return
    expect(s.players[1].remaining).toContain(plan.action.cardId)
  })

  it('waits out the whole gesture before the grade lands', () => {
    let s = toRivalChoosing(battle())
    const plan = cpuPlan(s, DEMON.strategy)!
    if (plan.action?.type !== 'SELECT_CARD') throw new Error('expected a card')
    const cardId = plan.action.cardId

    s = step(s, { type: 'SELECT_CARD', cardId, now: 2000 })
    s = step(s, { type: 'TICK', now: 2500 })
    expect(s.phase.kind).toBe('qte')

    const qte = cpuPlan(s, DEMON.strategy)!
    expect(qte.action?.type).toBe('QTE_RESULT')
    // Long enough for the animation, and comfortably inside the window the
    // reducer would otherwise call a MISS on.
    expect(qte.waitMs).toBe(getCard(cardId).durationMs)
    if (s.phase.kind !== 'qte') return
    expect(qte.waitMs).toBeLessThan(s.phase.endsAt - s.phase.startedAt)
  })

  it('reads its own score sheet and hands back on its own', () => {
    let s = toRivalChoosing(battle())
    s = step(s, { type: 'SELECT_CARD', cardId: DEMON.deck[1], now: 2000 })
    s = step(s, { type: 'TICK', now: 2500 })
    s = step(s, { type: 'QTE_RESULT', judgement: 'GOOD', now: 3000 })

    expect(s.phase.kind).toBe('resolve')
    const plan = cpuPlan(s, DEMON.strategy)!
    expect(plan.action).toEqual({ type: 'READY', now: 0 })
    expect(plan.waitMs).toBeGreaterThan(0)
  })

  it('is the same plan every time it is asked', () => {
    const s = toRivalChoosing(battle())
    const first = cpuPlan(s, DEMON.strategy)
    for (let i = 0; i < 10; i++) expect(cpuPlan(s, DEMON.strategy)).toEqual(first)
  })

  /**
   * A rival that hesitates does not get a special exit: it plans no action at
   * all, and the reducer's own clock takes the turn off it the way it would
   * take it off anyone who sat there.
   */
  it('lets the clock run out when it hesitates, and pays for it like anyone else', () => {
    const s = toRivalChoosing(battle(ROOKIE.id))

    const nervous = cpuPlan(s, { ...ROOKIE.strategy, hesitates: 1 })!
    expect(nervous.action).toBeNull()
    expect(nervous.waitMs).toBeGreaterThan(0)

    // Same rival, same state, same seed: only the nerve is different.
    const steady = cpuPlan(s, { ...ROOKIE.strategy, hesitates: 0 })!
    expect(steady.action?.type).toBe('SELECT_CARD')

    // And nothing downstream knows it was a rival who froze.
    const frozen = step(s, { type: 'TICK', now: 1200 + SOLO_SETTINGS.chooseMs })
    expect(frozen.phase.kind).toBe('lostComposure')
    expect(frozen.players[1].momentum).toBe(0)
    expect(frozen.log[frozen.log.length - 1].judgement).toBe('LOST_COMPOSURE')
  })

  it('answers a handoff of its own the moment it arrives', () => {
    // Not reachable in solo today — the player always opens — but the rule is
    // "a CPU never waits for a phone", and it should hold wherever it lands.
    const s = battle()
    const cpuFirst: MatchState = {
      ...s,
      active: 1,
      phase: { kind: 'handoff', player: 1 },
    }
    const plan = cpuPlan(cpuFirst, DEMON.strategy)!
    expect(plan.waitMs).toBe(0)
    expect(plan.action).toEqual({ type: 'READY', now: 0 })
  })
})

describe('every rival can be driven', () => {
  it('only ever reaches for a card it is actually holding', () => {
    for (const rival of RIVALS) {
      let picked = 0
      // Across seeds, because a rival with nerves does not answer every turn
      // and one unlucky seed is not a broken rival.
      for (let seed = 1; seed <= 12; seed++) {
        const s = toRivalChoosing(battle(rival.id, seed))
        const plan = cpuPlan(s, rival.strategy)!
        expect(plan.waitMs, rival.name).toBeGreaterThan(0)
        if (plan.action?.type !== 'SELECT_CARD') continue
        expect(rival.deck, rival.name).toContain(plan.action.cardId)
        picked += 1
      }
      expect(picked, `${rival.name} answers at least sometimes`).toBeGreaterThan(6)
    }
  })
})

/**
 * A rival never touches the glass, so the console plays out the attempt for
 * them. The one thing that must never happen is the strip saying one thing
 * while the score says another.
 */
describe('watching the rival play', () => {
  it('has nothing to show while nobody is performing', () => {
    const opening = battle()
    expect(cpuPerformance(opening, DEMON.strategy)).toBeNull()
    expect(cpuPerformance(toRivalChoosing(opening), DEMON.strategy)).toBeNull()
  })

  it('shows nothing during the player\'s own gesture', () => {
    let s = step(battle(), { type: 'READY', now: 0 })
    s = step(s, { type: 'SELECT_CARD', cardId: 'mewing', now: 0 })
    s = step(s, { type: 'TICK', now: 500 })

    expect(s.phase.kind).toBe('qte')
    expect(s.active).toBe(0)
    // The player has a real QTE in their hands; they do not need a mime of one.
    expect(cpuPerformance(s, DEMON.strategy)).toBeNull()
  })

  it('gives the rival one beat per beat of the card they picked', () => {
    for (const rival of RIVALS) {
      for (let seed = 1; seed <= 8; seed++) {
        let s = toRivalChoosing(battle(rival.id, seed))
        const plan = cpuPlan(s, rival.strategy)!
        if (plan.action?.type !== 'SELECT_CARD') continue

        const card = getCard(plan.action.cardId)
        s = step(s, { type: 'SELECT_CARD', cardId: card.id, now: 2000 })
        s = step(s, { type: 'TICK', now: 2500 })

        const beats = cpuPerformance(s, rival.strategy)!
        expect(beats, `${rival.name} on ${card.name}`).toHaveLength(beatsOf(card))
      }
    }
  })

  it('never contradicts the grade the plan is about to dispatch', () => {
    for (const rival of RIVALS) {
      for (let seed = 1; seed <= 12; seed++) {
        let s = toRivalChoosing(battle(rival.id, seed))
        const plan = cpuPlan(s, rival.strategy)!
        if (plan.action?.type !== 'SELECT_CARD') continue

        const card = getCard(plan.action.cardId)
        s = step(s, { type: 'SELECT_CARD', cardId: card.id, now: 2000 })
        s = step(s, { type: 'TICK', now: 2500 })

        const beats = cpuPerformance(s, rival.strategy)!
        // The grade the QTE phase will actually resolve to.
        const judgement = judgeQte(rival.strategy, card, cpuRoll(s, 1))
        const label = `${rival.name} ${card.name} ${judgement}`

        if (judgement === 'PERFECT') expect(beats.every((b) => b === 'hit'), label).toBe(true)
        if (judgement === 'GOOD') expect(beats, label).not.toContain('slip')
        if (judgement === 'MISS') expect(beats, label).toContain('slip')
      }
    }
  })

  it('shows the same attempt every frame it is asked for', () => {
    let s = toRivalChoosing(battle())
    s = step(s, { type: 'SELECT_CARD', cardId: DEMON.deck[1], now: 2000 })
    s = step(s, { type: 'TICK', now: 2500 })

    const first = cpuPerformance(s, DEMON.strategy)
    for (let i = 0; i < 10; i++) expect(cpuPerformance(s, DEMON.strategy)).toEqual(first)
  })
})
