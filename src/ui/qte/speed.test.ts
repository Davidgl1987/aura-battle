import { describe, expect, it } from 'vitest'
import { getCard } from '../../engine/cards'
import type { SpeedParams } from '../../engine/types'
import { countsAsTap, goodThreshold, gradeSpeed } from './speed'

const mash = getCard('six-seven').qte as SpeedParams
const alternate = getCard('sturdy').qte as SpeedParams

describe('grading a mash', () => {
  it('is PERFECT at the target and beyond', () => {
    expect(gradeSpeed(mash.targetTaps, mash)).toBe('PERFECT')
    expect(gradeSpeed(mash.targetTaps + 5, mash)).toBe('PERFECT')
  })

  it('drops to GOOD short of the target and MISS well short', () => {
    expect(gradeSpeed(goodThreshold(mash), mash)).toBe('GOOD')
    expect(gradeSpeed(goodThreshold(mash) - 1, mash)).toBe('MISS')
    expect(gradeSpeed(0, mash)).toBe('MISS')
  })

  it('asks for more taps as difficulty goes up', () => {
    expect(alternate.targetTaps).toBeGreaterThan(mash.targetTaps)
  })
})

describe('alternating pads', () => {
  it('takes any tap when the card does not alternate', () => {
    expect(countsAsTap(0, 0, false)).toBe(true)
    expect(countsAsTap(1, 1, false)).toBe(true)
  })

  it('ignores a second tap on the same pad', () => {
    expect(countsAsTap(0, null, true)).toBe(true)
    expect(countsAsTap(1, 0, true)).toBe(true)
    expect(countsAsTap(0, 0, true)).toBe(false)
  })
})
