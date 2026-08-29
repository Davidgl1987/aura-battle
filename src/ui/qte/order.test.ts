import { describe, expect, it } from 'vitest'
import type { OrderParams } from '../../engine/types'
import { gradeOrder, nextSpot, orderLayout, orderRolls, spotFor, type Spot } from './order'

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

/**
 * The pad holds a rolling window, not the whole run: press the lowest number
 * and it goes, and the next one of the sequence appears somewhere else. Laid
 * out all at once, the pad emptied as you played and the last two numbers were
 * the only things left to look at.
 */
describe('a pad that refills itself', () => {
  it('puts each new number somewhere the others are not', () => {
    const roll = orderRolls(0.42)
    const down: Spot[] = []
    for (let n = 1; n <= 5; n++) down.push({ n, ...nextSpot(down, roll) })

    // Retire the first and bring on a sixth, the way the widget does.
    const left = down.filter((s) => s.n !== 1)
    const sixth = { n: 6, ...nextSpot(left, roll) }

    for (const spot of left) {
      expect(Math.hypot(spot.x - sixth.x, spot.y - sixth.y), `vs ${spot.n}`).toBeGreaterThan(0.1)
    }
  })

  it('keeps every number on the pad', () => {
    const roll = orderRolls(0.7)
    const down: Spot[] = []
    for (let n = 1; n <= 12; n++) {
      const spot = { n, ...nextSpot(down, roll) }
      expect(spot.x).toBeGreaterThanOrEqual(0)
      expect(spot.x).toBeLessThanOrEqual(1)
      expect(spot.y).toBeGreaterThanOrEqual(0)
      expect(spot.y).toBeLessThanOrEqual(1)
      down.push(spot)
    }
  })

  it('lays the same pad out twice from the same play', () => {
    const build = () => {
      const roll = orderRolls(0.31)
      const down: Spot[] = []
      for (let n = 1; n <= 8; n++) down.push({ n, ...nextSpot(down, roll) })
      return down
    }
    expect(build()).toEqual(build())
  })
})

describe('placing one number at a time', () => {
  it('puts the same number in the same place however often it is asked', () => {
    const down: Spot[] = [spotFor(1, [], 0.4), spotFor(2, [], 0.4)]
    // Not a running generator: the pad refills as it is played, and a shared
    // stream would move a number depending on how often React re-rendered.
    for (let i = 0; i < 5; i++) expect(spotFor(6, down, 0.4)).toEqual(spotFor(6, down, 0.4))
  })

  it('gives different numbers different places', () => {
    const places = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => spotFor(n, [], 0.4))
    const keys = new Set(places.map((s) => `${s.x.toFixed(4)},${s.y.toFixed(4)}`))
    expect(keys.size).toBe(places.length)
  })
})
