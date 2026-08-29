import { useEffect, useMemo, useRef, useState } from 'react'
import { now, stamp } from '../../state/store'
import { QTE_RAMP } from '../../engine/balance'
import type { Card, OrderParams, QteOutcome } from '../../engine/types'
import { schedule, useRun } from './run'
import { useArming } from './arming'
import { orderLayout } from './order'

interface Props {
  card: Card
  params: OrderParams
  startedAt: number
  variation: number
  onResult: (outcome: QteOutcome) => void
}

export function QteOrder({ card, params, startedAt, variation, onResult }: Props) {
  const arming = useArming(startedAt)
  const spots = useMemo(() => orderLayout(params.count, variation), [params.count, variation])

  const run = useRun(card, onResult)
  const next = useRef(1)
  // Every number gets its own slice of the card, and the slices get shorter.
  const deadlines = useRef(schedule(card.durationMs, params.count, QTE_RAMP))

  const rootRef = useRef<HTMLDivElement>(null)
  const armRef = useRef<HTMLElement>(null)
  const timeRef = useRef<HTMLDivElement>(null)
  const [taken, setTaken] = useState(0)
  const [wrong, setWrong] = useState(0)

  useEffect(() => {
    let raf = 0
    const loop = () => {
      const t = now()
      const armedAt = arming.resolve(t)

      if (rootRef.current) rootRef.current.dataset.live = String(armedAt !== null)
      if (armRef.current) {
        armRef.current.textContent = `${(arming.countdown(t) / 1000).toFixed(1)}s`
      }

      const left = armedAt === null ? 1 : 1 - (t - armedAt) / card.durationMs
      if (timeRef.current) timeRef.current.style.transform = `scaleX(${Math.max(0, left)})`

      run.paint(rootRef.current)

      // A number whose time ran out is gone, and it costs what fumbling one
      // costs. The sequence moves on rather than stalling on it.
      if (armedAt !== null) {
        const elapsed = t - armedAt
        while (next.current <= params.count && elapsed > deadlines.current[next.current - 1]) {
          next.current += 1
          run.beat('missed')
          setTaken(next.current - 1)
        }
      }

      if (armedAt !== null && left <= 0) {
        run.finish()
        return
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [card.durationMs, params, arming, run])

  /**
   * Unlike the other cards the first press counts. The numbers are on the pad
   * from the moment it opens, so reaching for one is already the answer — a
   * press of "1" that did nothing would just read as a dropped input.
   */
  const press = (n: number) => (event: React.PointerEvent) => {
    if (run.done || next.current > params.count) return
    const t = event.nativeEvent.timeStamp ? stamp(event.nativeEvent.timeStamp) : now()
    // The clock starts on the press that begins the sequence, so hunting for
    // the first number costs nothing.
    if (arming.armedAt === null) arming.arm(t)
    const armedAt = arming.armedAt ?? t

    if (n !== next.current) {
      // A press out of order costs the chance the way running out of time on
      // it would, and the number stays: you still have to find it.
      run.beat('missed')
      next.current += 1
      setWrong(run.ledger.mistakes)
      setTaken(next.current - 1)
      return
    }

    // Early in its own window is clean; scrambling for it at the end is not.
    const window = deadlines.current[n - 1] - (n > 1 ? deadlines.current[n - 2] : 0)
    const spent = t - armedAt - (n > 1 ? deadlines.current[n - 2] : 0)
    run.beat(spent <= window * 0.6 ? 'clean' : 'scrappy')

    next.current += 1
    setTaken(n)
  }

  return (
    <div className="qte" ref={rootRef} data-live="false">
      <div className="qte__title">
        {card.emoji} {card.name}
        <em className="qte__hint-grab">
          PRESS 1 TO START <b ref={armRef} className="qte__count" />
        </em>
        <em className="qte__hint-live">IN ORDER — {taken}/{params.count}</em>
      </div>

      <div className="qte__timer">
        <div ref={timeRef} className="qte__timer-fill" />
      </div>

      <div className="qte__area order" data-wrong={wrong}>
        {spots.map((spot) => (
          <button
            key={spot.n}
            type="button"
            className="order__key"
            data-done={spot.n <= taken}
            style={{ left: `${spot.x * 100}%`, top: `${spot.y * 100}%` }}
            onPointerDown={press(spot.n)}
          >
            {spot.n}
          </button>
        ))}
      </div>
    </div>
  )
}
