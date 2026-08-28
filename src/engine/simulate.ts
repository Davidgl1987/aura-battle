import { INTRO_MS } from './balance'

/** Nominal time a player spends reading a score sheet before passing over. */
const READING_MS = 2000
import { ALL_CARD_IDS, getCard } from './cards'
import { createMatch, qteWindow, step } from './match'
import { nextRandom, shuffle } from './rng'
import { freshnessOf } from './scoring'
import type {
  Card,
  Difficulty,
  Judgement,
  MatchSettings,
  MatchState,
  PlayerId,
  PlayerSetup,
  TurnResult,
} from './types'

/**
 * A player, as far as the numbers are concerned. Everything the balance cares
 * about is here: how well they execute, whether they bother reading the rival,
 * and how often they freeze on the clock.
 */
export interface Profile {
  name: string
  /** Chance a QTE comes out PERFECT, on a difficulty-2 card. */
  perfect: number
  /** Chance of a GOOD; whatever is left over is a MISS. */
  good: number
  /** Chance they answer with a kind the rival did not just play. */
  fresh: number
  /** Chance they let the choosing clock run out. */
  freeze: number
  /**
   * What they do when they are not reading the rival. Picking at random still
   * comes out FRESH about two thirds of the time, so it is not the control for
   * variety — `repeat` is, because it is the habit the scoring is meant to
   * punish.
   */
  mode?: 'random' | 'repeat'
}

/**
 * Hard cards have to actually be hard, or the bonus for landing one is free
 * money. A profile's numbers describe a difficulty-2 card; easy cards forgive
 * and hard ones punish, which is what makes picking one a real decision.
 */
const PERFECT_SCALE: Record<Difficulty, number> = { 1: 1.25, 2: 1, 3: 0.72 }
const MISS_SCALE: Record<Difficulty, number> = { 1: 0.5, 2: 1, 3: 1.8 }

/** A profile's odds against one specific card. */
export function oddsFor(profile: Profile, card: Card): { perfect: number; good: number } {
  const perfect = Math.min(0.97, profile.perfect * PERFECT_SCALE[card.difficulty])
  const miss = Math.min(
    1 - perfect,
    (1 - profile.perfect - profile.good) * MISS_SCALE[card.difficulty],
  )
  return { perfect, good: 1 - perfect - miss }
}

export interface MatchSummary {
  winner: PlayerId | null
  reason: 'mogged' | 'moves'
  /** Turns actually taken, both players combined. */
  turns: number
  finalBalance: number
  /** Whether each player ever reached god aura. */
  godAura: [boolean, boolean]
  freezes: [number, number]
  fresh: [number, number]
  perfects: [number, number]
  /** Longest PERFECT streak each player put together. */
  bestStreak: [number, number]
  outaurad: [number, number]
  /** Every scoring play's total, for checking the numbers read as intended. */
  scores: number[]
}

/** A seeded roll, threaded so a whole simulation replays from one number. */
class Rolls {
  private seed: number

  constructor(seed: number) {
    this.seed = seed
  }

  next(): number {
    const r = nextRandom(this.seed)
    this.seed = r.seed
    return r.value
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)]
  }

  deck(size: number): string[] {
    const shuffled = shuffle(ALL_CARD_IDS, Math.floor(this.next() * 0xffffffff))
    return shuffled.items.slice(0, size)
  }
}

function judge(profile: Profile, card: Card, rolls: Rolls): Judgement {
  const odds = oddsFor(profile, card)
  const roll = rolls.next()
  if (roll < odds.perfect) return 'PERFECT'
  return roll < odds.perfect + odds.good ? 'GOOD' : 'MISS'
}

/**
 * Which card they reach for. A player who reads the rival takes the best
 * answer that breaks the last kind played; one who does not just grabs
 * something.
 */
function choose(state: MatchState, profile: Profile, rolls: Rolls): string {
  const remaining = state.players[state.active].remaining
  const cards = remaining.map(getCard)

  if (rolls.next() >= profile.fresh) {
    if (profile.mode !== 'repeat') return rolls.pick(remaining)
    const same = cards.filter((c) => freshnessOf(c, state.lastPlayed) !== 'FRESH')
    const pool = same.length ? same : cards
    return pool.reduce((best, c) => (c.baseAura > best.baseAura ? c : best)).id
  }

  const breaking = cards.filter((c) => freshnessOf(c, state.lastPlayed) === 'FRESH')
  const pool = breaking.length ? breaking : cards
  return pool.reduce((best, c) => (c.baseAura > best.baseAura ? c : best)).id
}

