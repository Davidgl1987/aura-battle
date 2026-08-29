import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  INTRO_MS,
  MOGGED_THRESHOLD,
} from './balance'
import { getCard } from './cards'
import { createMatch, qteWindow, remainingCards, step } from './match'
import type { Play } from './scoring'
import { applyMomentum, freshnessOf, momentumDelta, scorePlay, streakOf } from './scoring'
import { runFor } from './qte'
import type {
  Action,
  GameEvent,
  Judgement,
  MatchSettings,
  MatchState,
  PlayerSetup,
  QteKind,
} from './types'

/** Two of every kind, so a FRESH answer always exists at any deck size. */
const MIXED = ['mewing', 'six-seven', 'split-focus', 'griddy-drop', 'rizz-clap', 'lean']

interface DriverOptions {
  settings?: Partial<MatchSettings>
  decks?: [string[], string[]]
  seed?: number
}

/** Drives a match with a fake clock, one whole turn at a time. */
class Driver {
  s: MatchState
  t = 1000
  /** Every event the match has emitted, in order. */
  events: GameEvent[] = []
  readonly settings: MatchSettings

  constructor(options: DriverOptions = {}) {
    const settings = { ...DEFAULT_SETTINGS, ...options.settings }
    const seed = options.seed ?? 42
    const deck = (i: 0 | 1) => options.decks?.[i] ?? MIXED.slice(0, settings.deckSize)
    const setups: [PlayerSetup, PlayerSetup] = [
      { name: 'P1', characterId: 'blocky', deck: deck(0) },
      { name: 'P2', characterId: 'noodle', deck: deck(1) },
    ]

    this.settings = settings
    this.s = step(createMatch(settings, setups, seed), {
      type: 'START',
      now: this.t,
      seed,
      settings,
      setups,
    })
    this.events.push(...this.s.events)
  }

  run(action: Action): MatchState {
    this.s = step(this.s, action)
    this.events.push(...this.s.events)
    return this.s
  }

  tick(ms: number): MatchState {
    this.t += ms
    return this.run({ type: 'TICK', now: this.t })
  }

  /** The phone changed hands and the next player tapped to begin. */
  ready(): MatchState {
    return this.run({ type: 'READY', now: this.t })
  }

  /**
   * Runs a turn and stops on the score sheet, which is where a turn now ends:
   * it has no clock, so the next `ready()` is what moves the match on.
   */
  play(cardId: string, judgement: Judgement): MatchState {
    this.ready()
    this.run({ type: 'SELECT_CARD', cardId, now: this.t })
    this.tick(INTRO_MS)
    this.t += 20
    return this.run({ type: 'QTE_RESULT', outcome: runFor(getCard(cardId), judgement), now: this.t })
  }

  /**
   * Settle whatever is on screen, then take a turn. Picking has to happen
   * after the handoff, not before: on a score sheet the active player is still
   * the one who just performed, and they may have nothing left to play.
   */
  turn(judgement: Judgement, kind?: QteKind): MatchState {
    this.ready()
    // Settling the last score sheet can be what ends the battle.
    if (this.s.phase.kind === 'matchEnd') return this.s
    return this.play(this.pick(kind), judgement)
  }

  /** The same, answering with whatever breaks the last kind played. */
  turnFresh(judgement: Judgement): MatchState {
    this.ready()
    if (this.s.phase.kind === 'matchEnd') return this.s
    return this.play(this.pickFresh(), judgement)
  }

  /** Plays the battle out to its end, settling every score sheet on the way. */
  runToEnd(judgement: Judgement, guard = 40): MatchState {
    while (this.s.phase.kind !== 'matchEnd' && guard-- > 0) this.turn(judgement)
    return this.s
  }

  /** Play up to the QTE and stop there, with the widget's parameters on show. */
  toQte(cardId: string): MatchState {
    this.ready()
    this.run({ type: 'SELECT_CARD', cardId, now: this.t })
    return this.tick(INTRO_MS)
  }

  /** Take the phone and then sit on the card picker until time runs out. */
  stall(): MatchState {
    this.ready()
    return this.tick(this.settings.chooseMs)
  }

  /** A card the active player still holds, of `kind` when possible. */
  pick(kind?: QteKind): string {
    const cards = remainingCards(this.s.players[this.s.active])
    return (kind ? (cards.find((c) => c.kind === kind) ?? cards[0]) : cards[0]).id
  }

