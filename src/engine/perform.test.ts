import { describe, expect, it } from 'vitest'
import { CARDS, getCard } from './cards'
import { beatsOf, performance } from './perform'
import type { Judgement } from './types'

const ROLLS = Array.from({ length: 40 }, (_, i) => (i + 0.5) / 40)
const GRADES: Judgement[] = ['PERFECT', 'GOOD', 'MISS']

describe('the shape of a rival\'s attempt', () => {
  it('gives every card a strip you can count', () => {
    for (const card of CARDS) {
      const beats = beatsOf(card)
      expect(beats, card.name).toBeGreaterThanOrEqual(2)
      // Any more than this and a phone-width strip stops being readable.
      expect(beats, card.name).toBeLessThanOrEqual(8)
    }
  })

  it('takes the count from the QTE the player would have been given', () => {
    // A rival playing Beat Drop shows the five notes going past, not a
    // generic bar: the strip is the card, not decoration.
    expect(beatsOf(getCard('beat-drop'))).toBe(6)
    expect(beatsOf(getCard('hyperpop'))).toBe(8)
    expect(beatsOf(getCard('mewing'))).toBe(6)
    expect(beatsOf(getCard('speedrun'))).toBe(8)
  })

  it('always produces exactly that many beats', () => {
    for (const card of CARDS) {
      for (const grade of GRADES) {
        for (const roll of ROLLS) {
          expect(performance(card, grade, roll), `${card.name} ${grade}`).toHaveLength(beatsOf(card))
        }
      }
    }
  })

  /** The whole point: the strip and the grade can never disagree. */
  it('runs clean for a PERFECT, every time', () => {
    for (const card of CARDS) {
      for (const roll of ROLLS) {
        expect(performance(card, 'PERFECT', roll).every((b) => b === 'hit'), card.name).toBe(true)
      }
    }
  })

  it('wobbles for a GOOD without dropping anything', () => {
    for (const card of CARDS) {
      for (const roll of ROLLS) {
        const beats = performance(card, 'GOOD', roll)
        expect(beats, `${card.name} @ ${roll}`).toContain('soft')
        expect(beats, `${card.name} @ ${roll}`).not.toContain('slip')
      }
    }
  })

  it('drops at least one for a MISS', () => {
    for (const card of CARDS) {
      for (const roll of ROLLS) {
        expect(performance(card, 'MISS', roll), `${card.name} @ ${roll}`).toContain('slip')
      }
    }
  })

  it('reads worse on a MISS than on a GOOD', () => {
    const clean = (grade: Judgement) =>
      CARDS.flatMap((card) => ROLLS.map((roll) => performance(card, grade, roll)))
        .flat()
        .filter((b) => b === 'hit').length

    expect(clean('MISS')).toBeLessThan(clean('GOOD'))
    expect(clean('GOOD')).toBeLessThan(clean('PERFECT'))
  })

  it('plays the same performance from the same roll', () => {
    const card = getCard('hyperpop')
    for (const grade of GRADES) {
      const first = performance(card, grade, 0.42)
      for (let i = 0; i < 5; i++) expect(performance(card, grade, 0.42)).toEqual(first)
    }
  })

  it('does not spoil the same beat every time', () => {
    // Otherwise a rival misses the third note of Hyperpop for eternity.
    const card = getCard('hyperpop')
    const spoiled = new Set(
      ROLLS.map((roll) => performance(card, 'MISS', roll).findIndex((b) => b === 'slip')),
    )
    expect(spoiled.size).toBeGreaterThan(2)
  })
})
