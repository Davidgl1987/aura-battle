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
          <span className="tutorial__hand" />
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
 */
function TutorialStage({ game }: { game: QteGame }) {
  switch (game) {
    case 'sweep':
      return (
        <span className="demo-bar">
          <span className="demo-bar__zone" />
          <span className="demo-bar__cursor" />
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
        </span>
      )
    case 'order':
      return (
        <span className="demo-order">
          {[1, 2, 3, 4].map((n) => (
            <span key={n} className="demo-order__key" style={{ '--n': n } as React.CSSProperties}>
              {n}
            </span>
          ))}
        </span>
      )
    case 'zone':
      return (
        <span className="demo-zone">
          <span className="demo-zone__ring" />
        </span>
      )
    case 'paths':
      return (
        <span className="demo-paths">
          <span className="demo-paths__lane" />
          <span className="demo-paths__lane" />
        </span>
      )
  }
}
