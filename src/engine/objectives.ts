import type { Reward } from './rewards'
import type { BattleStats } from './stats'
import type { PlayerId } from './types'

/**
 * What a rival asks of you, as data. Every one of these is answered from
 * `BattleStats` alone, which is why `match.ts` has never heard of an
 * objective: adding "land four hard cards" is a line in this union and a case
 * in one switch, not a condition threaded through the turn machine.
 */
export type ObjectiveCheck =
  | { kind: 'win' }
  | { kind: 'aura'; amount: number }
  | { kind: 'mogged' }
  | { kind: 'outaura'; count: number }
  | { kind: 'streak'; length: number }
  | { kind: 'perfects'; count: number }
  | { kind: 'godAura' }
  | { kind: 'noMiss' }
  | { kind: 'hardLanded'; count: number }
  | { kind: 'momentum'; atLeast: number }

export interface Objective {
  check: ObjectiveCheck
  reward: Reward
}

/** Whether `me` met the objective in a finished battle. */
export function meets(check: ObjectiveCheck, stats: BattleStats, me: PlayerId): boolean {
  switch (check.kind) {
    case 'win':
      return stats.winner === me
    case 'aura':
      return stats.totalAura[me] >= check.amount
    case 'mogged':
      return stats.mogged && stats.winner === me
    case 'outaura':
      return stats.outauraCount[me] >= check.count
    case 'streak':
      return stats.bestStreak[me] >= check.length
    case 'perfects':
      return stats.perfectCount[me] >= check.count
    case 'godAura':
      return stats.godAuraReached[me]
    case 'noMiss':
      // Freezing on the clock is not a MISS, but it is not a clean run either.
      return stats.missCount[me] === 0 && stats.lostComposureCount[me] === 0
    case 'hardLanded':
      return stats.hardLanded[me] >= check.count
    case 'momentum':
      return stats.maxMomentum[me] >= check.atLeast
  }
}

/**
 * What the objective says on the rival's card. Derived rather than written out
 * beside every rival, so a number can never be changed in one place and left
 * stale in the other.
 */
export function objectiveLabel(check: ObjectiveCheck): string {
  switch (check.kind) {
    case 'win':
      return 'WIN THE BATTLE'
    case 'aura':
      return `GET ${check.amount.toLocaleString('en-US')} AURA`
    case 'mogged':
      return 'WIN BY MOGGED'
    case 'outaura':
      return check.count === 1 ? "OUTAURA THEM" : `OUTAURA ×${check.count}`
    case 'streak':
      return `PERFECT STREAK ×${check.length}`
    case 'perfects':
      return `LAND ${check.count} PERFECTS`
    case 'godAura':
      return 'REACH GOD AURA'
    case 'noMiss':
      return 'FINISH WITHOUT A MISS'
    case 'hardLanded':
      return `LAND ${check.count} HARD CARDS`
    case 'momentum':
      return `REACH ${check.atLeast} MOMENTUM`
  }
}

/** Which of a rival's three objectives were met. Order is the rival's order. */
export function met(
  objectives: readonly Objective[],
  stats: BattleStats,
  me: PlayerId,
): boolean[] {
  return objectives.map((o) => meets(o.check, stats, me))
}
