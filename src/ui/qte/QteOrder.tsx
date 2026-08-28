import { useEffect, useMemo, useRef, useState } from 'react'
import { play } from '../../audio/engine'
import { now, stamp } from '../../state/store'
import type { Card, Judgement, OrderParams } from '../../engine/types'
import { useArming } from './arming'
import { gradeOrder, orderLayout } from './order'

interface Props {
  card: Card
  params: OrderParams
  startedAt: number
  variation: number
  onResult: (judgement: Judgement) => void
}

export function QteOrder({ card, params, startedAt, variation, onResult }: Props) {
  const arming = useArming(startedAt)
  const spots = useMemo(() => orderLayout(params.count, variation), [params.count, variation])

  const next = useRef(1)
  const mistakes = useRef(0)
  const done = useRef(false)
  const onResultRef = useRef(onResult)

  const rootRef = useRef<HTMLDivElement>(null)
  const armRef = useRef<HTMLElement>(null)
  const timeRef = useRef<HTMLDivElement>(null)
  const [taken, setTaken] = useState(0)
  const [wrong, setWrong] = useState(0)

  useEffect(() => {
    onResultRef.current = onResult
  })

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

      if (armedAt !== null && left <= 0 && !done.current) {
        done.current = true
        onResultRef.current(gradeOrder(false, t - armedAt, mistakes.current, params))
        return
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [card.durationMs, params, arming])

  /**
   * Unlike the other cards the first press counts. The numbers are on the pad
   * from the moment it opens, so reaching for one is already the answer — a
   * press of "1" that did nothing would just read as a dropped input.
   */
  const press = (n: number) => (event: React.PointerEvent) => {
    if (done.current) return
    const t = event.nativeEvent.timeStamp ? stamp(event.nativeEvent.timeStamp) : now()
    // The clock starts on the press that begins the sequence, so hunting for
    // the first number costs nothing.
    if (arming.armedAt === null) arming.arm(t)
    const armedAt = arming.armedAt ?? t

    if (n !== next.current) {
      mistakes.current += 1
      setWrong(mistakes.current)
      play('dead')
      return
    }

    next.current += 1
    setTaken(n)
    play('tap')

    if (next.current > params.count) {
      done.current = true
      onResultRef.current(gradeOrder(true, t - armedAt, mistakes.current, params))
    }
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
