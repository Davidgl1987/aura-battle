import { beforeEach, describe, expect, it } from 'vitest'
import { qteWindow } from '../engine/match'
import { met } from '../engine/objectives'
import { RIVALS } from '../engine/rivals'
import { battleStats } from '../engine/stats'
import type { Judgement, MatchState } from '../engine/types'
import { useGame } from './store'
import { cpuPlan } from './useCpuTurn'
import { bankedFor, hasCard, isRivalUnlocked, useProgress } from './useProgress'

/**
 * The whole solo loop, end to end: pick a rival, play the battle, bank what it
 * was worth, open the next one. This is the seam the unit tests do not cover —
 * `startBattle`, the reducer, `cpuPlan` and `claim` all wired together the way
 * the screen wires them.
 *
 * The rival's turns are driven by `cpuPlan` exactly as `useCpuTurn` drives
 * them, minus the waiting: the delay is a matter of pacing, not of rules.
 */

const [ROOKIE, KID] = RIVALS

/** Plays a battle out. `script` decides the human's grade, turn by turn. */
function playSolo(
  opponentId: string,
  script: (turn: number) => Judgement | 'FREEZE',
  seed = 1,
): MatchState {
  // Pinned: a battle replays exactly from its seed, and a test that leaves it
  // to `Math.random()` is a coin toss wearing an assertion.
  useGame.getState().startBattle({ mode: 'solo', opponentId, seed })

  const strategy = RIVALS.find((r) => r.id === opponentId)!.strategy
  let now = 0
  let humanTurns = 0

  for (let guard = 0; guard < 400; guard++) {
    const { match, dispatch } = useGame.getState()
    if (match.phase.kind === 'matchEnd') break

    const cpu = cpuPlan(match, strategy)
    if (cpu) {
      now += cpu.waitMs
      if (cpu.action) dispatch({ ...cpu.action, now })
      // A rival that hesitated planned nothing; the clock takes the turn.
      else dispatch({ type: 'TICK', now: now + match.settings.chooseMs })
      continue
    }

    switch (match.phase.kind) {
      case 'handoff':
        dispatch({ type: 'READY', now })
        break
      case 'choosing': {
        const grade = script(humanTurns++)
        if (grade === 'FREEZE') {
          dispatch({ type: 'TICK', now: now + match.settings.chooseMs })
          now += match.settings.chooseMs
          break
        }
        dispatch({ type: 'SELECT_CARD', cardId: match.players[0].remaining[0], now })
        break
      }
      case 'performIntro':
        now += 500
        dispatch({ type: 'TICK', now })
        break
      case 'qte': {
        const grade = script(humanTurns - 1)
        now += Math.min(600, qteWindow(match.phase.cardId) - 100)
        dispatch({ type: 'QTE_RESULT', judgement: grade as Judgement, now })
        break
      }
      default:
        now += 100
        dispatch({ type: 'READY', now })
    }
  }

  return useGame.getState().match
}

