import { describe, expect, it } from 'vitest'
import { getCard } from '../../engine/cards'
import type { TimingParams } from '../../engine/types'
import { CARDS } from '../../engine/cards'
import {
  combine,
  crossings,
  cursorAt,
  errorAt,
  gradeHit,
  zoneTripAt,
  startPhase,
  zoneCentres,
  zoneErrorAt,
} from './timing'

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

/**
 * The bar opens on its target rather than at an end. Setting off from an edge
 * meant the first thing every sweep asked of you was to sit out half a stroke.
 */
describe('where it sets off from', () => {
  const s = params.sweepMs

  it('puts the cursor in the middle at the moment it goes live', () => {
    for (const variation of [0, 0.2, 0.49, 0.5, 0.8, 0.99]) {
      expect(cursorAt(1000, startPhase(1000, s, variation), s), `v${variation}`).toBeCloseTo(0.5)
    }
  })

  it('sets off toward one end or the other, by the play', () => {
    const rising = cursorAt(1010, startPhase(1000, s, 0.2), s) > 0.5
    const falling = cursorAt(1010, startPhase(1000, s, 0.8), s) < 0.5
    expect(rising).toBe(true)
    expect(falling).toBe(true)
  })

  it('reaches both ends whichever way it left', () => {
    for (const variation of [0.2, 0.8]) {
      const phase = startPhase(1000, s, variation)
      const seen = Array.from({ length: 240 }, (_, i) => cursorAt(1000 + i * 10, phase, s))
      expect(Math.min(...seen), `v${variation}`).toBeLessThan(0.05)
      expect(Math.max(...seen), `v${variation}`).toBeGreaterThan(0.95)
    }
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

  /**
   * The tier is what the bar asks of you, not how fast it moves. Every sweep
   * runs at the same pace: a hard card puts more targets on the bar and makes
   * each one narrower.
   */
  it('gets harder by asking more, not by going faster', () => {
    const easy = getCard('mewing').qte as TimingParams
    const mid = getCard('sigma-stare').qte as TimingParams
    const hard = getCard('griddy-drop').qte as TimingParams

    expect(hard.perfectMs).toBeLessThan(mid.perfectMs)
    expect(mid.perfectMs).toBeLessThan(easy.perfectMs)
    expect(hard.zones).toBeGreaterThan(mid.zones)
    expect(mid.zones).toBeGreaterThan(easy.zones)
    expect(mid.sweepMs).toBe(easy.sweepMs)
    expect(hard.sweepMs).toBe(easy.sweepMs)
  })

  it('keeps the amber a border on the green rather than a target of its own', () => {
    for (const card of CARDS) {
      if (card.qte.game !== 'sweep') continue
      const amber = card.qte.goodMs - card.qte.perfectMs
      expect(amber, `${card.name} has amber`).toBeGreaterThan(0)
      expect(amber, `${card.name} amber is the smaller band`).toBeLessThan(card.qte.perfectMs)
    }
  })

  it('spreads its zones evenly and keeps them clear of the turns', () => {
    for (const zones of [1, 2, 3]) {
      const centres = zoneCentres(zones)
      expect(centres).toHaveLength(zones)
      for (const c of centres) {
        expect(c, `${zones} zones`).toBeGreaterThan(0.1)
        expect(c, `${zones} zones`).toBeLessThan(0.9)
      }
    }
    expect(zoneCentres(1)).toEqual([0.5])
  })

  it('grades against whichever zone the cursor was nearest', () => {
    const three = getCard('griddy-drop').qte as TimingParams
    const s = three.sweepMs
    // Dead on the outer zone of a three-zone bar is as good as dead centre.
    const [first, , last] = zoneCentres(three.zones)
    expect(gradeHit(zoneErrorAt(first * s, 0, s, three), three)).toBe('PERFECT')
    expect(gradeHit(zoneErrorAt(last * s, 0, s, three), three)).toBe('PERFECT')
    // And the gap between two of them is not.
    const between = ((first + zoneCentres(three.zones)[1]) / 2) * s
    expect(gradeHit(zoneErrorAt(between, 0, s, three), three)).toBe('MISS')
  })
})

/**
 * A chance is one trip through a green zone. Zones sit in the middle of equal
 * slices, so the cursor reaches one at a constant beat and a busy bar is a
 * quicker rhythm rather than a scramble.
 */
describe('one chance per trip through a zone', () => {
  const three = getCard('griddy-drop').qte as TimingParams
  const one = getCard('mewing').qte as TimingParams

  it('meets a zone at a constant beat, out and back alike', () => {
    for (const p of [one, getCard('sigma-stare').qte as TimingParams, three]) {
      const beat = p.sweepMs / p.zones
      const seen: number[] = []
      // Two full there-and-backs, sampled finely enough to catch every zone.
      for (let t = 0; t < 4 * p.sweepMs; t += 0.5) {
        const x = cursorAt(t, 0, p.sweepMs)
        if (zoneCentres(p.zones).some((c) => Math.abs(x - c) < 0.0004)) seen.push(t)
      }
      const gaps = seen.slice(1).map((t, i) => t - seen[i])
      for (const gap of gaps) expect(gap, `${p.zones} zones`).toBeCloseTo(beat, 0)
    }
  })

  it('answers a zone once however many times it is tapped', () => {
    const beat = three.sweepMs / three.zones
    expect(zoneTripAt(0, 0, three)).toBe(0)
    expect(zoneTripAt(beat * 0.4, 0, three)).toBe(0)
    expect(zoneTripAt(beat, 0, three)).toBe(1)
    expect(zoneTripAt(beat * 5.2, 0, three)).toBe(5)
  })

  it('offers more chances the busier the bar is', () => {
    const counts = CARDS.filter((c) => c.qte.game === 'sweep').map((c) => ({
      zones: (c.qte as TimingParams).zones,
      chances: crossings(c.durationMs, c.qte as TimingParams),
    }))
    counts.sort((a, b) => a.zones - b.zones)
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i].chances).toBeGreaterThan(counts[i - 1].chances)
    }
  })

  it('does not count the zone the bar opens on', () => {
    // An odd number of zones puts one dead centre, which is where the cursor
    // starts: that trip is already going, so it is neither hit nor fumble.
    const withCentre = { ...one, zones: 3 }
    const without = { ...one, zones: 2 }
    const trips = (p: TimingParams) => (3300 / p.sweepMs) * p.zones
    expect(crossings(3300, withCentre)).toBe(Math.floor(trips(withCentre)))
    expect(crossings(3300, without)).toBe(Math.floor(trips(without) + 0.5))
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
 * A card cannot ask for more taps than the bar will offer. The sweep used to
 * demand six hits inside an animation the cursor only crossed the centre three
 * times in, which made a flawless run something the card refused to allow
 * however well it was played.
 */
describe('a bar that comes past often enough', () => {
  it('comes past more often than it asks to be hit', () => {
    for (const card of CARDS) {
      if (card.qte.game !== 'sweep') continue
      // Two more than it asks for: one for the fumble a GOOD is allowed, and
      // one for the room above the bar. At exactly the bar plus one, a single
      // slip was already a MISS and the sweeps were the harshest cards in the
      // game.
      expect(crossings(card.durationMs, card.qte), card.name).toBeGreaterThanOrEqual(
        card.qte.goodAt + 2,
      )
    }
  })

  it('counts what the bar offers, not what it was asked for', () => {
    expect(crossings(1000, { ...params, sweepMs: 250 })).toBe(4)
    expect(crossings(1000, { ...params, sweepMs: 400 })).toBe(2)
  })
})
