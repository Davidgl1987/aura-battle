import { describe, expect, it } from 'vitest'
import { CARDS, getCard } from '../../engine/cards'
import type { Card, ControlParams } from '../../engine/types'
import { gradeControl, holdRatio, peakSpeed, zoneAt } from './control'

const paramsOf = (card: Card) => card.qte as ControlParams
const easy = paramsOf(getCard('lean'))
const hard = paramsOf(getCard('levitate'))

// The kind now covers two minigames; this file is about the drifting zone.
const controlCards = CARDS.filter((c) => c.qte.game === 'zone')

/** The control pad's short side: it is 340 tall on a 375px phone. */
const PAD = 340

describe('the drifting zone', () => {
  it('stays on the pad', () => {
    for (let ms = 0; ms <= 4000; ms += 50) {
      const { x, y } = zoneAt(ms, hard)
      expect(Math.abs(x)).toBeLessThanOrEqual(1)
      expect(Math.abs(y)).toBeLessThanOrEqual(1)
    }
  })

  it('is deterministic: the same moment and variation is always the same spot', () => {
    expect(zoneAt(700, easy, 0.42)).toEqual(zoneAt(700, easy, 0.42))
  })

  it('stays on the pad whatever the variation', () => {
    for (let v = 0; v < 1; v += 0.05) {
      for (let ms = 0; ms <= 2000; ms += 50) {
        const { x, y } = zoneAt(ms, hard, v)
        expect(Math.abs(x)).toBeLessThanOrEqual(1)
        expect(Math.abs(y)).toBeLessThanOrEqual(1)
      }
    }
  })

  it('moves further in the same time when the card is harder', () => {
    const travel = (p: ControlParams) => {
      const a = zoneAt(0, p)
      const b = zoneAt(600, p)
      return Math.hypot(b.x - a.x, b.y - a.y)
    }
    expect(travel(hard)).toBeGreaterThan(travel(easy))
  })
})

describe('not being the same puzzle twice', () => {
  it('starts each play somewhere else', () => {
    const spots = [0, 0.2, 0.45, 0.7, 0.9].map((v) => {
      const { x, y } = zoneAt(0, hard, v)
      return `${x.toFixed(3)},${y.toFixed(3)}`
    })
    expect(new Set(spots).size).toBe(spots.length)
  })

  it('traces a different path, not the same one started later', () => {
    // Shifting both axes by the same amount would only delay the identical
    // curve — you would learn one path and wait for your bit of it.
    const sample = (variation: number, shiftMs = 0) =>
      Array.from({ length: 40 }, (_, i) => zoneAt(shiftMs + i * 45, hard, variation))
    const apart = (a: ReturnType<typeof sample>, b: ReturnType<typeof sample>) =>
      Math.max(...a.map((p, i) => Math.hypot(p.x - b[i].x, p.y - b[i].y)))

    const varied = sample(0.37)
    let closest = Infinity
    for (let shift = 0; shift < 5000; shift += 25) {
      closest = Math.min(closest, apart(sample(0, shift), varied))
    }
    expect(closest).toBeGreaterThan(0.15)
  })
})

describe('staying followable', () => {
  // A finger tracks roughly 200-300 px/s comfortably, and a fingertip covers
  // about 45px. These bounds are what stops the hard card going back to being
  // unplayable — it once drifted at 950 px/s behind a 50px target.
  it('never drifts faster than a finger can follow', () => {
    for (const card of controlCards) {
      expect(peakSpeed(paramsOf(card), PAD)).toBeLessThanOrEqual(350)
    }
  })

  it('never shrinks the ring below a fingertip', () => {
    for (const card of controlCards) {
      expect(paramsOf(card).zoneRadius * PAD * 2).toBeGreaterThanOrEqual(70)
    }
  })

  it('makes every HARD one faster and tighter than every NORMAL one', () => {
    // Across tiers, not card by card: two cards of the same tier are allowed
    // to differ from each other, and ranking them against one another only
    // asserted the order they happen to sit in the pool.
    const normal = controlCards.filter((c) => c.difficulty === 2)
    const hard = controlCards.filter((c) => c.difficulty === 3)
    expect(normal.length).toBeGreaterThan(0)
    expect(hard.length).toBeGreaterThan(0)

    for (const tough of hard) {
      for (const easier of normal) {
        expect(peakSpeed(paramsOf(tough), PAD)).toBeGreaterThan(peakSpeed(paramsOf(easier), PAD))
        expect(paramsOf(tough).zoneRadius).toBeLessThan(paramsOf(easier).zoneRadius)
      }
    }
  })
})

describe('the scored window', () => {
  it('is short enough to hold on to', () => {
    // The window runs from the touch that armed the QTE, so this is time spent
    // actually tracking — not time spent reaching for the glass.
    for (const card of controlCards) {
      expect(card.durationMs).toBeLessThanOrEqual(2100)
    }
  })

  it('is a flat PERFECT when you never slip after the touch', () => {
    for (const card of controlCards) {
      expect(gradeControl(card.durationMs, card.durationMs, paramsOf(card))).toBe('PERFECT')
    }
  })
})

describe('grading a hold', () => {
  const window = 1500

  it('is PERFECT when you barely ever slip', () => {
    expect(gradeControl(window * easy.perfectRatio, window, easy)).toBe('PERFECT')
    expect(gradeControl(window, window, easy)).toBe('PERFECT')
  })

  it('degrades to GOOD then MISS as the finger wanders', () => {
    expect(gradeControl(window * easy.goodRatio, window, easy)).toBe('GOOD')
    expect(gradeControl(window * (easy.goodRatio - 0.05), window, easy)).toBe('MISS')
    expect(gradeControl(0, window, easy)).toBe('MISS')
  })

  it('gives half a hold a score on every control card', () => {
    for (const card of controlCards) {
      expect(gradeControl(window * 0.55, window, paramsOf(card))).not.toBe('MISS')
    }
  })

  it('never reports more than a full hold', () => {
    expect(holdRatio(window * 2, window)).toBe(1)
    expect(holdRatio(-5, window)).toBe(0)
  })
})