describe('a solo battle, start to finish', () => {
  beforeEach(() => {
    useGame.getState().toTitle()
    useProgress.getState().resetProgress()
  })

  it('runs to an ending with the rival taking its own turns', () => {
    const match = playSolo(ROOKIE.id, () => 'PERFECT')

    expect(match.phase.kind).toBe('matchEnd')
    // Both sides actually played: a rival that never moved would leave a log
    // with one name in it.
    expect(match.log.some((t) => t.player === 0)).toBe(true)
    expect(match.log.some((t) => t.player === 1)).toBe(true)
    // And the rival only ever played cards it brought.
    for (const turn of match.log.filter((t) => t.player === 1)) {
      if (turn.cardId) expect(ROOKIE.deck).toContain(turn.cardId)
    }
  })

  it('banks the receipt once, as the battle ends', () => {
    playSolo(ROOKIE.id, () => 'PERFECT')

    const { claimed, match } = useGame.getState()
    const stats = battleStats(match)
    expect(claimed).not.toBeNull()
    expect(claimed!.rivalId).toBe(ROOKIE.id)
    // The receipt has to agree with the battle it came from, objective by
    // objective, rather than being a second opinion about it.
    expect(claimed!.met).toEqual(met(ROOKIE.objectives, stats, 0))
    expect(claimed!.met[0]).toBe(stats.winner === 0)
    // Nothing was banked before this battle, so everything met paid out.
    expect(claimed!.fresh).toEqual(claimed!.met)

    // Dispatching into a finished match must not pay twice.
    const before = useProgress.getState().coins
    const banked = useProgress.getState().unlockedCards.length
    useGame.getState().dispatch({ type: 'READY', now: 99_999 })
    useGame.getState().dispatch({ type: 'TICK', now: 99_999 })
    expect(useProgress.getState().coins).toBe(before)
    expect(useProgress.getState().unlockedCards).toHaveLength(banked)
  })

  it('pays the card, opens the next rival, and leaves the rest to be earned', () => {
    playSolo(ROOKIE.id, () => 'PERFECT')
    const { claimed } = useGame.getState()

    expect(claimed!.met[0], 'a clean run beats the Rookie').toBe(true)
    expect(hasCard(useProgress.getState(), ROOKIE.signatureCardId)).toBe(true)
    expect(isRivalUnlocked(useProgress.getState(), KID.id)).toBe(true)

    // Whatever else landed, it landed because it was met — never because the
    // battle was won.
    const banked = bankedFor(useProgress.getState(), ROOKIE.id)
    expect(banked).toEqual(claimed!.met)
  })

  it('opens nothing when the battle is lost, and keeps what was earned anyway', () => {
    // Every card fumbled: the Rookie wins on aura even playing badly.
    playSolo(ROOKIE.id, () => 'MISS')
    const { claimed } = useGame.getState()

    expect(claimed!.met[0]).toBe(false)
    expect(isRivalUnlocked(useProgress.getState(), KID.id)).toBe(false)
    expect(hasCard(useProgress.getState(), ROOKIE.signatureCardId)).toBe(false)
  })

  it('starts a rematch clean, and re-pays nothing', () => {
    playSolo(ROOKIE.id, () => 'PERFECT')
    const coins = useProgress.getState().coins
    const cards = useProgress.getState().unlockedCards.length

    useGame.getState().rematch()
    expect(useGame.getState().claimed).toBeNull()
    expect(useGame.getState().match.log).toHaveLength(0)
    expect(useGame.getState().opponentId).toBe(ROOKIE.id)

    playSolo(ROOKIE.id, () => 'PERFECT')
    expect(useProgress.getState().coins).toBe(coins)
    expect(useProgress.getState().unlockedCards).toHaveLength(cards)
    expect(useGame.getState().claimed!.fresh).toEqual([false, false, false])
    expect(useGame.getState().claimed!.banked).toEqual([true, true, true])
  })

  /**
   * A flawless run is not a guaranteed win, and it should not be: measured
   * across sixty seeds, playing every card PERFECT beats the first four rivals
   * every time, the Gambler nine times in ten and the Aura Demon two in three.
   * The Demon can catch fire and out-score a clean sheet, which is the whole
   * point of a boss. So the ladder is climbable, not walked.
   */
  it('lets the whole ladder be climbed, given a few attempts at the top', () => {
    for (const rival of RIVALS) {
      expect(isRivalUnlocked(useProgress.getState(), rival.id), rival.name).toBe(true)

      let attempts = 0
      while (!bankedFor(useProgress.getState(), rival.id)[0]) {
        attempts += 1
        expect(attempts, `${rival.name} took more than five clean runs`).toBeLessThanOrEqual(5)
        playSolo(rival.id, () => 'PERFECT', attempts)
      }
      expect(hasCard(useProgress.getState(), rival.signatureCardId), rival.name).toBe(true)
    }
    expect(useProgress.getState().unlockedCards).toHaveLength(15)
  })

  it('does not hand the last rival over to a clean sheet alone', () => {
    // The flip side of the same measurement: if a perfect run always won, the
    // Aura Demon would be a formality with a long name.
    const demon = RIVALS[RIVALS.length - 1]
    const wins = [1, 2, 3, 4, 5, 6, 7, 8].filter((seed) => {
      useProgress.getState().resetProgress()
      const match = playSolo(demon.id, () => 'PERFECT', seed)
      return match.phase.kind === 'matchEnd' && match.phase.winner === 0
    }).length

    expect(wins, 'beatable').toBeGreaterThan(2)
    expect(wins, 'not a formality').toBeLessThan(8)
  })

  it('never asks a rival to play a QTE, and never leaves one waiting', () => {
    // The two things a CPU must not do: hold a widget, or expect a thumb.
    useGame.getState().startBattle({ mode: 'solo', opponentId: KID.id })
    const seen = new Set<string>()
    let now = 0

    for (let guard = 0; guard < 200; guard++) {
      const { match, dispatch } = useGame.getState()
      if (match.phase.kind === 'matchEnd') break

      const rivalUp = match.players[match.active].controller === 'cpu'
      if (rivalUp) seen.add(match.phase.kind)

      const plan = cpuPlan(match, KID.strategy)
      if (plan) {
        now += plan.waitMs
        if (plan.action) dispatch({ ...plan.action, now })
        else dispatch({ type: 'TICK', now: now + match.settings.chooseMs })
        continue
      }
      // The human's side, played straight through.
      switch (match.phase.kind) {
        case 'choosing':
          dispatch({ type: 'SELECT_CARD', cardId: match.players[0].remaining[0], now })
          break
        case 'performIntro':
          dispatch({ type: 'TICK', now: (now += 500) })
          break
        case 'qte':
          dispatch({ type: 'QTE_RESULT', judgement: 'GOOD', now: (now += 600) })
          break
        default:
          dispatch({ type: 'READY', now: (now += 100) })
      }
    }

    // The rival went through choosing and performing like anyone else…
    expect(seen).toContain('choosing')
    expect(seen).toContain('qte')
    // …and the battle finished, so nothing ever sat waiting for a tap.
    expect(useGame.getState().match.phase.kind).toBe('matchEnd')
  })
})
