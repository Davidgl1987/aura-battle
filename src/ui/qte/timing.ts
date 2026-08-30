import type { Judgement, TimingParams } from '../../engine/types'

/**
 * Pure timing maths, kept out of the component so it can be tested without a
 * DOM and reused by the speed and control widgets later.
 */

/**
 * A phase origin that puts the cursor in the middle of the bar the moment the
 * card goes live, heading for one end or the other.
 *
 * It used to set off from an end, which meant the first thing every sweep asked
 * of you was to wait out half a stroke before anything could be hit. Starting
 * on the target costs nothing — the first tap is what arms the card and is
 * never graded — and it makes the opening of a sweep read as "here it comes"
 * rather than as dead time.
 */
export function startPhase(startedAt: number, sweepMs: number, variation: number): number {
  return startedAt - (variation < 0.5 ? 0.5 : 1.5) * sweepMs
}

/** Triangle wave: 0 → 1 → 0 across the bar, one crossing per `sweepMs`. */
export function cursorAt(t: number, startedAt: number, sweepMs: number, edge = 0): number {
  const span = 2 * sweepMs
  const shifted = t - startedAt + edge * sweepMs
  const p = (((shifted % span) + span) % span) / sweepMs
  return p <= 1 ? p : 2 - p
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
 * The bar is cut into `zones` equal slices and a zone goes in the middle of
 * each. That is the one arrangement where the cursor meets a target at a
 * constant beat — every `sweepMs / zones`, out and back alike — because the
 * turn at each end lands exactly half a gap past the last zone, which is the
 * same half gap it takes to reach the first one on the way back.
 *
 * Every other spacing stutters. Placing them on the joins between slices put
 * two zones on the thirds, which the cursor met at 266ms and then 534ms; from a
 * margin they went further out still, so it passed one, bounced off the end and
 * passed it again a quarter of a second later, then crawled the whole middle of
 * the bar with nothing to hit.
 */
export function zoneCentres(zones: number): number[] {
  const n = Math.max(1, zones)
  return Array.from({ length: n }, (_, i) => (2 * i + 1) / (2 * n))
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

/**
 * Which trip through a green zone a moment falls in, counting from the bar's
 * left edge.
 *
 * The unit a sweep is scored in: one chance per zone the cursor goes through.
 * Zones sit in the middle of equal slices, so the cursor reaches one every
 * `sweepMs / zones` however far along the bar it is, and a moment's index is
 * just how many of those beats have gone by.
 *
 * It is an index rather than a count so the widget can tell two taps in the
 * same trip apart from two taps in consecutive ones — a zone is answered once.
 */
export function zoneTripAt(t: number, startedAt: number, params: TimingParams): number {
  const zones = Math.max(1, params.zones)
  return Math.floor(((t - startedAt) / params.sweepMs) * zones + 0.5)
}