  /** The best answer left: highest aura among the cards that break the last kind. */
  pickFresh(): string {
    const cards = remainingCards(this.s.players[this.s.active])
    const last = this.s.lastPlayed
    const fresh = cards.filter((c) => !last || c.kind !== last.kind)
    const pool = fresh.length ? fresh : cards
    return pool.reduce((best, c) => (c.baseAura > best.baseAura ? c : best)).id
  }
}

describe('setup', () => {
  it('puts the whole deck on the table: no draw pile, no refills', () => {
    const d = new Driver()
    for (const p of d.s.players) {
      expect(p.deck).toHaveLength(DEFAULT_SETTINGS.deckSize)
      expect(p.remaining).toEqual(p.deck)
    }
  })

  it('honours the chosen deck size', () => {
    const d = new Driver({ settings: { deckSize: 6 } })
    expect(d.s.players[0].remaining).toHaveLength(6)
  })

  it('keeps each player on the cards and character they picked', () => {
    const d = new Driver({ decks: [['mewing', 'lean'], ['sturdy', 'levitate']], settings: { deckSize: 2 } })
    expect(d.s.players[0].remaining).toEqual(['mewing', 'lean'])
    expect(d.s.players[1].remaining).toEqual(['sturdy', 'levitate'])
    expect(d.s.players[1].characterId).toBe('noodle')
  })

  it('falls back to P1 / P2 when the alias is left blank', () => {
    const settings = DEFAULT_SETTINGS
    const setups: [PlayerSetup, PlayerSetup] = [
      { name: '   ', characterId: 'orb', deck: MIXED.slice(0, 4) },
      { name: 'Dav', characterId: 'chad', deck: MIXED.slice(0, 4) },
    ]
    const s = step(createMatch(settings, setups, 1), { type: 'START', now: 0, settings, setups })
    expect(s.players.map((p) => p.name)).toEqual(['P1', 'Dav'])
  })
})

describe('handoff', () => {
  it('waits for the phone to change hands before the clock starts', () => {
    const d = new Driver()
    expect(d.s.phase).toEqual({ kind: 'handoff', player: 0 })

    // A minute goes by with the phone on the table: nothing happens.
    d.tick(60_000)
    expect(d.s.phase.kind).toBe('handoff')
    expect(d.s.log).toHaveLength(0)

    d.ready()
    expect(d.s.phase).toMatchObject({ kind: 'choosing', endsAt: d.t + DEFAULT_SETTINGS.chooseMs })
  })

  it('holds the score sheet until the next player takes the phone', () => {
    const d = new Driver()
    d.play(d.pick(), 'GOOD')

    // The bill has no clock. It is the handoff, so it cannot time out from
    // under someone who is still reading it.
    expect(d.s.phase.kind).toBe('resolve')
    d.tick(60_000)
    expect(d.s.phase.kind).toBe('resolve')
    expect(d.s.active).toBe(0)

    d.ready()
    expect(d.s.phase).toMatchObject({ kind: 'choosing', endsAt: d.t + DEFAULT_SETTINGS.chooseMs })
    expect(d.s.active).toBe(1)
  })

  it('does the same for a fumbled turn, so the burnt card can be read', () => {
    const d = new Driver()
    d.stall()
    expect(d.s.phase.kind).toBe('lostComposure')
    d.tick(60_000)
    expect(d.s.phase.kind).toBe('lostComposure')

    d.ready()
    expect(d.s.phase.kind).toBe('choosing')
    expect(d.s.active).toBe(1)
  })

  it('ignores READY outside a handoff', () => {
    const d = new Driver()
    d.ready()
    const endsAt = d.s.phase.kind === 'choosing' ? d.s.phase.endsAt : 0

    d.t += 1_000
    d.run({ type: 'READY', now: d.t })

    // A second tap must not restart the countdown.
    expect(d.s.phase).toMatchObject({ kind: 'choosing', endsAt })
  })

  it('uses the configured choosing time', () => {
    const d = new Driver({ settings: { chooseMs: 5000 } })
    d.ready()
    expect(d.s.phase).toMatchObject({ kind: 'choosing', endsAt: d.t + 5000 })
  })
})

