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

export { crossings } from '../../engine/qte'

/**
 * Where each green zone sits along the bar, as a share of its width.
 *
 * Spread evenly with a margin at both ends, so a zone is never so close to a
 * turn that the cursor is standing still inside it. One zone sits dead centre,
 * which is what a timing bar has always been; three make you read the bar
 * before you can aim at it.
 */
export function zoneCentres(zones: number): number[] {
  if (zones <= 1) return [0.5]
  const margin = 0.5 / (zones + 1)
  const span = 1 - 2 * margin
  return Array.from({ length: zones }, (_, i) => margin + (span * i) / (zones - 1))
}

/**
 * How far the tap was from the nearest zone, in milliseconds of cursor travel.
 *
 * Distance is measured along the bar and converted back to time, which is the
 * same thing the single-centre version measured — the cursor covers the bar at
 * a constant rate, so a share of the width is a share of the sweep.
 */
export function zoneErrorAt(
  t: number,
  startedAt: number,
  sweepMs: number,
  params: TimingParams,
  edge = 0,
): number {
  const x = cursorAt(t, startedAt, sweepMs, edge)
  const nearest = Math.min(...zoneCentres(params.zones).map((c) => Math.abs(x - c)))
  return nearest * sweepMs
}
