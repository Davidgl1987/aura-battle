import { INTRO_MS, QTE_FORM_SWING } from './balance'
import { ALL_CARD_IDS, getCard } from './cards'
import {
  NO_STRATEGY,
  attemptsFor,
  baseOdds,
  chooseCard,
  cpuRoll,
  oddsFor as cardOdds,
  beatFor,
  performQte,
  slipScale,
  type Strategy,
} from './cpu'
import { EMPTY, record, scrapeable, settle } from './qte'
import { createMatch, qteWindow, step } from './match'
import { nextRandom, shuffle } from './rng'
import { freshnessOf } from './scoring'
import type {
  Card,
  QteOutcome,
  MatchSettings,
  MatchState,
  PlayerId,
  PlayerSetup,
  TurnResult,
} from './types'

/** Nominal time a player spends reading a score sheet before passing over. */
const READING_MS = 2000

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
  /**
   * When set, the profile stops being a bundle of probabilities and plays the
   * real CPU: `chooseCard` reads the whole match state and `judgeQte` grades
   * the QTE. This is how the rival ladder is measured against the brain that
   * actually ships rather than against a stand-in.
   */
  strategy?: Strategy
  /** A fixed hand rather than a random one, for measuring a real rival. */
  deck?: string[]
}

/**
 * A profile's odds against one specific card. Re-exported rather than defined:
 * the difficulty scaling moved to `cpu.ts` when the shipped CPU started
 * playing to it, and the simulator has to measure the same rival the player
 * actually meets.
 */
export { oddsFor } from './cpu'

/**
 * Turns a rival into something the simulator can drive, playing exactly the
 * brain that ships: `chooseCard` picks the card and `judgeQte` grades it. The
 * `perfect`/`good` fields are filled in from the same strategy so a profile
 * still reads on its own in a report.
 */
export function rivalProfile(name: string, strategy: Strategy, deck?: string[]): Profile {
  const odds = baseOdds(strategy)
  return { name, perfect: odds.perfect, good: odds.good, fresh: 0, freeze: strategy.hesitates, strategy, deck }
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

/**
 * A profile's whole gesture, opportunity by opportunity. The simulation drives
 * the same ledger a pair of thumbs does, so what it measures is the game and
 * not a model of it.
 */
function perform(profile: Profile, card: Card, rolls: Rolls, state: MatchState): QteOutcome {
  if (profile.strategy) return performQte(profile.strategy, card, cpuRoll(state, 1))

  const odds = cardOdds(profile, card)
  // Open-ended gestures take as many chances as the hands manage; see
  // `attemptsFor`. The profile's own `perfect` stands in for its pace.
  const total = attemptsFor({ ...NO_STRATEGY, qteSkill: profile.perfect }, card)
  // How this card is going for them, drawn once and felt on every beat of it.
  const form = (rolls.next() - 0.5) * QTE_FORM_SWING
  // The same beat model the rivals run on. It used to be written out again
  // here, and the copy quietly stopped matching the original.
  const slip = slipScale(card)
  const twoTier = scrapeable(card)
  let ledger = EMPTY
  for (let i = 0; i < total; i++) {
    ledger = record(ledger, beatFor(odds, i, total, rolls.next(), form, slip, twoTier))
  }
  return settle(card, ledger)
}

/**
 * Which card they reach for. A player who reads the rival takes the best
 * answer that breaks the last kind played; one who does not just grabs
 * something.
 */
function choose(state: MatchState, profile: Profile, rolls: Rolls): string {
  if (profile.strategy) return chooseCard(state, profile.strategy)
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
  // Rolled for both regardless, so giving one side a fixed deck does not
  // change which random deck the other one gets and shift the comparison.
  const rolled = [rolls.deck(settings.deckSize), rolls.deck(settings.deckSize)]
  const setups: [PlayerSetup, PlayerSetup] = [
    { name: profiles[0].name, characterId: 'blocky', deck: profiles[0].deck ?? rolled[0] },
    { name: profiles[1].name, characterId: 'noodle', deck: profiles[1].deck ?? rolled[1] },
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
        const outcome = perform(profile, getCard(state.phase.cardId), rolls, state)
        if (outcome.judgement === 'PERFECT') perfects[state.active] += 1
        now += Math.min(600, qteWindow(state.phase.cardId) - 100)
        state = step(state, { type: 'QTE_RESULT', outcome, now })
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
/**
 * Ready-made opponents to measure against.
 *
 * `perfect` and `good` are per *opportunity*, not per card. They used to be a
 * whole card's verdict, which under a gesture that is scored beat by beat made
 * even a good player miss four cards in five — a thumb that lands 45% of its
 * taps is not a solid player, it is somebody who has never held the phone.
 */
export const PROFILES = {
  ace: { name: 'ace', perfect: 0.86, good: 0.12, fresh: 0.95, freeze: 0.02 },
  solid: { name: 'solid', perfect: 0.7, good: 0.22, fresh: 0.7, freeze: 0.05 },
  sloppy: { name: 'sloppy', perfect: 0.46, good: 0.34, fresh: 0.3, freeze: 0.14 },
  /** Executes well but never reads the rival: the control for freshness. */
  blind: { name: 'blind', perfect: 0.7, good: 0.22, fresh: 0, freeze: 0.05 },
  /** Reads the rival but fumbles the inputs: the control for execution. */
  reader: { name: 'reader', perfect: 0.46, good: 0.34, fresh: 1, freeze: 0.05 },
  /** Same hands as `solid`, but leans on one kind: the control for variety. */
  repeater: { name: 'repeater', perfect: 0.7, good: 0.22, fresh: 0, freeze: 0.05, mode: 'repeat' },
} satisfies Record<string, Profile>
