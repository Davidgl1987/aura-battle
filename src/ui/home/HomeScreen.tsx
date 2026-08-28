import { Suspense, lazy, useState } from 'react'
import { RIVALS } from '../../engine/rivals'
import { useGame } from '../../state/store'
import { currentRival, isRivalBeaten, useProgress } from '../../state/useProgress'
import { Glossary } from '../Glossary'
import { ModeSheet } from './ModeSheet'

/** Same split as the battle: the hub paints instantly, three.js follows. */
const TitleShowcase = lazy(() =>
  import('../../scene/Showcase').then((m) => ({ default: m.TitleShowcase })),
)

/**
 * The hub. The cast owns the screen and everything else floats over it in two
 * bands — who you are at the top, where you are going at the bottom. One big
 * button and a row of small ones, because a wall of labels would be a menu
 * standing in front of the thing worth looking at.
 */
export function HomeScreen() {
  const go = useGame((s) => s.go)
  const coins = useProgress((s) => s.coins)
  const progress = useProgress()

  const [sheet, setSheet] = useState(false)
  const [rules, setRules] = useState(false)

  const beaten = RIVALS.filter((r) => isRivalBeaten(progress, r.id)).length
  const next = currentRival(progress)

  return (
    <div className="screen screen--home">
      <Suspense fallback={null}>
        <TitleShowcase />
      </Suspense>

      <div className="home__top">
        <h1 className="title">
          AURA<span>BATTLE</span>
        </h1>
        {/* Secondary on purpose: a currency you cannot spend yet should not be
            the loudest thing on the screen. */}
        <button className="coins" onPointerDown={() => go('collection')}>
          <span className="coins__icon">🪙</span>
          <span className="coins__value">{coins.toLocaleString('en-US')}</span>
        </button>
      </div>

      <div className="home__foot">
        {rules && (
          <div className="rules">
            <ol className="rules__steps">
              <li>Answer the rival with a different kind of gesture.</li>
              <li>Nail the QTE. Every card you play is gone for good.</li>
              <li>Own the aura bar when the moves run out.</li>
            </ol>
            <Glossary />
          </div>
        )}

        <button className="btn btn--big btn--play" onPointerDown={() => setSheet(true)}>
          PLAY
        </button>

        <div className="hub">
          <button className="hub__item" onPointerDown={() => go('collection')}>
            <span className="hub__icon">🃏</span>
            <span className="hub__label">COLLECTION</span>
          </button>
          {/* The wardrobe exists — rivals are wearing it — but there is nothing
              to change yet, and a button onto an empty screen is worse than a
              button that says so. */}
          <button className="hub__item" disabled>
            <span className="hub__icon">✨</span>
            <span className="hub__label">CUSTOMIZE</span>
            <span className="hub__soon">SOON</span>
          </button>
          <button className="hub__item" onPointerDown={() => go('settings')}>
            <span className="hub__icon">⚙</span>
            <span className="hub__label">SETTINGS</span>
          </button>
        </div>

        <div className="tabs">
          {/* Sound lives in Settings now. A speaker button here could only ever
              mute everything at once, which is not what either switch does. */}
          <button className="tab" data-open={rules} onPointerDown={() => setRules((r) => !r)}>
            ? HOW TO PLAY
          </button>
        </div>
      </div>

      {sheet && <ModeSheet beaten={beaten} nextRivalId={next} onClose={() => setSheet(false)} />}
    </div>
  )
}
