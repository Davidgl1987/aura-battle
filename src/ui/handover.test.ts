import { describe, expect, it } from 'vitest'
import MATCH_SCREEN from './MatchScreen.tsx?raw'

/**
 * Ending a turn is a slide, in both modes.
 *
 * Solo used to get a plain button, on the reasoning that sliding is a handover
 * ritual and there is nobody to hand the phone to. That missed what the slide is
 * actually for: the bill lands the instant a gesture is graded, and the last
 * taps of a mash are still arriving. A button under them is spent before it has
 * been read, and the score sheet goes with it — which is exactly what happened.
 *
 * `SlideToPass` is the one control a stray finger cannot fire. There is no test
 * harness for components here, so this guards the shape rather than the
 * behaviour: it fails if the button comes back.
 */
describe('ending a turn', () => {
  /** The block that offers to move the game on once a play has settled. */
  const pass = MATCH_SCREEN.slice(
    MATCH_SCREEN.indexOf('className="pass"'),
    MATCH_SCREEN.indexOf('phase.kind === \'performIntro\' && <DeckStrip'),
  )

  it('hands both modes a slide and neither a button', () => {
    expect(pass).toContain('<SlideToPass')
    expect(pass, 'a tappable button is back in the handover').not.toMatch(/<button/)
  })

  it('does not make the slide conditional on the mode', () => {
    // A `solo ?` around the control itself is how the button got there before;
    // choosing the *label* by mode is fine.
    expect(pass).not.toMatch(/\{solo \?[\s\S]{0,200}<SlideToPass/)
  })
})
