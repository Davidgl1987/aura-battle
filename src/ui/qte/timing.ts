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
 * The bar is cut into `zones + 1` equal stretches and a zone goes on every
 * join: one lands dead centre, two land on the thirds, three on the quarters.
 * The ends of the bar are as far from a zone as the middle of a gap is, so the
 * cursor meets targets at an even beat wherever it is.
 *
 * Spreading them from a margin instead pushed them outward — two zones sat at a
 * sixth and five sixths, right against the turns. The cursor passed one, bounced
 * off the end and passed it again a quarter of a second later, then crawled the
 * whole middle of the bar with nothing to hit: a stutter and a wait rather than
 * a rhythm, on the one card whose targets were all at an edge.
 */
export function zoneCentres(zones: number): number[] {
  return Array.from({ length: Math.max(1, zones) }, (_, i) => (i + 1) / (zones + 1))
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
 * Which pass of the bar a moment falls in, counting from the first.
 *
 * The unit a sweep is scored in. A pass is one chance however many zones sit on
 * it: a busy bar gives you more moments to commit in, not more to bank, and
 * once you have answered a pass the rest of it is yours to watch go by.
 */
export function passAt(t: number, startedAt: number, sweepMs: number): number {
  return Math.floor((t - startedAt) / sweepMs)
}
