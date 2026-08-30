import { describe, expect, it } from 'vitest'
import { QTE_ARM_MS } from '../../engine/balance'
import { getCard } from '../../engine/cards'
import { createArming } from './arming'
import { cursorAt, startEdge, startPhase, zoneErrorAt, zoneTripAt } from './timing'
import type { TimingParams } from '../../engine/types'

/**
 * The bookkeeping `QteTiming` does around the pure maths, exercised without a
 * DOM: what the two ways of starting a card produce, and which taps a trip
 * accepts. Modelled the same way the widget does it, so a change to one that
 * is not made to the other shows up here.
 */
const SWEEPS = ['mewing', 'sigma-stare', 'griddy-drop'].map(getCard)

/** The widget's `begin` and `tap`, with the DOM and the ledger left out. */
function sweep(params: TimingParams, startedAt: number, variation: number) {
  const arming = createArming(startedAt)
  let phase = 0
  let answered = -1
  let begun = false

  const begin = (at: number) => {
    if (begun) return
    begun = true
    phase = startPhase(at, params.sweepMs, variation)
    answered = -1
  }

  return {
    get phase() {
      return phase
    },
    get answered() {
      return answered
    },
    /** One frame of the rAF loop: arms on its own once the wait runs out. */
    frame(at: number) {
      const armedAt = arming.resolve(at)
      if (armedAt !== null) begin(armedAt)
      return armedAt === null ? startEdge(variation) : cursorAt(at, phase, params.sweepMs)
    },
    /** A pointer down. Returns what the widget would do with it. */
    tap(at: number): 'START' | 'REPEAT' | 'GRADED' {
      if (arming.armedAt === null) {
        arming.arm(at)
        begin(at)
        return 'START'
      }
      const trip = zoneTripAt(at, phase, params)
      if (trip === answered) return 'REPEAT'
      answered = trip
      return 'GRADED'
    },
  }
}

describe('starting a sweep', () => {
  it('produces the same state whether it was tapped or armed itself', () => {
    for (const card of SWEEPS) {
      const params = card.qte as TimingParams
      for (const variation of [0.2, 0.8]) {
        const byHand = sweep(params, 1000, variation)
        byHand.tap(1000 + QTE_ARM_MS)

        // Nobody touched: the loop runs until the wait runs out.
        const byItself = sweep(params, 1000, variation)
        byItself.frame(1000)
        byItself.frame(1000 + QTE_ARM_MS)

        const where = `${card.name} v${variation}`
        expect(byItself.phase, `${where} phase`).toBe(byHand.phase)
        expect(byItself.answered, `${where} nothing answered yet`).toBe(byHand.answered)
        // Same cursor, and the same first chance still ahead of both.
        const at = 1000 + QTE_ARM_MS + params.sweepMs / (4 * params.zones)
        expect(byItself.frame(at), `${where} cursor`).toBeCloseTo(byHand.frame(at), 9)
        expect(zoneTripAt(at, byItself.phase, params), `${where} trip`).toBe(
          zoneTripAt(at, byHand.phase, params),
        )
      }
    }
  })

  it('draws the cursor where the sweep will actually set off from', () => {
    for (const card of SWEEPS) {
      const params = card.qte as TimingParams
      for (const variation of [0.2, 0.8]) {
        const run = sweep(params, 1000, variation)
        // Parked before anyone touches...
        const parked = run.frame(1000)
        run.tap(1000)
        // ...and in the same place the instant it goes live, so it never jumps.
        expect(run.frame(1000), `${card.name} v${variation}`).toBeCloseTo(parked, 9)
      }
    }
  })

  it('opens clear of any scorable window, on every zone count', () => {
    for (const card of SWEEPS) {
      const params = card.qte as TimingParams
      for (const variation of [0.2, 0.8]) {
        const run = sweep(params, 1000, variation)
        expect(run.tap(1000), card.name).toBe('START')
        // The tap that starts the card is never graded, so there must be
        // nothing under the cursor for it to look like a fumbled hit on.
        expect(zoneErrorAt(1000, run.phase, params.sweepMs, params), card.name).toBeGreaterThan(
          params.goodMs,
        )
      }
    }
  })
})

describe('one answer per trip', () => {
  const meets = (p: TimingParams, i: number, phase: number) =>
    phase + ((2 * i + 1) / (2 * p.zones)) * p.sweepMs

  it('takes one tap on a zone and turns the second away without charging it', () => {
    for (const card of SWEEPS) {
      const params = card.qte as TimingParams
      const run = sweep(params, 1000, 0.2)
      run.tap(1000)
      const centre = meets(params, 0, run.phase)

      expect(run.tap(centre - 20), `${card.name} approaching`).toBe('GRADED')
      expect(run.tap(centre + 20), `${card.name} leaving`).toBe('REPEAT')
      expect(run.tap(centre + 1), `${card.name} again`).toBe('REPEAT')
    }
  })

  it('takes the next zone along as a chance of its own', () => {
    for (const card of SWEEPS) {
      const params = card.qte as TimingParams
      const run = sweep(params, 1000, 0.2)
      run.tap(1000)

      // Every zone the bar offers, answered on the way out of each — which is
      // the case that used to eat the following one.
      for (let i = 0; i < 5; i++) {
        const late = meets(params, i, run.phase) + params.goodMs - 2
        expect(run.tap(late), `${card.name} zone ${i}`).toBe('GRADED')
      }
    }
  })

  it('accepts a whole window as one chance, from its first edge to its last', () => {
    for (const card of SWEEPS) {
      const params = card.qte as TimingParams
      for (let i = 0; i < 4; i++) {
        const run = sweep(params, 1000, 0.2)
        run.tap(1000)
        const centre = meets(params, i, run.phase)
        // Entering the window is the same chance as leaving it.
        expect(run.tap(centre - params.goodMs + 1), `${card.name} zone ${i} early`).toBe('GRADED')
        expect(run.tap(centre + params.goodMs - 1), `${card.name} zone ${i} late`).toBe('REPEAT')
      }
    }
  })
})
