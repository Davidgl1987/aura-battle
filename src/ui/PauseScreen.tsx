import { useState } from 'react'
import { useGame } from '../state/store'
import { Glossary } from './Glossary'
import { SettingsList } from './settings/SettingsList'

/**
 * The battle held still. Everything downstream of the clock is frozen with it,
 * so this is also the only calm moment in a match — which makes it the right
 * place for the glossary and for the settings themselves, rather than for a
 * lone speaker button that could only turn everything off at once.
 */
type Panel = 'settings' | 'rules' | null

export function PauseScreen() {
  const setPaused = useGame((s) => s.setPaused)
  const toTitle = useGame((s) => s.toTitle)
  const [panel, setPanel] = useState<Panel>(null)
  const toggle = (which: Panel) => setPanel((open) => (open === which ? null : which))

  return (
    <div className="paused">
      <span className="paused__title">PAUSED</span>
      <span className="paused__note">nothing is ticking</span>

      {/* One at a time: between them they cover the whole screen, and the
          battle underneath is what the player is coming back to. */}
      {panel === 'settings' && <SettingsList compact />}
      {panel === 'rules' && (
        <div className="rules">
          <Glossary />
        </div>
      )}

      <button className="btn btn--big" onPointerDown={() => setPaused(false)}>
        RESUME
      </button>

      <div className="tabs">
        <button
          className="tab"
          data-open={panel === 'settings'}
          onPointerDown={() => toggle('settings')}
        >
          ⚙ SETTINGS
        </button>
        <button className="tab" data-open={panel === 'rules'} onPointerDown={() => toggle('rules')}>
          ? HOW TO PLAY
        </button>
        <button className="tab" onPointerDown={toTitle}>
          QUIT
        </button>
      </div>
    </div>
  )
}
