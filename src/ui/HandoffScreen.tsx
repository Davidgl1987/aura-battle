import type { CSSProperties } from 'react'
import { SlideToPass } from './SlideToPass'

interface Props {
  name: string
  color: string
  emoji: string
  note?: string
  onReady: () => void
}

/**
 * Opening the battle: the phone is changing hands for the first time. Nothing
 * ticks here on purpose, and between turns the score sheet does this job, so
 * this only ever runs once per match.
 */
export function HandoffScreen({ name, color, emoji, note, onReady }: Props) {
  return (
    <div className="handoff" style={{ '--who': color } as CSSProperties}>
      <span className="handoff__pass">PASS THE PHONE TO</span>
      <span className="handoff__emoji">{emoji}</span>
      <span className="handoff__name">{name}</span>
      {note && <span className="handoff__note">{note}</span>}
      {/* The same gesture as every other handover, so there is one way to give
          the phone up rather than two. */}
      <div className="handoff__cta">
        {/* The name is already the biggest thing on the screen; saying it
            again here only makes the label too wide for its own track. */}
        <SlideToPass color={color} label="SLIDE WHEN YOU HAVE IT" onComplete={onReady} />
      </div>
    </div>
  )
}
