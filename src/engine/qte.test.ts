import { describe, expect, it } from 'vitest'
import { QTE_GOOD_RATIO, QTE_OPPORTUNITIES_MAX, QTE_OPPORTUNITIES_MIN } from './balance'
import { CARDS, getCard } from './cards'
import { baseOdds, cpuOdds, performQte, type Strategy } from './cpu'
import { NO_STRATEGY } from './cpu'
import {
  EMPTY,
  accuracyOf,
  ignored,
  opportunities,
  rampAt,
  record,
  runFor,
  settle,
  tickBeat,
  tickLength,
  unplayed,
  type Beat,
} from './qte'
import type { Card, Judgement } from './types'

const ROLLS = Array.from({ length: 400 }, (_, i) => (i + 0.5) / 400)
const strategy = (patch: Partial<Strategy>): Strategy => ({ ...NO_STRATEGY, ...patch })

/** Feeds a card a run of beats and settles it. */
const play = (card: Card, beats: Beat[]) => settle(card, beats.reduce(record, EMPTY))
const all = (card: Card, beat: Beat) =>
  play(card, Array.from({ length: opportunities(card) }, () => beat))

describe('what a card offers', () => {
  /**
   * The fairness rule the whole redesign hangs on. PERFECT is a run with no
   * fumbles in it, so a card offering twice as many chances is twice as likely
   * to lose one — a systematic penalty for nothing but being longer.
   */
  it('gives every card the same handful of chances', () => {
    for (const card of CARDS) {
      const n = opportunities(card)
      expect(n, card.name).toBeGreaterThanOrEqual(QTE_OPPORTUNITIES_MIN)
      expect(n, card.name).toBeLessThanOrEqual(QTE_OPPORTUNITIES_MAX)
    }
    const counts = CARDS.map(opportunities)
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(2)
  })

  it('cuts a continuous gesture into stretches of its own length', () => {
    for (const card of CARDS) {
      if (card.qte.game !== 'zone' && card.qte.game !== 'paths') continue
      // The whole animation is covered, whatever the card's duration.
      expect(tickLength(card) * opportunities(card)).toBeCloseTo(card.durationMs, 5)
    }
  })

  it('gets harder as it runs, and by the same curve every time', () => {
    const total = 8
    const steps = Array.from({ length: total }, (_, i) => rampAt(i, total))
    expect(steps[0]).toBe(1)
    for (let i = 1; i < total; i++) expect(steps[i]).toBeGreaterThan(steps[i - 1])
    // A single-opportunity card cannot ramp into anything.
    expect(rampAt(0, 1)).toBe(1)
  })
})

describe('settling a run', () => {
  it('pays a flawless run in full and calls it PERFECT', () => {
    for (const card of CARDS) {
      const outcome = all(card, 'clean')
      expect(outcome.judgement, card.name).toBe('PERFECT')
      expect(outcome.metrics.accuracy, card.name).toBe(1)
      expect(outcome.score, card.name).toBe(card.baseAura)
      expect(outcome.perfectEligible, card.name).toBe(true)
    }
  })

  /** One fumble is the whole of the difference between the two grades. */
  it('takes PERFECT off a run the moment anything is fumbled', () => {
    for (const card of CARDS) {
      const total = opportunities(card)
      const one = play(card, [
        'missed',
        ...Array.from({ length: total - 1 }, () => 'clean' as Beat),
      ])
      expect(one.perfectEligible, card.name).toBe(false)
      expect(one.judgement, card.name).toBe('GOOD')
    }
  })

  it('lets enough mistakes drag a run back under the bar', () => {
    const card = getCard('mewing')
    const total = opportunities(card)
    const grades = Array.from({ length: total + 1 }, (_, fumbles) =>
      play(card, [
        ...Array.from({ length: fumbles }, () => 'missed' as Beat),
        ...Array.from({ length: total - fumbles }, () => 'clean' as Beat),
      ]),
    )
    // The threshold is not a checkpoint you keep once you have passed it.
    expect(grades[0].judgement).toBe('PERFECT')
    expect(grades[1].judgement).toBe('GOOD')
    expect(grades[total].judgement).toBe('MISS')
    for (let i = 1; i < grades.length; i++) {
      // Strictly down until it bottoms out: accuracy is clamped at zero, so a
      // run that is already worthless cannot get worse.
      const prev = grades[i - 1].metrics.accuracy
      if (prev > 0) expect(grades[i].metrics.accuracy).toBeLessThan(prev)
    }
  })

  it('pays a late GOOD more than one that scraped the bar', () => {
    const card = getCard('beat-drop')
    const total = opportunities(card)
    const nearly = play(card, [
      'missed',
      ...Array.from({ length: total - 1 }, () => 'clean' as Beat),
    ])
    const scraped = play(card, [
      'missed',
      'missed',
      ...Array.from({ length: total - 2 }, () => 'scrappy' as Beat),
    ])
    expect(nearly.judgement).toBe('GOOD')
    expect(scraped.judgement).not.toBe('PERFECT')
    expect(nearly.score).toBeGreaterThan(scraped.score)
  })

  it('is worth nothing when nobody answered it', () => {
    for (const card of CARDS) {
      const outcome = unplayed(card)
      expect(outcome.judgement, card.name).toBe('MISS')
      expect(outcome.score, card.name).toBe(0)
      // Ignoring the gesture costs exactly what fumbling it costs, or standing
      // still would be a way to keep a clean sheet.
      expect(outcome.metrics.mistakes, card.name).toBe(opportunities(card))
      expect(outcome.perfectEligible, card.name).toBe(false)
    }
  })

  it('charges for chances that came and went', () => {
    const card = getCard('mewing')
    const half = Math.floor(opportunities(card) / 2)
    const walked = play(card, Array.from({ length: half }, () => 'clean'))
    expect(walked.metrics.mistakes).toBe(opportunities(card) - half)
    expect(ignored(EMPTY, 5).mistakes).toBe(5)
  })

  it('never reports an accuracy outside 0..1', () => {
    for (const card of CARDS) {
      for (const beat of ['clean', 'scrappy', 'missed'] as Beat[]) {
        const acc = all(card, beat).metrics.accuracy
        expect(acc, `${card.name} ${beat}`).toBeGreaterThanOrEqual(0)
        expect(acc, `${card.name} ${beat}`).toBeLessThanOrEqual(1)
      }
    }
    expect(accuracyOf(EMPTY, 0)).toBe(0)
  })

  it('grades on the one threshold and nothing else', () => {
    const card = getCard('mewing')
    for (const beats of [['clean'], ['scrappy'], ['missed']] as Beat[][]) {
      const outcome = play(card, beats)
      const over = outcome.metrics.accuracy >= QTE_GOOD_RATIO
      expect(outcome.judgement === 'MISS').toBe(!over)
    }
  })

  /**
   * A tick is a quarter of a second and a dropped frame is sixteen
   * milliseconds. One hitched frame must not cost a PERFECT.
   */
  it('forgives a dropped frame inside a held stretch', () => {
    expect(tickBeat(250, 250)).toBe('clean')
    expect(tickBeat(250 - 16, 250)).toBe('clean')
    expect(tickBeat(150, 250)).toBe('scrappy')
    expect(tickBeat(20, 250)).toBe('missed')
    expect(tickBeat(0, 0)).toBe('missed')
  })
})

