import { CARDS } from './engine/cards'
import { useEffect } from 'react'
import { play } from './audio/engine'
import { useSound } from './audio/useSound'
import { getCharacter } from './engine/characters'
import { useGame } from './state/store'
import { useGameClock } from './state/useGameClock'
import { HandoffScreen } from './ui/HandoffScreen'
import { MatchScreen } from './ui/MatchScreen'
import { QteLab } from './ui/QteLab'
import { SetupScreen } from './ui/SetupScreen'
import { TitleScreen } from './ui/TitleScreen'
import './ui/styles.css'

function SetupHandoff() {
  const confirm = useGame((s) => s.confirmSetupHandoff)
  const taken = useGame((s) => s.setups[0]?.characterId)

  // This handoff is a screen rather than a match phase, so it has no event to
  // ride; it announces itself.
  useEffect(() => play('handoff'), [])

  return (
    <HandoffScreen
      name="P2"
      color="var(--p1)"
      emoji="🫱"
      note={taken ? `P1 is playing ${getCharacter(taken).name}` : undefined}
      onReady={confirm}
    />
  )
}

/** `?qte` (optionally `?qte=six-seven`) opens the QTE range instead of the game. */
const labCardId = import.meta.env.DEV
  ? (() => {
      const value = new URLSearchParams(window.location.search).get('qte')
      if (value === null) return null
      return CARDS.some((c) => c.id === value) ? value : CARDS[0].id
    })()
  : null

export default function App() {
  const screen = useGame((s) => s.screen)
  useGameClock()
  useSound()

  if (labCardId) {
    return (
      <div className="app">
        <QteLab initialCardId={labCardId} />
      </div>
    )
  }

  return (
    <div className="app">
      {screen === 'title' && <TitleScreen />}
      {screen === 'setup' && <SetupScreen />}
      {screen === 'setupHandoff' && <SetupHandoff />}
      {screen === 'match' && <MatchScreen />}
    </div>
  )
}