describe('freshness', () => {
  const timing = getCard('mewing')
  const otherTiming = getCard('sigma-stare')
  const speed = getCard('six-seven')

  it('counts the opening move as FRESH: there is nothing to repeat yet', () => {
    expect(freshnessOf(timing, null)).toBe('FRESH')
  })

  it('is FRESH against a different kind', () => {
    expect(freshnessOf(timing, { cardId: speed.id, kind: speed.kind })).toBe('FRESH')
  })

  it('is NEUTRAL against the same kind', () => {
    expect(freshnessOf(timing, { cardId: otherTiming.id, kind: otherTiming.kind })).toBe('NEUTRAL')
  })

  it('is STALE against the very same card', () => {
    expect(freshnessOf(timing, { cardId: timing.id, kind: timing.kind })).toBe('STALE')
  })

  it('reads the rival last play, not your own', () => {
    const d = new Driver()
    const first = d.pick('speed')
    d.play(first, 'PERFECT')
    expect(d.s.lastPlayed).toEqual({ cardId: first, kind: getCard(first).kind })

    d.play(d.pick('timing'), 'PERFECT')
    expect(d.s.log[1].freshness).toBe('FRESH')
  })
})

describe('scoring', () => {
  const card = getCard('griddy-drop')
  const play = (over: Partial<Play> = {}): Play => ({
    card,
    outcome: runFor(card, 'PERFECT'),
    freshness: 'NEUTRAL',
    godAura: false,
    streak: 0,
    rivalLast: 0,
    ...over,
  })

  it('rewards varying kinds and punishes repeating a card', () => {
    // Aura pays a bonus for varying; repeating is punished on the momentum
    // side, so the resolve screen never has to show a line worth nothing.
    expect(scorePlay(play({ freshness: 'FRESH' })).total).toBeGreaterThan(
      scorePlay(play({ freshness: 'NEUTRAL' })).total,
    )
    expect(momentumDelta(play({ freshness: 'FRESH' }))).toBeGreaterThan(
      momentumDelta(play({ freshness: 'NEUTRAL' })),
    )
    expect(momentumDelta(play({ freshness: 'NEUTRAL' }))).toBeGreaterThan(
      momentumDelta(play({ freshness: 'STALE' })),
    )
  })

  it('scores GOOD below PERFECT and loses aura on a MISS', () => {
    expect(scorePlay(play({ outcome: runFor(card, 'GOOD'), freshness: 'FRESH' })).total).toBeLessThan(
      scorePlay(play({ freshness: 'FRESH' })).total,
    )
    expect(scorePlay(play({ outcome: runFor(card, 'MISS'), freshness: 'FRESH' })).total).toBeLessThan(0)
  })

  it('never lets a bonus soften a MISS', () => {
    const plain = scorePlay(play({ outcome: runFor(card, 'MISS') }))
    expect(plain.lines).toHaveLength(1)
    for (const over of [
      { freshness: 'STALE' } as const,
      { freshness: 'FRESH', godAura: true, streak: 5, rivalLast: 100 } as const,
    ]) {
      expect(scorePlay(play({ outcome: runFor(card, 'MISS'), ...over })).total).toBe(plain.total)
    }
  })

  it('adds up to exactly what it shows', () => {
    const big = scorePlay(
      play({ freshness: 'FRESH', streak: 4, rivalLast: 900, godAura: true }),
    )
    expect(big.lines.map((l) => l.key)).toEqual([
      'base',
      'perfect',
      'fresh',
      'hard',
      'streak',
      'outaurad',
      'god',
    ])
    expect(big.lines.reduce((sum, l) => sum + l.value, 0)).toBe(big.total)
  })

  it("only says OUTAURA'D when the play clearly beats the rival's last", () => {
    // Measured against impact — what the play was worth before momentum and
    // god aura — rather than against a finished total. Comparing totals was
    // the old rule and it made a rival who had caught fire unbeatable.
    const impact = scorePlay(play({ rivalLast: 0 })).impact
    const beat = (rivalLast: number) =>
      scorePlay(play({ rivalLast })).lines.some((l) => l.key === 'outaurad')

    expect(beat(0)).toBe(false)
    expect(beat(impact)).toBe(false)
    expect(beat(Math.floor(impact / 2))).toBe(true)
    // Half again is the bar, exactly.
    expect(beat(Math.floor(impact / 1.5))).toBe(true)
  })

  it('grows the streak bonus and drops it the moment a PERFECT is missed', () => {
    const chain = (streak: number) => scorePlay(play({ streak })).total
    expect(chain(1)).toBe(chain(0))
    expect(chain(2)).toBeGreaterThan(chain(1))
    expect(chain(3)).toBeGreaterThan(chain(2))
    expect(streakOf(4, 'GOOD')).toBe(0)
    expect(streakOf(4, 'PERFECT')).toBe(5)
  })

  it('pushes the shared bar toward whoever earned the aura', () => {
    const d = new Driver()
    d.play(d.pick('speed'), 'PERFECT')
    const afterP0 = d.s.balance
    expect(afterP0).toBeGreaterThan(0)

    d.play(d.pick('timing'), 'PERFECT')
    expect(d.s.balance).toBeLessThan(afterP0)
  })
})

