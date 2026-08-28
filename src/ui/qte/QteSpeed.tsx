import { useEffect, useRef } from 'react'
import { play } from '../../audio/engine'
import { now, stamp } from '../../state/store'
import type { Card, Judgement, SpeedParams } from '../../engine/types'
import { useArming } from './arming'
import { countsAsTap, goodThreshold, gradeSpeed } from './speed'

interface Props {
  card: Card
  params: SpeedParams
  startedAt: number
  /** Unused: a mash has no path to learn. Kept so every widget shares a shape. */
  variation?: number
  onResult: (judgement: Judgement) => void
}

export function QteSpeed({ card, params, startedAt, onResult }: Props) {
  const done = useRef(false)
  const taps = useRef(0)
  const lastZone = useRef<number | null>(null)
  const onResultRef = useRef(onResult)
  const arming = useArming(startedAt)

  const rootRef = useRef<HTMLDivElement>(null)
  const armRef = useRef<HTMLElement>(null)
  const timeRef = useRef<HTMLDivElement>(null)
  const fillRef = useRef<HTMLDivElement>(null)
  const countRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    onResultRef.current = onResult
  })

  useEffect(() => {
    let raf = 0
    const finish = (judgement: Judgement) => {
      if (done.current) return
      done.current = true
      onResultRef.current(judgement)
    }

    const loop = () => {
      const t = now()
      const armedAt = arming.resolve(t)
      const left = armedAt === null ? 1 : 1 - (t - armedAt) / card.durationMs

      if (rootRef.current) rootRef.current.dataset.live = String(armedAt !== null)

      if (armRef.current) {
        armRef.current.textContent = `${(arming.countdown(t) / 1000).toFixed(1)}s`
      }
      if (timeRef.current) timeRef.current.style.transform = `scaleX(${Math.max(0, left)})`

      if (armedAt !== null && left <= 0) {
        finish(gradeSpeed(taps.current, params))
        return
      }
      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [startedAt, card.durationMs, params, arming])

  const tap = (zone: number) => (event: React.PointerEvent<HTMLButtonElement>) => {
    if (done.current) return

    if (!countsAsTap(zone, lastZone.current, params.alternating)) {
      // Dead input: say so instead of silently swallowing the tap.
      play('dead')
      event.currentTarget.dataset.dead = 'true'
      window.setTimeout(() => event.currentTarget?.removeAttribute('data-dead'), 120)
      return
    }

    // The tap that starts the clock still counts — swallowing your first hit
    // of a mash would feel like the game stole it.
    arming.arm(
      event.nativeEvent.timeStamp ? stamp(event.nativeEvent.timeStamp) : now(),
    )

    play('tap')
    lastZone.current = zone
    taps.current += 1

    // Counting taps through React state would drop inputs at mash speed.
    if (fillRef.current) {
      fillRef.current.style.transform = `scaleX(${Math.min(1, taps.current / params.targetTaps)})`
    }
    if (countRef.current) countRef.current.textContent = String(taps.current)

    if (taps.current >= params.targetTaps) {
      done.current = true
      onResultRef.current('PERFECT')
    }
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
        <em> · {goodThreshold(params)} to score</em>
      </div>
      <div className="qte__progress">
        <div ref={fillRef} className="qte__progress-fill" />
        <div
          className="qte__mark"
          style={{ left: `${(goodThreshold(params) / params.targetTaps) * 100}%` }}
        />
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
