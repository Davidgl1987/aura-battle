import { useEffect, useRef } from 'react'
import { now, stamp } from '../../state/store'
import { QTE_GOOD_RATIO } from '../../engine/balance'
import { rampAt } from '../../engine/qte'
import type { Card, QteOutcome, SpeedParams } from '../../engine/types'
import { useRun } from './run'
import { useArming } from './arming'
import { countsAsTap, gradePace } from './speed'

interface Props {
  card: Card
  params: SpeedParams
  startedAt: number
  /** Unused: a mash has no path to learn. Kept so every widget shares a shape. */
  variation?: number
  onResult: (outcome: QteOutcome) => void
}

/** How far behind the pace still counts for something. */
const WINDOW_MS = 220

/**
 * How much room the `n`th alternation gets. Module level rather than a closure
 * so the frame loop can call it without being rebuilt every render.
 */
const windowFor = (n: number, perfectAt: number) => WINDOW_MS / rampAt(n - 1, perfectAt)

export function QteSpeed({ card, params, startedAt, onResult }: Props) {
  const run = useRun(card, onResult)
  /**
   * When the next alternation stops being on time. There is no schedule laid
   * out in advance any more: the card takes as many taps as your thumbs
   * manage, and the window simply tightens as the run gets longer.
   */
  const expires = useRef(0)
  const landed = useRef(0)
  const lastZone = useRef<number | null>(null)
  const arming = useArming(startedAt)

  const rootRef = useRef<HTMLDivElement>(null)
  const armRef = useRef<HTMLElement>(null)
  const timeRef = useRef<HTMLDivElement>(null)
  const fillRef = useRef<HTMLDivElement>(null)
  const countRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    let raf = 0
    const loop = () => {
      const t = now()
      const armedAt = arming.resolve(t)
      const left = armedAt === null ? 1 : 1 - (t - armedAt) / card.durationMs

      if (rootRef.current) rootRef.current.dataset.live = String(armedAt !== null)

      if (armRef.current) {
        armRef.current.textContent = `${(arming.countdown(t) / 1000).toFixed(1)}s`
      }
      if (timeRef.current) timeRef.current.style.transform = `scaleX(${Math.max(0, left)})`
      run.paint(rootRef.current)

      // Falling behind the pace costs a beat. The card does not wait, which is
      // what stops a slow, careful run from being worth a fast one.
      if (armedAt !== null && t > expires.current) {
        expires.current = t + windowFor(landed.current + 1, params.perfectAt)
        run.beat('missed')
      }
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${run.accuracy})`
      if (countRef.current) countRef.current.textContent = String(run.ledger.successes)

      if (armedAt !== null && left <= 0) {
        run.finish()
        return
      }
      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [startedAt, card.durationMs, params, arming, run])

  const tap = (zone: number) => (event: React.PointerEvent<HTMLButtonElement>) => {
    // No ceiling: keep going for as long as the animation lasts.
    if (run.done) return
    const t = event.nativeEvent.timeStamp ? stamp(event.nativeEvent.timeStamp) : now()

    // The tap that starts the clock still counts — swallowing your first hit
    // would feel like the game stole it.
    if (arming.armedAt === null) {
      arming.arm(t)
      expires.current = t + windowFor(1, params.perfectAt)
    }

    // Drumming one thumb is not the gesture: the move is a six and a seven,
    // one in each hand, so the same side twice is a beat thrown away.
    if (!countsAsTap(zone, lastZone.current, params.alternating)) {
      run.beat('missed')
      event.currentTarget.dataset.dead = 'true'
      window.setTimeout(() => event.currentTarget?.removeAttribute('data-dead'), 120)
      return
    }

    const room = windowFor(landed.current + 1, params.perfectAt)
    // How far past its deadline the tap arrived. Ahead of it is clean, however
    // far ahead: going quicker is the whole point of the gesture.
    const late = -(expires.current - t)
    landed.current += 1
    expires.current = t + windowFor(landed.current + 1, params.perfectAt)
    lastZone.current = zone
    run.beat(gradePace(late, room))
  }

  const zones = params.alternating ? [0, 1] : [0]

  return (
    <div className="qte" ref={rootRef} data-live="false">
      <div className="qte__title">
        {card.emoji} {card.name}
        <em className="qte__hint-grab">
          {params.alternating ? 'TAP EITHER PAD TO START' : 'TAP TO START'}{' '}
          <b ref={armRef} className="qte__count" />
        </em>
        <em className="qte__hint-live">
          {params.alternating ? 'ALTERNATE BOTH PADS' : 'MASH IT'}
        </em>
      </div>

      <div className="qte__timer">
        <div ref={timeRef} className="qte__timer-fill" />
      </div>

      <div className="qte__tally">
        <span ref={countRef}>0</span> · {params.goodAt} TO SCORE, {params.perfectAt} CLEAN
        <em> · KEEP ALTERNATING</em>
      </div>
      {/* The performance bar, not a tap count: it can go down. */}
      <div className="qte__progress">
        <div ref={fillRef} className="qte__progress-fill" />
        <div className="qte__mark" style={{ left: `${QTE_GOOD_RATIO * 100}%` }} />
      </div>

      <div className="qte__pads">
        {zones.map((zone) => (
          <button key={zone} className="pad" onPointerDown={tap(zone)}>
            {params.alternating ? (zone === 0 ? 'L' : 'R') : 'TAP'}
          </button>
        ))}
      </div>
    </div>
  )
}
