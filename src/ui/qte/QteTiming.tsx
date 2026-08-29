import { useEffect, useRef } from 'react'
import { QTE_RAMP } from '../../engine/balance'
import { now, stamp } from '../../state/store'
import type { Card, QteOutcome, TimingParams } from '../../engine/types'
import { useArming } from './arming'
import { useRun } from './run'
import { cursorAt, errorAt, gradeHit, startEdge } from './timing'

interface Props {
  card: Card
  params: TimingParams
  startedAt: number
  variation: number
  onResult: (outcome: QteOutcome) => void
}

/**
 * A cursor sweeps the bar and you tap it dead centre, as many times as the
 * card asks for, and every hit makes the next sweep faster.
 *
 * The card no longer ends on the last tap — it runs the whole animation, so a
 * player who lands their taps early has to hold their nerve rather than being
 * let off. Taps they never take are counted as ignored at the end, which is
 * what stops standing still from being a clean sheet.
 */
export function QteTiming({ card, params, startedAt, variation, onResult }: Props) {
  const edge = startEdge(variation)
  const run = useRun(card, onResult)
  const arming = useArming(startedAt)

  const rootRef = useRef<HTMLDivElement>(null)
  const armRef = useRef<HTMLElement>(null)
  const cursorRef = useRef<HTMLDivElement>(null)
  const timeRef = useRef<HTMLDivElement>(null)
  const hitsRef = useRef<HTMLDivElement>(null)

  // The sweep tightens with every landed tap, so the last one of a card is a
  // different ask from the first.
  const sweep = useRef(params.sweepMs)
  const phase = useRef(0)

  useEffect(() => {
    let raf = 0
    const loop = () => {
      const t = now()
      const armedAt = arming.resolve(t)

      const x = armedAt === null ? edge : cursorAt(t, phase.current, sweep.current, edge)
      if (cursorRef.current) cursorRef.current.style.left = `${x * 100}%`
      if (rootRef.current) rootRef.current.dataset.live = String(armedAt !== null)
      if (armRef.current) armRef.current.textContent = `${(arming.countdown(t) / 1000).toFixed(1)}s`
      run.paint(rootRef.current)

      const left = armedAt === null ? 1 : 1 - (t - armedAt) / card.durationMs
      if (timeRef.current) timeRef.current.style.transform = `scaleX(${Math.max(0, left)})`

      if (armedAt !== null && left <= 0) {
        run.finish()
        return
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [startedAt, card.durationMs, edge, arming, run])

  const tap = (event: React.PointerEvent) => {
    if (run.done || run.ledger.taken >= run.total) return
    // The native timestamp is the moment the finger landed, not the moment
    // React got around to us — that difference is a whole judgement grade.
    const t = event.nativeEvent.timeStamp ? stamp(event.nativeEvent.timeStamp) : now()

    // The first touch only sets the cursor moving: grading a tap against a
    // parked cursor would be a free MISS.
    if (arming.armedAt === null) {
      arming.arm(t)
      phase.current = t
      return
    }

    const hit = gradeHit(errorAt(t, phase.current, sweep.current, edge), params)
    run.beat(hit === 'PERFECT' ? 'clean' : hit === 'GOOD' ? 'scrappy' : 'missed')

    if (hit !== 'MISS') {
      // Speeding up from the tap that earned it, so the cursor does not jump.
      const step = 1 - (QTE_RAMP - 1) / (params.hits - 1) / QTE_RAMP
      sweep.current = Math.max(180, sweep.current * step)
      phase.current = t
    }

    const dot = hitsRef.current?.children[run.ledger.taken - 1] as HTMLElement | undefined
    if (dot) dot.dataset.hit = hit
  }

  const goodWidth = (params.goodMs / params.sweepMs) * 200
  const perfectWidth = (params.perfectMs / params.sweepMs) * 200

  return (
    <div className="qte" ref={rootRef} data-live="false" data-perfect="true" onPointerDown={tap}>
      <div className="qte__title">
        {card.emoji} {card.name}
        <em className="qte__hint-grab">
          TAP TO START <b ref={armRef} className="qte__count" />
        </em>
        <em className="qte__hint-live">{params.hits} TAPS · IT SPEEDS UP</em>
      </div>

      <div className="qte__timer">
        <div ref={timeRef} className="qte__timer-fill" />
      </div>

      <div className="qte__bar">
        <div className="qte__zone qte__zone--good" style={{ width: `${goodWidth}%` }} />
        <div className="qte__zone qte__zone--perfect" style={{ width: `${perfectWidth}%` }} />
        <div ref={cursorRef} className="qte__cursor" />
      </div>

      <div className="qte__hits" ref={hitsRef}>
        {Array.from({ length: params.hits }, (_, i) => (
          <span key={i} className="qte__hit" data-hit="pending" />
        ))}
      </div>
    </div>
  )
}