describe('the run a rival plays', () => {
  it('lands on a grade its own ledger agrees with', () => {
    for (const card of CARDS) {
      for (const skill of [0.2, 0.5, 0.8]) {
        for (const roll of [0.1, 0.5, 0.9]) {
          const outcome = performQte(strategy({ qteSkill: skill, consistency: 0.6 }), card, roll)
          expect(outcome.metrics.successes + outcome.metrics.mistakes).toBe(opportunities(card))
          expect(outcome.perfectEligible).toBe(outcome.metrics.mistakes === 0)
          if (outcome.judgement === 'PERFECT') expect(outcome.perfectEligible).toBe(true)
          if (outcome.judgement === 'MISS') expect(outcome.score).toBe(0)
        }
      }
    }
  })

  it('plays the same run from the same roll', () => {
    const s = strategy({ qteSkill: 0.6, consistency: 0.5 })
    const card = getCard('hyperpop')
    const first = performQte(s, card, 0.42)
    for (let i = 0; i < 5; i++) expect(performQte(s, card, 0.42)).toEqual(first)
  })

  it('gets better as the hands get better', () => {
    const card = getCard('mewing')
    const mean = (skill: number) =>
      ROLLS.reduce(
        (sum, roll) =>
          sum + performQte(strategy({ qteSkill: skill, consistency: 0.6 }), card, roll).metrics.accuracy,
        0,
      ) / ROLLS.length

    const steps = [0.2, 0.4, 0.6, 0.8].map(mean)
    for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeGreaterThan(steps[i - 1])
  })

  it('finds a hard card harder than an easy one, at the same hands', () => {
    const s = strategy({ qteSkill: 0.65, consistency: 0.6 })
    const mean = (card: Card) =>
      ROLLS.reduce((sum, roll) => sum + performQte(s, card, roll).metrics.accuracy, 0) / ROLLS.length
    expect(mean(getCard('griddy-drop'))).toBeLessThan(mean(getCard('mewing')))
    expect(cpuOdds(s, getCard('griddy-drop')).perfect).toBeLessThan(
      cpuOdds(s, getCard('mewing')).perfect,
    )
  })

  it('never promises a perfect hand', () => {
    expect(baseOdds(strategy({ qteSkill: 1 })).perfect).toBeLessThan(1)
  })
})

describe('a representative run', () => {
  it('lands on the grade it was asked for, for every card', () => {
    for (const card of CARDS) {
      for (const judgement of ['PERFECT', 'GOOD', 'MISS'] as Judgement[]) {
        expect(runFor(card, judgement).judgement, `${card.name} ${judgement}`).toBe(judgement)
      }
    }
  })
})
