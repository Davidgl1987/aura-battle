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
 * Scatters the numbers. Seeded from the play's `variation`, so the same card is
 * never the same puzzle twice but a battle still replays exactly.
 */
export function orderLayout(count: number, variation: number): Spot[] {
  let seed = Math.floor(variation * 0xffffffff) >>> 0 || 1
  const roll = () => {
    const next = nextRandom(seed)
    seed = next.seed
    return next.value
  }

  const spots: Spot[] = []
  for (let n = 1; n <= count; n++) {
    let best = { x: 0.5, y: 0.5 }
    let bestGap = -1

    // Rejection sampling with a ceiling: on a pad this size a clean spread is
    // not always there to be found, and the roomiest of a few tries will do.
    for (let tries = 0; tries < TRIES; tries++) {
      const x = MARGIN + roll() * (1 - MARGIN * 2)
      const y = MARGIN + roll() * (1 - MARGIN * 2)
      const gap = spots.reduce(
        (min, spot) => Math.min(min, Math.hypot(spot.x - x, spot.y - y)),
        Number.POSITIVE_INFINITY,
      )
      if (gap > bestGap) {
        best = { x, y }
        bestGap = gap
      }
      if (gap >= APART) break
    }
    spots.push({ n, x: best.x, y: best.y })
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
