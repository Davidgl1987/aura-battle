import {
  CPU_GOOD_FLOOR,
  CPU_GOOD_SPAN,
  CPU_PERFECT_CEILING,
  CPU_THINK_MAX_MS,
  CPU_THINK_MIN_MS,
  MISS_SCALE,
  QTE_FORM_SWING,
  PERFECT_SCALE,
} from './balance'
import { getCard } from './cards'
import { EMPTY, opportunities, rampAt, record, runFor, settle, type Beat } from './qte'
import { outauraTarget } from './match'
import { nextRandom } from './rng'
import { freshnessOf, momentumDelta, scorePlay } from './scoring'
import type { Card, Freshness, Judgement, MatchState, QteOutcome } from './types'

/**
 * A rival is configuration, not code. Every weight runs 0..1 and defaults to
 * 0, so a rival declares only what defines it and there is not one branch
 * anywhere that names a specific opponent.
 *
 * The CPU plays by exactly the rules the player does — it picks from its own
 * hand, it is scored by `scorePlay`, it gains and loses momentum, it can be
 * OUTAURA'D and it can be MOGGED. The only thing it does not do is move a
 * thumb: `judgeQte` stands in for the minigame.
 */
export interface Strategy {
  /** Value on answering with a kind the rival did not just play. */
  prefersFresh: number
  /**
   * Value on the best play available *right now* — the expected bill for this
   * card given the freshness on the table, the streak in hand and whether god
   * aura is up. This is the "plays well" weight.
   */
  prefersHighAura: number
  /**
   * Appetite for hard cards for their own sake, whether or not they are the
   * best expected value. This is the "takes risks" weight, and it is a
   * different axis from `prefersHighAura` on purpose: a rival can be greedy
   * and careful, or reckless and bad at maths.
   */
  prefersDifficulty: number
  /** Weight on avoiding their own chance of fumbling the card. */
  prefersSafeCards: number
  /** Value on beating the rival's last score by enough to OUTAURA them. */
  chasesOutaura: number
  /** Value on the momentum a landed card would add, and on god aura. */
  chasesMomentum: number
  /** 0..1. Drives how often the QTE comes out PERFECT. */
  qteSkill: number
  /** 0..1. What is left after PERFECT leans to GOOD rather than to MISS. */
  consistency: number
  /** Noise on the choice, so a rival is a personality and not a script. */
  jitter: number
  /**
   * Chance of letting the choosing clock run out. Not a handicap bolted on —
   * it goes through LOST COMPOSURE like anyone else's freeze, momentum wiped
   * and the turn gone, which is why the Rookie reads as flustered rather than
   * as merely bad.
   */
  hesitates: number
}

export const NO_STRATEGY: Strategy = {
  prefersFresh: 0,
  prefersHighAura: 0,
  prefersDifficulty: 0,
  prefersSafeCards: 0,
  chasesOutaura: 0,
  chasesMomentum: 0,
  qteSkill: 0.5,
  consistency: 0.5,
  jitter: 0,
  hesitates: 0,
}

/** How good a hand a card is, before the weights get hold of it. */
const FRESH_VALUE: Record<Freshness, number> = { FRESH: 1, NEUTRAL: 0.35, STALE: 0 }

export interface Odds {
  perfect: number
  good: number
}

/**
 * A skill level's odds on one opportunity of a card. Hard cards have to
 * actually be hard or the bonus for landing one is free money, so a set of
 * odds describes a difficulty-2 card and the card bends it from there.
 *
 * `perfect` is the chance of a clean beat, `good` of a scrappy one; what is
 * left is a fumble. It lives here rather than in the simulator because the CPU
 * has to play to the odds the balance was measured with, or the difficulty
 * ladder is calibrated against a rival nobody meets.
 */
export function oddsFor(skill: Odds, card: Card): Odds {
  const perfect = Math.min(0.97, skill.perfect * PERFECT_SCALE[card.difficulty])
  const miss = Math.min(1 - perfect, (1 - skill.perfect - skill.good) * MISS_SCALE[card.difficulty])
  return { perfect, good: 1 - perfect - miss }
}

/**
 * How one beat goes for a rival, `i` opportunities into a card of `total`.
 *
 * The odds tighten as the card does. The widgets speed a gesture up over its
 * length by `rampAt`, so the CPU's chances have to close by the same curve —
 * otherwise the difficulty a player feels and the difficulty the ladder is
 * measured at are two different things.
 */
function beatFor(odds: Odds, i: number, total: number, roll: number, form: number): Beat {
  const ramp = rampAt(i, total)
  // Clean gets harder in proportion; fumbling gets likelier by the same curve.
  // Dividing both by the ramp made the back half of every card a coin toss.
  const clean = odds.perfect / ramp + form
  const missing = Math.min(0.9, (1 - odds.perfect - odds.good) * ramp)
  if (roll < clean) return 'clean'
  return roll < 1 - missing ? 'scrappy' : 'missed'
}

/** A strategy's baseline odds, before any card bends them. */
export function baseOdds(strategy: Strategy): Odds {
  const perfect = strategy.qteSkill * CPU_PERFECT_CEILING
  const good = (1 - perfect) * (CPU_GOOD_FLOOR + CPU_GOOD_SPAN * strategy.consistency)
  return { perfect, good }
}

export function cpuOdds(strategy: Strategy, card: Card): Odds {
  return oddsFor(baseOdds(strategy), card)
}

/**
 * A roll drawn from the match itself rather than from `Math.random()`, so a
 * solo battle replays exactly from its seed the way a local one does. `salt`
 * separates the decisions taken within one turn.
 */
