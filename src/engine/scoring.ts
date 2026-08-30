import {
  AURA_ROUNDING,
  BAR_CURVE,
  FRESH_AURA,
  GOD_AURA_BREAK,
  GOD_AURA_MULT,
  HARD_AURA,
  MISS_PENALTY,
  MOMENTUM_FRESH,
  MOMENTUM_HARD,
  MOMENTUM_JUDGE,
  MOMENTUM_MAX,
  MOMENTUM_STREAK_MAX,
  MOMENTUM_STREAK_STEP,
  MOGGED_THRESHOLD,
  OUTAURA_MOMENTUM,
  OUTAURA_RATIO,
  PERFECT_BONUS,
  STREAK_AURA_BASE,
  STREAK_AURA_MAX,
  STREAK_AURA_STEP,
  STREAK_MIN,
} from './balance'
import type {
  AuraBreakdown,
  AuraLine,
  Card,
  Freshness,
  Judgement,
  PlayedCard,
  QteOutcome,
} from './types'

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
  /** How the gesture actually went, start to finish. */
  outcome: QteOutcome
  freshness: Freshness
  godAura: boolean
  /** Consecutive PERFECTs, this play included. */
  streak: number
  /**
   * The impact of the rival's last landed play — what it was worth before
   * momentum, god aura or a bonus of its own. 0 if they have nothing standing.
   */
  rivalLast: number
}

/** Shorthand, since almost everything reads the grade rather than the ledger. */
export const judgementOf = (play: Play): Judgement => play.outcome.judgement

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
  const { card, outcome, freshness, streak, rivalLast, godAura } = play
  const judgement = outcome.judgement

  if (judgement === 'MISS') {
    const value = -round(card.baseAura * MISS_PENALTY)
    return { lines: [{ key: 'miss', label: 'MISS', value }], impact: 0, total: value }
  }

  // The base line is the execution itself: the card's worth times how much of
  // the gesture was landed. A run that finished at 95% is worth more than one
  // that scraped the threshold, which is what the old flat multiplier per grade
  // could not say.
  const lines: AuraLine[] = [{ key: 'base', label: judgement, value: round(outcome.score) }]

  if (judgement === 'PERFECT') {
    lines.push({ key: 'perfect', label: 'FLAWLESS', value: PERFECT_BONUS })
  }

  if (freshness === 'FRESH') lines.push({ key: 'fresh', label: 'FRESH MOVE', value: FRESH_AURA })

  // Only the tier the line is named after. `HARD_AURA` pays nothing below it,
  // but keying the line on the payout alone is how a NORMAL card came to show
  // a HARD MOVE bonus the moment that tier was given one.
  const hard = card.difficulty === 3 ? HARD_AURA[3] : 0
  if (hard > 0) lines.push({ key: 'hard', label: 'HARD MOVE', value: hard })

  const chain = streakAura(streak)
  if (chain > 0) {
    lines.push({ key: 'streak', label: `PERFECT STREAK ×${streak}`, value: chain })
  }

  /**
   * What the play is worth on its own, and the number OUTAURA'D is measured
   * both from and against. Deliberately everything the player did — execution,
   * freshness, difficulty, streak — and nothing they merely had: no momentum,
   * no god aura, and no bonus from having out-scored somebody last turn.
   *
   * Comparing finished totals was the old rule and it did not work. A rival on
   * fire had their play doubled for reasons that were not about the play, so
   * out-scoring them by half again was arithmetically out of reach.
   */
  const impact = lines.reduce((sum, line) => sum + line.value, 0)
  const outaurad = rivalLast > 0 && impact >= rivalLast * OUTAURA_RATIO
  if (outaurad) {
    // No aura: the play has already earned half again what theirs did, and
    // paying on top of that paid twice for the same thing. The reward is
    // momentum, applied in `applyMomentum`.
    lines.push({ key: 'outaurad', label: "OUTAURA'D", value: 0 })
  }

  if (!godAura) return { lines, impact, total: impact }

  // One multiplier, applied to the whole bill and shown as its own line, so
  // god aura reads as the payoff for the run rather than as hidden maths.
  const total = round(impact * GOD_AURA_MULT)
  lines.push({
    key: 'god',
    label: 'GOD AURA',
    value: total - impact,
    multiplier: GOD_AURA_MULT,
  })
  return { lines, impact, total }
}

/** Whether this play out-scored the rival's last one by enough. */
export function outaurad(play: Play): boolean {
  if (play.outcome.judgement === 'MISS' || play.rivalLast <= 0) return false
  return scorePlay(play).impact >= play.rivalLast * OUTAURA_RATIO
}

/**
 * Momentum has four sources so that no single habit owns the meter: execution,
 * variety, difficulty and streaks each pay a share. Repeating yourself is the
 * only thing that drains it outside of a MISS.
 */
export function momentumDelta(play: Play): number {
  const base = MOMENTUM_JUDGE[play.outcome.judgement]
  if (play.outcome.judgement === 'MISS') return base
  return (
    base +
    MOMENTUM_FRESH[play.freshness] +
    MOMENTUM_HARD[play.card.difficulty] +
    streakMomentum(play.streak) +
    // Out-scoring them is paid in momentum rather than in aura; see `scorePlay`.
    (outaurad(play) ? OUTAURA_MOMENTUM : 0)
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

  if (play.outcome.judgement === 'MISS' && on) {
    on = false
    next = Math.min(next, GOD_AURA_BREAK)
  }
  if (next >= MOMENTUM_MAX) on = true

  return { momentum: next, godAura: on }
}
