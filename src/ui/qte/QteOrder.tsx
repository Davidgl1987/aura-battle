import { useEffect, useRef, useState } from 'react'
import { now, stamp } from '../../state/store'
import type { Card, OrderParams, QteOutcome } from '../../engine/types'
import { useRun } from './run'
import { useArming } from './arming'
import { rampAt } from '../../engine/qte'
import { spotFor, type Spot } from './order'

interface Props {
  card: Card
  params: OrderParams
  startedAt: number
  variation: number
  onResult: (outcome: QteOutcome) => void
}

/**
 * How much room the `n`th number gets. Module level rather than a closure so
 * the frame loop can call it without being rebuilt every render.
 */
const windowFor = (n: number, params: OrderParams) =>
  params.windowMs / rampAt(n - 1, params.perfectAt)

export function QteOrder({ card, params, startedAt, variation, onResult }: Props) {
  const arming = useArming(startedAt)

  /**
   * A rolling window rather than the whole sequence laid out at once. Five are
   * on the pad; press the lowest and it goes, and the next number of the run
   * appears somewhere else. Otherwise the pad empties as you play and the last
   * couple of numbers are the only things left to look at.
   */
  /**
   * The pad is worked out in the handler and only handed to React to draw.
   * Choosing a spot used to advance a shared generator, which made both the
   * state updater and the render impure — under StrictMode each ran twice and
   * the number that should have appeared never did.
   */
  const [spots, setSpots] = useState<Spot[]>(() => {
    const out: Spot[] = []
    for (let n = 1; n <= params.visible; n++) out.push(spotFor(n, out, variation))
    return out
  })
  const pad = useRef<Spot[] | null>(null)

  const run = useRun(card, onResult)
  const next = useRef(1)
  /**
   * When the number currently on offer stops being on offer. Open-ended, so
   * there is no list of deadlines laid out in advance: each number gets its
   * own window, and the windows tighten the further into the run you get.
   */
  const expires = useRef(0)

  const rootRef = useRef<HTMLDivElement>(null)
  const armRef = useRef<HTMLElement>(null)
  const timeRef = useRef<HTMLDivElement>(null)
  const [taken, setTaken] = useState(0)
  const [wrong, setWrong] = useState(0)

  /**
   * One number leaves the pad and the next of the run takes its place, in a
   * spot chosen away from whatever else is still down.
   */
  const retire = (n: number) => {
    next.current = n + 1
    setTaken(n)
    expires.current = now() + windowFor(n + 1, params)

    const current = pad.current ?? spots
    const left = current.filter((spot) => spot.n !== n)
    const highest = current.reduce((top, spot) => Math.max(top, spot.n), 0)
    // The run has no end: one leaves and the next takes its place, for as long
    // as the animation lasts.
    pad.current = [...left, spotFor(highest + 1, left, variation)]
    setSpots(pad.current)
  }

  // Held in a ref so the frame loop can call it without being rebuilt every
  // render, the way `useGameEvents` keeps its own handler current.
  const retireRef = useRef(retire)
  useEffect(() => {
    retireRef.current = retire
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

      run.paint(rootRef.current)

      // A number whose time ran out is gone, and it costs what fumbling one
      // costs. The sequence moves on rather than stalling on it.
      // A number whose window ran out is gone, and it costs what fumbling one
      // costs. The run moves on rather than stalling on it.
      if (armedAt !== null && t > expires.current) {
        retireRef.current(next.current)
        run.beat('missed')
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
    if (run.done) return
    const t = event.nativeEvent.timeStamp ? stamp(event.nativeEvent.timeStamp) : now()
    // The clock starts on the press that begins the sequence, so hunting for
    // the first number costs nothing.
    if (arming.armedAt === null) {
      arming.arm(t)
      expires.current = t + windowFor(1, params)
    }

    if (n !== next.current) {
      // A press out of order costs a chance the way running out of time on one
      // would. The number you pressed stays where it is; the one you should
      // have pressed is the one you lose.
      run.beat('missed')
      retire(next.current)
      setWrong(run.ledger.mistakes)
      return
    }

    // Early in its own window is clean; scrambling for it at the end is not.
    const room = windowFor(n, params)
    const spent = room - (expires.current - t)
    run.beat(spent <= room * 0.6 ? 'clean' : 'scrappy')
    retire(n)
  }

  return (
    <div className="qte" ref={rootRef} data-live="false">
      <div className="qte__title">
        {card.emoji} {card.name}
        <em className="qte__hint-grab">
          PRESS 1 TO START <b ref={armRef} className="qte__count" />
        </em>
        <em className="qte__hint-live">
          IN ORDER — {taken} · {params.goodAt} TO SCORE, {params.perfectAt} CLEAN
        </em>
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
            data-next={spot.n === taken + 1}
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
