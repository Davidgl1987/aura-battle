import type { Judgement, TimingParams } from '../../engine/types'

/**
 * Pure timing maths, kept out of the component so it can be tested without a
 * DOM and reused by the speed and control widgets later.
 */

/**
 * Which end the cursor sets off from. Both ends are equally far from the
 * target, so this costs nothing in fairness and stops the sweep from being the
 * same countdown every single time.
 */
export function startEdge(variation: number): number {
  return variation < 0.5 ? 0 : 1
}

/** Triangle wave: 0 → 1 → 0 across the bar, one crossing per `sweepMs`. */
export function cursorAt(t: number, startedAt: number, sweepMs: number, edge = 0): number {
  const span = 2 * sweepMs
  const shifted = t - startedAt + edge * sweepMs
  const p = (((shifted % span) + span) % span) / sweepMs
  return p <= 1 ? p : 2 - p
}

/**
 * Where in its stroke the cursor is: 0 to 2 across a there-and-back, so it
 * carries the direction as well as the position.
 */
export function strokeAt(t: number, startedAt: number, sweepMs: number, edge = 0): number {
  const span = 2 * sweepMs
  const shifted = t - startedAt + edge * sweepMs
  return (((shifted % span) + span) % span) / sweepMs
}

/**
 * A new phase origin that leaves the cursor exactly where it is, moving the
 * way it was, while the sweep changes speed.
 *
 * The bar speeds up after every hit, and without this the stroke restarted
 * from the tap — the cursor jumped to the middle and set off again, which read
 * as the card resetting under you. It sweeps side to side without pause now,
 * whether the tap landed or not; only the pace changes.
 */
export function rephase(
  t: number,
  startedAt: number,
  sweepMs: number,
  nextSweepMs: number,
  edge = 0,
): number {
  const stroke = strokeAt(t, startedAt, sweepMs, edge)
  return t + edge * nextSweepMs - stroke * nextSweepMs
}

/** How far the tap landed from the centre of the bar, in milliseconds. */
export function errorAt(t: number, startedAt: number, sweepMs: number, edge = 0): number {
  return Math.abs(cursorAt(t, startedAt, sweepMs, edge) - 0.5) * sweepMs
}

/**
 * How many times the cursor passes dead centre inside the card, at its opening
 * pace and before any of the speeding-up a landed tap brings.
 *
 * The conservative count on purpose: a card must offer comfortably more
 * crossings than `perfectAt` asks for, or a flawless run is not something the
 * card allows however well it is played. `timing.test.ts` holds every sweep
 * card to it, which is how a tuning pass that quietens the bar cannot quietly
 * make its own PERFECT unreachable.
 */
export function crossings(durationMs: number, params: TimingParams): number {
  return Math.floor(durationMs / params.sweepMs)
}

export function gradeHit(errorMs: number, params: TimingParams): Judgement {
  if (errorMs <= params.perfectMs) return 'PERFECT'
  if (errorMs <= params.goodMs) return 'GOOD'
  return 'MISS'
}

/** One bad tap sinks the card; anything short of all-perfect is a GOOD. */
export function combine(hits: Judgement[]): Judgement {
  if (hits.length === 0) return 'MISS'
  if (hits.includes('MISS')) return 'MISS'
  return hits.every((h) => h === 'PERFECT') ? 'PERFECT' : 'GOOD'
}
