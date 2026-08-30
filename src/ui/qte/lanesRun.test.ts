import { describe, expect, it } from 'vitest'
import { getCard } from '../../engine/cards'
import { EMPTY, record, settle } from '../../engine/qte'
import type { Judgement, LanesParams, QteOutcome } from '../../engine/types'
import { EMPTY_GUARD_MS, chart, strikeAt } from './lanes'

/**
 * A whole chart played out, driving the real `strikeAt` and the real `settle`.
 * Only the bookkeeping the rAF loop does is modelled here — which notes have
 * gone past, and when.
 */
const CARDS = ['vibe-check', 'beat-drop', 'hyperpop'].map(getCard)

function play(card: (typeof CARDS)[number], taps: { lane: number; atMs: number }[]): QteOutcome {
  const params = card.qte as LanesParams
  const notes = chart(params, 0.42)
  const settledNotes = new Map<number, Judgement>()
  let ledger = EMPTY
  let lastEmpty = Number.NEGATIVE_INFINITY

  const ordered = [...taps].sort((a, b) => a.atMs - b.atMs)
  let next = 0

  /** Everything that has gone past the window by `at`, charged as dropped. */
  const lapse = (at: number) => {
    notes.forEach((note, i) => {
      if (settledNotes.has(i) || at - note.atMs <= params.goodMs) return
      settledNotes.set(i, 'MISS')
      ledger = record(ledger, 'missed')
    })
  }

  while (next < ordered.length) {
    const tap = ordered[next++]
    lapse(tap.atMs)
    const result = strikeAt(notes, settledNotes, tap.lane, tap.atMs, params, lastEmpty)
    if (result.kind === 'empty') {
      lastEmpty = tap.atMs
      ledger = record(ledger, 'missed')
    } else if (result.kind === 'hit') {
      settledNotes.set(result.note, result.grade)
      ledger = record(
        ledger,
        result.grade === 'PERFECT' ? 'clean' : result.grade === 'GOOD' ? 'scrappy' : 'missed',
      )
    }
  }
  lapse(card.durationMs)
  return settle(card, ledger)
}

/** Every note answered dead on the line — the chart read properly. */
const readIt = (card: (typeof CARDS)[number]) =>
  chart(card.qte as LanesParams, 0.42).map((n) => ({ lane: n.lane, atMs: n.atMs }))

/** Every lane hit over and over, reading nothing. */
function mashIt(card: (typeof CARDS)[number], everyMs: number) {
  const params = card.qte as LanesParams
  const taps: { lane: number; atMs: number }[] = []
  for (let at = params.travelMs; at < card.durationMs; at += everyMs) {
    for (let lane = 0; lane < params.lanes; lane++) taps.push({ lane, atMs: at })
  }
  return taps
}

describe('a swing at nothing costs a chance', () => {
  it('leaves reading the chart strictly better than drumming on it', () => {
    for (const card of CARDS) {
      const read = play(card, readIt(card))
      for (const everyMs of [80, 120, 200, 300]) {
        const mashed = play(card, mashIt(card, everyMs))
        const where = `${card.name} @${everyMs}ms`
        expect(mashed.score, `${where} score`).toBeLessThan(read.score)
        expect(mashed.metrics.accuracy, `${where} accuracy`).toBeLessThan(
          read.metrics.accuracy,
        )
        expect(mashed.perfectEligible, `${where} flawless`).toBe(false)
      }
    }
  })

  it('sinks a masher outright rather than merely marking them down', () => {
    // The point of the change: drumming used to catch every note for free.
    for (const card of CARDS) {
      for (const everyMs of [80, 120, 200]) {
        expect(play(card, mashIt(card, everyMs)).judgement, `${card.name} @${everyMs}ms`).toBe(
          'MISS',
        )
      }
    }
  })

  it('still lets a clean read come out flawless', () => {
    for (const card of CARDS) {
      const read = play(card, readIt(card))
      expect(read.judgement, card.name).toBe('PERFECT')
      expect(read.perfectEligible, card.name).toBe(true)
      expect(read.metrics.mistakes, card.name).toBe(0)
    }
  })

  it('blocks a flawless run on a single swing at nothing', () => {
    for (const card of CARDS) {
      const params = card.qte as LanesParams
      const notes = chart(params, 0.42)
      // A perfect read, plus one tap into a lane with nothing in it. The gap
      // before the first note is empty by construction.
      const strayed = play(card, [
        ...readIt(card),
        { lane: notes[0].lane, atMs: Math.max(1, params.travelMs - params.goodMs - 200) },
      ])
      expect(strayed.perfectEligible, card.name).toBe(false)
      expect(strayed.judgement, card.name).not.toBe('PERFECT')
      expect(strayed.metrics.mistakes, card.name).toBe(1)
    }
  })
})

describe('one finger, one mistake', () => {
  const card = CARDS[2]
  const params = card.qte as LanesParams
  const empty = Math.max(1, params.travelMs - params.goodMs - 300)

  /**
   * Mistakes charged for the taps themselves. A run that answers nothing also
   * drops every note on the chart, and those are counted the same way, so the
   * baseline has to come out first.
   */
  const dropped = play(card, []).metrics.mistakes
  const charged = (taps: { lane: number; atMs: number }[]) =>
    play(card, taps).metrics.mistakes - dropped

  it('charges a hand across three lanes once, not once per lane', () => {
    const slap = Array.from({ length: params.lanes }, (_, lane) => ({
      lane,
      // The spread of one hand landing, well inside the guard.
      atMs: empty + lane * 8,
    }))
    expect(charged(slap)).toBe(1)
  })

  it('charges a duplicated event once', () => {
    const doubled = [
      { lane: 0, atMs: empty },
      { lane: 0, atMs: empty + 1 },
    ]
    expect(charged(doubled)).toBe(1)
  })

  it('charges again once the guard has run out', () => {
    const apart = [
      { lane: 0, atMs: empty },
      { lane: 0, atMs: empty + EMPTY_GUARD_MS + 1 },
    ]
    expect(charged(apart)).toBe(2)
  })

  it('never swallows a deliberate tap, however short the note', () => {
    // The guard only ever applies to swings at nothing, so the tightest
    // rhythm a chart can ask for is unaffected.
    for (const c of CARDS) {
      const p = c.qte as LanesParams
      expect(EMPTY_GUARD_MS, c.name).toBeLessThan(p.gapMs / p.subdivisions)
    }
    const read = play(card, readIt(card))
    expect(read.metrics.successes).toBe(params.notes)
  })
})
