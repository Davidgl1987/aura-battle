import { QTE_RAMP } from '../../engine/balance'
import type { ControlParams, Judgement } from '../../engine/types'

/**
 * Where the zone sits, as offsets in [-1, 1] from the centre of the pad.
 *
 * Two sines at unrelated rates, each started at its own point by `variation`.
 * Without that shift every play of a card traced the identical path from the
 * identical spot, and the card stopped being a test of tracking after two
 * attempts. The axes are offset by the golden ratio so they never line up into
 * the same curve twice.
 */
export function zoneAt(
  elapsedMs: number,
  params: ControlParams,
  variation = 0,
): { x: number; y: number } {
  const t = (elapsedMs / 1000) * params.driftSpeed
  const shift = variation * Math.PI * 2
  return { x: Math.sin(t * 1.7 + shift), y: Math.sin(t * 2.3 + 1.1 + shift * 1.618) }
}

/**
 * Elapsed time, warped so the ring drifts faster the further into the card it
 * gets. The total distance covered is the same; it is front-loaded slow and
 * back-loaded quick, so the last quarter of a hold is the hard part.
 */
export function drifted(elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0) return elapsedMs
  const p = Math.min(1, elapsedMs / durationMs)
  // Integral of a linear ramp from 1 to QTE_RAMP, scaled back to real time.
  const warp = p + ((QTE_RAMP - 1) * p * p) / 2
  return warp * durationMs
}

/**
 * Peak speed of the zone, in px/s, on a pad whose short side is `size`. Both
 * axes travel the same square region: letting the tall axis use the full pad
 * height made the vertical drift twice as fast as the horizontal one.
 */
export function peakSpeed(params: ControlParams, size: number): number {
  const span = size / 2 - params.zoneRadius * size
  const vx = span * 1.7 * params.driftSpeed
  const vy = span * 2.3 * params.driftSpeed
  return Math.hypot(vx, vy)
}

/**
 * Share of the live window the finger stayed inside the zone. The window runs
 * from the touch that armed the QTE, so reaching for the ring costs nothing.
 */
export function holdRatio(heldMs: number, windowMs: number): number {
  if (windowMs <= 0) return 0
  return Math.min(1, Math.max(0, heldMs / windowMs))
}

export function gradeControl(heldMs: number, windowMs: number, params: ControlParams): Judgement {
  const ratio = holdRatio(heldMs, windowMs)
  if (ratio >= params.perfectRatio) return 'PERFECT'
  return ratio >= params.goodRatio ? 'GOOD' : 'MISS'
}