export function cpuRoll(state: MatchState, salt: number): number {
  const mixed = (state.seed ^ Math.imul(state.turnIndex + 1, 2654435761) ^ Math.imul(salt + 1, 40503)) >>> 0
  return nextRandom(mixed).value
}

/**
 * Spreads a set of raw numbers over 0..1 so a weight means the same thing
 * whichever term it is multiplying. Cards that tie — every card in hand being
 * the same difficulty, say — all land in the middle and let the other terms
 * decide, which is the honest answer rather than an arbitrary winner.
 */
function normalise(values: number[]): number[] {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min
  return span <= 0 ? values.map(() => 0.5) : values.map((v) => (v - min) / span)
}

/** Everything one candidate card is worth to a rival, before weighting. */
interface Appraisal {
  card: Card
  fresh: number
  expectedAura: number
  difficulty: number
  momentum: number
  outaura: number
  missChance: number
}

function appraise(state: MatchState, strategy: Strategy, card: Card): Appraisal {
  const me = state.players[state.active]
  const freshness = freshnessOf(card, state.lastPlayed)
  const rivalLast = outauraTarget(state)?.last ?? 0
  const odds = cpuOdds(strategy, card)
  const missChance = Math.max(0, 1 - odds.perfect - odds.good)

  const play = (outcome: QteOutcome, streak: number) => ({
    card,
    outcome,
    freshness,
    godAura: me.godAura,
    streak,
    rivalLast,
  })

  const landed = play(runFor(card, 'PERFECT'), me.perfectStreak + 1)

  return {
    card,
    fresh: FRESH_VALUE[freshness],
    // The bill this card would actually produce, weighted by how likely each
    // grade is. Not `baseAura`: a huge card into a STALE answer with a miss
    // waiting on the end of it is not the best play on the table.
    expectedAura:
      odds.perfect * scorePlay(landed).total +
      odds.good * scorePlay(play(runFor(card, 'GOOD'), 0)).total +
      missChance * scorePlay(play(runFor(card, 'MISS'), 0)).total,
    difficulty: card.difficulty,
    momentum: momentumDelta(landed),
    // Asked of the scoring itself rather than recomputed, so what a rival
    // reaches for and what the game pays out can never drift apart.
    outaura: scorePlay(landed).lines.some((l) => l.key === 'outaurad') ? 1 : 0,
    missChance,
  }
}

/**
 * Which card the rival reaches for: a weighted sum over everything in hand,
 * best total wins. Deterministic given the match state, so the same battle
 * replays move for move.
 */
export function chooseCard(state: MatchState, strategy: Strategy): string {
  const hand = state.players[state.active].remaining
  if (hand.length <= 1) return hand[0]

  const cards = hand.map(getCard)
  const looks = cards.map((card) => appraise(state, strategy, card))

  const aura = normalise(looks.map((l) => l.expectedAura))
  const difficulty = normalise(looks.map((l) => l.difficulty))
  const momentum = normalise(looks.map((l) => l.momentum))
  const noise = cpuRoll(state, 0)

  let bestIndex = 0
  let bestScore = -Infinity
  for (let i = 0; i < looks.length; i++) {
    const look = looks[i]
    const score =
      strategy.prefersFresh * look.fresh +
      strategy.prefersHighAura * aura[i] +
      strategy.prefersDifficulty * difficulty[i] +
      strategy.chasesOutaura * look.outaura +
      strategy.chasesMomentum * momentum[i] -
      strategy.prefersSafeCards * look.missChance +
      // Shifted per card so the noise ranks the hand rather than nudging the
      // whole thing by the same amount, which would change nothing.
      strategy.jitter * ((noise + i * 0.6180339887) % 1)

    if (score > bestScore) {
      bestScore = score
      bestIndex = i
    }
  }

  return cards[bestIndex].id
}

/**
 * The rival's gesture, without a gesture. They never touch the glass, so the
 * run is played out opportunity by opportunity from their skill against this
 * specific card, and settled by exactly the ledger a human's thumbs feed.
 *
 * One roll is stretched across the whole card rather than drawn fresh per
 * beat: a rival is a hand on a given night, so their beats correlate the way a
 * person's do. A single roll per opportunity would have every rival regress to
 * their mean inside one card and nobody would ever have a bad run of it.
 */
export function performQte(strategy: Strategy, card: Card, roll: number): QteOutcome {
  const odds = cpuOdds(strategy, card)
  const total = opportunities(card)

  // How this particular card is going for them. Drawn once and applied to
  // every beat in it, so a run holds together the way a person's does.
  const form = (frac(roll * 31.7) - 0.5) * QTE_FORM_SWING

  let ledger = EMPTY
  for (let i = 0; i < total; i++) {
    // Decorrelated per beat, but anchored to the one roll for the card.
    const at = frac(roll * 997.13 + i * 0.6180339887)
    ledger = record(ledger, beatFor(odds, i, total, at, form))
  }
  return settle(card, ledger)
}

/** The grade alone, for anything that only needs to know how it went. */
export function judgeQte(strategy: Strategy, card: Card, roll: number): Judgement {
  return performQte(strategy, card, roll).judgement
}

const frac = (x: number) => x - Math.floor(x)

/**
 * How long a rival sits on a decision. Long enough to read as thought, short
 * enough that watching them play is not a punishment — and steadier the more
 * consistent they are, so the Rookie dithers and the Demon does not.
 */
export function thinkMs(strategy: Strategy, roll: number): number {
  const hurry = (strategy.qteSkill + strategy.consistency) / 2
  const span = CPU_THINK_MAX_MS - CPU_THINK_MIN_MS
  return Math.round(CPU_THINK_MIN_MS + span * (1 - hurry) * (0.55 + 0.45 * roll))
}