describe('momentum and god aura', () => {
  const run = (over: Partial<Play> = {}): Play => ({
    card: getCard('griddy-drop'),
    outcome: runFor(getCard('griddy-drop'), 'PERFECT'),
    freshness: 'FRESH',
    godAura: false,
    streak: 0,
    rivalLast: 0,
    ...over,
  })

  it('turns god aura on after a run of hard, fresh perfects', () => {
    let m = { momentum: 0, godAura: false }
    for (let i = 1; i <= 3; i++) m = applyMomentum(m.momentum, m.godAura, run({ streak: i }))
    expect(m).toEqual({ momentum: 100, godAura: true })
  })

  it('takes longer to catch fire on easy cards played safe', () => {
    let m = { momentum: 0, godAura: false }
    const safe = run({ card: getCard('mewing'), outcome: runFor(getCard('mewing'), 'GOOD'), freshness: 'NEUTRAL' })
    for (let i = 0; i < 3; i++) m = applyMomentum(m.momentum, m.godAura, safe)
    expect(m.godAura).toBe(false)
  })

  it('breaks god aura on a MISS and knocks momentum down', () => {
    const broken = applyMomentum(100, true, run({ outcome: runFor(getCard('griddy-drop'), 'MISS'), freshness: 'NEUTRAL' }))
    expect(broken.godAura).toBe(false)
    expect(broken.momentum).toBeLessThan(100)
  })

  it('reaches god aura through a run of fresh perfects, and says so on the bus', () => {
    const d = new Driver()
    // P0 always answers with a different kind and nails it; P1 keeps the bar
    // honest with GOODs so the match does not end early.
    for (let i = 0; i < 4; i++) {
      if (d.s.phase.kind !== 'matchEnd') d.turnFresh('PERFECT')
      if (d.s.phase.kind !== 'matchEnd') d.turnFresh('GOOD')
    }

    expect(d.s.log.filter((r) => r.player === 0).map((r) => r.freshness)).toEqual([
      'FRESH',
      'FRESH',
      'FRESH',
      'FRESH',
    ])
    expect(d.s.players[0].godAura).toBe(true)
    expect(d.s.players[1].godAura).toBe(false)
    expect(d.events).toContainEqual({ type: 'godAura', player: 0, on: true })
  })
})

describe('lost composure', () => {
  it('wipes momentum and costs the turn, but never a card', () => {
    const d = new Driver()
    d.turn('PERFECT', 'speed')
    d.turn('MISS')

    const before = d.s.players[0]
    expect(before.momentum).toBeGreaterThan(0)
    const balance = d.s.balance

    d.ready()
    d.stall()

    const after = d.s.players[0]
    const result = d.s.log.at(-1)!
    expect(result.judgement).toBe('LOST_COMPOSURE')
    expect(result.cardId).toBeNull()
    // The hand is untouched: freezing spends a move, not a card.
    expect(after.remaining).toEqual(before.remaining)
    expect(after.momentum).toBe(0)
    expect(after.godAura).toBe(false)
    expect(after.movesPlayed).toBe(before.movesPlayed + 1)
    expect(d.s.balance).toBe(balance)
  })

  it('leaves a card in the hand of whoever froze, once the moves run out', () => {
    const d = new Driver()
    d.stall()
    let guard = 20
    while (d.s.phase.kind !== 'matchEnd' && guard-- > 0) d.turn('GOOD')

    expect(d.s.phase).toMatchObject({ kind: 'matchEnd', reason: 'moves' })
    expect(d.s.players[0].remaining).toHaveLength(1)
    expect(d.s.players[1].remaining).toHaveLength(0)
  })

  it('keeps the previous play as the freshness reference', () => {
    const d = new Driver()
    const first = d.pick('speed')
    d.play(first, 'PERFECT')
    d.stall()
    expect(d.s.lastPlayed?.cardId).toBe(first)
  })

  it('still costs a turn, so the battle stays the same length', () => {
    const d = new Driver()
    while (d.s.phase.kind !== 'matchEnd') d.stall()

    expect(d.s.players.map((p) => p.movesPlayed)).toEqual([
      DEFAULT_SETTINGS.deckSize,
      DEFAULT_SETTINGS.deckSize,
    ])
    expect(d.s.phase).toMatchObject({ kind: 'matchEnd', winner: null, reason: 'moves' })
  })
})

