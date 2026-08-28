import { describe, expect, it } from 'vitest'
import { CARDS } from '../../engine/cards'
import type { PathsParams } from '../../engine/types'
import { bothHands, gradePaths, laneCentre, laneRange, onTrack } from './paths'

const params = CARDS.find((c) => c.id === 'split-focus')!.qte as PathsParams
const hard = CARDS.find((c) => c.id === 'galaxy-brain')!.qte as PathsParams

describe('the two lanes', () => {
  it('keeps each lane in its own half of the pad', () => {
    for (const p of [params, hard]) {
      for (let d = 0; d < 20; d += 0.05) {
        expect(laneCentre(d, p, 0.3, 0)).toBeLessThan(0)
        expect(laneCentre(d, p, 0.3, 1)).toBeGreaterThan(0)
      }
    }
  })

  it('never winds the corridor off the edge of the pad', () => {
    for (const p of [params, hard]) {
      for (const lane of [0, 1] as const) {
        for (let d = 0; d < 20; d += 0.05) {
          const edge = Math.abs(laneCentre(d, p, 0.8, lane)) + p.laneWidth
          expect(edge).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it('actually bends, rather than running straight', () => {
    let lowest = Number.POSITIVE_INFINITY
    let highest = Number.NEGATIVE_INFINITY
    for (let d = 0; d < 20; d += 0.05) {
      const x = laneCentre(d, params, 0.2, 0)
      lowest = Math.min(lowest, x)
      highest = Math.max(highest, x)
    }
    expect(highest - lowest).toBeGreaterThan(params.laneWidth * 2)
  })

  it('does not let the two lanes wind in step with each other', () => {
    let apart = 0
    for (let d = 0; d < 20; d += 0.05) {
      const a = laneCentre(d, params, 0.5, 0) + 0.5
      const b = laneCentre(d, params, 0.5, 1) - 0.5
      if (Math.abs(a - b) > 0.12) apart += 1
    }
    expect(apart).toBeGreaterThan(150)
  })

  it('lays out a different track each play, and the same one from a seed', () => {
    expect(laneCentre(2, params, 0.4, 0)).toBe(laneCentre(2, params, 0.4, 0))
    expect(laneCentre(2, params, 0.4, 0)).not.toBe(laneCentre(2, params, 0.9, 0))
  })
})

describe('steering', () => {
  it('gives each thumb its own half to work in', () => {
    expect(laneRange(0)).toEqual([-1, 0])
    expect(laneRange(1)).toEqual([0, 1])
  })

  it('counts the marker in when it is inside the corridor', () => {
    const centre = -0.5
    expect(onTrack(centre, centre, params)).toBe(true)
    expect(onTrack(centre + params.laneWidth * 0.9, centre, params)).toBe(true)
    expect(onTrack(centre + params.laneWidth * 1.2, centre, params)).toBe(false)
  })

  it('leaves a corridor wide enough to hold a steady hand', () => {
    // The full sweep has to be reachable from inside one half of the pad.
    for (const p of [params, hard]) {
      expect(p.laneWidth).toBeGreaterThan(0.08)
      expect(p.wander + p.laneWidth).toBeLessThanOrEqual(0.5)
    }
  })
})

describe('both hands on the wheels', () => {
  const down = (...ids: number[]) => (id: number) => ids.includes(id)

  it('wants two wheels held', () => {
    expect(bothHands([1, 2], down(1, 2))).toBe(true)
    expect(bothHands([1, null], down(1))).toBe(false)
    expect(bothHands([null, null], down())).toBe(false)
  })

  it('will not take one finger as two', () => {
    // A mouse reuses its id for every press, and a thumb dragged across from
    // the other wheel would otherwise read as a second hand.
    expect(bothHands([3, 3], down(3))).toBe(false)
  })

  it('will not take a remembered pointer as a held one', () => {
    // The id is still on record, but that finger has left the glass.
    expect(bothHands([1, 2], down(1))).toBe(false)
    expect(bothHands([1, 2], down())).toBe(false)
  })
})

describe('grading two lanes', () => {
  it('scores the time both markers were in', () => {
    expect(gradePaths(true, 1000, 1000, params)).toBe('PERFECT')
    expect(gradePaths(true, 650, 1000, params)).toBe('GOOD')
    expect(gradePaths(true, 300, 1000, params)).toBe('MISS')
  })

  it('gives nothing for a card that never started', () => {
    expect(gradePaths(true, 0, 0, params)).toBe('MISS')
  })

  it('fails a card played one-handed, however well the one hand did', () => {
    // Both wheels were never held together, so there is nothing to grade —
    // a perfect-looking ratio from a single thumb is not an attempt.
    expect(gradePaths(false, 1000, 1000, params)).toBe('MISS')
    expect(gradePaths(false, 0, 1000, params)).toBe('MISS')
  })
})
