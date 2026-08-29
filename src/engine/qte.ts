import {
  QTE_OPPORTUNITIES_MAX,
  QTE_OPPORTUNITIES_MIN,
  QTE_BAR_SHARE,
  QTE_HOLD_CLEAN,
  QTE_MISTAKE_COST,
  QTE_OPEN_HEADROOM,
  QTE_RAMP,
  QTE_SCRAPPY_VALUE,
  QTE_TICK_MS,
} from './balance'
import type {
  Card,
  Difficulty,
  Judgement,
  LanesParams,
  QteOutcome,
  QtePacing,
  TimingParams,
} from './types'

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
/**
 * Whether the card offers a lesser target as well as the one you want.
 *
 * The sweep has amber around its green and the chart has a note caught off the
 * beat; everything else either lands or does not. It matters because taking the
 * lesser target is what puts a flawless run out of reach, so a gesture with no
 * lesser target can never lose one that way.
 */
export function scrapeable(card: Card): boolean {
  return card.qte.game === 'sweep' || card.qte.game === 'lanes'
}

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
/**
 * The bar a card asks you to clear, and what its run is measured against.
 *
 * Every gesture has one, counted or open. That is what makes them comparable:
 * doing what the card asked for is worth 1 whether the card asked for two
 * centres or nine alternations, and going past it is what the overshoot pays
 * for. Normalising the counted ones by every chance they held instead made
 * them worth barely half what the open ones were for the same hands.
 */
export function opportunities(card: Card): number {
  const params = card.qte
  switch (params.game) {
    case 'sweep':
    case 'mash':
    case 'order':
    case 'lanes':
      return params.goodAt
    case 'zone':
    case 'paths':
      // A hold has no beats of its own, so it is cut into stretches of roughly
      // a quarter second and the bar is most of them.
      return Math.max(1, Math.round(chancesIn(card) * CONTINUOUS_BAR[card.difficulty]))
  }
}

/**
 * Share of a hold that has to be held for the hold to count.
 *
 * Half rather than most of it, because a counted gesture cannot overshoot its
 * way out of trouble: it has the chances it has, so a bar set near the top
 * would mean anything short of flawless was a MISS.
 */
const CONTINUOUS_BAR: Record<Difficulty, number> = { 1: 0.6, 2: 0.5, 3: 0.4 }

/**
 * How many chances a card physically holds. The same as the bar for the open
 * gestures, which have no ceiling, and more than it for the rest.
 */
export function chancesIn(card: Card): number {
  const params = card.qte
  switch (params.game) {
    case 'lanes':
      return notesInside(card, params)
    case 'sweep':
      return crossings(card.durationMs, params)
    case 'zone':
    case 'paths':
      return Math.min(
        QTE_OPPORTUNITIES_MAX,
        Math.max(QTE_OPPORTUNITIES_MIN, Math.round(card.durationMs / QTE_TICK_MS)),
      )
    // A mash and a number pad have no ceiling of their own, so they take the
    // one every other gesture already has: the bar is the same share of what
    // the card holds here as it is on a chart or a hold. Set from the overshoot
    // instead, the bar sat at four fifths of the chances and the hardest of
    // them could not survive the single fumble a GOOD is allowed.
    case 'mash':
    case 'order':
      return Math.max(params.goodAt + QTE_OPEN_HEADROOM, Math.round(params.goodAt / QTE_BAR_SHARE))
  }
}

/**
 * How many of a chart's notes actually reach the line while the card is still
 * running. A chart used to be allowed to outlast its own animation, and the
 * notes past the end were charged to the player as dropped — a fumble on a
 * note that never arrived, which is not something anyone can be asked to fix.
 */
function notesInside(card: Card, params: LanesParams): number {
  let inside = 0
  for (let i = 0; i < params.notes; i++) {
    if (params.travelMs + i * params.gapMs + params.goodMs <= card.durationMs) inside += 1
  }
  return Math.max(1, inside)
}

/**
 * How long one stretch of a continuous gesture lasts. Derived from the count
 * rather than fixed, so a short card and a long one are cut into the same
 * number of pieces and neither is penalised for its length.
 */
export function tickLength(card: Card): number {
  return card.durationMs / chancesIn(card)
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
  /** Of those, the ones that were not merely scraped. */
  readonly clean: number
  readonly mistakes: number
  /** Sum of what each landed opportunity was worth. */
  readonly value: number
  /** Chances answered so far, however they went. */
  readonly taken: number
}