describe('turn flow', () => {
  it('takes the played card off the table for good', () => {
    const d = new Driver()
    const played = d.pick()
    d.play(played, 'GOOD')

    const p0 = d.s.players[0]
    expect(p0.remaining).not.toContain(played)
    expect(p0.remaining).toHaveLength(DEFAULT_SETTINGS.deckSize - 1)
    expect(p0.deck).toContain(played)
  })

  it('counts an unfinished QTE as a MISS', () => {
    const d = new Driver()
    const card = getCard(d.pick())
    d.ready()
    d.run({ type: 'SELECT_CARD', cardId: card.id, now: d.t })
    d.tick(INTRO_MS)
    d.tick(card.durationMs)
    expect(d.s.phase.kind).toBe('qte') // still open: the widget gets its grace
    d.tick(qteWindow(card.id) - card.durationMs)

    expect(d.s.log.at(-1)?.judgement).toBe('MISS')
    expect(d.s.balance).toBeLessThan(0)
  })

  it('ignores a card the player does not hold', () => {
    const d = new Driver()
    d.ready()
    const after = d.run({ type: 'SELECT_CARD', cardId: 'levitate', now: d.t })
    expect(after.phase.kind).toBe('choosing')
    expect(after.players[0].remaining).toEqual(d.s.players[0].deck)
  })

  it('returns the very same state on an idle tick', () => {
    const d = new Driver()
    d.ready()
    d.tick(1) // drains the events left over from the phase change
    const idle = d.s
    expect(step(idle, { type: 'TICK', now: d.t + 1 })).toBe(idle)
  })
})

describe('never the same puzzle twice', () => {
  it('hands the QTE a fresh variation to shuffle itself with', () => {
    const d = new Driver()
    const phase = d.toQte(d.pick()).phase
    expect(phase.kind).toBe('qte')
    if (phase.kind === 'qte') {
      expect(phase.variation).toBeGreaterThanOrEqual(0)
      expect(phase.variation).toBeLessThan(1)
    }
  })

  it('changes it from one play to the next', () => {
    const d = new Driver()
    const seen: number[] = []
    for (let i = 0; i < 4; i++) {
      const phase = d.toQte(d.pick()).phase
      if (phase.kind === 'qte') seen.push(phase.variation)
      // finish the turn so the next one can start
      d.t += 20
      if (phase.kind === 'qte') {
        d.run({ type: 'QTE_RESULT', outcome: runFor(getCard(phase.cardId), 'GOOD'), now: d.t })
      }
      d.ready()
    }
    expect(new Set(seen).size).toBe(seen.length)
  })

  it('still replays exactly from the same seed', () => {
    const variations = (seed: number) => {
      const d = new Driver({ seed })
      const out: number[] = []
      for (let i = 0; i < 3; i++) {
        const phase = d.toQte(d.pick()).phase
        if (phase.kind === 'qte') out.push(phase.variation)
        d.t += 20
        if (phase.kind === 'qte') {
          d.run({ type: 'QTE_RESULT', outcome: runFor(getCard(phase.cardId), 'GOOD'), now: d.t })
        }
        d.ready()
      }
      return out
    }
    expect(variations(99)).toEqual(variations(99))
    expect(variations(99)).not.toEqual(variations(100))
  })
})

