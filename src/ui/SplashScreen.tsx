import { useEffect, useState } from 'react'

/**
 * The first thing anybody sees, and the only screen in the game that is not
 * allowed to import three.js.
 *
 * The title used to be four primitive fighters so that opening the game did
 * not cost a download. It is one Firetoy character now, which does — twelve
 * megabytes of it — so something has to hold the door. This is that something:
 * plain HTML and CSS, in the entry bundle, on screen before the 3D chunk has
 * even been asked for.
 *
 * It waits for exactly two things, and the title tells it when they have both
 * happened: the scene module, and the male body standing on the mark. Not the
 * female body, not the sounds, not the battle's stage — those come later and
 * nobody is looking at them yet.
 */

/** No progress bar, because there is no honest number to put in one. */
const LINES = [
  'FARMING AURA…',
  'CHECKING JAWLINE…',
  'CALCULATING DRIP…',
  'BUILDING MOMENTUM…',
]

const LINE_MS = 1400

export function SplashScreen({ done }: { done: boolean }) {
  const [line, setLine] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => setLine((i) => (i + 1) % LINES.length), LINE_MS)
    return () => window.clearInterval(timer)
  }, [])

  // Left in English on purpose, the way the card names are: "farming aura" is
  // the joke the game is named after, and it does not survive translation.
  return (
    <div className="splash-screen" data-done={done} aria-hidden={done}>
      <h1 className="title splash-screen__title">
        AURA<span>BATTLE</span>
      </h1>
      <p className="splash-screen__line" key={line}>
        {LINES[line]}
      </p>
      <div className="splash-screen__bar" />
    </div>
  )
}
