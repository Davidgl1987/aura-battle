import { Suspense, lazy, useState } from 'react'
import { SOLO_DECK_SIZE } from '../../engine/balance'
import { CARDS } from '../../engine/cards'
import { useI18n } from '../../i18n'
import { kindLabel, tierLabel } from '../labels'
import { getRival } from '../../engine/rivals'
import { PLAYER_CHARACTER, useGame } from '../../state/store'
import { hasCard, unlockedBy, useProgress } from '../../state/useProgress'
import type { QteKind } from '../../engine/types'
import { DEFAULT_PLAYER_CHARACTER } from '../../scene/firetoy/cast'

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
  const i18n = useI18n()
  const { t, n } = i18n
  const go = useGame((s) => s.go)
  const progress = useProgress()
  const setDeck = useProgress((s) => s.setDeck)

  /**
   * The deck is edited here and only saved once it is legal again. The store
   * refuses a deck of the wrong size — rightly, since that is what a battle
   * starts from — so taking a card out has to be able to leave the deck four
   * long for as long as it takes to pick the fifth.
   */
  const [draft, setDraft] = useState<string[] | null>(null)
  const deck = draft ?? progress.deck

  const commit = (next: string[]) => {
    setDraft(next)
    if (next.length === SOLO_DECK_SIZE) {
      setDeck(next)
      setDraft(null)
    }
  }

  const [preview, setPreview] = useState<{
    animation: string
    durationMs: number
    startedAt: number
  } | null>(null)
  const [note, setNote] = useState<string | null>(null)

  /**
   * Tap to take a move, tap it again to put it back. A full deck refuses new
   * picks rather than quietly dropping one of its own: swapping the oldest out
   * meant a tap could cost you a card you never chose to lose, and you found
   * out by noticing it missing.
   */
  const toggle = (cardId: string) => {
    if (deck.includes(cardId)) {
      commit(deck.filter((id) => id !== cardId))
      setNote(null)
      return
    }
    if (deck.length >= SOLO_DECK_SIZE) {
      setNote(t('collection.full'))
      return
    }
    commit([...deck, cardId])
    setNote(null)
  }

  return (
    <div className="screen screen--collection">
      <div className="collection__stage">
        <Suspense fallback={null}>
          <SetupShowcase
            characterId={PLAYER_CHARACTER}
            preview={preview}
            cardIds={deck}
            look={{ character: DEFAULT_PLAYER_CHARACTER }}
          />
        </Suspense>
        <button className="setup__back" onPointerDown={() => go('home')}>
          ‹ {t('common.home')}
        </button>
        <div className="collection__caption">
          <span className="collection__count" data-short={deck.length < SOLO_DECK_SIZE}>
            {t('collection.deck', { n: deck.length, total: SOLO_DECK_SIZE })}
          </span>
          <span className="collection__owned">
            {t('collection.moves', { n: progress.unlockedCards.length, total: CARDS.length })}
          </span>
        </div>
      </div>

      <div className="collection__body">
        <p className="setup__hint" data-warn={note !== null}>
          {note ?? t('collection.hint')}
        </p>

        {ORDER.map((kind) => (
          <section key={kind} className="collection__group">
            <h3 className="collection__kind" data-kind={kind}>
              {kindLabel(kind, i18n)}
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
                        setNote(
                          t('collection.locked', {
                            card: card.name,
                            name: getRival(holder!).name,
                          }),
                        )
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
                        ? `${tierLabel(card.difficulty, i18n)} · ${n(card.baseAura)} ${t('common.auraLower')}`
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
