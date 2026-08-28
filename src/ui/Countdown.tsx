import { useEffect, useRef } from 'react'
import { play } from '../audio/engine'
import { now } from '../state/store'

interface Props {
  endsAt: number
  totalMs: number
  label?: string
}

/**
 * Ticks in its own rAF loop and writes straight to the DOM: a countdown that
 * re-rendered React 60 times a second would drag the whole screen with it.
 */
export function Countdown({ endsAt, totalMs, label }: Props) {
  const barRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    let raf = 0
    let lastWhole = Infinity
    const loop = () => {
      const left = Math.max(0, endsAt - now())
      const ratio = left / totalMs

      // One tick per second, but only once the clock is genuinely tight.
      const whole = Math.ceil(left / 1000)
      if (whole < lastWhole && whole > 0 && ratio < 0.55) play('tick')
      lastWhole = whole
      if (barRef.current) {
        barRef.current.style.transform = `scaleX(${ratio})`
        barRef.current.dataset.urgent = ratio < 0.35 ? 'true' : 'false'
      }
      if (textRef.current) textRef.current.textContent = (left / 1000).toFixed(1)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [endsAt, totalMs])

  return (
    <div className="countdown">
      <div className="countdown__head">
        <span>{label}</span>
        <span className="countdown__secs">
          <span ref={textRef}>0.0</span>s
        </span>
      </div>
      <div className="countdown__track">
        <div ref={barRef} className="countdown__bar" />
      </div>
    </div>
  )
}
