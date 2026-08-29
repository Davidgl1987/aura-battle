import { nextRandom } from '../../engine/rng'
import type { Judgement, OrderParams } from '../../engine/types'

/** One numbered button, and where it sits on the pad. */
export interface Spot {
  /** 1-based. Also the order it has to be pressed in. */
  n: number
  /** Centre of the button, in [0, 1] across and down the pad. */
  x: number
  y: number
}

/** Keeps buttons off the edges and out of each other's way. */
const MARGIN = 0.14
const APART = 0.28
const TRIES = 24

/**
 * A place for one more number, as far from the ones already down as a few
 * tries can find. Rejection sampling with a ceiling: on a pad this size a
 * clean spread is not always there to be found, and the roomiest of a handful
 * of attempts will do.
 */
export function nextSpot(taken: readonly Spot[], roll: () => number): { x: number; y: number } {
  let best = { x: 0.5, y: 0.5 }
  let bestGap = -1

  for (let tries = 0; tries < TRIES; tries++) {
    const x = MARGIN + roll() * (1 - MARGIN * 2)
    const y = MARGIN + roll() * (1 - MARGIN * 2)
    const gap = taken.reduce(
      (min, spot) => Math.min(min, Math.hypot(spot.x - x, spot.y - y)),
      Number.POSITIVE_INFINITY,
    )
    if (gap > bestGap) {
      best = { x, y }
      bestGap = gap
    }
    if (gap >= APART) break
  }
  return best
}

/** A seeded roll, so the same play lays the pad out the same way twice. */
export function orderRolls(variation: number): () => number {
  let seed = Math.floor(variation * 0xffffffff) >>> 0 || 1
  return () => {
    const next = nextRandom(seed)
    seed = next.seed
    return next.value
  }
}

/**
 * Where number `n` goes, given what is already on the pad.
 *
 * Seeded from the play and the number itself rather than from a running
 * generator: the pad refills as it is played, and a shared mutable stream
 * would put a number in a different place depending on how many times the
 * component happened to render.
 */
export function spotFor(n: number, taken: readonly Spot[], variation: number): Spot {
  const roll = orderRolls((variation + n * 0.6180339887) % 1)
  return { n, ...nextSpot(taken, roll) }
}

/**
 * Scatters the numbers. Seeded from the play's `variation`, so the same card is
 * never the same puzzle twice but a battle still replays exactly.
 */
export function orderLayout(count: number, variation: number): Spot[] {
  const roll = orderRolls(variation)
  const spots: Spot[] = []
  for (let n = 1; n <= count; n++) {
    const { x, y } = nextSpot(spots, roll)
    spots.push({ n, x, y })
  }
  return spots
}

/**
 * A press out of order does not end the card — it costs time. Running out of
 * numbers to press is the only way to fail outright, which keeps a fumbled
 * start recoverable.
 */
export function gradeOrder(
  completed: boolean,
  elapsedMs: number,
  mistakes: number,
  params: OrderParams,
): Judgement {
  if (!completed) return 'MISS'
  const effective = elapsedMs + mistakes * params.mistakeMs
  if (effective <= params.perfectMs) return 'PERFECT'
  return effective <= params.goodMs ? 'GOOD' : 'MISS'
}
