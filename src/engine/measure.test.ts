import { describe, expect, it } from 'vitest'
import { SOLO_SETTINGS } from './balance'
import { CARDS } from './cards'
import { NO_STRATEGY, performQte } from './cpu'
import { chancesIn, opportunities } from './qte'
import { RIVALS } from './rivals'
import { PROFILES, rivalProfile, simulateMatch, tally } from './simulate'
import type { Card } from './types'

/**
 * The picture of the game as it currently stands, printed in one go.
 *
 * `npm run measure`. Nothing is asserted here — `balance.test.ts` and
 * `rivals.test.ts` are what hold the numbers in place. This is the thing you
 * read *before* changing one of them, and again after, so a tuning pass is two
 * commands rather than a throwaway script written from scratch every time.
 *
 * Skipped unless asked for, because it plays a few thousand matches.
 */
const SHOW = !!import.meta.env.VITE_MEASURE

/** How many of each kind of run to average over. Enough to be stable at 1%. */
const RUNS = 600
const MATCHES = 400

/** The three hands every table is measured against. */
const HANDS = ['sloppy', 'solid', 'ace'] as const

function gradesFor(card: Card, skill: number) {
  const grades = { PERFECT: 0, GOOD: 0, MISS: 0 } as Record<string, number>
  let accuracy = 0
  for (let i = 0; i < RUNS; i++) {
    // Swept across the roll rather than sampled randomly, so two runs of this
    // file on the same code print the same table.
    const out = performQte(
      { ...NO_STRATEGY, qteSkill: skill, consistency: 0.6 },
      card,
      (i + 0.5) / RUNS,
    )
    grades[out.judgement]++
    accuracy += out.metrics.accuracy
  }
  const pct = (k: string) => ((grades[k] / RUNS) * 100).toFixed(0).padStart(3)
  return `P ${pct('PERFECT')}%  G ${pct('GOOD')}%  M ${pct('MISS')}%  acc ${(accuracy / RUNS).toFixed(2)}`
}

describe('the game as it currently stands', () => {
  it.skipIf(!SHOW)('prints the rival ladder', () => {
    const rows = RIVALS.map((rival) => {
      const cpu = rivalProfile(rival.name, rival.strategy, [...rival.deck])
      const rate = (hand: 'solid' | 'ace') =>
        ((tally(SOLO_SETTINGS, [PROFILES[hand], cpu], MATCHES).winsP0 / MATCHES) * 100)
          .toFixed(0)
          .padStart(3)
      return (
        `${rival.name.padEnd(14)} skill ${rival.strategy.qteSkill.toFixed(3)}` +
        `   solid ${rate('solid')}%   ace ${rate('ace')}%`
      )
    })
    console.log(`\n=== THE LADDER — how often the player wins ===\n${rows.join('\n')}`)
    // The ladder has to exist at all; `rivals.test.ts` is what says it climbs.
    expect(rows).toHaveLength(RIVALS.length)
  })

  it.skipIf(!SHOW)('prints what every card does in three pairs of hands', () => {
    const rows = CARDS.map((card) => {
      const head =
        `d${card.difficulty} ${card.qte.game.padEnd(6)} ${card.name.padEnd(15)}` +
        ` bar ${String(opportunities(card)).padStart(2)}/${String(chancesIn(card)).padEnd(2)}`
      const hands = HANDS.map((hand) => `${hand.padEnd(7)} ${gradesFor(card, PROFILES[hand].perfect)}`)
      return `${head}\n${hands.map((h) => `      ${h}`).join('\n')}`
    })
    console.log(
      '\n=== EVERY CARD ===\n' +
        'A tier should read as a spread, not as one verdict: if a card returns\n' +
        'the same grade to all three hands it has stopped telling players apart.\n' +
        'Windows in milliseconds do NOT move these numbers — see docs/balance.md.\n\n' +
        rows.join('\n'),
    )
    expect(rows).toHaveLength(CARDS.length)
  })

  it.skipIf(!SHOW)('prints what a match looks like', () => {
    const lines: string[] = []
    for (const [label, a, b] of [
      ['even (solid vs solid)', PROFILES.solid, { ...PROFILES.solid, name: 'solid2' }],
      ['lopsided (ace vs sloppy)', PROFILES.ace, PROFILES.sloppy],
    ] as const) {
      let mogged = 0
      let god = 0
      let outaura = 0
      let turns = 0
      const scores: number[] = []
      for (let i = 0; i < MATCHES; i++) {
        const m = simulateMatch(SOLO_SETTINGS, [a, b], i * 7919 + 1)
        if (m.reason === 'mogged') mogged++
        if (m.godAura[0] || m.godAura[1]) god++
        if (m.outaurad[0] + m.outaurad[1] > 0) outaura++
        turns += m.turns
        scores.push(...m.scores)
      }
      scores.sort((x, y) => x - y)
      const at = (q: number) => scores[Math.floor(scores.length * q)]
      const pc = (n: number) => `${((n / MATCHES) * 100).toFixed(0)}%`
      lines.push(
        `${label.padEnd(24)} mogged ${pc(mogged).padStart(4)}  god aura ${pc(god).padStart(4)}` +
          `  outaura ${pc(outaura).padStart(4)}  turns ${(turns / MATCHES).toFixed(1)}` +
          `\n${' '.repeat(24)} play: median ${at(0.5)}  p90 ${at(0.9)}  max ${scores[scores.length - 1]}`,
      )
    }
    console.log(`\n=== MATCHES ===\n${lines.join('\n')}\n`)
    expect(lines).toHaveLength(2)
  })
})
