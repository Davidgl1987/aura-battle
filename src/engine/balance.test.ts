import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, MOGGED_THRESHOLD } from './balance'
import { CARDS } from './cards'
import { scorePlay } from './scoring'
import { PROFILES, oddsFor, type Profile, simulateMatch, type Tally, tally } from './simulate'
import type { Freshness, Judgement } from './types'

const MATCHES = 3000
const settings = DEFAULT_SETTINGS

/** Run with `npm run balance` to see the table this is asserting against. */
function report(label: string, t: Tally) {
  if (!import.meta.env.VITE_BALANCE) return
  const pct = (n: number) => `${((n / t.matches) * 100).toFixed(1)}%`
  console.log(
    `${label.padEnd(22)} P1 ${pct(t.winsP0).padStart(6)}  P2 ${pct(t.winsP1).padStart(6)}` +
      `  draw ${pct(t.draws).padStart(5)}  mogged ${pct(t.mogged).padStart(6)}` +
      `  godAura ${pct(t.godAuraReached).padStart(6)}` +
      `  bal ${t.averageBalance.toFixed(1).padStart(6)}` +
      `  fresh ${t.averageFresh[0].toFixed(1)}/${t.averageFresh[1].toFixed(1)}` +
      `  turns ${t.averageTurns.toFixed(1)}`,
  )
}

function run(label: string, a: Profile, b: Profile): Tally {
  const t = tally(settings, [a, b], MATCHES)
  report(label, t)
  return t
}

describe('what the numbers actually produce', () => {
  it('lets skill decide the battle', () => {
    const t = run('ace vs sloppy', PROFILES.ace, PROFILES.sloppy)
    expect(t.winsP0 / t.matches).toBeGreaterThan(0.85)
  })

  it('punishes leaning on the same kind of move', () => {
    // Identical hands; the only difference is that one of them keeps answering
    // with the kind already on the table. `blind` is not the control here —
    // picking at random still comes out FRESH about two thirds of the time, so
    // it barely differs from playing well. Deliberate repetition is the habit
    // the scoring is meant to punish, so it is the one worth measuring.
    const t = run('solid vs repeater', PROFILES.solid, PROFILES.repeater)
    // Measured at 57%: fifteen points of win rate for varying your answers.
    expect(t.winsP0 / t.matches).toBeGreaterThan(0.54)
  })

  it('leaves picking at random survivable', () => {
    // The flip side: someone who never reads the rival should be at a
    // disadvantage, not locked out. Variety is one of four momentum sources,
    // and this is the test that keeps it from quietly becoming all of them.
    const t = run('solid vs blind', PROFILES.solid, PROFILES.blind)
    const edge = t.winsP0 / t.matches
    expect(edge).toBeGreaterThan(0.5)
    expect(edge).toBeLessThan(0.62)
  })

  it('does not let reading alone beat execution', () => {
    // The reader plays perfectly fresh but fumbles the QTEs; execution should
    // still win the day, or the QTEs are pointless.
    const t = run('blind vs reader', PROFILES.blind, PROFILES.reader)
    expect(t.winsP0 / t.matches).toBeGreaterThan(0.6)
  })

  it('is close to fair on who moves first', () => {
    const t = run('mirror (solid)', PROFILES.solid, { ...PROFILES.solid, name: 'solid2' })
    const edge = Math.abs(t.winsP0 - t.winsP1) / t.matches
    expect(edge).toBeLessThan(0.1)
  })

  it('keeps MOGGED alive without making it the norm', () => {
    const lopsided = run('ace vs sloppy (mog)', PROFILES.ace, PROFILES.sloppy)
    const even = run('mirror (mog)', PROFILES.solid, { ...PROFILES.solid, name: 'solid2' })
    // Half of blowouts, one in twelve close ones: a mercy rule, not the norm.
    expect(lopsided.mogged / lopsided.matches).toBeGreaterThan(0.25)
    expect(even.mogged / even.matches).toBeLessThan(0.2)
  })

  it('puts god aura within reach without handing it out', () => {
    const strong = run('ace vs ace', PROFILES.ace, { ...PROFILES.ace, name: 'ace2' })
    const weak = run('sloppy vs sloppy', PROFILES.sloppy, { ...PROFILES.sloppy, name: 'sloppy2' })
    expect(strong.godAuraReached / strong.matches).toBeGreaterThan(0.3)
    expect(weak.godAuraReached / weak.matches).toBeLessThan(0.25)
  })

  it('cuts a hopeless battle short instead of playing it out', () => {
    const lopsided = run('length: lopsided', PROFILES.ace, PROFILES.sloppy)
    const even = run('length: even', PROFILES.solid, { ...PROFILES.solid, name: 'solid2' })
    expect(lopsided.averageTurns).toBeLessThan(even.averageTurns)
    expect(even.averageTurns).toBeGreaterThan(settings.deckSize * 2 - 1)
  })

  /**
   * God aura is the headline mechanic, so a battle should not routinely be over
   * before it appears. It nearly was: at a MOGGED threshold of 6000 only half
   * of one-sided battles ever saw one, because aura races to its threshold
   * faster than momentum races to its cap.
   *
   * The two are not independent knobs — god aura doubles the aura a play is
   * worth, so quicker momentum feeds the bar and brings MOGGED back with it.
   * That is what let both numbers improve at once.
   */
  it('lets god aura land before a beating is called off', () => {
    const runs = 1200
    let mogged = 0
    let god = 0
    let godFirst = 0

    for (let i = 0; i < runs; i++) {
      const m = simulateMatch(settings, [PROFILES.ace, PROFILES.sloppy], i * 7919 + 1)
      const caught = m.godAura[0] || m.godAura[1]
      if (caught) god += 1
      if (m.reason === 'mogged') {
        mogged += 1
        if (caught) godFirst += 1
      }
    }

    if (import.meta.env.VITE_BALANCE) {
      console.log(
        `\nblowouts: god aura ${((god / runs) * 100).toFixed(1)}%` +
          `  mogged ${((mogged / runs) * 100).toFixed(1)}%` +
          `  god aura before the mogging ${((godFirst / mogged) * 100).toFixed(1)}%`,
      )
    }

    // Measured at 75% / 47% / 93%.
    expect(god / runs).toBeGreaterThan(0.65)
    expect(godFirst / mogged).toBeGreaterThan(0.85)
    // And the mercy rule still has to be a rule, not a curiosity.
    expect(mogged / runs).toBeGreaterThan(0.3)
  })

  it('almost never ends in a dead heat', () => {
    const t = run('draws', PROFILES.solid, { ...PROFILES.solid, name: 'solid2' })
    expect(t.draws / t.matches).toBeLessThan(0.06)
  })
})


