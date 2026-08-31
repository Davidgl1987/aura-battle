import { describe, expect, it } from 'vitest'
import { CARDS } from '../../engine/cards'
import BOARDS from './boards.tsx?raw'
import TUTORIAL from './QteTutorial.tsx?raw'
import STYLES from '../styles.css?raw'
import QteTiming from './QteTiming.tsx?raw'
import QteLanes from './QteLanes.tsx?raw'
import QteSpeed from './QteSpeed.tsx?raw'
import QteOrder from './QteOrder.tsx?raw'
import QteControl from './QteControl.tsx?raw'
import QtePaths from './QtePaths.tsx?raw'

/**
 * The tutorial and the card have to be looking at the same board.
 *
 * They did not used to be. The tutorial drew its own version of each minigame
 * in CSS keyframes, and the drive-test one drifted far enough to show a gesture
 * the game does not have — two upright bars with a finger in each, when the
 * real card is two wheels you steer with. These are the checks that would have
 * caught it, and they are structural rather than visual: they say the drawing
 * exists in exactly one place.
 */
const WIDGETS = Object.entries({
  QteTiming,
  QteLanes,
  QteSpeed,
  QteOrder,
  QteControl,
  QtePaths,
}).map(([name, src]) => ({ name, src }))

/** The class names a board owns, and nobody else may write. */
const OWNED = [
  'qte__bar',
  'qte__zone',
  'qte__cursor',
  'lanes__lane',
  'lanes__line',
  'lanes__note',
  'qte__pads',
  'order__key',
  'zone__ring',
  'drive__track',
  'drive__lane',
  'drive__mark',
  'drive__wheel',
  'drive__knob',
]

describe('one drawing of each board', () => {
  it('builds every board in boards.tsx and nowhere else', () => {
    for (const cls of OWNED) {
      const marker = `className="${cls}`
      expect(BOARDS, `boards.tsx draws .${cls}`).toContain(marker)
      expect(TUTORIAL, `the tutorial redraws .${cls}`).not.toContain(marker)
      for (const { name, src } of WIDGETS) {
        expect(src, `${name} redraws .${cls}`).not.toContain(marker)
      }
    }
  })

  it('leaves the tutorial with no board of its own to draw', () => {
    // Any `className="demo-…"` would be a second drawing starting up again.
    expect(TUTORIAL).not.toMatch(/className="demo-/)
    expect(STYLES).not.toMatch(/\.demo-\w/)
  })

  it('has a demo for every minigame, built from a real card', () => {
    const games = [...new Set(CARDS.map((c) => c.qte.game))]
    expect(games).toHaveLength(6)
    for (const game of games) {
      expect(TUTORIAL, `${game} has no demo`).toMatch(new RegExp(`\\b${game}:\\s*'[a-z-]+'`))
    }
    // And every card those demos name has to be a card that exists.
    const named = [...TUTORIAL.matchAll(/\b(?:sweep|lanes|mash|order|zone|paths):\s*'([a-z-]+)'/g)]
    expect(named).toHaveLength(6)
    for (const [, id] of named) {
      expect(CARDS.map((c) => c.id), `${id} is not a card`).toContain(id)
    }
  })

  it('drives the demos from the same geometry the cards are graded on', () => {
    // Not a copy of the maths: the tutorial imports it.
    for (const fn of ['paintSweep', 'paintLanes', 'paintZone', 'paintDrive']) {
      expect(TUTORIAL, `the tutorial does not use ${fn}`).toContain(fn)
    }
    for (const fn of ['zoneCentres', 'chart', 'spotFor', 'drifted', 'padLabel', 'startPhase']) {
      expect(TUTORIAL, `the tutorial does not use ${fn}`).toContain(fn)
    }
  })
})
