import type { CSSProperties } from 'react'
import { useI18n } from '../i18n'
import { SlideToPass } from './SlideToPass'

interface Props {
  name: string
  color: string
  emoji: string
  note?: string
  /** What the screen is for. The default is a phone changing hands. */
  lead?: string
  /**
   * A handover is a slide, because a slide is hard to do by accident with a
   * phone in motion. Solo has nobody to hand it to, so it gets a tap.
   */
  confirm?: 'slide' | 'tap'
  confirmLabel?: string
  onReady: () => void
}

/**
 * Opening the battle: the phone is changing hands for the first time. Nothing
 * ticks here on purpose, and between turns the score sheet does this job, so
 * this only ever runs once per match.
 */
export function HandoffScreen({
  name,
  color,
  emoji,
  note,
  lead,
  confirm = 'slide',
  confirmLabel,
  onReady,
}: Props) {
  const { t } = useI18n()

  return (
    <div className="handoff" style={{ '--who': color } as CSSProperties}>
      <span className="handoff__pass">{lead ?? t('handoff.passTo')}</span>
      <span className="handoff__emoji">{emoji}</span>
      <span className="handoff__name">{name}</span>
      {note && <span className="handoff__note">{note}</span>}
      <div className="handoff__cta">
        {/* The name is already the biggest thing on the screen; saying it
            again here only makes the label too wide for its own track. */}
        {confirm === 'slide' ? (
          <SlideToPass color={color} label={confirmLabel ?? t('handoff.slide')} onComplete={onReady} />
        ) : (
          <button className="btn btn--big" onPointerDown={onReady}>
            {confirmLabel ?? t('handoff.start')}
          </button>
        )}
      </div>
    </div>
  )
}
