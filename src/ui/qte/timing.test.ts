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
  startEdge,
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
 * The bar opens at an end, which is the furthest point on it from any zone —
 * both the longest run-up the card's rhythm can offer and the only start that
 * is not sitting on a scorable target.
 */
describe('where it sets off from', () => {
  const s = params.sweepMs

  it('parks at an end, never on a zone', () => {
    for (const variation of [0, 0.2, 0.49, 0.5, 0.8, 0.99]) {
      const at = cursorAt(1000, startPhase(1000, s, variation), s)
      expect(at, `v${variation}`).toBeCloseTo(startEdge(variation), 6)
    }
  })

  it('heads into the bar from whichever end it took', () => {
    expect(cursorAt(1010, startPhase(1000, s, 0.2), s)).toBeGreaterThan(0)
    expect(cursorAt(1010, startPhase(1000, s, 0.8), s)).toBeLessThan(1)
  })

  it('gives a run-up before the first target, on every zone count', () => {
    for (const card of CARDS) {
      if (card.qte.game !== 'sweep') continue
      const p = card.qte as TimingParams
      for (const variation of [0.2, 0.8]) {
        const phase = startPhase(1000, p.sweepMs, variation)
        // The first moment the cursor is inside a scorable window.
        let first = Number.POSITIVE_INFINITY
        for (let t = 1000; t < 1000 + 2 * p.sweepMs; t += 1) {
          if (zoneErrorAt(t, phase, p.sweepMs, p) <= p.goodMs) {
            first = t - 1000
            break
          }
        }
        // Nothing scorable at the moment of the tap, and half a beat of
        // approach before the first one — which is as long a run-up as a bar
        // with this many targets on it can give.
        expect(zoneErrorAt(1000, phase, p.sweepMs, p), card.name).toBeGreaterThan(p.goodMs)
        expect(first, `${card.name} v${variation}`).toBeGreaterThan(0)
        expect(first, `${card.name} v${variation}`).toBeLessThanOrEqual(
          p.sweepMs / (2 * p.zones),
        )
      }
    }
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

/**
 * The drawn zone and the scored chance have to be the same thing. They were
 * not: the trip boundary sat on the zone centre rather than between zones, so
 * the approach to a zone and the departure from it belonged to different
 * chances. Answering one on the way out spent the next chance too, and the
 * whole approach to the following zone was then dropped in silence — a tap
 * dead on a green zone that did nothing, which reads as a missed touch.
 */
describe('the drawn zone and the chance it scores are the same window', () => {
  const sweeps = CARDS.filter((c) => c.qte.game === 'sweep')
  /** Where the cursor is exactly on the `i`th zone it meets, from a phase of 0. */
  const meets = (p: TimingParams, i: number) => ((2 * i + 1) / (2 * p.zones)) * p.sweepMs

  it('measures the same error either side of a centre', () => {
    // The invariant the grade rests on. Landing exactly on a threshold is a
    // coin toss by definition, so it is the measurement that has to be
    // symmetric rather than the verdict at the boundary.
    for (const card of sweeps) {
      const p = card.qte as TimingParams
      for (let i = 0; i < 4; i++) {
        const centre = meets(p, i)
        for (const offset of [10, 50, p.perfectMs, p.goodMs]) {
          const before = zoneErrorAt(centre - offset, 0, p.sweepMs, p)
          const after = zoneErrorAt(centre + offset, 0, p.sweepMs, p)
          expect(before, `${card.name} zone ${i} −${offset}ms`).toBeCloseTo(offset, 6)
          expect(after, `${card.name} zone ${i} +${offset}ms`).toBeCloseTo(offset, 6)
        }
      }
    }
  })

  it('grades a tap the same distance either side of a centre alike', () => {
    for (const card of sweeps) {
      const p = card.qte as TimingParams
      for (let i = 0; i < 4; i++) {
        const centre = meets(p, i)
        // Clear of the two thresholds, so the verdict is not a coin toss.
        for (const offset of [10, 50, p.perfectMs - 4, p.perfectMs + 4, p.goodMs - 4]) {
          const before = gradeHit(zoneErrorAt(centre - offset, 0, p.sweepMs, p), p)
          const after = gradeHit(zoneErrorAt(centre + offset, 0, p.sweepMs, p), p)
          expect(after, `${card.name} zone ${i} ±${offset}ms`).toBe(before)
        }
      }
    }
  })

  it('keeps one whole window inside one trip, both halves of it', () => {
    for (const card of sweeps) {
      const p = card.qte as TimingParams
      for (let i = 0; i < 4; i++) {
        const centre = meets(p, i)
        const trip = zoneTripAt(centre, 0, p)
        // Everything the player can see as this zone belongs to this chance.
        for (const offset of [-p.goodMs, -p.perfectMs, -1, 0, 1, p.perfectMs, p.goodMs]) {
          expect(zoneTripAt(centre + offset, 0, p), `${card.name} zone ${i} @${offset}`).toBe(trip)
        }
      }
    }
  })

  it('recognises both edges of the PERFECT window', () => {
    for (const card of sweeps) {
      const p = card.qte as TimingParams
      const centre = meets(p, 0)
      // Just inside each edge. Exactly on one is float noise deciding.
      for (const edge of [centre - p.perfectMs + 1, centre + p.perfectMs - 1]) {
        expect(gradeHit(zoneErrorAt(edge, 0, p.sweepMs, p), p), card.name).toBe('PERFECT')
      }
      // And just outside each is the lesser target, on both sides.
      for (const edge of [centre - p.perfectMs - 2, centre + p.perfectMs + 2]) {
        expect(gradeHit(zoneErrorAt(edge, 0, p.sweepMs, p), p), card.name).toBe('GOOD')
      }
    }
  })

  it('recognises both edges of the GOOD window', () => {
    for (const card of sweeps) {
      const p = card.qte as TimingParams
      const centre = meets(p, 0)
      for (const edge of [centre - p.goodMs + 1, centre + p.goodMs - 1]) {
        expect(gradeHit(zoneErrorAt(edge, 0, p.sweepMs, p), p), card.name).toBe('GOOD')
      }
      // And just outside it is not, on both sides.
      for (const edge of [centre - p.goodMs - 2, centre + p.goodMs + 2]) {
        expect(gradeHit(zoneErrorAt(edge, 0, p.sweepMs, p), p), card.name).toBe('MISS')
      }
    }
  })

  /**
   * Position either side of a centre is only the same *time* either side while
   * the window stays clear of a turn, where the cursor doubles back. Every zone
   * sits half a beat from the end of the bar, so this holds by construction —
   * but it stops holding the moment somebody widens a window past that.
   */
  it('never lets a window reach the turn at the end of the bar', () => {
    for (const card of sweeps) {
      const p = card.qte as TimingParams
      expect(p.goodMs, card.name).toBeLessThan(p.sweepMs / (2 * p.zones))
    }
  })

  it('finds the first target with one, two or three zones', () => {
    for (const card of sweeps) {
      const p = card.qte as TimingParams
      for (const variation of [0.2, 0.8]) {
        const phase = startPhase(1000, p.sweepMs, variation)
        const first = 1000 + p.sweepMs / (2 * p.zones)
        expect(gradeHit(zoneErrorAt(first, phase, p.sweepMs, p), p), `${card.name} v${variation}`)
          .toBe('PERFECT')
        // And it is a fresh chance, not one the opening tap already spent.
        expect(zoneTripAt(first, phase, p)).not.toBe(-1)
        expect(zoneTripAt(first, phase, p), `${card.name} v${variation}`).toBe(
          zoneTripAt(1000, phase, p),
        )
      }
    }
  })

  it('tells two taps in one trip apart from two taps in consecutive ones', () => {
    for (const card of sweeps) {
      const p = card.qte as TimingParams
      const first = meets(p, 0)
      const second = meets(p, 1)
      // Two taps either side of the same centre: one chance.
      expect(zoneTripAt(first - 20, 0, p), card.name).toBe(zoneTripAt(first + 20, 0, p))
      // Consecutive zones: two.
      expect(zoneTripAt(second, 0, p), card.name).not.toBe(zoneTripAt(first, 0, p))
      expect(zoneTripAt(second, 0, p), card.name).toBe(zoneTripAt(first, 0, p) + 1)
    }
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
