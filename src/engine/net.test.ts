import { describe, expect, it } from 'vitest'
import { QTE_SCRAPPY_VALUE } from './balance'
import { CARDS, getCard } from './cards'
import {
  EMPTY,
  accuracyOf,
  chancesIn,
  clearedBar,
  netValue,
  opportunities,
  record,
  settle,
} from './qte'
import type { Beat } from './qte'

const add = (beats: Beat[]) => beats.reduce(record, EMPTY)

/**
 * One definition of what a run is worth, shared by everything that compares
 * against it. The meter used to keep its own — `successes - mistakes`, which
 * weighs a scrape the same as a clean hit — so a run that scraped its way to
 * the bar showed as cleared right up until `settle` returned a MISS.
 */
describe('what a run is worth', () => {
  it('weighs a scrape below a clean hit', () => {
    expect(netValue(add(['clean']))).toBe(1)
    expect(netValue(add(['scrappy']))).toBe(QTE_SCRAPPY_VALUE)
    expect(netValue(add(['scrappy']))).toBeLessThan(netValue(add(['clean'])))
  })

  it('lets one fumble cancel one clean hit', () => {
    expect(netValue(add(['clean', 'missed']))).toBe(0)
    expect(netValue(add(['clean', 'clean', 'missed']))).toBe(1)
  })

  it('is the number the bar, the score and the meter all read', () => {
    // Enough scrapes to reach the bar by count but not by worth. This is the
    // exact run that used to show as cleared and settle as a MISS.
    for (const card of CARDS) {
      const bar = opportunities(card)
      const scraped = add(Array.from({ length: bar }, () => 'scrappy' as Beat))

      expect(scraped.successes, `${card.name} counts as enough`).toBe(bar)
      expect(netValue(scraped), `${card.name} is not worth enough`).toBeLessThan(bar)
      expect(clearedBar(scraped, bar), `${card.name} bar`).toBe(false)
      expect(accuracyOf(scraped, chancesIn(card)), `${card.name} accuracy`).toBeLessThan(1)
    }
  })
})

/**
 * The screen and the score sheet, on the same ledger, at the same moment.
 * `settle` is the score sheet; `clearedBar` is what the meter lights up on.
 */
describe('the meter and the result agree', () => {
  /** Every run of up to four beats, on every card. */
  function* runs(depth: number): Generator<Beat[]> {
    if (depth === 0) {
      yield []
      return
    }
    for (const rest of runs(depth - 1)) {
      yield rest
      for (const beat of ['clean', 'scrappy', 'missed'] as Beat[]) yield [...rest, beat]
    }
  }

  /**
   * Mid-run the meter speaks about what has happened, while `settle` also
   * charges every chance still outstanding — so the two only have to agree
   * once nothing is outstanding. Every widget reports every chance as it
   * happens (a note that goes past says so at the moment it does), so that is
   * the state a card always ends in.
   */
  it('never lights up cleared on a scraped run that settles as a MISS', () => {
    for (const card of CARDS) {
      const bar = opportunities(card)
      const held = chancesIn(card)
      // Scrapes all the way to the end of the card: the count reaches the bar
      // but the worth does not. Lit and unscored, before `netValue` was shared.
      const scraped = add(Array.from({ length: held }, () => 'scrappy' as Beat))
      expect(clearedBar(scraped, bar), `${card.name} meter`).toBe(
        settle(card, scraped).judgement !== 'MISS',
      )
    }
  })

  it('agrees exactly once every chance has been answered', () => {
    for (const card of CARDS) {
      const bar = opportunities(card)
      const held = chancesIn(card)
      for (const beats of runs(3)) {
        // Pad to a complete run, which is the state the card ends in.
        const full = [...beats, ...Array.from({ length: held - beats.length }, () => 'clean')]
        if (full.length !== held) continue
        const ledger = add(full as Beat[])
        expect(clearedBar(ledger, bar), `${card.name} [${full.join(',')}]`).toBe(
          settle(card, ledger).judgement !== 'MISS',
        )
      }
    }
  })

  it('only promises a flawless run the score sheet would honour', () => {
    const card = getCard('mewing')
    const held = chancesIn(card)
    const complete = (beats: Beat[]) => add(beats)
    // The meter's flawless light, and what settle does with the same ledger.
    for (const beats of runs(4)) {
      if (beats.length !== held) continue
      const ledger = complete(beats)
      const lit = ledger.clean === ledger.taken
      const honoured = settle(card, ledger).perfectEligible
      if (!lit) expect(honoured, `[${beats.join(',')}]`).toBe(false)
    }
  })
})