/**
 * The scoring is a bill: a base line for the execution, flat bonuses for the
 * things worth celebrating, and one multiplier at the bottom. These are the
 * measurements that set those numbers — run `npm run balance` to see them.
 */
describe('the shape of a score', () => {
  const line = (judgement: Judgement, freshness: Freshness, streak = 0, rivalLast = 0, god = false) =>
    (card: (typeof CARDS)[number]) =>
      scorePlay({ card, judgement, freshness, godAura: god, streak, rivalLast })

  it('puts an ordinary play in the hundreds and a great one in the thousands', () => {
    const timing = CARDS.filter((c) => c.kind === 'timing')
    if (import.meta.env.VITE_BALANCE) {
      const rows = timing.flatMap((card) =>
        (
          [
            ['GOOD', 'NEUTRAL', 0, 0, false],
            ['PERFECT', 'NEUTRAL', 0, 0, false],
            ['PERFECT', 'FRESH', 0, 0, false],
            ['PERFECT', 'FRESH', 3, 900, false],
            ['PERFECT', 'FRESH', 4, 900, true],
            ['MISS', 'STALE', 0, 0, false],
          ] as const
        ).map(([j, f, st, rl, g]) => {
          const b = line(j, f, st, rl, g)(card)
          return (
            `d${card.difficulty} ${card.name.padEnd(13)} ${j.padEnd(8)} ${f.padEnd(8)}` +
            ` streak${st} god:${g ? 'y' : 'n'} = ${String(b.total).padStart(6)}   ` +
            b.lines.map((l) => `${l.label} ${l.value >= 0 ? '+' : ''}${l.value}`).join(' | ')
          )
        }),
      )
      console.log('\n=== WHAT A PLAY IS WORTH ===\n' + rows.join('\n'))
    }

    // Picked by tier rather than by position: the pool gets reshuffled every
    // time cards are added, and an index quietly starts meaning something else.
    const softest = timing.find((c) => c.difficulty === 2)!
    const hardest = timing.find((c) => c.difficulty === 3)!
    const easyGood = line('GOOD', 'NEUTRAL')(softest).total
    const hardPerfect = line('PERFECT', 'FRESH')(hardest).total
    const everything = line('PERFECT', 'FRESH', 4, 900, true)(hardest).total

    expect(easyGood).toBeGreaterThanOrEqual(400)
    expect(easyGood).toBeLessThan(1200)
    expect(hardPerfect).toBeGreaterThanOrEqual(2000)
    expect(everything).toBeGreaterThanOrEqual(5000)
    // Every number a player sees ends in round hundreds, never stray digits.
    for (const card of CARDS) {
      expect(line('GOOD', 'FRESH', 2, 500)(card).total % 50).toBe(0)
    }
  })

  it('keeps the big numbers rare enough to stay big', () => {
    const scores: number[] = []
    for (let i = 0; i < 800; i++) {
      scores.push(...simulateMatch(settings, [PROFILES.solid, PROFILES.solid], i * 7919 + 1).scores)
    }
    scores.sort((a, b) => a - b)
    const share = (min: number) => scores.filter((x) => x >= min).length / scores.length
    const median = scores[Math.floor(scores.length / 2)]

    if (import.meta.env.VITE_BALANCE) {
      console.log(
        `\nplays: median ${median}  2000+ ${(share(2000) * 100).toFixed(1)}%` +
          `  3000+ ${(share(3000) * 100).toFixed(1)}%  max ${scores[scores.length - 1]}`,
      )
    }

    expect(median).toBeGreaterThanOrEqual(1000)
    expect(median).toBeLessThanOrEqual(2000)
    // Roughly one play in five is a "muy buena"; one in twenty is a moment.
    expect(share(2000)).toBeGreaterThan(0.12)
    expect(share(2000)).toBeLessThan(0.35)
    expect(share(3000)).toBeLessThan(0.12)
  })

  /**
   * A hard card has to be a decision, not a strictly better button. It pays
   * more and it misses more, so the answer to "should I bring Griddy Drop"
   * depends on whether you can actually land it.
   */
  it('makes a hard card pay off for a good player and backfire for a bad one', () => {
    const ev = (p: Profile, card: (typeof CARDS)[number]) => {
      const o = oddsFor(p, card)
      return (
        o.perfect * line('PERFECT', 'FRESH')(card).total +
        o.good * line('GOOD', 'FRESH')(card).total +
        (1 - o.perfect - o.good) * line('MISS', 'FRESH')(card).total
      )
    }
    const easy = CARDS.find((c) => c.id === 'mewing')!
    const hard = CARDS.find((c) => c.id === 'griddy-drop')!

    if (import.meta.env.VITE_BALANCE) {
      const rows = [PROFILES.ace, PROFILES.solid, PROFILES.sloppy].map(
        (p) =>
          `${p.name.padEnd(7)} easy ${ev(p, easy).toFixed(0).padStart(5)}` +
          `   hard ${ev(p, hard).toFixed(0).padStart(5)}` +
          `   (hard miss ${((1 - oddsFor(p, hard).perfect - oddsFor(p, hard).good) * 100).toFixed(0)}%)`,
      )
      console.log('\n=== EXPECTED VALUE BY DIFFICULTY ===\n' + rows.join('\n'))
    }

    expect(ev(PROFILES.ace, hard)).toBeGreaterThan(ev(PROFILES.ace, easy))
    expect(ev(PROFILES.sloppy, hard)).toBeLessThan(ev(PROFILES.sloppy, easy))
  })

  it('makes a streak something you notice without making it routine', () => {
    let x2 = 0
    let x3 = 0
    const runs = 800
    for (let i = 0; i < runs; i++) {
      const best = Math.max(
        ...simulateMatch(settings, [PROFILES.solid, PROFILES.solid], i * 7919 + 1).bestStreak,
      )
      if (best >= 2) x2 += 1
      if (best >= 3) x3 += 1
    }
    if (import.meta.env.VITE_BALANCE) {
      console.log(`\nstreaks (solid mirror): x2 in ${((x2 / runs) * 100).toFixed(0)}% of matches, x3 in ${((x3 / runs) * 100).toFixed(0)}%`)
    }
    expect(x2 / runs).toBeGreaterThan(0.4)
    expect(x3 / runs).toBeLessThan(0.45)
  })

  it('ends the battle on the bar reaching an end, not on a second hidden number', () => {
    // The needle and the win condition are the same number, so a player who
    // watches the bar has been told the rule by watching it.
    const best = (god: boolean) =>
      Math.max(...CARDS.map((c) => line('PERFECT', 'FRESH', 6, 500, god)(c).total))

    // Nothing you can do without god aura wins the match from level: the bar
    // has to be walked over, one play at a time.
    expect(best(false)).toBeLessThan(MOGGED_THRESHOLD)
    // With god aura it can, and that is the point of god aura — but reaching
    // it takes a run that has already moved the bar a long way first.
    expect(best(true)).toBeGreaterThan(best(false) * 1.9)
  })
})
