import { useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { useSettled } from './pointers'

/** How far along the track counts as having meant it. */
const THRESHOLD = 0.78
/** How long the glass has to stay clear before the slider will listen. */
const SETTLE_MS = 300
const EASE = 'transform 220ms cubic-bezier(0.2, 0.9, 0.2, 1)'

interface Props {
  label: string
  /** The colour of whoever is being handed the phone. */
  color: string
  onComplete: () => void
}

/**
 * Slide, rather than tap, to hand the phone over.
 *
 * A 29-tap Sturdy does not stop cleanly: the last few taps land after the QTE
 * has already been graded, and a button anywhere on screen eats one of them and
 * skips the turn. Moving the button does not help, because the three QTE kinds
 * cover different parts of the glass between them.
 *
 * Three things have to be true before this can fire, and a stray tap satisfies
 * none of them: every finger is off the glass, it has stayed off for a beat,
 * and a fresh press has dragged most of the way across. A pointer that went
 * down during the QTE can never do it — `pointerdown` only fires on the press,
 * so a finger that is already down cannot take hold of something that has just
 * appeared under it.
 */
export function SlideToPass({ label, color, onComplete }: Props) {
  const armed = useSettled(SETTLE_MS)

  const trackRef = useRef<HTMLDivElement>(null)
  const fillRef = useRef<HTMLDivElement>(null)
  const knobRef = useRef<HTMLButtonElement>(null)
  const drag = useRef<{ id: number; from: number; travel: number } | null>(null)
  const spent = useRef(false)

  const paint = (px: number, travel: number, animate: boolean) => {
    const knob = knobRef.current
    const fill = fillRef.current
    if (!knob || !fill) return
    knob.style.transition = animate ? EASE : 'none'
    fill.style.transition = animate ? EASE : 'none'
    knob.style.transform = `translateX(${px}px)`
    fill.style.transform = `scaleX(${travel > 0 ? px / travel : 0})`
  }

  const reach = (event: ReactPointerEvent) => {
    const held = drag.current
    if (!held) return 0
    return Math.min(Math.max(event.clientX - held.from, 0), held.travel)
  }

  const grab = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const track = trackRef.current
    const knob = knobRef.current
    if (!armed || spent.current || drag.current || !track || !knob) return

    // Measured on the press: the console is a different width on every phone.
    const travel = track.clientWidth - knob.offsetWidth - 8
    // Keeps the move events coming once the finger slides off the knob. It
    // throws if the pointer has already gone, which is not worth dying over.
    try {
      knob.setPointerCapture(event.pointerId)
    } catch {
      // Carry on without capture; the drag still works inside the knob.
    }
    drag.current = { id: event.pointerId, from: event.clientX, travel }
    paint(0, travel, false)
  }

  const move = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const held = drag.current
    if (!held || held.id !== event.pointerId) return
    paint(reach(event), held.travel, false)
  }

  const release = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const held = drag.current
    if (!held || held.id !== event.pointerId) return
    const px = reach(event)
    drag.current = null

    if (px / held.travel >= THRESHOLD) {
      spent.current = true
      paint(held.travel, held.travel, true)
      onComplete()
      return
    }
    // Short of the line: it springs back and nothing happened.
    paint(0, held.travel, true)
  }

  return (
    <div className="slide" data-armed={armed} style={{ '--who': color } as CSSProperties}>
      <div className="slide__track" ref={trackRef}>
        <div className="slide__fill" ref={fillRef} />
        <span className="slide__label">{label}</span>
        <button
          type="button"
          ref={knobRef}
          className="slide__knob"
          aria-label={label}
          onPointerDown={grab}
          onPointerMove={move}
          onPointerUp={release}
          onPointerCancel={release}
        >
          ›››
        </button>
      </div>
    </div>
  )
}
