import { Suspense, lazy, useEffect, useState } from 'react'
import { CARDS, KIND_LABEL, TIER_LABEL } from '../engine/cards'
import { CHARACTERS, getCharacter } from '../engine/characters'
import { takenCharacterId, useGame } from '../state/store'

const SetupShowcase = lazy(() =>
  import('../scene/Showcase').then((m) => ({ default: m.SetupShowcase })),
)

/**
 * Two steps rather than one long scroll. Who you are and what you brought are
 * separate decisions, and splitting them lets the fighter own the top of the
 * screen instead of being squeezed into a strip above a list.
 */
type Step = 'fighter' | 'deck'

export function SetupScreen() {
  const settings = useGame((s) => s.settings)
  const index = useGame((s) => s.setupIndex)
  const setups = useGame((s) => s.setups)
  const submitSetup = useGame((s) => s.submitSetup)
  const toTitle = useGame((s) => s.toTitle)

  // Only the character is public. Which cards the other one brought is not:
  // drafting against a deck you can read is the same free win as answering a
  // hand you can see, one screen earlier and with every card still in it.
  const taken = takenCharacterId(setups, index)

  const [step, setStep] = useState<Step>('fighter')
  const [characterId, setCharacterId] = useState(
    () => (CHARACTERS.find((c) => c.id !== taken) ?? CHARACTERS[0]).id,
  )
  const [alias, setAlias] = useState('')
  const [deck, setDeck] = useState<string[]>([])
  /** The gesture the fighter is trying out, replaced on every card tapped. */
  const [preview, setPreview] = useState<{
    animation: string
    durationMs: number
    startedAt: number
  } | null>(null)

  // Pull the 3D stage down while they are still choosing, so the battle does
  // not open on an empty screen waiting for three.js.
  useEffect(() => {
    void import('../scene/StageScene')
  }, [])

  const full = deck.length === settings.deckSize
  const fallbackName = index === 0 ? 'P1' : 'P2'
  const character = getCharacter(characterId)

  const toggle = (id: string) =>
    setDeck((current) => {
      if (current.includes(id)) return current.filter((c) => c !== id)
      return current.length < settings.deckSize ? [...current, id] : current
    })

  return (
    <div className="screen screen--setup" data-step={step}>
      {/* The fighter is the backdrop of the step, not an item inside it. */}
      <div className="setup__stage">
        <Suspense fallback={null}>
          <SetupShowcase characterId={characterId} preview={preview} />
        </Suspense>
        {/* The caption itself ignores taps, so the way out is its own element. */}
        <button
          className="setup__back"
          onPointerDown={() => (step === 'deck' ? setStep('fighter') : toTitle())}
        >
          ‹ {step === 'deck' ? 'BACK' : 'TITLE'}
        </button>
        <div className="setup__caption" style={{ color: character.color }}>
          <span className="setup__who">{alias.trim() || fallbackName}</span>
          <span className="setup__step">
            {step === 'fighter' ? 'PICK YOUR FIGHTER' : `DECK ${deck.length}/${settings.deckSize}`}
          </span>
        </div>
      </div>

      <div className="setup__body">
        {step === 'fighter' ? (
          <>
            <div className="fighters">
              {CHARACTERS.map((c) => {
                const claimed = c.id === taken
                return (
                  <button
                    key={c.id}
                    className="fighter"
                    data-selected={c.id === characterId}
                    disabled={claimed}
                    style={{ '--who': c.color } as React.CSSProperties}
                    onPointerDown={() => !claimed && setCharacterId(c.id)}
                  >
                    <span className="fighter__emoji">{c.emoji}</span>
                    <span className="fighter__name">{c.name}</span>
                    <span className="fighter__build">{claimed ? 'TAKEN' : c.build}</span>
                  </button>
                )
              })}
            </div>

            <label className="alias__row">
              <span className="setup__title">ALIAS (OPTIONAL)</span>
              <input
                className="alias"
                type="text"
                maxLength={10}
                placeholder={fallbackName}
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
              />
            </label>
          </>
        ) : (
          <>
            <p className="setup__hint">Tap a card to see {character.name} do it.</p>
            <div className="picker">
              {CARDS.map((card) => {
                const picked = deck.includes(card.id)
                return (
                  <button
                    key={card.id}
                    className="pick"
                    data-kind={card.kind}
                    data-picked={picked}
                    onPointerDown={() => {
                      setPreview({
                        animation: card.animation,
                        durationMs: card.durationMs,
                        startedAt: performance.now(),
                      })
                      toggle(card.id)
                    }}
                  >
                    {/* A tick, not a number: numbering the picks read as an
                        order they had to be played in. */}
                    {picked && <span className="pick__order">✓</span>}
                    <span className="pick__emoji">{card.emoji}</span>
                    <span className="pick__name">{card.name}</span>
                    <span className="pick__meta">
                      {KIND_LABEL[card.kind]} · {TIER_LABEL[card.difficulty]} · {card.baseAura}
                    </span>
                  </button>
                )
              })}
            </div>

          </>
        )}
      </div>

      <div className="setup__foot">
        {step === 'deck' && (
          <button className="btn btn--ghost" onPointerDown={() => setStep('fighter')}>
            BACK
          </button>
        )}
        {step === 'fighter' ? (
          <button className="btn btn--big" onPointerDown={() => setStep('deck')}>
            NEXT
          </button>
        ) : (
          <button
            className="btn btn--big btn--confirm"
            disabled={!full}
            onPointerDown={() => full && submitSetup({ name: alias, characterId, deck })}
          >
            {full ? 'LOCK IT IN' : `PICK ${settings.deckSize - deck.length} MORE`}
          </button>
        )}
      </div>
    </div>
  )
}
