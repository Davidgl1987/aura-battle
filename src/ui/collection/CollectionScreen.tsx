import { Suspense, lazy, useState } from 'react'
import { SOLO_DECK_SIZE } from '../../engine/balance'
import { CARDS, KIND_LABEL, TIER_LABEL } from '../../engine/cards'
import { getRival } from '../../engine/rivals'
import { PLAYER_CHARACTER, useGame } from '../../state/store'
import { hasCard, unlockedBy, useProgress } from '../../state/useProgress'
import type { QteKind } from '../../engine/types'

const SetupShowcase = lazy(() =>
  import('../../scene/Showcase').then((m) => ({ default: m.SetupShowcase })),
)

const ORDER: QteKind[] = ['timing', 'speed', 'control']

/**
 * The collection and the deck are one screen because they are one decision:
 * what you own only matters in terms of what you are taking in. Tapping a card
 * you own puts it in the deck and shows you the gesture; tapping a locked one
 * tells you who is holding it.
 */
export function CollectionScreen() {
  const go = useGame((s) => s.go)
  const progress = useProgress()
  const setDeck = useProgress((s) => s.setDeck)
  const deck = progress.deck

  const [preview, setPreview] = useState<{
    animation: string
    durationMs: number
    startedAt: number
  } | null>(null)
  const [note, setNote] = useState<string | null>(null)

  const toggle = (cardId: string) => {
    if (deck.includes(cardId)) {
      // The last slot cannot be emptied: an illegal deck is refused by the
      // store, so removing it would look like the tap did nothing.
      if (deck.length <= SOLO_DECK_SIZE) {
        setNote(`Pick a replacement to swap ${CARDS.find((c) => c.id === cardId)!.name} out`)
        return
      }
      setDeck(deck.filter((id) => id !== cardId))
      return
    }
    // A full deck swaps the oldest pick out, so a tap always does something.
    const next = deck.length >= SOLO_DECK_SIZE ? [...deck.slice(1), cardId] : [...deck, cardId]
    setDeck(next)
    setNote(null)
  }

  return (
    <div className="screen screen--collection">
      <div className="collection__stage">
        <Suspense fallback={null}>
          <SetupShowcase characterId={PLAYER_CHARACTER} preview={preview} cardIds={deck} />
        </Suspense>
        <button className="setup__back" onPointerDown={() => go('home')}>
          ‹ HOME
        </button>
        <div className="collection__caption">
          <span className="collection__count">
            DECK {deck.length}/{SOLO_DECK_SIZE}
          </span>
          <span className="collection__owned">
            {progress.unlockedCards.length}/{CARDS.length} MOVES
          </span>
        </div>
      </div>

      <div className="collection__body">
        <p className="setup__hint">{note ?? 'Tap a move to swap it into your deck.'}</p>

        {ORDER.map((kind) => (
          <section key={kind} className="collection__group">
            <h3 className="collection__kind" data-kind={kind}>
              {KIND_LABEL[kind]}
            </h3>
            <div className="picker">
              {CARDS.filter((c) => c.kind === kind).map((card) => {
                const owned = hasCard(progress, card.id)
                const picked = deck.includes(card.id)
                const holder = unlockedBy(card.id)

                return (
                  <button
                    key={card.id}
                    className="pick"
                    data-kind={card.kind}
                    data-picked={picked}
                    data-locked={!owned}
                    onPointerDown={() => {
                      if (!owned) {
                        setNote(`${card.name} · beat ${getRival(holder!).name} to unlock`)
                        return
                      }
                      setPreview({
                        animation: card.animation,
                        durationMs: card.durationMs,
                        startedAt: performance.now(),
                      })
                      toggle(card.id)
                    }}
                  >
                    {picked && <span className="pick__order">✓</span>}
                    <span className="pick__emoji">{owned ? card.emoji : '🔒'}</span>
                    <span className="pick__name">{card.name}</span>
                    <span className="pick__meta">
                      {owned
                        ? `${TIER_LABEL[card.difficulty]} · ${card.baseAura} aura`
                        : getRival(holder!).name}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
