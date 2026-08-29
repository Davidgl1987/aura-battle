import type { ObjectiveCheck } from '../engine/objectives'
import type { Reward } from '../engine/rewards'
import { getAccessory } from '../engine/accessories'
import { getCard } from '../engine/cards'
import type { AuraLine, Difficulty, Freshness, QteKind } from '../engine/types'
import type { I18n } from '../i18n'

/**
 * Everything the interface has to put into words. It lives here rather than in
 * the engine because the engine has no language: it deals in `{ kind: 'aura',
 * amount: 4000 }` and this is the layer that knows how to say that out loud,
 * in whichever language is on.
 *
 * Card, rival and accessory names are not translated. They are the game's own
 * nouns — GRIDDY DROP is GRIDDY DROP either way — so they come through as they
 * are and only the words around them change.
 */

const KIND_EMOJI: Record<QteKind, string> = { timing: '🎯', speed: '⚡', control: '🧠' }

export function kindLabel(kind: QteKind, { t }: I18n): string {
  return `${KIND_EMOJI[kind]} ${t(`kind.${kind}`)}`
}

export function tierLabel(difficulty: Difficulty, { t }: I18n): string {
  return t(`tier.${difficulty}`)
}

export function freshLabel(freshness: Freshness, { t }: I18n): string {
  return t(`fresh.${freshness}`)
}

/** What a rival is asking for. */
export function objectiveText(check: ObjectiveCheck, { t, n }: I18n): string {
  switch (check.kind) {
    case 'win':
      return t('objective.win')
    case 'aura':
      return t('objective.aura', { n: n(check.amount) })
    case 'mogged':
      return t('objective.mogged')
    case 'outaura':
      return check.count === 1
        ? t('objective.outaura')
        : t('objective.outauraMany', { n: check.count })
    case 'streak':
      return t('objective.streak', { n: check.length })
    case 'perfects':
      return t('objective.perfects', { n: check.count })
    case 'godAura':
      return t('objective.godAura')
    case 'noMiss':
      return t('objective.noMiss')
    case 'hardLanded':
      return t('objective.hardLanded', { n: check.count })
    case 'momentum':
      return t('objective.momentum', { n: check.atLeast })
  }
}

/** And what it pays. */
export function rewardText(reward: Reward, { t, n }: I18n): string {
  switch (reward.kind) {
    case 'card':
      return t('reward.card', { name: getCard(reward.cardId).name.toUpperCase() })
    case 'coins':
      return t('reward.coins', { n: n(reward.amount) })
    case 'accessory':
      return t('reward.accessory', { name: getAccessory(reward.accessoryId).name.toUpperCase() })
  }
}

/**
 * One line of the aura bill. Read from `line.key` rather than `line.label`:
 * the engine writes a readable English label into every line for tests and
 * for the balance report, and the screen needs the reader's language instead.
 */
export function billLabel(line: AuraLine, { t }: I18n): string {
  switch (line.key) {
    case 'miss':
      return t('bill.miss')
    case 'base':
      return line.label === 'PERFECT' ? t('bill.base.PERFECT') : t('bill.base.GOOD')
    case 'perfect':
      return t('bill.perfect')
    case 'fresh':
      return t('bill.fresh')
    case 'hard':
      return t('bill.hard')
    case 'streak':
      // The count is already in the engine's label; the number is what matters.
      return t('bill.streak', { n: line.label.replace(/\D+/g, '') })
    case 'outaurad':
      return t('bill.outaurad')
    case 'god':
      return t('bill.god')
  }
}
