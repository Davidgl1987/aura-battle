import { Suspense, lazy, useState } from 'react'
import {
  CHOOSE_SECONDS_MAX,
  CHOOSE_SECONDS_MIN,
  DECK_SIZE_MAX,
  DECK_SIZE_MIN,
} from '../engine/balance'
import { CARDS } from '../engine/cards'
import { useGame } from '../state/store'
import { Glossary } from './Glossary'
import { Stepper } from './Stepper'

/** Same split as the battle: the title paints instantly, three.js follows. */
const TitleShowcase = lazy(() =>
  import('../scene/Showcase').then((m) => ({ default: m.TitleShowcase })),
)

type Panel = 'settings' | 'rules' | null

export function TitleScreen() {
  const settings = useGame((s) => s.settings)
  const setSettings = useGame((s) => s.setSettings)
  const beginSetup = useGame((s) => s.beginSetup)
  const muted = useGame((s) => s.muted)
  const toggleMuted = useGame((s) => s.toggleMuted)

  // Both panels were open at once before, and between them they covered the
  // whole screen — which is where the fighters are.
  const [panel, setPanel] = useState<Panel>(null)
  const toggle = (which: Panel) => setPanel((open) => (open === which ? null : which))

  return (
    <div className="screen screen--title">
      <Suspense fallback={null}>
        <TitleShowcase />
      </Suspense>

      <div className="title__top">
        <h1 className="title">
          AURA<span>BATTLE</span>
        </h1>
        <p className="title__sub">Two players · one phone</p>
      </div>

      <div className="title__foot">
        {panel === 'settings' && (
          <div className="settings">
            <Stepper
              label="CARDS PER DECK"
              value={settings.deckSize}
              min={DECK_SIZE_MIN}
              max={DECK_SIZE_MAX}
              onChange={(deckSize) => setSettings({ deckSize })}
            />
            <Stepper
              label="TIME TO CHOOSE"
              value={Math.round(settings.chooseMs / 1000)}
              min={CHOOSE_SECONDS_MIN}
              max={CHOOSE_SECONDS_MAX}
              suffix="s"
              onChange={(seconds) => setSettings({ chooseMs: seconds * 1000 })}
            />
          </div>
        )}

        {panel === 'rules' && (
          <div className="rules">
            <ol className="rules__steps">
              <li>Build a deck of {settings.deckSize} from the {CARDS.length} gestures.</li>
              <li>Take turns performing one. Every card you play is gone for good.</li>
              <li>Whoever owns the aura bar when the moves run out wins.</li>
            </ol>
            <Glossary />
          </div>
        )}

        <button className="btn btn--big" onPointerDown={beginSetup}>
          START
        </button>

        <div className="tabs">
          <button className="tab" data-open={panel === 'settings'} onPointerDown={() => toggle('settings')}>
            ⚙ {settings.deckSize} CARDS · {Math.round(settings.chooseMs / 1000)}s
          </button>
          <button className="tab" data-open={panel === 'rules'} onPointerDown={() => toggle('rules')}>
            ? HOW TO PLAY
          </button>
          <button className="tab" onPointerDown={toggleMuted}>
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      </div>
    </div>
  )
}
