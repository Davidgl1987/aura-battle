import { describe, expect, it } from 'vitest'
import { getCard } from '../../engine/cards'
import type { TimingParams } from '../../engine/types'
import { combine, cursorAt, errorAt, gradeHit, startEdge } from './timing'

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
    expect(hard.hits).toBeGreaterThan(easy.hits)
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
