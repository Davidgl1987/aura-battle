import { useEffect, useRef } from 'react'
import { now, stamp } from '../../state/store'
import { QTE_GOOD_RATIO, QTE_RAMP } from '../../engine/balance'
import type { Card, QteOutcome, SpeedParams } from '../../engine/types'
import { schedule, useRun } from './run'
import { useArming } from './arming'
import { countsAsTap } from './speed'

interface Props {
  card: Card
  params: SpeedParams
  startedAt: number
  /** Unused: a mash has no path to learn. Kept so every widget shares a shape. */
  variation?: number
  onResult: (outcome: QteOutcome) => void
}

/** How far off the beat still counts for something. */
const WINDOW_MS = 170

export function QteSpeed({ card, params, startedAt, onResult }: Props) {
  const run = useRun(card, onResult)
  const beats = useRef(schedule(card.durationMs, params.targetTaps, QTE_RAMP))
  const next = useRef(0)
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

      // Beats that came and went unanswered. The rhythm does not wait, which
      // is what makes falling behind cost something rather than nothing.
      if (armedAt !== null) {
        const elapsed = t - armedAt
        while (next.current < beats.current.length && elapsed > beats.current[next.current] + WINDOW_MS) {
          next.current += 1
          run.beat('missed')
        }
        if (fillRef.current) {
          fillRef.current.style.transform = `scaleX(${run.accuracy})`
        }
        if (countRef.current) countRef.current.textContent = String(run.ledger.successes)
      }

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
    if (run.done || next.current >= beats.current.length) return
    const t = event.nativeEvent.timeStamp ? stamp(event.nativeEvent.timeStamp) : now()

    // The tap that starts the clock still counts — swallowing your first hit
    // would feel like the game stole it.
    arming.arm(t)
    const armedAt = arming.armedAt ?? t

    // Drumming one thumb is not the gesture: the move is a six and a seven,
    // one in each hand, so the same side twice is a beat thrown away.
    if (!countsAsTap(zone, lastZone.current, params.alternating)) {
      next.current += 1
      run.beat('missed')
      event.currentTarget.dataset.dead = 'true'
      window.setTimeout(() => event.currentTarget?.removeAttribute('data-dead'), 120)
      return
    }

    // How close to the beat it landed. The beats tighten as the card runs, so
    // the same hand gets less room the further in it gets.
    const error = Math.abs(t - armedAt - beats.current[next.current])
    next.current += 1
    lastZone.current = zone
    run.beat(error <= WINDOW_MS * 0.45 ? 'clean' : error <= WINDOW_MS ? 'scrappy' : 'missed')
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
        <span ref={countRef}>0</span> / {params.targetTaps}
        <em> · ALTERNATE ON THE BEAT</em>
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
