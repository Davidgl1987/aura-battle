import { CARDS } from './engine/cards'
import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import { play } from './audio/engine'
import { useSound } from './audio/useSound'
import { getCharacter } from './engine/characters'
import { useI18n } from './i18n'
import { useGame } from './state/store'
import { useGameClock } from './state/useGameClock'
import { HandoffScreen } from './ui/HandoffScreen'
import { MatchScreen } from './ui/MatchScreen'
import { QteLab } from './ui/QteLab'
import { SplashScreen } from './ui/SplashScreen'
import { SetupScreen } from './ui/SetupScreen'
import { CollectionScreen } from './ui/collection/CollectionScreen'
import { HomeScreen } from './ui/home/HomeScreen'
import { RivalSelectScreen } from './ui/solo/RivalSelectScreen'
import './ui/styles.css'

function SetupHandoff() {
  const { t } = useI18n()
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
      note={taken ? t('handoff.p2Note', { name: getCharacter(taken).name }) : undefined}
      onReady={confirm}
    />
  )
}

const params = import.meta.env.DEV ? new URLSearchParams(window.location.search) : null

/** `?qte` (optionally `?qte=six-seven`) opens the QTE range instead of the game. */
const labCardId = (() => {
  const value = params?.get('qte')
  if (value === undefined || value === null) return null
  return CARDS.some((c) => c.id === value) ? value : CARDS[0].id
})()

/**
 * `?firetoy` (optionally `?firetoy=male07`) opens the wardrobe range. Loaded on
 * demand and not by name: it puts a whole 3D stage on screen, and everything
 * else that does is behind a lazy import too, so that opening the game does not
 * download three.js before the title has drawn.
 */
const labPreset = params?.get('firetoy') ?? null

const CharacterLab = lazy(() =>
  import('./ui/CharacterLab').then((m) => ({ default: m.CharacterLab })),
)

/**
 * How long the splash waits before showing the title anyway.
 *
 * The two things it waits for can both fail to arrive: a clone without the
 * licensed bodies never resolves, and a slow connection can take longer than
 * anybody is prepared to stare at a loading screen. Neither is a reason to
 * trap someone on it.
 */
const BOOT_PATIENCE_MS = 15_000

/** Long enough to read as a fade rather than a cut. Matches the stylesheet. */
const FADE_MS = 420

export default function App() {
  const screen = useGame((s) => s.screen)
  const [boot, setBoot] = useState<'loading' | 'fading' | 'done'>('loading')
  useGameClock()
  useSound()

  const titleReady = useCallback(() => setBoot((b) => (b === 'loading' ? 'fading' : b)), [])

  useEffect(() => {
    if (boot === 'loading') {
      const patience = window.setTimeout(titleReady, BOOT_PATIENCE_MS)
      return () => window.clearTimeout(patience)
    }
    if (boot === 'fading') {
      const fade = window.setTimeout(() => setBoot('done'), FADE_MS)
      return () => window.clearTimeout(fade)
    }
  }, [boot, titleReady])

  if (labCardId) {
    return (
      <div className="app">
        <QteLab initialCardId={labCardId} />
      </div>
    )
  }

  if (labPreset !== null) {
    return (
      <div className="app">
        <Suspense fallback={null}>
          <CharacterLab initialPreset={labPreset} />
        </Suspense>
      </div>
    )
  }

  return (
    <div className="app">
      {screen === 'home' && <HomeScreen onTitleReady={titleReady} />}
      {screen === 'rivals' && <RivalSelectScreen />}
      {screen === 'collection' && <CollectionScreen />}
      {screen === 'setup' && <SetupScreen />}
      {screen === 'setupHandoff' && <SetupHandoff />}
      {screen === 'match' && <MatchScreen />}

      {boot !== 'done' && <SplashScreen done={boot === 'fading'} />}
    </div>
  )
}
