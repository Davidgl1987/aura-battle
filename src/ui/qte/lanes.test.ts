import { describe, expect, it } from 'vitest'
import type { Judgement, LanesParams } from '../../engine/types'
import { chart, chartLength, combineNotes, gradeNote, noteProgress } from './lanes'

const params: LanesParams = {
  kind: 'timing',
  game: 'lanes',
  lanes: 3,
  notes: 6,
  travelMs: 900,
  gapMs: 400,
  perfectMs: 70,
  goodMs: 160,
}

describe('the chart', () => {
  it('writes the asked-for number of notes, evenly spaced', () => {
    const notes = chart(params, 0.4)
    expect(notes).toHaveLength(6)
    for (let i = 1; i < notes.length; i++) {
      expect(notes[i].atMs - notes[i - 1].atMs).toBe(params.gapMs)
    }
  })

  it('gives the first note the full run of the board', () => {
    expect(chart(params, 0.4)[0].atMs).toBe(params.travelMs)
  })

  it('never puts two in a row in the same lane', () => {
    for (const variation of [0, 0.23, 0.61, 0.99]) {
      const notes = chart(params, variation)
      for (let i = 1; i < notes.length; i++) {
        expect(notes[i].lane).not.toBe(notes[i - 1].lane)
      }
      for (const note of notes) {
        expect(note.lane).toBeGreaterThanOrEqual(0)
        expect(note.lane).toBeLessThan(params.lanes)
      }
    }
  })

  it('replays the same chart from the same seed and a different one otherwise', () => {
    expect(chart(params, 0.2)).toEqual(chart(params, 0.2))
    expect(chart(params, 0.2).map((n) => n.lane)).not.toEqual(chart(params, 0.77).map((n) => n.lane))
  })

  it('reports how long it needs, so a card can be given room for it', () => {
    expect(chartLength(params)).toBe(900 + 5 * 400 + 160)
  })
})

describe('a note arriving', () => {
  it('runs from the far edge to the line and past it', () => {
    const note = { lane: 0, atMs: 900 }
    expect(noteProgress(note, 0, 900)).toBe(1)
    expect(noteProgress(note, 450, 900)).toBe(0.5)
    expect(noteProgress(note, 900, 900)).toBe(0)
    expect(noteProgress(note, 1000, 900)).toBeLessThan(0)
  })

  it('grades on how close to the line it was hit', () => {
    expect(gradeNote(0, params)).toBe('PERFECT')
    expect(gradeNote(120, params)).toBe('GOOD')
    expect(gradeNote(400, params)).toBe('MISS')
  })
})

describe('the card as a whole', () => {
  const all = (judgement: Judgement, n: number) => Array.from({ length: n }, () => judgement)

  it('needs nearly every note clean to be a PERFECT, but allows one slip', () => {
    expect(combineNotes(all('PERFECT', 6), 6)).toBe('PERFECT')
    expect(combineNotes([...all('PERFECT', 5), 'GOOD'], 6)).toBe('PERFECT')
    expect(combineNotes([...all('PERFECT', 4), ...all('GOOD', 2)], 6)).toBe('GOOD')
  })

  it('does not let one bad note sink the whole card', () => {
    expect(combineNotes([...all('PERFECT', 5), 'MISS'], 6)).toBe('GOOD')
  })

  it('fails once too much of the chart has gone by untouched', () => {
    expect(combineNotes([...all('GOOD', 4), ...all('MISS', 2)], 6)).toBe('GOOD')
    expect(combineNotes([...all('GOOD', 3), ...all('MISS', 3)], 6)).toBe('MISS')
    expect(combineNotes([], 6)).toBe('MISS')
  })
})
