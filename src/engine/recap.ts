import type { MatchState, PlayerId, TurnResult } from './types'

/** One player's side of the story, once the battle is over. */
export interface PlayerRecap {
  player: PlayerId
  name: string
  /** Their turns, in order. */
  turns: TurnResult[]
  totalAura: number
  perfects: number
  /** Turns lost to a frozen clock rather than played. */
  fumbles: number
  /** Longest run of PERFECTs they put together. */
  bestStreak: number
  reachedGodAura: boolean
  /** The one they will bring up afterwards. */
  best: TurnResult | null
}

/**
 * Turns the match log into something a results screen can show. Kept in the
 * engine and kept pure: the story of a battle is derived from what happened,
 * never accumulated as it goes.
 */
export function recap(state: MatchState): [PlayerRecap, PlayerRecap] {
  return [0, 1].map((id) => {
    const player = state.players[id as PlayerId]
    const turns = state.log.filter((t) => t.player === id)

    const scoring = turns.filter((t) => t.aura > 0)
    const best = scoring.length
      ? scoring.reduce((top, t) => (t.aura > top.aura ? t : top))
      : null

    return {
      player: player.id,
      name: player.name,
      turns,
      totalAura: turns.reduce((sum, t) => sum + t.aura, 0),
      perfects: turns.filter((t) => t.judgement === 'PERFECT').length,
      fumbles: turns.filter((t) => t.judgement === 'LOST_COMPOSURE').length,
      bestStreak: turns.reduce((top, t) => Math.max(top, t.perfectStreak), 0),
      reachedGodAura: turns.some((t) => t.godAuraAfter),
      best,
    }
  }) as [PlayerRecap, PlayerRecap]
}
