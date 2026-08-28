import { play } from '../audio/engine'
import { KIND_LABEL, getCard, TIER_LABEL } from '../engine/cards'
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
            <span className="card__fresh">{fresh}</span>
            <span className="card__emoji">{card.emoji}</span>
            <span className="card__name">{card.name}</span>
            <span className="card__kind">{KIND_LABEL[card.kind]}</span>
            <span className="card__stats">
              {TIER_LABEL[card.difficulty]} · {card.baseAura} aura
            </span>
          </button>
        )
      })}
    </div>
  )
}
