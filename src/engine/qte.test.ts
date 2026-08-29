import { describe, expect, it } from 'vitest'
import {
  QTE_GOOD_RATIO,
  QTE_OPPORTUNITIES_MAX,
  QTE_OPPORTUNITIES_MIN,
  QTE_OVERSHOOT_MAX,
} from './balance'
import { CARDS, getCard } from './cards'
import { attemptsFor, baseOdds, cpuOdds, performQte, type Strategy } from './cpu'
import { NO_STRATEGY } from './cpu'
import {
  EMPTY,
  accuracyOf,
  chancesIn,
  ignored,
  opportunities,
  pacingOf,
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
/** Every chance the card holds, answered the same way. */
const all = (card: Card, beat: Beat) =>
  play(card, Array.from({ length: chancesIn(card) }, () => beat))

describe('what a card offers', () => {
  /**
   * The fairness rule the whole redesign hangs on. PERFECT is a run with no
   * fumbles in it, so a card offering twice as many chances is twice as likely
   * to lose one — a systematic penalty for nothing but being longer.
   */
  it('gives every counted card the same handful of chances', () => {
    const counted = CARDS.filter((c) => pacingOf(c) === 'counted')
    for (const card of counted) {
      const n = chancesIn(card)
      expect(n, card.name).toBeGreaterThanOrEqual(QTE_OPPORTUNITIES_MIN)
      expect(n, card.name).toBeLessThanOrEqual(QTE_OPPORTUNITIES_MAX)
      // And the bar sits below what the card holds, so a counted gesture has
      // somewhere to lose a chance without losing the card.
      expect(opportunities(card), card.name).toBeLessThan(n)
    }
    const counts = counted.map(chancesIn)
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(2)
  })

  /**
   * An open-ended gesture has no count to hold in a band — it runs for as long
   * as you can keep it going. What keeps it fair is the denominator: a clean
   * run normalises to 1 whatever the card asked for, and `balance.test.ts`
   * measures that the same hands reach the same accuracy on all of them.
   */
  it('lets an open gesture run as long as the hands do', () => {
    for (const card of CARDS) {
      if (pacingOf(card) !== 'open') continue
      // There is no ceiling above the bar, which is what "keep going and every
      // extra counts" means — so what the card holds is never less than what it
      // asks for, and a sweep holds strictly more because the cursor comes back.
      expect(chancesIn(card), card.name).toBeGreaterThanOrEqual(opportunities(card))
      expect(opportunities(card), card.name).toBeGreaterThan(0)
    }
  })

  it('cuts a continuous gesture into stretches of its own length', () => {
    for (const card of CARDS) {
      if (card.qte.game !== 'zone' && card.qte.game !== 'paths') continue
      // The whole animation is covered, whatever the card's duration.
      expect(tickLength(card) * chancesIn(card)).toBeCloseTo(card.durationMs, 5)
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
      expect(outcome.perfectEligible, card.name).toBe(true)
      // Clearing the bar is worth the card; clearing it by more is worth more.
      expect(outcome.metrics.accuracy, card.name).toBeGreaterThanOrEqual(1)
      expect(outcome.score, card.name).toBeGreaterThanOrEqual(card.baseAura)
    }
  })

  it('is worth the share of the card that was actually landed', () => {
    // The card is worth its full aura for a run that answered everything it
    // held, and proportionally less for one that only reached the bar. That
    // proportion is the same on every card, which is what stops a long gesture
    // out-earning a short one.
    for (const card of CARDS) {
      const whole = play(card, Array.from({ length: chancesIn(card) }, () => 'clean'))
      expect(whole.metrics.accuracy, card.name).toBeCloseTo(1, 5)
      expect(whole.score, card.name).toBe(card.baseAura)

      if (pacingOf(card) !== 'open') continue
      const bar = play(card, Array.from({ length: opportunities(card) }, () => 'clean'))
      expect(bar.metrics.accuracy, card.name).toBeCloseTo(
        opportunities(card) / chancesIn(card),
        5,
      )
      expect(bar.score, card.name).toBeLessThan(whole.score)
    }
  })

  /** One fumble is the whole of the difference between the two grades. */
  it('takes PERFECT off a run the moment anything is fumbled', () => {
    for (const card of CARDS) {
      // A run that cleared the bar with one fumble in it: still scored, never
      // flawless. `runFor` builds exactly that.
      const one = runFor(card, 'GOOD')
      expect(one.perfectEligible, card.name).toBe(false)
      expect(one.judgement, card.name).toBe('GOOD')
      expect(one.metrics.mistakes, card.name).toBeGreaterThan(0)
    }
  })

  it('lets enough mistakes drag a run back under the bar', () => {
    const card = getCard('six-seven')
    const bar = opportunities(card)
    // Played a few past the bar, which is what leaves room for a fumble to be
    // absorbed rather than being fatal on its own.
    const total = bar + 3
    const grades = Array.from({ length: total + 1 }, (_, fumbles) =>
      play(card, [
        ...Array.from({ length: fumbles }, () => 'missed' as Beat),
        ...Array.from({ length: total - fumbles }, () => 'clean' as Beat),
      ]),
    )
    // The threshold is not a checkpoint you keep once you have passed it.
    // The clean run here stops short of everything the card holds, so it is a
    // GOOD rather than a flawless one — see 'stopping once the bar is cleared'.
    expect(grades[0].judgement).toBe('GOOD')
    expect(grades[1].judgement).toBe('GOOD')
    expect(grades[total].judgement).toBe('MISS')
    for (let i = 1; i < grades.length; i++) {
      // Strictly down until it bottoms out: accuracy is clamped at zero, so a
      // run that is already worthless cannot get worse.
      const prev = grades[i - 1].metrics.accuracy
      if (prev > 0) expect(grades[i].metrics.accuracy).toBeLessThan(prev)
    }
  })

  it('cancels exactly one clean beat per fumble', () => {
    const card = getCard('six-seven')
    const bar = opportunities(card)
    // One over the bar with one fumble in it lands exactly on the bar: the
    // fumble ate the spare, so the run still clears but no longer flawlessly.
    const scraped = play(card, [
      'missed',
      ...Array.from({ length: bar + 1 }, () => 'clean' as Beat),
    ])
    expect(scraped.judgement).toBe('GOOD')
    // Exactly the bar's worth of the card: the fumble ate the spare.
    expect(scraped.metrics.accuracy).toBeCloseTo(bar / chancesIn(card), 6)

    // One fewer clean beat and the same fumble drops it under.
    const short = play(card, [
      'missed',
      ...Array.from({ length: bar }, () => 'clean' as Beat),
    ])
    expect(short.judgement).toBe('MISS')
  })

  it('pays a late GOOD more than one that scraped the bar', () => {
    const card = getCard('six-seven')
    const total = chancesIn(card) + 4
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
      // Not even vacuously flawless: a gesture nobody touched answered none
      // of the chances it held.
      expect(outcome.perfectEligible, card.name).toBe(false)
    }
  })

  it('charges a counted gesture for chances that came and went', () => {
    // Ignoring one costs exactly what fumbling it costs, or standing still
    // would be a way to keep a clean sheet.
    const card = getCard('beat-drop')
    const half = Math.floor(chancesIn(card) / 2)
    const walked = play(card, Array.from({ length: half }, () => 'clean'))
    expect(walked.metrics.mistakes).toBe(chancesIn(card) - half)
    expect(ignored(EMPTY, 5).mistakes).toBe(5)
  })

  it('does not charge an open gesture for stopping', () => {
    // There is no number it was supposed to reach and stop at, so falling
    // short scores less rather than counting as fumbles — it just is not
    // enough to clear the bar.
    const card = getCard('six-seven')
    const few = play(card, Array.from({ length: 3 }, () => 'clean'))
    expect(few.metrics.mistakes).toBe(0)
    expect(few.judgement).toBe('MISS')
  })

  it('keeps paying an open gesture past the point it needed to reach', () => {
    const card = getCard('six-seven')
    const bar = opportunities(card)
    const enough = play(card, Array.from({ length: bar }, () => 'clean'))
    const more = play(card, Array.from({ length: bar + 6 }, () => 'clean'))
    // Clearing the bar and stopping there is a GOOD, however clean it was:
    // the card was still offering chances and they went unanswered.
    expect(enough.judgement).toBe('GOOD')
    expect(more.judgement).toBe('PERFECT')
    expect(more.score).toBeGreaterThan(enough.score)
    // Capped, so the three open gestures cannot out-earn the three counted
    // ones simply by having no end.
    expect(more.metrics.accuracy).toBeLessThanOrEqual(QTE_OVERSHOOT_MAX)
  })

  it('never reports an accuracy outside its bounds', () => {
    for (const card of CARDS) {
      for (const beat of ['clean', 'scrappy', 'missed'] as Beat[]) {
        const acc = all(card, beat).metrics.accuracy
        expect(acc, `${card.name} ${beat}`).toBeGreaterThanOrEqual(0)
        expect(acc, `${card.name} ${beat}`).toBeLessThanOrEqual(QTE_OVERSHOOT_MAX)
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
  it('is held or dropped, with no grade in between', () => {
    // A dropped frame is sixteen milliseconds and must not cost anything; a
    // hold has no lesser target to take, so there is no scrape to record.
    expect(tickBeat(250, 250)).toBe('clean')
    expect(tickBeat(250 - 16, 250)).toBe('clean')
    expect(tickBeat(160, 250)).toBe('clean')
    expect(tickBeat(140, 250)).toBe('missed')
    expect(tickBeat(20, 250)).toBe('missed')
    expect(tickBeat(0, 0)).toBe('missed')
  })
})

/**
 * The bug this exists to catch: the two continuous gestures were cut into
 * exactly as many stretches as they had to clear, so the first wobble put the
 * bar out of reach for the rest of the card and every play of them was a MISS.
 * A card with no room above its bar is not a hard card, it is a broken one.
 */
describe('room to slip', () => {
  const whole = (card: Card, missed: number) =>
    play(card, [
      ...Array.from({ length: chancesIn(card) - missed }, () => 'clean' as Beat),
      ...Array.from({ length: missed }, () => 'missed' as Beat),
    ])

  it('holds more chances than it asks you to clear', () => {
    for (const card of CARDS) {
      expect(chancesIn(card), card.name).toBeGreaterThan(opportunities(card))
    }
  })

  it('still scores a run that was played the whole way with a fumble in it', () => {
    for (const card of CARDS) {
      expect(whole(card, 0).judgement, card.name).toBe('PERFECT')
      expect(whole(card, 1).judgement, card.name).toBe('GOOD')
    }
  })

  it('sinks a run that fumbled most of what it was offered', () => {
    for (const card of CARDS) {
      expect(whole(card, chancesIn(card) - 1).judgement, card.name).toBe('MISS')
    }
  })
})

/**
 * "Do the good and stop" was the best way to play an open gesture: the bar was
 * cleared, nothing had been fumbled, so it came out flawless with half the
 * animation still to run.
 */
describe('stopping once the bar is cleared', () => {
  it('scores the bar but is never flawless', () => {
    for (const card of CARDS) {
      if (pacingOf(card) !== 'open') continue
      const stopped = play(
        card,
        Array.from({ length: opportunities(card) }, () => 'clean' as Beat),
      )
      expect(stopped.judgement, card.name).toBe('GOOD')
      expect(stopped.perfectEligible, card.name).toBe(false)
    }
  })

  it('is worth less than the same run played out to the end', () => {
    for (const card of CARDS) {
      if (pacingOf(card) !== 'open') continue
      const stopped = play(card, Array.from({ length: opportunities(card) }, () => 'clean' as Beat))
      const carried = play(card, Array.from({ length: chancesIn(card) }, () => 'clean' as Beat))
      expect(carried.score, card.name).toBeGreaterThan(stopped.score)
    }
  })
})

describe('the run a rival plays', () => {
  it('lands on a grade its own ledger agrees with', () => {
    for (const card of CARDS) {
      for (const skill of [0.2, 0.5, 0.8]) {
        for (const roll of [0.1, 0.5, 0.9]) {
          const s = strategy({ qteSkill: skill, consistency: 0.6 })
          const outcome = performQte(s, card, roll)
          // Counted cards answer every chance; open ones answer as many as the
          // hands manage, which is what `attemptsFor` decides.
          expect(outcome.metrics.successes + outcome.metrics.mistakes).toBe(attemptsFor(s, card))
          // Flawless needs more than a clean sheet: every chance the card
          // held, answered, and none of them scraped.
          if (outcome.perfectEligible) expect(outcome.metrics.mistakes).toBe(0)
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
