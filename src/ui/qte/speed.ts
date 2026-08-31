import type { Beat } from '../../engine/qte'

/**
 * How an alternation is graded. Only being late costs anything.
 *
 * Tap as fast as you like: the gesture is a six and a seven, one in each hand,
 * and going quicker is the whole point of it. What you cannot do is fall
 * behind, and each alternation has a deadline that tightens as the card runs.
 *
 * This was graded on the absolute distance from the beat for a while, which
 * meant playing it well — getting ahead of the pace — was scored as a fumble.
 */
export function gradePace(lateMs: number, windowMs: number): Beat {
  if (lateMs <= 0) return 'clean'
  return lateMs <= windowMs ? 'scrappy' : 'missed'
}

/**
 * Whether a tap on `zone` is the one the card was waiting for.
 *
 * One rule covers all three pad counts, because they are all the same gesture
 * at different widths: the next pad is a neighbour of the last one. On two pads
 * that is the alternation a six and a seven already was; on three it walks left,
 * middle, right, middle, left and back again, which is the only path that never
 * repeats a pad and never jumps one. On a single pad there is no neighbour to
 * find, so every tap counts.
 */
export function countsAsTap(zone: number, lastZone: number | null, pads: number): boolean {
  if (pads <= 1 || lastZone === null) return true
  return Math.abs(zone - lastZone) === 1
}

/**
 * What a pad is called: left, middle, right — or just the two hands, or the one
 * pad. Shared so the tutorial names them the way the card does.
 */
export function padLabel(zone: number, pads: number): string {
  return pads === 1 ? 'TAP' : pads === 2 ? (zone === 0 ? 'L' : 'R') : 'LMR'[zone]
}
