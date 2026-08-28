import { getCard } from './cards'
import type { MatchState, PlayerId } from './types'

/**
 * What happened in a battle, as plain numbers. Everything an objective could
 * ever want to ask about, derived from the match log after the fact — the
 * reducer keeps no score of its own and never learns that objectives exist.
 *
 * Pairs are indexed by player id throughout, so an objective reads the same
 * whichever side it is asked about.
 */
export interface BattleStats {
  winner: PlayerId | null
  reason: 'mogged' | 'moves'
  /** The battle ended on the bar rather than on running out of moves. */
  mogged: boolean
  /** Turns taken, both players combined. */
  turns: number
  totalAura: [number, number]
  perfectCount: [number, number]
  goodCount: [number, number]
  missCount: [number, number]
  /** Turns lost to a frozen clock. Not a MISS, but not a clean sheet either. */
  lostComposureCount: [number, number]
  /** Longest run of consecutive PERFECTs. */
  bestStreak: [number, number]
  maxMomentum: [number, number]
  outauraCount: [number, number]
  /** Difficulty-3 cards played and not fumbled. */
  hardLanded: [number, number]
  godAuraReached: [boolean, boolean]
}

const pair = <T,>(value: T): [T, T] => [value, value]

/**
 * Reads a finished (or in-progress) match into its statistics. Pure, and
 * derived rather than accumulated: the story of a battle comes out of what
 * happened, never out of counters kept as it went.
 */
export function battleStats(state: MatchState): BattleStats {
  const stats: BattleStats = {
    winner: null,
    reason: 'moves',
    mogged: false,
    turns: state.log.length,
    totalAura: pair(0),
    perfectCount: pair(0),
    goodCount: pair(0),
    missCount: pair(0),
    lostComposureCount: pair(0),
    bestStreak: pair(0),
    maxMomentum: pair(0),
    outauraCount: pair(0),
    hardLanded: pair(0),
    godAuraReached: pair(false),
  }

  const end = state.phase.kind === 'matchEnd' ? state.phase : state.pendingEnd
  if (end) {
    stats.winner = end.winner
    stats.reason = end.reason
    stats.mogged = end.reason === 'mogged'
  }

  for (const turn of state.log) {
    const p = turn.player
    stats.totalAura[p] += turn.aura
    stats.bestStreak[p] = Math.max(stats.bestStreak[p], turn.perfectStreak)
    stats.maxMomentum[p] = Math.max(stats.maxMomentum[p], turn.momentumAfter)
    if (turn.godAuraAfter) stats.godAuraReached[p] = true
    if (turn.lines.some((l) => l.key === 'outaurad')) stats.outauraCount[p] += 1

    switch (turn.judgement) {
      case 'PERFECT':
        stats.perfectCount[p] += 1
        break
      case 'GOOD':
        stats.goodCount[p] += 1
        break
      case 'MISS':
        stats.missCount[p] += 1
        break
      case 'LOST_COMPOSURE':
        stats.lostComposureCount[p] += 1
        break
    }

    if (turn.cardId && turn.judgement !== 'MISS' && getCard(turn.cardId).difficulty === 3) {
      stats.hardLanded[p] += 1
    }
  }

  return stats
}
