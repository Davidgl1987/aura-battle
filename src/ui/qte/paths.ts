import type { Judgement, PathsParams } from '../../engine/types'
import { holdRatio } from './control'

/** Where each lane sits when it is not wandering, across a pad of [-1, 1]. */
const HOME = [-0.5, 0.5] as const

/**
 * The middle of a lane at a given distance along the track, across a pad that
 * runs from -1 on the left to 1 on the right.
 *
 * Two sines at unrelated rates so the bends never settle into a rhythm you can
 * learn, started at their own point by the play's `variation`. Each lane keeps
 * to its own half of the pad: the two thumbs never have to cross, which on a
 * phone is the difference between a test of coordination and one of hand size.
 */
export function laneCentre(
  distance: number,
  params: PathsParams,
  variation: number,
  lane: 0 | 1,
): number {
  const shift = variation * Math.PI * 2 + lane * 2.399
  const wind =
    Math.sin(distance * 1.7 + shift) * 0.65 + Math.sin(distance * 2.9 + shift * 1.618) * 0.35
  return HOME[lane] + params.wander * wind
}

/** Whether the marker is inside the corridor rather than off in the grass. */
export function onTrack(markerX: number, centre: number, params: PathsParams): boolean {
  return Math.abs(markerX - centre) <= params.laneWidth
}

/**
 * Whether both wheels are genuinely held: two ids, different from each other,
 * and both still on the glass.
 *
 * All three conditions have bitten. One finger cannot hold two wheels, and a
 * mouse reuses its id for every press, so the same id twice is one hand. And a
 * remembered id is not a held one — a `pointerup` that never arrives leaves a
 * grip that looks live for the rest of the card.
 */
export function bothHands(
  grip: readonly [number | null, number | null],
  live: (id: number) => boolean,
): boolean {
  const [left, right] = grip
  if (left === null || right === null || left === right) return false
  return live(left) && live(right)
}

/** How far a lane's marker is allowed to be steered: its own half of the pad. */
export function laneRange(lane: 0 | 1): [min: number, max: number] {
  return lane === 0 ? [-1, 0] : [0, 1]
}

/**
 * Only time with BOTH markers in their lane counts. One of two is half a job.
 *
 * `placed` is whether the player ever had both hands on the wheels at all. A
 * card played with one thumb is not a bad attempt at this one, it is a refusal
 * to attempt it, and the ratio alone would let a late grab still score.
 */
export function gradePaths(
  placed: boolean,
  bothHeldMs: number,
  windowMs: number,
  params: PathsParams,
): Judgement {
  if (!placed) return 'MISS'
  const ratio = holdRatio(bothHeldMs, windowMs)
  if (ratio >= params.perfectRatio) return 'PERFECT'
  return ratio >= params.goodRatio ? 'GOOD' : 'MISS'
}
