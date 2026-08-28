import { getAccessory } from './accessories'
import { getCard } from './cards'

/**
 * What an objective pays. Three kinds, one per objective slot: beating a rival
 * is worth a move, out-scoring the target is worth coins, and the challenge is
 * worth the accessory that rival is wearing while you do it.
 *
 * Every reward is claimed once and only once. `useProgress.claim` is the only
 * thing that hands one out, so re-beating the Rookie is worth exactly the
 * practice.
 */
export type Reward =
  | { kind: 'card'; cardId: string }
  | { kind: 'coins'; amount: number }
  | { kind: 'accessory'; accessoryId: string }

export function rewardLabel(reward: Reward): string {
  switch (reward.kind) {
    case 'card':
      return `NEW MOVE · ${getCard(reward.cardId).name.toUpperCase()}`
    case 'coins':
      return `+${reward.amount.toLocaleString('en-US')} COINS`
    case 'accessory':
      return `NEW DRIP · ${getAccessory(reward.accessoryId).name.toUpperCase()}`
  }
}

export function rewardEmoji(reward: Reward): string {
  switch (reward.kind) {
    case 'card':
      return getCard(reward.cardId).emoji
    case 'coins':
      return '🪙'
    case 'accessory':
      return getAccessory(reward.accessoryId).emoji
  }
}
