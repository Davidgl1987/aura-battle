import { useI18n } from '../../i18n'
import type { QteGame } from '../../engine/types'

interface Props {
  game: QteGame
  onDismiss: () => void
}

/**
 * What this minigame wants, the first time it comes up.
 *
 * The battle is stopped while this is on screen — not slowed, stopped: it takes
 * its own hold on the game clock, so the QTE's own deadline is not running
 * behind it and nobody loses a card to reading an explanation.
 *
 * One per minigame rather than one per card. A sweep and a chart are both filed
 * under Timing and have nothing in common, so the tier a card sits at is never
 * what needs explaining — the gesture is.
 */
export function QteTutorial({ game, onDismiss }: Props) {
  const { t } = useI18n()

  return (
    <div className="tutorial" role="dialog" aria-modal="true">
      <div className="tutorial__card">
        <span className="tutorial__eyebrow">{t('tutorial.title')}</span>

        {/* The hand does the gesture on a loop. The text says what it means;
            the hand says what it feels like, which is the half a still icon
            cannot carry. */}
        <div className="tutorial__demo" data-game={game} aria-hidden>
          <TutorialStage game={game} />
        </div>

        <p className="tutorial__text">{t(`tutorial.${game}`)}</p>

        <button className="btn btn--big" onPointerDown={onDismiss} autoFocus>
          {t('tutorial.skip')}
        </button>
      </div>
    </div>
  )
}

/**
 * The board the hand is moving over, drawn small and still. Enough of the real
 * widget to recognise it when it appears a second later, and no more — this is
 * a diagram, not a rehearsal.
 *
 * Each stage carries its own hand rather than the card holding one for all of
 * them. The hand has to be positioned in the same box as the thing it is
 * pointing at: hanging it off the outer frame while the numbers were laid out
 * inside an inset one meant two different coordinate spaces, and the finger
 * landed next to the keys instead of on them.
 */
function TutorialStage({ game }: { game: QteGame }) {
  switch (game) {
    case 'sweep':
      return (
        <span className="demo-bar">
          <span className="demo-bar__zone" />
          <span className="demo-bar__cursor" />
          <span className="tutorial__hand" />
        </span>
      )
    case 'lanes':
      return (
        <span className="demo-lanes">
          {[0, 1, 2].map((i) => (
            <span key={i} className="demo-lanes__lane">
              <span className="demo-lanes__line" />
              {i === 1 && <span className="demo-lanes__note" />}
            </span>
          ))}
          <span className="tutorial__hand" />
        </span>
      )
    case 'mash':
      return (
        <span className="demo-pads">
          {['L', 'M', 'R'].map((label) => (
            <span key={label} className="demo-pads__pad">
              {label}
            </span>
          ))}
          <span className="tutorial__hand" />
        </span>
      )
    case 'order':
      return (
        <span className="demo-order">
          {[1, 2, 3, 4].map((n) => (
            <span key={n} className="demo-order__key">
              {n}
            </span>
          ))}
          <span className="tutorial__hand" />
        </span>
      )
    case 'zone':
      return (
        <span className="demo-zone">
          <span className="demo-zone__ring" />
          <span className="tutorial__hand" />
        </span>
      )
    case 'paths':
      return <DriveDemo />
  }
}

/**
 * The drive test: two lanes winding past above, a diamond on each showing where
 * your thumb has put it, and a wheel under each to slide it back on.
 *
 * It used to be drawn as two upright bars with a finger in each, which is not
 * the gesture at all — the thumbs never touch the lanes, they sit on the wheels
 * below and steer. Somebody who had read that tutorial would have reached for
 * the wrong half of the screen.
 */
function DriveDemo() {
  return (
    <span className="demo-drive">
      <span className="demo-drive__track">
        <svg className="demo-drive__lanes" viewBox="0 0 100 60" preserveAspectRatio="none">
          {/* Two wavelengths tall and scrolled by exactly one, so the loop has
              no seam. The marks below swing on the same period. */}
          <g className="demo-drive__scroll">
            <path className="demo-drive__lane" d={LANE_LEFT} />
            <path className="demo-drive__lane" d={LANE_RIGHT} />
          </g>
        </svg>
        <span className="demo-drive__mark demo-drive__mark--left" />
        <span className="demo-drive__mark demo-drive__mark--right" />
      </span>

      <span className="demo-drive__wheels">
        <span className="demo-drive__wheel">
          <span className="demo-drive__knob" />
          <span className="tutorial__hand tutorial__hand--left" />
        </span>
        <span className="demo-drive__wheel">
          <span className="demo-drive__knob" />
          <span className="tutorial__hand tutorial__hand--right" />
        </span>
      </span>
    </span>
  )
}

/**
 * One lane, drawn over two full waves so scrolling by one leaves the shape
 * exactly where it started. `C` curves rather than straight segments, because
 * the real track is a spline and a zigzag reads as a different gesture.
 */
const lane = (x: number, amp: number, phase: number) => {
  const at = (i: number) => x + amp * Math.sin(phase + (i * Math.PI) / 2)
  return (
    `M ${at(0)} -60` +
    ` C ${at(0)} -45, ${at(1)} -45, ${at(1)} -30` +
    ` C ${at(1)} -15, ${at(2)} -15, ${at(2)} 0` +
    ` C ${at(2)} 15, ${at(3)} 15, ${at(3)} 30` +
    ` C ${at(3)} 45, ${at(4)} 45, ${at(4)} 60` +
    ` C ${at(4)} 75, ${at(5)} 75, ${at(5)} 90` +
    ` C ${at(5)} 105, ${at(6)} 105, ${at(6)} 120`
  )
}

const LANE_LEFT = lane(28, 12, 0)
const LANE_RIGHT = lane(72, 12, Math.PI)
