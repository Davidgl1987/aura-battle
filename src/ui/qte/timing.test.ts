import { describe, expect, it } from 'vitest'
import { getCard } from '../../engine/cards'
import type { TimingParams } from '../../engine/types'
import { CARDS } from '../../engine/cards'
import { combine, crossings, cursorAt, errorAt, gradeHit, rephase, startEdge } from './timing'

const params = getCard('mewing').qte as TimingParams

describe('cursor', () => {
  it('sweeps 0 → 1 → 0 and repeats', () => {
    const s = params.sweepMs
    expect(cursorAt(0, 0, s)).toBeCloseTo(0)
    expect(cursorAt(s / 2, 0, s)).toBeCloseTo(0.5)
    expect(cursorAt(s, 0, s)).toBeCloseTo(1)
    expect(cursorAt(s * 1.5, 0, s)).toBeCloseTo(0.5)
    expect(cursorAt(s * 2, 0, s)).toBeCloseTo(0)
    expect(cursorAt(s * 2.5, 0, s)).toBeCloseTo(cursorAt(s * 0.5, 0, s))
  })

  it('handles a tap timestamped just before the start', () => {
    expect(cursorAt(-10, 0, params.sweepMs)).toBeGreaterThanOrEqual(0)
    expect(cursorAt(-10, 0, params.sweepMs)).toBeLessThanOrEqual(1)
  })
})

describe('which end it sets off from', () => {
  const s = params.sweepMs

  it('picks an end from the play variation', () => {
    expect(startEdge(0.1)).toBe(0)
    expect(startEdge(0.9)).toBe(1)
  })

  it('runs the other way when it starts on the right', () => {
    expect(cursorAt(0, 0, s, 1)).toBeCloseTo(1)
    expect(cursorAt(s / 2, 0, s, 1)).toBeCloseTo(0.5)
    expect(cursorAt(s, 0, s, 1)).toBeCloseTo(0)
  })

  it('reaches dead centre at the same moment from either end', () => {
    expect(errorAt(s / 2, 0, s, 0)).toBeCloseTo(errorAt(s / 2, 0, s, 1))
  })
})

describe('grading', () => {
  const s = params.sweepMs

  it('is PERFECT dead centre and on both sides of the window', () => {
    // A millisecond inside the edge: the exact boundary is a float artefact,
    // not something a finger can aim at.
    const inside = params.perfectMs - 1
    expect(gradeHit(errorAt(s / 2, 0, s), params)).toBe('PERFECT')
    expect(gradeHit(errorAt(s / 2 - inside, 0, s), params)).toBe('PERFECT')
    expect(gradeHit(errorAt(s / 2 + inside, 0, s), params)).toBe('PERFECT')
  })

  it('degrades to GOOD then MISS as the tap drifts', () => {
    expect(gradeHit(errorAt(s / 2 + params.perfectMs + 1, 0, s), params)).toBe('GOOD')
    expect(gradeHit(errorAt(s / 2 + params.goodMs + 1, 0, s), params)).toBe('MISS')
    expect(gradeHit(errorAt(0, 0, s), params)).toBe('MISS')
  })

  it('grades the same on the way back as on the way out', () => {
    const out = errorAt(s / 2 - 30, 0, s)
    const back = errorAt(s * 1.5 + 30, 0, s)
    expect(out).toBeCloseTo(back)
  })

  it('gets harder as difficulty goes up', () => {
    const easy = getCard('mewing').qte as TimingParams
    const hard = getCard('griddy-drop').qte as TimingParams
    expect(hard.perfectMs).toBeLessThan(easy.perfectMs)
    expect(hard.sweepMs).toBeLessThan(easy.sweepMs)
    expect(hard.perfectAt).toBeGreaterThan(easy.perfectAt)
  })
})

describe('combining multi-tap cards', () => {
  it('needs every tap perfect to score PERFECT', () => {
    expect(combine(['PERFECT', 'PERFECT'])).toBe('PERFECT')
    expect(combine(['PERFECT', 'GOOD'])).toBe('GOOD')
    expect(combine(['PERFECT', 'MISS'])).toBe('MISS')
    expect(combine([])).toBe('MISS')
  })
})

/**
 * The bar speeds up after every hit and it must not restart doing it. The
 * cursor used to jump back to the tap and set off again, which read as the
 * card resetting under you rather than tightening.
 */
describe('changing pace mid-sweep', () => {
  const sweep = 900
  const faster = 600

  it('leaves the cursor exactly where it was', () => {
    for (const edge of [0, 1]) {
      for (const at of [0, 120, 450, 899, 1200, 1750]) {
        const t = 1000 + at
        const before = cursorAt(t, 1000, sweep, edge)
        const phase = rephase(t, 1000, sweep, faster, edge)
        expect(cursorAt(t, phase, faster, edge), `edge ${edge} at ${at}`).toBeCloseTo(before, 6)
      }
    }
  })

  it('leaves it going the way it was going', () => {
    for (const at of [200, 700, 1100, 1600]) {
      const t = 1000 + at
      const step = 1
      const wasRising = cursorAt(t + step, 1000, sweep) > cursorAt(t, 1000, sweep)

      const phase = rephase(t, 1000, sweep, faster)
      const isRising = cursorAt(t + step, phase, faster) > cursorAt(t, phase, faster)
      expect(isRising, `at ${at}`).toBe(wasRising)
    }
  })

  it('actually runs faster afterwards', () => {
    const t = 1300
    const phase = rephase(t, 1000, sweep, faster)
    const travel = (p: number, ms: number) =>
      Math.abs(cursorAt(t + 20, p, ms) - cursorAt(t, p, ms))
    expect(travel(phase, faster)).toBeGreaterThan(travel(1000, sweep))
  })

  it('keeps sweeping side to side rather than parking', () => {
    // A whole stroke of the faster sweep still reaches both ends.
    const phase = rephase(1300, 1000, sweep, faster)
    const seen = Array.from({ length: 200 }, (_, i) => cursorAt(1300 + i * 6, phase, faster))
    expect(Math.min(...seen)).toBeLessThan(0.05)
    expect(Math.max(...seen)).toBeGreaterThan(0.95)
  })
})

/**
 * A card cannot ask for more taps than the bar will offer. The sweep used to
 * demand six hits inside an animation the cursor only crossed the centre three
 * times in, which made a flawless run something the card refused to allow
 * however well it was played.
 */
describe('a bar that comes past often enough', () => {
  it('crosses the centre more often than a clean run needs', () => {
    for (const card of CARDS) {
      if (card.qte.game !== 'sweep') continue
      const passes = crossings(card.durationMs, card.qte)
      // Comfortably more, not exactly enough: at its opening pace, before any
      // of the speeding-up a landed tap brings.
      expect(passes, `${card.name} perfect`).toBeGreaterThan(card.qte.perfectAt)
      expect(passes, `${card.name} good`).toBeGreaterThan(card.qte.goodAt)
    }
  })

  it('asks for more to be flawless than it does to score', () => {
    for (const card of CARDS) {
      if (card.qte.game !== 'sweep') continue
      expect(card.qte.perfectAt, card.name).toBeGreaterThan(card.qte.goodAt)
    }
  })

  it('counts what the bar offers, not what it was asked for', () => {
    expect(crossings(1000, { ...params, sweepMs: 250 })).toBe(4)
    expect(crossings(1000, { ...params, sweepMs: 400 })).toBe(2)
  })
})