/** Plays one whole match between two profiles and reports what happened. */
export function simulateMatch(
  settings: MatchSettings,
  profiles: [Profile, Profile],
  seed: number,
  captureLog?: TurnResult[],
): MatchSummary {
  const rolls = new Rolls(seed)
  const setups: [PlayerSetup, PlayerSetup] = [
    { name: profiles[0].name, characterId: 'blocky', deck: rolls.deck(settings.deckSize) },
    { name: profiles[1].name, characterId: 'noodle', deck: rolls.deck(settings.deckSize) },
  ]

  let now = 0
  let state = step(createMatch(settings, setups, seed), {
    type: 'START',
    now,
    seed,
    settings,
    setups,
  })

  const godAura: [boolean, boolean] = [false, false]
  const freezes: [number, number] = [0, 0]
  const fresh: [number, number] = [0, 0]
  const perfects: [number, number] = [0, 0]
  const bestStreak: [number, number] = [0, 0]
  const outaurad: [number, number] = [0, 0]
  const scores: number[] = []
  let turns = 0

  // Every phase advances, so this only trips if the machine ever stalls.
  for (let guard = 0; guard < 400 && state.phase.kind !== 'matchEnd'; guard++) {
    const profile = profiles[state.active]

    switch (state.phase.kind) {
      case 'handoff':
        state = step(state, { type: 'READY', now })
        break

      case 'choosing': {
        turns += 1
        if (rolls.next() < profile.freeze) {
          freezes[state.active] += 1
          now += settings.chooseMs
          state = step(state, { type: 'TICK', now })
          break
        }
        const cardId = choose(state, profile, rolls)
        if (freshnessOf(getCard(cardId), state.lastPlayed) === 'FRESH') fresh[state.active] += 1
        now += 400
        state = step(state, { type: 'SELECT_CARD', cardId, now })
        break
      }

      case 'performIntro':
        now += INTRO_MS
        state = step(state, { type: 'TICK', now })
        break

      case 'qte': {
        const judgement = judge(profile, getCard(state.phase.cardId), rolls)
        if (judgement === 'PERFECT') perfects[state.active] += 1
        now += Math.min(600, qteWindow(state.phase.cardId) - 100)
        state = step(state, { type: 'QTE_RESULT', judgement, now })
        const last = state.log[state.log.length - 1]
        if (last) {
          bestStreak[last.player] = Math.max(bestStreak[last.player], last.perfectStreak)
          if (last.lines.some((l) => l.key === 'outaurad')) outaurad[last.player] += 1
          if (last.aura > 0) scores.push(last.aura)
        }
        break
      }

      case 'resolve':
      case 'lostComposure':
        for (const p of state.players) if (p.godAura) godAura[p.id] = true
        now += READING_MS
        state = step(state, { type: 'READY', now })
        break

      default:
        now += 100
        state = step(state, { type: 'TICK', now })
    }
  }

  if (captureLog) captureLog.push(...state.log)

  const end = state.phase.kind === 'matchEnd' ? state.phase : null
  return {
    winner: end?.winner ?? null,
    reason: end?.reason ?? 'moves',
    turns,
    finalBalance: state.balance,
    godAura,
    freezes,
    fresh,
    perfects,
    bestStreak,
    outaurad,
    scores,
  }
}

/**
 * The full match log rather than a summary, for digging into where an edge
 * comes from turn by turn.
 */
export function simulateLog(
  settings: MatchSettings,
  profiles: [Profile, Profile],
  seed: number,
): TurnResult[] {
  const captured: TurnResult[] = []
  simulateMatch(settings, profiles, seed, captured)
  return captured
}

export interface Tally {
  matches: number
  winsP0: number
  winsP1: number
  draws: number
  mogged: number
  godAuraReached: number
  averageTurns: number
  averageGap: number
  /** Signed, so it says who the aura actually went to, not just how far. */
  averageBalance: number
  averageFresh: [number, number]
  averagePerfects: [number, number]
}

/** Runs a match-up many times over and boils it down to the numbers. */
export function tally(
  settings: MatchSettings,
  profiles: [Profile, Profile],
  matches: number,
  seed = 1,
): Tally {
  const out: Tally = {
    matches,
    winsP0: 0,
    winsP1: 0,
    draws: 0,
    mogged: 0,
    godAuraReached: 0,
    averageTurns: 0,
    averageGap: 0,
    averageBalance: 0,
    averageFresh: [0, 0],
    averagePerfects: [0, 0],
  }

  for (let i = 0; i < matches; i++) {
    const summary = simulateMatch(settings, profiles, seed + i * 7919)
    if (summary.winner === 0) out.winsP0 += 1
    else if (summary.winner === 1) out.winsP1 += 1
    else out.draws += 1
    if (summary.reason === 'mogged') out.mogged += 1
    if (summary.godAura[0] || summary.godAura[1]) out.godAuraReached += 1
    out.averageTurns += summary.turns
    out.averageGap += Math.abs(summary.finalBalance)
    out.averageBalance += summary.finalBalance
    out.averageFresh[0] += summary.fresh[0]
    out.averageFresh[1] += summary.fresh[1]
    out.averagePerfects[0] += summary.perfects[0]
    out.averagePerfects[1] += summary.perfects[1]
  }

  out.averageTurns /= matches
  out.averageGap /= matches
  out.averageBalance /= matches
  out.averageFresh = [out.averageFresh[0] / matches, out.averageFresh[1] / matches]
  out.averagePerfects = [out.averagePerfects[0] / matches, out.averagePerfects[1] / matches]
  return out
}

/** Ready-made opponents to measure against. */
export const PROFILES = {
  ace: { name: 'ace', perfect: 0.75, good: 0.2, fresh: 0.95, freeze: 0.02 },
  solid: { name: 'solid', perfect: 0.45, good: 0.4, fresh: 0.7, freeze: 0.05 },
  sloppy: { name: 'sloppy', perfect: 0.15, good: 0.45, fresh: 0.3, freeze: 0.14 },
  /** Executes well but never reads the rival: the control for freshness. */
  blind: { name: 'blind', perfect: 0.45, good: 0.4, fresh: 0, freeze: 0.05 },
  /** Reads the rival but fumbles the inputs: the control for execution. */
  reader: { name: 'reader', perfect: 0.15, good: 0.45, fresh: 1, freeze: 0.05 },
  /** Same hands as `solid`, but leans on one kind: the control for variety. */
  repeater: { name: 'repeater', perfect: 0.45, good: 0.4, fresh: 0, freeze: 0.05, mode: 'repeat' },
} satisfies Record<string, Profile>
