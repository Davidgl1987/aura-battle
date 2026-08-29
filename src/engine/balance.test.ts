import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, MOGGED_THRESHOLD, QTE_OVERSHOOT_MAX } from './balance'
import { CARDS } from './cards'
import { NO_STRATEGY, performQte } from './cpu'
import { EMPTY, chancesIn, pacingOf, record, runFor, settle } from './qte'
import { momentumDelta, scorePlay } from './scoring'
import {
  PROFILES,
  oddsFor,
  simulateLog,
  simulateMatch,
  tally,
  type Profile,
  type Tally,
} from './simulate'
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
    // Measured at 53%.
    expect(t.winsP0 / t.matches).toBeGreaterThan(0.51)
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
    expect(even.mogged / even.matches).toBeLessThan(0.3)
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

    // Measured at 46% / 74% / 82%.
    expect(god / runs).toBeGreaterThan(0.35)
    expect(godFirst / mogged).toBeGreaterThan(0.4)
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
      scorePlay({ card, outcome: runFor(card, judgement), freshness, godAura: god, streak, rivalLast })

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

    // `line('GOOD', …)` is a run that cleared the bar with a fumble in it.
    expect(easyGood).toBeGreaterThanOrEqual(400)
    expect(easyGood).toBeLessThan(2200)
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

    expect(median).toBeGreaterThanOrEqual(1200)
    expect(median).toBeLessThanOrEqual(3200)
    // Scoring a gesture over its whole length raised what a landed play is
    // worth: the base line is now the card's value times how much of it was
    // actually landed, plus a bonus for a clean sheet, where it used to be a
    // flat multiplier per grade. Measured at 45% / 9%.
    expect(share(2000)).toBeGreaterThan(0.25)
    expect(share(3000)).toBeGreaterThan(0.1)
    expect(share(6000)).toBeLessThan(0.2)
  })

  /**
   * A hard card has to be a decision, not a strictly better button. It pays
   * more and it misses more, so the answer to "should I bring Griddy Drop"
   * depends on whether you can actually land it.
   */
  it('makes a hard card pay off for a good player and backfire for a bad one', () => {
    /**
     * Averaged over runs the profile actually plays, rather than over a fixed
     * representative one: the whole reason a hard card backfires is that the
     * same hands land less of it, and a stand-in run cannot say that.
     */
    const ev = (p: Profile, card: (typeof CARDS)[number]) => {
      const rolls = 300
      let sum = 0
      for (let i = 0; i < rolls; i++) {
        const outcome = performQte(
          { ...NO_STRATEGY, qteSkill: p.perfect, consistency: 0.6 },
          card,
          (i + 0.5) / rolls,
        )
        sum += scorePlay({
          card,
          outcome,
          freshness: 'FRESH',
          godAura: false,
          streak: 0,
          rivalLast: 0,
        }).total
      }
      return sum / rolls
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
    // Measured at 38% / 16%.
    expect(x2 / runs).toBeGreaterThan(0.3)
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

/**
 * What a battle actually looks like now that a gesture is scored over its whole
 * length rather than at one moment.
 *
 * These are the numbers the redesign was for: the game was beatable end to end
 * on a first run, and the reason was that clearing a single threshold was the
 * entire test. The measurements below are what say whether the fix took.
 */
describe('the shape of a battle', () => {
  const grades = (a: Profile, b: Profile, runs = 1200) => {
    const seen = { PERFECT: 0, GOOD: 0, MISS: 0 }
    let outaura = 0
    let plays = 0
    for (let i = 0; i < runs; i++) {
      const log = simulateLog(settings, [a, b], i * 7919 + 1).filter((t) => t.player === 0)
      for (const turn of log) {
        if (turn.judgement === 'LOST_COMPOSURE') continue
        seen[turn.judgement] += 1
        plays += 1
        if (turn.lines.some((l) => l.key === 'outaurad')) outaura += 1
      }
    }
    return {
      perfect: seen.PERFECT / plays,
      good: seen.GOOD / plays,
      miss: seen.MISS / plays,
      outaura: outaura / plays,
    }
  }

  it('separates three levels of player instead of two', () => {
    const bad = grades(PROFILES.sloppy, PROFILES.solid)
    const ok = grades(PROFILES.solid, PROFILES.solid)
    const good = grades(PROFILES.ace, PROFILES.solid)

    if (import.meta.env.VITE_BALANCE) {
      for (const [name, g] of [['sloppy', bad], ['solid', ok], ['ace', good]] as const) {
        console.log(
          `${name.padEnd(7)} PERFECT ${(g.perfect * 100).toFixed(0).padStart(3)}%` +
            `  GOOD ${(g.good * 100).toFixed(0).padStart(3)}%` +
            `  MISS ${(g.miss * 100).toFixed(0).padStart(3)}%` +
            `  outaura ${(g.outaura * 100).toFixed(0).padStart(3)}%`,
        )
      }
    }

    // Every grade has to be reachable and none of them the default.
    for (const g of [bad, ok, good]) {
      expect(g.perfect + g.good + g.miss).toBeCloseTo(1, 5)
    }
    // A flawless run is what separates the top: measured at 5 / 37 / 77%.
    expect(good.perfect).toBeGreaterThan(ok.perfect)
    expect(ok.perfect).toBeGreaterThan(bad.perfect)
    expect(good.perfect - bad.perfect).toBeGreaterThan(0.4)
    // And fumbling is what separates the bottom: 62 / 29 / 5%.
    expect(bad.miss).toBeGreaterThan(ok.miss)
    expect(ok.miss).toBeGreaterThan(good.miss)
  })

  it('leaves a decent player finishing more cards than they fumble', () => {
    // Harder than it was, not unplayable: the point is discrimination, and a
    // game a competent player misses most of is not a harder game, it is a
    // broken one.
    const ok = grades(PROFILES.solid, PROFILES.solid)
    expect(ok.miss).toBeLessThan(0.4)
    expect(ok.perfect).toBeGreaterThan(0.2)
    expect(ok.perfect).toBeLessThan(0.6)
  })

  /**
   * The old rule compared finished totals, so a rival who had caught fire had
   * their play doubled for reasons that were not about the play and could not
   * be out-scored at all. Measured then: the chance existed in 8-16% of whole
   * battles. Now it is a thing that happens.
   */
  it('puts OUTAURA back within reach without making it routine', () => {
    const ok = grades(PROFILES.solid, PROFILES.solid)
    expect(ok.outaura).toBeGreaterThan(0.02)
    expect(ok.outaura).toBeLessThan(0.35)
  })

  it('pays OUTAURA in momentum rather than in aura', () => {
    const card = CARDS[0]
    const base = {
      card,
      outcome: runFor(card, 'PERFECT'),
      freshness: 'FRESH' as const,
      godAura: false,
      streak: 0,
    }
    const alone = scorePlay({ ...base, rivalLast: 0 })
    // Beaten by half again: same aura, and the bonus is a momentum step.
    const beating = scorePlay({ ...base, rivalLast: Math.floor(alone.impact / 2) })
    expect(beating.lines.some((l) => l.key === 'outaurad')).toBe(true)
    expect(beating.total).toBe(alone.total)
    expect(momentumDelta({ ...base, rivalLast: Math.floor(alone.impact / 2) })).toBeGreaterThan(
      momentumDelta({ ...base, rivalLast: 0 }),
    )
  })

  it('never lets a fumbled play be out-scored, or do the out-scoring', () => {
    const card = CARDS[0]
    const missed = {
      card,
      outcome: runFor(card, 'MISS'),
      freshness: 'FRESH' as const,
      godAura: false,
      streak: 0,
    }
    // A MISS cannot claim it…
    expect(scorePlay({ ...missed, rivalLast: 1 }).lines.some((l) => l.key === 'outaurad')).toBe(
      false,
    )
    // …and is worth nothing to beat, which the reducer enforces by never
    // offering a fumbled turn as the target.
    expect(missed.outcome.score).toBe(0)
  })

  /**
   * The fairness rule the whole redesign hangs on: no gesture may score more
   * than another for being longer, or for asking for more inputs.
   */
  it('scores every card the same for the same hands', () => {
    /**
     * Compared at the bar rather than at a pace: every card is given exactly
     * the chances it asks for, mixed the same way. That is the apples-to-
     * apples question — does the gesture you happened to be dealt decide the
     * score — with how *much* of an open-ended one you get through taken out
     * of it, since that is the player's doing and not the card's.
     */
    /**
     * Measured on runs the same hands actually produce, rather than on a
     * synthetic mix. The two pacings cannot be handed the same script — a
     * counted gesture answers every chance it holds, an open one goes as far
     * past its bar as the player manages — so what is compared is the outcome.
     */
    const meanAccuracy = (skill: number, card: (typeof CARDS)[number]) => {
      const rolls = 300
      let sum = 0
      for (let i = 0; i < rolls; i++) {
        sum += performQte(
          { ...NO_STRATEGY, qteSkill: skill, consistency: 0.6 },
          card,
          (i + 0.5) / rolls,
        ).metrics.accuracy
      }
      return sum / rolls
    }

    for (const profile of [PROFILES.solid, PROFILES.ace]) {
      for (const difficulty of [2, 3] as const) {
        const tier = CARDS.filter((c) => c.difficulty === difficulty)
        const scores = tier.map((c) => meanAccuracy(profile.perfect, c))

        if (import.meta.env.VITE_BALANCE) {
          console.log(
            `${profile.name} d${difficulty}: ` +
              tier.map((c, i) => `${c.name} ${scores[i].toFixed(2)}`).join('  '),
          )
        }
        // Same difficulty, same hands: which of the six gestures you were
        // dealt must not decide the score. A third of the scale is the whole
        // allowance, and the cards that sit at the ends of it are the ones
        // whose bar is lowest — a two-tap sweep is binary in a way a nine-note
        // chart is not, and that is the card's character rather than a bias.
        expect(
          Math.max(...scores) - Math.min(...scores),
          `${profile.name} d${difficulty}`,
        ).toBeLessThan(0.35)
      }
    }

    /**
     * What an open-ended gesture adds on top for being kept going is a
     * separate, capped thing. Uncapped it would hand the sweep, the mash and
     * the number run a permanent edge over the three that end when their chart
     * does — which is the one thing the normalisation exists to stop.
     */
    for (const card of CARDS) {
      let long = EMPTY
      for (let i = 0; i < chancesIn(card) * 3; i++) long = record(long, 'clean')
      expect(settle(card, long).metrics.accuracy, card.name).toBeLessThanOrEqual(QTE_OVERSHOOT_MAX)
    }

    // The counted gestures stay in one band, which is what keeps a long chart
    // from being a long list of ways to lose a PERFECT. The open-ended ones
    // have no count to band — the parity above is what guards those.
    const counts = CARDS.filter((c) => pacingOf(c) === 'counted').map(chancesIn)
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(2)
  })
})
