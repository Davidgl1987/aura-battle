import { describe, expect, it } from 'vitest'
import { countsAsTap, gradePace } from './speed'

describe('two thumbs, not one', () => {
  it('ignores a second tap on the same pad when the card alternates', () => {
    expect(countsAsTap(0, null, true)).toBe(true)
    expect(countsAsTap(1, 0, true)).toBe(true)
    expect(countsAsTap(0, 0, true)).toBe(false)
  })

  it('takes any tap on a card that does not alternate', () => {
    expect(countsAsTap(0, 0, false)).toBe(true)
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
