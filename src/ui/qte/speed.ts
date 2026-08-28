import type { Judgement, SpeedParams } from '../../engine/types'

/** Falling short of the target still scores, down to this share of it. */
export const SPEED_GOOD_RATIO = 0.7

export function goodThreshold(params: SpeedParams): number {
  return Math.ceil(params.targetTaps * SPEED_GOOD_RATIO)
}

export function gradeSpeed(taps: number, params: SpeedParams): Judgement {
  if (taps >= params.targetTaps) return 'PERFECT'
  return taps >= goodThreshold(params) ? 'GOOD' : 'MISS'
}

/**
 * Alternating cards want two thumbs: a second tap on the same pad is dead
 * input, which is what stops you from just drumming one finger.
 */
export function countsAsTap(zone: number, lastZone: number | null, alternating: boolean): boolean {
  return !alternating || lastZone === null || zone !== lastZone
}
