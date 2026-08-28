import {
  AURA_ROUNDING,
  BAR_CURVE,
  FRESH_AURA,
  GOD_AURA_BREAK,
  GOD_AURA_MULT,
  HARD_AURA,
  JUDGE_MULT,
  MISS_PENALTY,
  MOMENTUM_FRESH,
  MOMENTUM_HARD,
  MOMENTUM_JUDGE,
  MOMENTUM_MAX,
  MOMENTUM_STREAK_MAX,
  MOMENTUM_STREAK_STEP,
  MOGGED_THRESHOLD,
  OUTAURA_BONUS,
  OUTAURA_RATIO,
  STREAK_AURA_BASE,
  STREAK_AURA_MAX,
  STREAK_AURA_STEP,
  STREAK_MIN,
} from './balance'
import type { AuraBreakdown, AuraLine, Card, Freshness, Judgement, PlayedCard } from './types'

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function round(aura: number): number {
  return Math.round(aura / AURA_ROUNDING) * AURA_ROUNDING
}

/**
 * Where the needle sits on the shared bar, from -1 (player 2 owns it) to 1.
 *
 * Deliberately not the raw ratio. A lead reads as domination long before it is
 * mathematically decisive, so the curve front-loads the swing: a quarter of the
 * winning gap already pushes the needle 45% of the way over. Reaching an end is
 * MOGGED, which means the bar is not a readout of the win condition — it is the
 * win condition, and watching it is how a player learns the rule.
 */
export function barPosition(balance: number): number {
  const share = clamp(balance / MOGGED_THRESHOLD, -1, 1)
  return Math.sign(share) * Math.abs(share) ** BAR_CURVE
}

/**
 * Everything one play is judged on. Gathered into a single object because aura
 * and momentum read the same facts and must never disagree about them.
 */
export interface Play {
  card: Card
  judgement: Judgement
  freshness: Freshness
  godAura: boolean
  /** Consecutive PERFECTs, this play included. */
  streak: number
  /** Aura the rival took with their last play; 0 if they did not score. */
  rivalLast: number
}

/**
 * Freshness is measured against the last card played in the match by either
 * player: a different kind is FRESH, the same kind NEUTRAL, the very same card
 * STALE.
 *
 * The opening move counts as FRESH. It has nothing to repeat, and scoring it
 * NEUTRAL handed the player who moved second a standing advantage — nine
 * points of win rate in a simulated mirror match, for nothing they did.
 */
export function freshnessOf(card: Card, lastPlayed: PlayedCard | null): Freshness {
  if (!lastPlayed) return 'FRESH'
  if (lastPlayed.cardId === card.id) return 'STALE'
  if (lastPlayed.kind === card.kind) return 'NEUTRAL'
  return 'FRESH'
}

/** A streak counts PERFECTs and nothing else: anything less breaks it. */
export function streakOf(previous: number, judgement: Judgement | 'LOST_COMPOSURE'): number {
  return judgement === 'PERFECT' ? previous + 1 : 0
}

function streakAura(streak: number): number {
  if (streak < STREAK_MIN) return 0
  return Math.min(STREAK_AURA_BASE + STREAK_AURA_STEP * (streak - STREAK_MIN), STREAK_AURA_MAX)
}

function streakMomentum(streak: number): number {
  if (streak < STREAK_MIN) return 0
  return Math.min(MOMENTUM_STREAK_STEP * (streak - STREAK_MIN + 1), MOMENTUM_STREAK_MAX)
}

/**
 * Aura won by a play, itemised. A MISS is a flat penalty and nothing else:
 * bonuses only ever amplify aura that was actually earned, never a loss.
 *
 * The lines are the score — the resolve screen adds up exactly what it shows,
 * so a huge number always comes with the reason it was huge.
 */
export function scorePlay(play: Play): AuraBreakdown {
  const { card, judgement, freshness, streak, rivalLast, godAura } = play

  if (judgement === 'MISS') {
    const value = -round(card.baseAura * MISS_PENALTY)
    return { lines: [{ key: 'miss', label: 'MISS', value }], total: value }
  }

  const lines: AuraLine[] = [
    { key: 'base', label: judgement, value: round(card.baseAura * JUDGE_MULT[judgement]) },
  ]

  if (freshness === 'FRESH') lines.push({ key: 'fresh', label: 'FRESH MOVE', value: FRESH_AURA })

  const hard = HARD_AURA[card.difficulty]
  if (hard > 0) lines.push({ key: 'hard', label: 'HARD MOVE', value: hard })

  const chain = streakAura(streak)
  if (chain > 0) {
    lines.push({ key: 'streak', label: `PERFECT STREAK ×${streak}`, value: chain })
  }

  // Beating the rival is measured against the bill so far, so the bonus is
  // earned by the play itself rather than by having beaten them last turn too.
  const earned = lines.reduce((sum, line) => sum + line.value, 0)
  if (rivalLast > 0 && earned >= rivalLast * OUTAURA_RATIO) {
    lines.push({ key: 'outaurad', label: "OUTAURA'D", value: OUTAURA_BONUS })
  }

  const subtotal = lines.reduce((sum, line) => sum + line.value, 0)
  if (!godAura) return { lines, total: subtotal }

  // One multiplier, applied to the whole bill and shown as its own line, so
  // god aura reads as the payoff for the run rather than as hidden maths.
  const total = round(subtotal * GOD_AURA_MULT)
  lines.push({
    key: 'god',
    label: 'GOD AURA',
    value: total - subtotal,
    multiplier: GOD_AURA_MULT,
  })
  return { lines, total }
}

/**
 * Momentum has four sources so that no single habit owns the meter: execution,
 * variety, difficulty and streaks each pay a share. Repeating yourself is the
 * only thing that drains it outside of a MISS.
 */
export function momentumDelta(play: Play): number {
  const base = MOMENTUM_JUDGE[play.judgement]
  if (play.judgement === 'MISS') return base
  return (
    base +
    MOMENTUM_FRESH[play.freshness] +
    MOMENTUM_HARD[play.card.difficulty] +
    streakMomentum(play.streak)
  )
}

/**
 * Applies a play to a player's momentum. Reaching the cap turns GOD AURA on;
 * a MISS while it is on breaks it and knocks momentum back down.
 */
export function applyMomentum(
  momentum: number,
  godAura: boolean,
  play: Play,
): { momentum: number; godAura: boolean } {
  let next = clamp(momentum + momentumDelta(play), 0, MOMENTUM_MAX)
  let on = godAura

  if (play.judgement === 'MISS' && on) {
    on = false
    next = Math.min(next, GOD_AURA_BREAK)
  }
  if (next >= MOMENTUM_MAX) on = true

  return { momentum: next, godAura: on }
}
