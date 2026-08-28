import { getCard } from '../engine/cards'
import type { PlayerState } from '../engine/types'

/**
 * Open information: both decks are on the table from the first turn, spent
 * cards dimmed, so you can count what the rival has left to answer with.
 */
export function DeckStrip({ player, label }: { player: PlayerState; label: string }) {
  return (
    <div className="strip">
      <span className="strip__label">{label}</span>
      <div className="strip__cards">
        {player.deck.map((id) => {
          const card = getCard(id)
          const spent = !player.remaining.includes(id)
          return (
            <span key={id} className="chip" data-kind={card.kind} data-spent={spent}>
              {card.emoji}
            </span>
          )
        })}
      </div>
    </div>
  )
}
