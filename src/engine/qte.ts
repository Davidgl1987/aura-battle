import {
  QTE_GOOD_RATIO,
  QTE_OPPORTUNITIES_MAX,
  QTE_OPPORTUNITIES_MIN,
  QTE_OVERSHOOT_MAX,
  QTE_MISTAKE_COST,
  QTE_RAMP,
  QTE_SCRAPPY_VALUE,
  QTE_TICK_MS,
} from './balance'
import type { Card, Judgement, QtePacing, QteOutcome } from './types'

/**
 * How a gesture is scored, for all six of them.
 *
 * The old rule was a verdict taken at one moment: a sweep asked for three taps
 * and one bad one sank the card, a mash asked for a number of taps and either
 * reached it or did not. That made a card a coin toss on its worst instant,
 * and it made the whole game easy — reaching a threshold once was the entire
 * test, and nothing after it counted.
 *
 * Now a gesture is a run. It lasts exactly as long as the animation, it never
 * ends early, and every opportunity inside it either pays or costs. What comes
 * out is a ledger the whole game can read.
 */

/** What one opportunity was worth. */
export type Beat = 'clean' | 'scrappy' | 'missed'

const VALUE: Record<Beat, number> = {
  clean: 1,
  // Landed, but not well. Enough to keep a run alive without making a scrappy
  // one worth the same as a clean one.
  scrappy: QTE_SCRAPPY_VALUE,
  missed: 0,
}

/**
 * How many chances a card offers. This is what stops a long animation from
 * out-earning a short one: every card's ledger is divided by its own number,
 * so a flawless Hyperpop and a flawless Mewing both come out at 1.
 *
 * The continuous gestures have no beats of their own, so they are sampled on a
 * fixed clock rather than per frame — a phone that drops to 30fps must not
 * score differently from one holding 60.
 */
/**
 * Whether a gesture has a fixed number of chances in it, or runs for as long
 * as you can keep it going.
 *
 * A chart has six notes and that is all it will ever have; a mash has as many
 * taps as your thumbs manage. The difference changes how a run is graded, so
 * it is asked once here rather than switched on twice further down.
 */
export function pacingOf(card: Card): QtePacing {
  switch (card.qte.game) {
    case 'sweep':
    case 'mash':
    case 'order':
      return 'open'
    default:
      return 'counted'
  }
}

/**
 * What a flawless run is measured against.
 *
 * For a counted gesture it is how many chances the card holds. For an
 * open-ended one it is `perfectAt` — the point at which a clean run has done
 * enough — and going past it is what the overshoot is for.
 */
export function opportunities(card: Card): number {
  const params = card.qte
  switch (params.game) {
    case 'sweep':
    case 'mash':
    case 'order':
      return params.perfectAt
    case 'lanes':
      return Math.min(QTE_OPPORTUNITIES_MAX, Math.max(QTE_OPPORTUNITIES_MIN, params.notes))
    case 'zone':
    case 'paths':
      // Continuous gestures have no beats of their own, so they are cut into
      // stretches of roughly a quarter second.
      return Math.min(
        QTE_OPPORTUNITIES_MAX,
        Math.max(QTE_OPPORTUNITIES_MIN, Math.round(card.durationMs / QTE_TICK_MS)),
      )
  }
}

/** What it takes to score at all on an open-ended gesture. */
export function goodAtOf(card: Card): number {
  const params = card.qte
  return 'goodAt' in params ? params.goodAt : 0
}

/**
 * How long one stretch of a continuous gesture lasts. Derived from the count
 * rather than fixed, so a short card and a long one are cut into the same
 * number of pieces and neither is penalised for its length.
 */
export function tickLength(card: Card): number {
  return card.durationMs / opportunities(card)
}

/**
 * How much harder the card has got by the `i`th of `total` opportunities, from
 * 1 at the start to `QTE_RAMP` at the end.
 *
 * One curve for every gesture, so the widgets and the CPU cannot drift apart
 * about how steep a card gets: a sweep multiplies its speed by this, a chart
 * divides its gap by it, and the CPU's odds bend by it. A run that starts
 * comfortable and ends flat out is what separates two players who would both
 * have cleared a single threshold.
 */
export function rampAt(i: number, total: number): number {
  if (total <= 1) return 1
  return 1 + (QTE_RAMP - 1) * (i / (total - 1))
}

/** A running tally of one gesture, fed an opportunity at a time. */
export interface Ledger {
  readonly successes: number
  readonly mistakes: number
  /** Sum of what each landed opportunity was worth. */
  readonly value: number
  /** Chances answered so far, however they went. */
  readonly taken: number
}

