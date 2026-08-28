import { useEffect, useRef, useState } from 'react'
import { play } from '../../audio/engine'
import { now, stamp } from '../../state/store'
import type { Card, Judgement, TimingParams } from '../../engine/types'
import { useArming } from './arming'
import { combine, cursorAt, errorAt, gradeHit, startEdge } from './timing'

interface Props {
  card: Card
  params: TimingParams
  startedAt: number
  variation: number
  onResult: (judgement: Judgement) => void
}

export function QteTiming({ card, params, startedAt, variation, onResult }: Props) {
  const edge = startEdge(variation)
  const hits = useRef<Judgement[]>([])
  const done = useRef(false)
  const onResultRef = useRef(onResult)
  const arming = useArming(startedAt)

  const rootRef = useRef<HTMLDivElement>(null)
  const armRef = useRef<HTMLElement>(null)
  const cursorRef = useRef<HTMLDivElement>(null)
  const timeRef = useRef<HTMLDivElement>(null)
  const [taken, setTaken] = useState<Judgement[]>([])

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

      // Parked at the start of the sweep until the player says go, so it
      // begins where it sits instead of jumping.
      const x = armedAt === null ? edge : cursorAt(t, armedAt, params.sweepMs, edge)
      if (cursorRef.current) cursorRef.current.style.left = `${x * 100}%`
      if (rootRef.current) rootRef.current.dataset.live = String(armedAt !== null)
      if (armRef.current) {
        armRef.current.textContent = `${(arming.countdown(t) / 1000).toFixed(1)}s`
      }

      const left = armedAt === null ? 1 : 1 - (t - armedAt) / card.durationMs
      if (timeRef.current) timeRef.current.style.transform = `scaleX(${Math.max(0, left)})`

      if (armedAt !== null && left <= 0) {
        // Out of time with taps still owed: no amount of good ones saves it.
        finish(hits.current.length < params.hits ? 'MISS' : combine(hits.current))
        return
      }
      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [startedAt, card.durationMs, params, edge, arming])

  const tap = (event: React.PointerEvent) => {
    if (done.current) return
    // The native timestamp is the moment the finger landed, not the moment
    // React got around to us — that difference is a whole judgement grade.
    const t = event.nativeEvent.timeStamp ? stamp(event.nativeEvent.timeStamp) : now()

    // The first touch only sets the cursor moving: grading a tap against a
    // parked cursor would be a free MISS.
    if (arming.armedAt === null) {
      arming.arm(t)
      play('tap')
      return
    }

    const hit = gradeHit(errorAt(t, arming.armedAt, params.sweepMs, edge), params)
    play(hit === 'MISS' ? 'dead' : 'tap')
    hits.current = [...hits.current, hit]
    setTaken(hits.current)

    if (hits.current.length >= params.hits) {
      done.current = true
      onResultRef.current(combine(hits.current))
    }
  }

  const goodWidth = (params.goodMs / params.sweepMs) * 200
  const perfectWidth = (params.perfectMs / params.sweepMs) * 200

  return (
    <div className="qte" ref={rootRef} data-live="false" onPointerDown={tap}>
      <div className="qte__title">
        {card.emoji} {card.name}
        <em className="qte__hint-grab">
          TAP TO START <b ref={armRef} className="qte__count" />
        </em>
        <em className="qte__hint-live">
          {params.hits > 1 ? `${params.hits} TAPS, DEAD CENTRE` : 'TAP DEAD CENTRE'}
        </em>
      </div>

      <div className="qte__timer">
        <div ref={timeRef} className="qte__timer-fill" />
      </div>

      <div className="qte__bar">
        <div className="qte__zone qte__zone--good" style={{ width: `${goodWidth}%` }} />
        <div className="qte__zone qte__zone--perfect" style={{ width: `${perfectWidth}%` }} />
        <div ref={cursorRef} className="qte__cursor" />
      </div>

      <div className="qte__hits">
        {Array.from({ length: params.hits }, (_, i) => (
          <span key={i} className="qte__hit" data-hit={taken[i] ?? 'pending'}>
            {taken[i] ?? '•'}
          </span>
        ))}
      </div>
    </div>
  )
}
