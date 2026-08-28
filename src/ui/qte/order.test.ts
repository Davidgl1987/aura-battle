import { describe, expect, it } from 'vitest'
import type { OrderParams } from '../../engine/types'
import { gradeOrder, orderLayout } from './order'

const params: OrderParams = {
  kind: 'speed',
  game: 'order',
  count: 5,
  perfectMs: 2600,
  goodMs: 4200,
  mistakeMs: 500,
}

describe('scattering the numbers', () => {
  it('lays out one button per number, in order', () => {
    const spots = orderLayout(5, 0.42)
    expect(spots.map((s) => s.n)).toEqual([1, 2, 3, 4, 5])
  })

  it('keeps every button on the pad', () => {
    for (const variation of [0, 0.17, 0.5, 0.93, 0.999]) {
      for (const spot of orderLayout(5, variation)) {
        expect(spot.x).toBeGreaterThan(0.1)
        expect(spot.x).toBeLessThan(0.9)
        expect(spot.y).toBeGreaterThan(0.1)
        expect(spot.y).toBeLessThan(0.9)
      }
    }
  })

  it('keeps them far enough apart to be pressed separately', () => {
    const spots = orderLayout(5, 0.31)
    for (let i = 0; i < spots.length; i++) {
      for (let j = i + 1; j < spots.length; j++) {
        expect(Math.hypot(spots[i].x - spots[j].x, spots[i].y - spots[j].y)).toBeGreaterThan(0.16)
      }
    }
  })

  it('is a different puzzle each play, and the same one from the same seed', () => {
    expect(orderLayout(5, 0.2)).toEqual(orderLayout(5, 0.2))
    expect(orderLayout(5, 0.2)).not.toEqual(orderLayout(5, 0.8))
  })
})

describe('grading the order', () => {
  it('fails a card that was never finished, however fast it went', () => {
    expect(gradeOrder(false, 100, 0, params)).toBe('MISS')
  })

  it('rewards finding them quickly', () => {
    expect(gradeOrder(true, 2000, 0, params)).toBe('PERFECT')
    expect(gradeOrder(true, 3500, 0, params)).toBe('GOOD')
  })

  it('charges for pressing out of order rather than ending the card', () => {
    // Fast enough for a PERFECT, until the wrong presses are counted.
    expect(gradeOrder(true, 2400, 0, params)).toBe('PERFECT')
    expect(gradeOrder(true, 2400, 1, params)).toBe('GOOD')
    expect(gradeOrder(true, 2400, 4, params)).toBe('MISS')
  })
})
