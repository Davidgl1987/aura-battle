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
 * Alternating cards want two thumbs: a second tap on the same pad is dead
 * input, which is what stops you from just drumming one finger.
 */
export function countsAsTap(zone: number, lastZone: number | null, alternating: boolean): boolean {
  return !alternating || lastZone === null || zone !== lastZone
}
