import { play } from '../audio/engine'
import { getCard } from '../engine/cards'
import { useI18n } from '../i18n'
import { freshLabel, kindLabel, tierLabel } from './labels'
import { freshnessOf } from '../engine/scoring'
import type { Card, PlayedCard } from '../engine/types'

interface Props {
  cards: string[]
  /** Fixed for the whole match, so the grid never reflows mid-battle. */
  deckSize: number
  lastPlayed: PlayedCard | null
  disabled: boolean
  onPick: (cardId: string) => void
}

/**
 * The freshness tag is not decoration: with a few seconds on the clock the
 * player has to read "what beats what" at a glance, so each card states up
 * front what it would score against the rival's last move.
 */
export function Hand({ cards, deckSize, lastPlayed, disabled, onPick }: Props) {
  const i18n = useI18n()

  return (
    <div className="hand" data-size={deckSize}>
      {cards.map((id) => {
        const card: Card = getCard(id)
        const fresh = freshnessOf(card, lastPlayed)
        return (
          <button
            key={id}
            className="card"
            data-kind={card.kind}
            data-fresh={fresh}
            disabled={disabled}
            onPointerDown={() => {
              if (disabled) return
              play('select')
              onPick(id)
            }}
          >
            <span className="card__fresh">{freshLabel(fresh, i18n)}</span>
            <span className="card__emoji">{card.emoji}</span>
            <span className="card__name">{card.name}</span>
            <span className="card__kind">{kindLabel(card.kind, i18n)}</span>
            <span className="card__stats">
              {tierLabel(card.difficulty, i18n)} · {i18n.n(card.baseAura)}{' '}
              {i18n.t('common.auraLower')}
            </span>
          </button>
        )
      })}
    </div>
  )
}