export const EMPTY: Ledger = { successes: 0, clean: 0, mistakes: 0, value: 0, taken: 0 }

export function record(ledger: Ledger, beat: Beat): Ledger {
  return {
    successes: ledger.successes + (beat === 'missed' ? 0 : 1),
    clean: ledger.clean + (beat === 'clean' ? 1 : 0),
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
 *
 * Measured against everything the card held, not against the bar. Against the
 * bar it needed a ceiling to stop a long gesture running away with the score,
 * and every card that could reach that ceiling sat on it — which took the
 * spread out of the scores and left the battles being decided by nothing.
 */
export function accuracyOf(ledger: Ledger, total: number): number {
  if (total <= 0) return 0
  const net = ledger.value - ledger.mistakes * QTE_MISTAKE_COST
  return Math.min(1, Math.max(0, net / total))
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

  // A counted gesture charges for chances that came and went — a note you let
  // go past is one you dropped. An open-ended one cannot: there is no number
  // it was supposed to reach and stop at, so falling short simply scores less.
  const held = chancesIn(card)
  const full = open ? ledger : ignored(ledger, held)
  // Against the whole card: a flawless run is worth 1 and a run that scraped
  // the bar is worth roughly the share of the card the bar represents.
  const accuracy = accuracyOf(full, held)

  // PERFECT is a clean run that was still going at the end.
  //
  // Clean means clean: a chance you scraped is not one you took well, and on
  // the sweep that is the whole point of the yellow — landing in it scores,
  // and it also ends any claim on a flawless run. Nothing is special-cased for
  // the sweep; every gesture is read the same way.
  //
  // And clearing the bar and stopping there is a GOOD however tidy it was: the
  // card was still offering chances and you did not take them. A counted
  // gesture gets this for free — `ignored` has already charged the ones that
  // went by — but an open one has to be asked outright, or "do the nine and
  // put the phone down" would be the best way to play it.
  const answered = full.taken >= held
  const perfectEligible = full.clean === full.taken && answered

  /**
   * The same shape either way, and it is worth saying plainly: PERFECT is not
   * a higher count than GOOD, it is a clean one.
   *
   * Clear the bar and you have scored. Clear it having never fumbled and you
   * have scored flawlessly. Fumble after clearing it and the flawless is gone
   * but the score is not — and fumble enough and you are dragged back under
   * the bar, because one bad cancels one good.
   */
  const cleared = full.value - full.mistakes * QTE_MISTAKE_COST >= total
  const judgement: Judgement = !cleared ? 'MISS' : perfectEligible ? 'PERFECT' : 'GOOD'

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
  const bar = opportunities(card)
  const held = chancesIn(card)
  const open = pacingOf(card) === 'open'
  const beats: Beat[] = []
  const add = (n: number, beat: Beat) => {
    for (let i = 0; i < n; i++) beats.push(beat)
  }

  if (judgement === 'PERFECT') {
    // Everything the card holds, cleanly — including an open one, which is
    // only flawless if it was still being played when the animation ended.
    add(held, 'clean')
  } else if (judgement === 'GOOD') {
    // Over the bar with one fumble in it, which is exactly what a GOOD is.
    // An open gesture buys the room by going further; a counted one has to
    // find it inside what it holds.
    add(open ? bar + 2 : held - 1, 'clean')
    add(1, 'missed')
  } else {
    add(open ? bar : held, 'missed')
  }

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
 *
 * Held or not, with no grade in between. `scrappy` is for a gesture that
 * offered you two targets and you took the lesser one — the amber on the sweep,
 * a note caught off the beat — and taking it is what puts a flawless run out of
 * reach. Half a second of hold is not a lesser target, it is less hold, and
 * grading it as a scrape would have made a flawless hold something no thumb
 * could produce.
 */
export function tickBeat(insideMs: number, tickMs = QTE_TICK_MS): Beat {
  const share = tickMs <= 0 ? 0 : insideMs / tickMs
  return share >= QTE_HOLD_CLEAN ? 'clean' : 'missed'
}

/**
 * How many times a sweep brings the cursor back through the middle. This is
 * what the card actually offers, which is more than the `goodAt` it asks for —
 * a bar that came past exactly as often as it needed to be hit would have no
 * room for a fumble, and made the sweeps the harshest cards in their tier for
 * no reason a player could see.
 */
export function crossings(durationMs: number, params: TimingParams): number {
  return Math.floor(durationMs / params.sweepMs)
}