describe('pausing', () => {
  it('gives back the time the game was not running', () => {
    const d = new Driver()
    d.ready()
    const before = d.s.phase
    if (before.kind !== 'choosing') throw new Error('expected choosing')

    // The tab was hidden for 10 seconds: far past the choosing deadline.
    d.t += 10_000
    d.run({ type: 'RESUME', skippedMs: 10_000, now: d.t })
    d.tick(0)

    expect(d.s.phase.kind).toBe('choosing')
    expect(d.s.log).toHaveLength(0)
  })

  it('never hands back more time than the phase is worth', () => {
    const d = new Driver()
    d.ready()
    // The stall began long before this turn did, so most of it is not ours.
    d.t += 1_000
    d.run({ type: 'RESUME', skippedMs: 30_000, now: d.t })

    expect(d.s.phase.kind).toBe('choosing')
    if (d.s.phase.kind === 'choosing') {
      expect(d.s.phase.endsAt - d.t).toBe(DEFAULT_SETTINGS.chooseMs)
      expect(d.s.phase.endsAt - d.s.phase.startedAt).toBe(DEFAULT_SETTINGS.chooseMs)
    }
  })

  it('keeps the QTE window intact across a pause', () => {
    const d = new Driver()
    const card = getCard(d.pick())
    d.ready()
    d.run({ type: 'SELECT_CARD', cardId: card.id, now: d.t })
    d.tick(INTRO_MS)
    if (d.s.phase.kind !== 'qte') throw new Error('expected qte')
    const started = d.s.phase.startedAt

    d.t += 5_000
    d.run({ type: 'RESUME', skippedMs: 5_000, now: d.t })

    expect(d.s.phase.kind).toBe('qte')
    if (d.s.phase.kind === 'qte') {
      expect(d.s.phase.startedAt).toBe(started + 5_000)
      expect(d.s.phase.endsAt - d.s.phase.startedAt).toBe(qteWindow(card.id))
    }
  })
})

describe('ending the match', () => {
  it('ends when both players run out of moves', () => {
    const d = new Driver()
    d.runToEnd('GOOD')

    expect(d.s.phase).toMatchObject({ kind: 'matchEnd', reason: 'moves' })
    expect(d.s.players.every((p) => p.movesPlayed === DEFAULT_SETTINGS.deckSize)).toBe(true)
    expect(d.s.log).toHaveLength(DEFAULT_SETTINGS.deckSize * 2)
  })

  it('runs longer with bigger decks', () => {
    // Both whiffing keeps the bar near the middle, so the battle runs its full
    // length instead of being cut short by a mogging.
    const length = (deckSize: number) => {
      const d = new Driver({ settings: { deckSize } })
      d.runToEnd('MISS')
      return d.s.log.length
    }
    expect(length(6)).toBe(12)
    expect(length(6)).toBeGreaterThan(length(4))
  })

  it('ends instantly when a player takes over the bar, with cards still in hand', () => {
    const d = new Driver()
    // One good move away from mogging: the cheapest card still gets there.
    d.s = { ...d.s, balance: MOGGED_THRESHOLD - 5 }
    d.turnFresh('PERFECT')
    // The score sheet still has to be read; passing the phone finds it over.
    expect(d.s.phase.kind).toBe('resolve')
    d.ready()

    expect(d.s.balance).toBeGreaterThanOrEqual(MOGGED_THRESHOLD)
    expect(d.s.phase).toMatchObject({ kind: 'matchEnd', winner: 0, reason: 'mogged' })
    expect(d.s.players[0].remaining.length).toBeGreaterThan(0)
    expect(d.events).toContainEqual({ type: 'mogged', winner: 0 })
  })

  it('mogs in the other direction too', () => {
    const d = new Driver()
    d.turnFresh('MISS')
    d.ready()
    d.s = { ...d.s, balance: -(MOGGED_THRESHOLD - 5) }
    d.turnFresh('PERFECT')
    d.ready()

    expect(d.s.phase).toMatchObject({ kind: 'matchEnd', winner: 1, reason: 'mogged' })
  })

  it('stops accepting input once the match is over', () => {
    const d = new Driver()
    d.runToEnd('GOOD')

    const ended = d.s
    expect(step(ended, { type: 'READY', now: d.t }).phase.kind).toBe('matchEnd')
    expect(step(ended, { type: 'TICK', now: d.t + 9999 }).phase.kind).toBe('matchEnd')
  })
})