export const EMPTY: Ledger = { successes: 0, mistakes: 0, value: 0, taken: 0 }

export function record(ledger: Ledger, beat: Beat): Ledger {
  return {
    successes: ledger.successes + (beat === 'missed' ? 0 : 1),
    mistakes: ledger.mistakes + (beat === 'missed' ? 1 : 0),
    value: ledger.value + VALUE[beat],
    taken: ledger.taken + 1,
  }
}

/**
 * Chances that came and went without an answer. Ignoring the gesture has to
 * cost exactly what fumbling it costs, or standing still would be a way to
 * keep a clean sheet.
 */
export function ignored(ledger: Ledger, total: number): Ledger {
  const left = Math.max(0, total - ledger.taken)
  return left === 0 ? ledger : { ...ledger, mistakes: ledger.mistakes + left, taken: total }
}

/**
 * The share of what was on offer that was actually taken, after mistakes are
 * charged for. A mistake costs a whole opportunity, so enough of them drag a
 * run that had already cleared the bar back under it — which is the point: the
 * threshold is not a checkpoint you keep once you reach it.
 */
export function accuracyOf(ledger: Ledger, total: number, open = false): number {
  if (total <= 0) return 0
  const net = ledger.value - ledger.mistakes * QTE_MISTAKE_COST
  // An open-ended gesture keeps paying past the point it needed to reach, up
  // to a ceiling: doing more than enough is worth something, but not enough
  // for the gesture you were asked for to decide the score.
  return Math.min(open ? QTE_OVERSHOOT_MAX : 1, Math.max(0, net / total))
}

/**
 * Turns a finished ledger into the grade and the aura the play earned.
 *
 * There is one threshold, not two. PERFECT is a GOOD that never slipped, which
 * is why a single mistake shows on screen the moment it happens: it is not a
 * dent in the score, it is the whole of the difference between the two grades.
 */
export function settle(card: Card, ledger: Ledger): QteOutcome {
  const total = opportunities(card)
  const open = pacingOf(card) === 'open'

  // A counted gesture charges for chances that came and went. An open-ended
  // one cannot: there is no number it was supposed to reach and stop at, so
  // falling short simply scores less rather than counting as fumbles.
  const full = open ? ledger : ignored(ledger, total)
  const accuracy = accuracyOf(full, total, open)
  const perfectEligible = full.mistakes === 0

  const judgement: Judgement = open
    ? full.successes < goodAtOf(card)
      ? 'MISS'
      : perfectEligible && full.successes >= total
        ? 'PERFECT'
        : 'GOOD'
    : accuracy < QTE_GOOD_RATIO
      ? 'MISS'
      : perfectEligible
        ? 'PERFECT'
        : 'GOOD'

  return {
    judgement,
    // In aura rather than in ratio: the card's own worth times how much of the
    // gesture was actually landed, so a late GOOD is worth more than one that
    // scraped the threshold and a PERFECT is worth more than either.
    score: judgement === 'MISS' ? 0 : Math.round(card.baseAura * accuracy),
    perfectEligible,
    metrics: {
      successes: full.successes,
      mistakes: full.mistakes,
      accuracy,
    },
  }
}

/**
 * A representative run that lands on `judgement`. Not what any particular
 * player did — what a play of that grade typically looks like — for the CPU
 * weighing up a card it has not played yet, and for tests that care about the
 * grade rather than about the ledger behind it.
 */
export function runFor(card: Card, judgement: Judgement): QteOutcome {
  const total = opportunities(card)
  const beats: Beat[] =
    judgement === 'PERFECT'
      ? Array.from({ length: total }, () => 'clean')
      : judgement === 'GOOD'
        ? // Over the line with one fumble: exactly what a GOOD is.
          Array.from({ length: total }, (_, i) => (i === 0 ? 'missed' : 'clean'))
        : Array.from({ length: total }, (_, i) => (i % 3 === 0 ? 'scrappy' : 'missed'))

  return settle(card, beats.reduce(record, EMPTY))
}

/** A gesture nobody answered at all. */
export function unplayed(card: Card): QteOutcome {
  return settle(card, EMPTY)
}

/**
 * Whether a stretch of a continuous gesture counts as held.
 *
 * A tick is a quarter of a second and a dropped frame is sixteen milliseconds,
 * so an instantaneous reading would let one hitched frame cost a PERFECT. The
 * tick is judged on the share of itself that was spent inside.
 */
export function tickBeat(insideMs: number, tickMs = QTE_TICK_MS): Beat {
  const share = tickMs <= 0 ? 0 : insideMs / tickMs
  if (share >= 0.75) return 'clean'
  return share >= 0.4 ? 'scrappy' : 'missed'
}
