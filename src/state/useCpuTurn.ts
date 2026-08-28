import { useEffect } from 'react'
import { CPU_READ_MS } from '../engine/balance'
import { getCard } from '../engine/cards'
import { chooseCard, cpuRoll, judgeQte, thinkMs, type Strategy } from '../engine/cpu'
import { performance, type Beat } from '../engine/perform'
import { getRival } from '../engine/rivals'
import type { Action, MatchState } from '../engine/types'
import { now, useGame } from './store'

/**
 * Plays the rival's turns. Everything here is a delay and a dispatch: the CPU
 * sends the same actions a thumb would, into the same reducer, so there is one
 * battle and not two.
 *
 * Deadlines are on the game clock rather than on wall time, which is what
 * makes pausing work — freeze `now()` and the rival stops mid-thought along
 * with the countdown and the particles.
 */

/** What the rival is about to do, and how long it waits before doing it. */
interface Plan {
  waitMs: number
  action: Action | null
}

/**
 * Nothing here reads the clock or the store; it is a pure reading of the match
 * against a strategy, so what a rival does next can be checked in a test.
 *
 * It takes the strategy rather than a rival id on purpose: the plan depends on
 * nine numbers and the match, and nothing else about who is holding them.
 */
export function cpuPlan(state: MatchState, strategy: Strategy): Plan | null {
  const phase = state.phase

  switch (phase.kind) {
    // No phone is changing hands, so there is nobody to wait for.
    case 'handoff':
      return state.players[phase.player].controller === 'cpu'
        ? { waitMs: 0, action: { type: 'READY', now: 0 } }
        : null

    case 'choosing': {
      if (state.players[state.active].controller !== 'cpu') return null
      const waitMs = thinkMs(strategy, cpuRoll(state, 2))
      // Freezing on the clock is a real outcome with a real cost, so a rival
      // that hesitates simply never answers and eats LOST COMPOSURE like
      // anyone else. Nothing special-cases it downstream.
      if (cpuRoll(state, 3) < strategy.hesitates) return { waitMs, action: null }
      return {
        waitMs,
        action: { type: 'SELECT_CARD', cardId: chooseCard(state, strategy), now: 0 },
      }
    }

    case 'qte': {
      if (state.players[state.active].controller !== 'cpu') return null
      const card = getCard(phase.cardId)
      // The whole gesture plays out before the grade lands. A rival that
      // resolved early would score off an animation the player never saw.
      return {
        waitMs: card.durationMs,
        action: {
          type: 'QTE_RESULT',
          judgement: judgeQte(strategy, card, cpuRoll(state, 1)),
          now: 0,
        },
      }
    }

    case 'resolve':
    case 'lostComposure':
      // The score sheet waits for a human. When it was the rival's turn there
      // is no human to wait for, so it reads itself and hands back.
      return state.players[phase.result.player].controller === 'cpu'
        ? { waitMs: CPU_READ_MS, action: { type: 'READY', now: 0 } }
        : null

    default:
      return null
  }
}

/**
 * The rival's attempt, beat by beat, for the console to play out while the
 * gesture runs. Derived rather than plumbed: `judgeQte` is pure and the rolls
 * come from the match, so asking the same question here gives the same answer
 * the plan will dispatch — no state to keep in step.
 */
export function cpuPerformance(state: MatchState, strategy: Strategy): Beat[] | null {
  if (state.phase.kind !== 'qte') return null
  if (state.players[state.active].controller !== 'cpu') return null

  const card = getCard(state.phase.cardId)
  return performance(card, judgeQte(strategy, card, cpuRoll(state, 1)), cpuRoll(state, 4))
}

export function useCpuTurn(): void {
  const mode = useGame((s) => s.mode)
  const opponentId = useGame((s) => s.opponentId)
  const dispatch = useGame((s) => s.dispatch)
  // These three name the decision point. Every phase a rival acts in is a
  // different kind, and the turn index moves on between turns, so the effect
  // re-runs exactly once per thing the rival has to decide.
  const phaseKind = useGame((s) => s.match.phase.kind)
  const active = useGame((s) => s.match.active)
  const turnIndex = useGame((s) => s.match.turnIndex)

  useEffect(() => {
    if (mode !== 'solo' || !opponentId) return

    const plan = cpuPlan(useGame.getState().match, getRival(opponentId).strategy)
    if (!plan) return

    const deadline = now() + plan.waitMs
    let raf = 0

    const tick = () => {
      if (now() < deadline) {
        raf = requestAnimationFrame(tick)
        return
      }
      // A pause, a rematch or a MISS on the reducer's own clock can have moved
      // the battle on while the rival was thinking; the plan is stale then.
      const { match, mode: liveMode } = useGame.getState()
      if (liveMode !== 'solo' || match.phase.kind !== phaseKind || match.turnIndex !== turnIndex) {
        return
      }
      if (plan.action) dispatch({ ...plan.action, now: now() })
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [mode, opponentId, dispatch, phaseKind, active, turnIndex])
}
