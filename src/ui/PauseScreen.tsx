import { useState } from 'react'
import { useGame } from '../state/store'
import { Glossary } from './Glossary'

/**
 * The battle held still. Everything downstream of the clock is frozen with it,
 * so this is also the only calm moment in a match — which makes it the right
 * place to keep the glossary and the sound switch rather than a second copy of
 * the title screen's.
 */
export function PauseScreen() {
  const setPaused = useGame((s) => s.setPaused)
  const toTitle = useGame((s) => s.toTitle)
  const muted = useGame((s) => s.muted)
  const toggleMuted = useGame((s) => s.toggleMuted)
  const [help, setHelp] = useState(false)

  return (
    <div className="paused">
      <span className="paused__title">PAUSED</span>
      <span className="paused__note">nothing is ticking</span>

      {help && (
        <div className="rules">
          <Glossary />
        </div>
      )}

      <button className="btn btn--big" onPointerDown={() => setPaused(false)}>
        RESUME
      </button>

      <div className="tabs">
        <button className="tab" data-open={help} onPointerDown={() => setHelp((open) => !open)}>
          ? HOW TO PLAY
        </button>
        <button className="tab" onPointerDown={toggleMuted}>
          {muted ? '🔇' : '🔊'}
        </button>
        <button className="tab" onPointerDown={toTitle}>
          QUIT TO TITLE
        </button>
      </div>
    </div>
  )
}
