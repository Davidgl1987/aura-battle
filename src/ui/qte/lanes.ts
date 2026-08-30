import { nextRandom } from '../../engine/rng'
import type { Judgement, LanesParams } from '../../engine/types'

export interface Note {
  lane: number
  /** When it reaches the hit line, from the moment the QTE goes live. */
  atMs: number
}

/**
 * Share of the chart that has to come out PERFECT for the card to. Not all of
 * it: with six notes, demanding six perfects makes the grade `p^6`, which is
 * under a fifth of the time even for someone who lands 75% of single notes.
 * One note of slack is the difference between hard and not worth attempting.
 */
const PERFECT_SHARE = 0.8
/** Land this share of the chart at all and it is still a GOOD. */
const GOOD_SHARE = 0.6

/**
 * The chart, laid out from the play's `variation`. Notes are evenly spaced —
 * the test is reading which lane, not the rhythm — and never repeat a lane back
 * to back, because two in a row in one lane reads as a single long note.
 */
export function chart(params: LanesParams, variation: number): Note[] {
  let seed = Math.floor(variation * 0xffffffff) >>> 0 || 1
  const roll = () => {
    const next = nextRandom(seed)
    seed = next.seed
    return next.value
  }

  // The tail of the current run of short notes: whatever the roll started
  // carries on to the end of the pair before another is drawn.
  const run: number[] = []
  const notes: Note[] = []
  let last = -1
  let at = params.travelMs
  for (let i = 0; i < params.notes; i++) {
    let lane = Math.floor(roll() * params.lanes)
    if (lane === last) lane = (lane + 1 + Math.floor(roll() * (params.lanes - 1))) % params.lanes
    last = lane
    notes.push({ lane, atMs: at })
    at += params.gapMs / divisionAt(i, params, roll, run)
  }
  return notes
}

/**
 * How the gap after note `i` is divided: 1 for a quarter, 2 for an eighth, 4
 * for a sixteenth.
 *
 * A chart of nothing but quarters is a metronome, and reacting to a metronome
 * is the same job however fast it ticks. What makes this gesture harder is
 * reading a rhythm, so the tiers let shorter notes in rather than shortening
 * every note: the run of two eighths inside an otherwise steady bar is the bit
 * that catches you out.
 *
 * Shorter notes always come in pairs, because a lone half-length gap is a
 * stumble rather than a rhythm — and the first note of a chart is never one, so
 * the bar establishes its pulse before it starts playing with it.
 */
function divisionAt(
  i: number,
  params: LanesParams,
  roll: () => number,
  run: number[],
): number {
  if (params.subdivisions <= 1 || i === 0) return 1
  if (run.length > 0) return run.pop()!
  const r = roll()
  if (params.subdivisions >= 4 && r < 0.22) {
    run.push(4, 4)
    return 4
  }
  if (r < 0.55) {
    run.push(2)
    return 2
  }
  return 1
}

/**
 * Where a note is on its way in: 1 at the far edge, 0 on the hit line, negative
 * once it has gone past.
 */
export function noteProgress(note: Note, elapsedMs: number, travelMs: number): number {
  return (note.atMs - elapsedMs) / travelMs
}

/**
 * How long the whole chart can possibly run, so a card can be given room for
 * it. Every gap at its longest, which is the worst case a chart of quarters
 * hits — anything the roll shortens only finishes sooner.
 */
export function chartLength(params: LanesParams): number {
  return params.travelMs + (params.notes - 1) * params.gapMs + params.goodMs
}

/**
 * How long after a tap into an empty lane the next one is not charged again.
 *
 * One finger produces one mistake. A hand coming down across three lanes fires
 * three `pointerdown` events inside a few tens of milliseconds, and a bouncy
 * driver can send the same one twice — neither is three decisions, so neither
 * should be three mistakes.
 *
 * Kept under the shortest gap any chart asks for, which is a sixteenth at
 * 100ms. The guard can never swallow a hit — it only ever applies to a tap that
 * found nothing — but a player flailing through a run of sixteenths should be
 * charged for each one they swing at, not for every other one.
 */
export const EMPTY_GUARD_MS = 70

/** What a tap on a lane turned out to be. */
export type Strike =
  | { kind: 'hit'; note: number; grade: Judgement }
  /** Nothing was there. A real mistake, charged to the ledger. */
  | { kind: 'empty' }
  /** Nothing was there either, but the last empty tap is still being paid for. */
  | { kind: 'muffled' }

/**
 * What a tap on `lane` at `elapsedMs` does: the nearest unanswered note of that
 * lane if one is close enough to the line, and otherwise a swing at nothing.
 *
 * A swing at nothing used to cost nothing — it flashed, it played a sound, and
 * the ledger never heard about it. That made drumming on all three lanes
 * strictly better than reading the chart: every note got caught by somebody's
 * finger and the taps in between were free. Reading is only a skill if not
 * reading costs something.
 */
export function strikeAt(
  notes: Note[],
  settled: ReadonlyMap<number, Judgement>,
  lane: number,
  elapsedMs: number,
  params: LanesParams,
  lastChargedEmptyMs: number,
): Strike {
  let pick = -1
  let closest = Number.POSITIVE_INFINITY
  notes.forEach((note, i) => {
    if (note.lane !== lane || settled.has(i)) return
    const error = Math.abs(note.atMs - elapsedMs)
    if (error < closest) {
      closest = error
      pick = i
    }
  })

  if (pick >= 0 && closest <= params.goodMs) {
    return { kind: 'hit', note: pick, grade: gradeNote(closest, params) }
  }
  return elapsedMs - lastChargedEmptyMs < EMPTY_GUARD_MS ? { kind: 'muffled' } : { kind: 'empty' }
}

export function gradeNote(errorMs: number, params: LanesParams): Judgement {
  if (errorMs <= params.perfectMs) return 'PERFECT'
  return errorMs <= params.goodMs ? 'GOOD' : 'MISS'
}

/**
 * Notes are graded together rather than one bad one sinking the card. With
 * seven of them, all-or-nothing would make the whole card a coin toss on the
 * worst single moment of it.
 */
export function combineNotes(hits: Judgement[], total: number): Judgement {
  const perfect = hits.filter((h) => h === 'PERFECT').length
  const landed = hits.filter((h) => h !== 'MISS').length
  if (perfect >= Math.ceil(total * PERFECT_SHARE) && landed === total) return 'PERFECT'
  return landed >= Math.ceil(total * GOOD_SHARE) ? 'GOOD' : 'MISS'
}
