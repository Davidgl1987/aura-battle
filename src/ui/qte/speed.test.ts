import { describe, expect, it } from 'vitest'
import { countsAsTap, gradePace } from './speed'

describe('walking the pads', () => {
  it('takes any tap when there is only one pad', () => {
    expect(countsAsTap(0, null, 1)).toBe(true)
    expect(countsAsTap(0, 0, 1)).toBe(true)
  })

  it('takes either pad to open, whatever the card', () => {
    for (const pads of [1, 2, 3]) {
      for (const zone of [0, 1, 2].slice(0, pads)) {
        expect(countsAsTap(zone, null, pads), `${pads} pads, zone ${zone}`).toBe(true)
      }
    }
  })

  it('alternates on two pads', () => {
    expect(countsAsTap(1, 0, 2)).toBe(true)
    expect(countsAsTap(0, 1, 2)).toBe(true)
    expect(countsAsTap(0, 0, 2)).toBe(false)
    expect(countsAsTap(1, 1, 2)).toBe(false)
  })

  /**
   * Left, middle, right, middle, left — the only path across three pads that
   * never repeats one and never skips one, which is what makes it a walk
   * rather than a second alternation.
   */
  it('walks three pads without repeating or skipping', () => {
    expect(countsAsTap(1, 0, 3)).toBe(true)
    expect(countsAsTap(2, 1, 3)).toBe(true)
    expect(countsAsTap(1, 2, 3)).toBe(true)
    expect(countsAsTap(0, 1, 3)).toBe(true)
    // Same pad twice, and the jump from one end to the other.
    expect(countsAsTap(1, 1, 3)).toBe(false)
    expect(countsAsTap(2, 0, 3)).toBe(false)
    expect(countsAsTap(0, 2, 3)).toBe(false)
  })

  it('accepts the walk it describes, all the way along and back', () => {
    const walk = [0, 1, 2, 1, 0, 1, 2, 1, 0]
    for (let i = 1; i < walk.length; i++) {
      expect(countsAsTap(walk[i], walk[i - 1], 3), `step ${i}`).toBe(true)
    }
  })
})

/**
 * The rule that broke: the gesture is a speed test, so getting ahead of the
 * pace is playing it well. Only falling behind may cost anything.
 */
describe('keeping the pace', () => {
  const window = 220

  it('counts an early tap as clean, however early', () => {
    for (const late of [-1, -50, -500, -5000]) {
      expect(gradePace(late, window), `${late}ms`).toBe('clean')
    }
    expect(gradePace(0, window)).toBe('clean')
  })

  it('lets a little lateness through as scrappy', () => {
    expect(gradePace(1, window)).toBe('scrappy')
    expect(gradePace(window, window)).toBe('scrappy')
  })

  it('only fumbles a tap that missed its deadline outright', () => {
    expect(gradePace(window + 1, window)).toBe('missed')
    expect(gradePace(9999, window)).toBe('missed')
  })
})
