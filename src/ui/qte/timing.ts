import type { Judgement, TimingParams } from '../../engine/types'

/**
 * Pure timing maths, kept out of the component so it can be tested without a
 * DOM and reused by the speed and control widgets later.
 */

/**
 * A phase origin that parks the cursor at one end of the bar the moment the
 * card goes live, heading inward.
 *
 * An end is the furthest point on the bar from any zone, which makes it both
 * the longest run-up the card's own rhythm can offer — half a beat, so
 * `sweepMs / (2 × zones)` — and the only start that is never sitting on a
 * scorable target.
 *
 * It used to open dead centre, which on an odd number of zones is a zone: the
 * card began on top of a chance nobody could take, because the tap that starts
 * a sweep is the one tap it never grades. You were looking at a green zone
 * under the cursor and being told, silently, that it did not count.
 */
export function startPhase(startedAt: number, sweepMs: number, variation: number): number {
  // Left edge heading right, or right edge heading left. Both are boundaries
  // between trips, so the first zone of either is a whole fresh chance.
  return startEdge(variation) === 0 ? startedAt : startedAt - sweepMs
}

/**
 * Which end this play sets off from: 0 for the left, 1 for the right.
 *
 * The widget parks the cursor here while the card waits for a touch, so what
 * is drawn before the bar goes live is exactly where it goes live from and the
 * cursor never appears to jump.
 */
export function startEdge(variation: number): 0 | 1 {
  return variation < 0.5 ? 0 : 1
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


/**
 * A nanosecond of slack on each threshold.
 *
 * The cursor position comes out of a float clock, so a tap exactly on a window
 * edge measures as 49.999999999999936 on one side of a zone and
 * 50.000000000000064 on the other — the same tap, graded differently because
 * of the fifteenth decimal place. This makes the edge itself belong to the
 * better grade, on both sides, deterministically. It widens nothing a player
 * could ever land in.
 */
const EDGE_SLACK_MS = 1e-6

export function gradeHit(errorMs: number, params: TimingParams): Judgement {
  if (errorMs <= params.perfectMs + EDGE_SLACK_MS) return 'PERFECT'
  if (errorMs <= params.goodMs + EDGE_SLACK_MS) return 'GOOD'
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
 * `sweepMs / zones` however far along the bar it is, and a trip is one of those
 * beats — with its zone in the middle of it and a boundary either side, at the
 * two points furthest from any zone.
 *
 * That centring is the whole job. Rounding instead of flooring put the boundary
 * *on* the zone rather than between zones, which cut every window in half: the
 * approach to a zone belonged to one trip and the departure from it to the
 * next. Answer a zone on the way out and the entire approach to the following
 * one was already spent, so a tap dead on a green zone did nothing at all and
 * the screen looked like it had missed the touch.
 *
 * It is an index rather than a count so the widget can tell two taps in the
 * same trip apart from two taps in consecutive ones — a zone is answered once.
 */
export function zoneTripAt(t: number, startedAt: number, params: TimingParams): number {
  const zones = Math.max(1, params.zones)
  return Math.floor(((t - startedAt) / params.sweepMs) * zones)
}
