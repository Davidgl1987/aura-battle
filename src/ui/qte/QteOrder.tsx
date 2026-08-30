import { useEffect, useRef, useState } from 'react'
import { now, stamp } from '../../state/store'
import type { Card, OrderParams, QteOutcome } from '../../engine/types'
import { useI18n } from '../../i18n'
import { useRun } from './run'
import { QteMeter } from './QteMeter'
import { useArming } from './arming'
import { spotFor, type Spot } from './order'

interface Props {
  card: Card
  params: OrderParams
  startedAt: number
  variation: number
  onResult: (outcome: QteOutcome) => void
}

export function QteOrder({ card, params, startedAt, variation, onResult }: Props) {
  const { t } = useI18n()
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

  const rootRef = useRef<HTMLDivElement>(null)
  const armRef = useRef<HTMLElement>(null)
  const timeRef = useRef<HTMLDivElement>(null)
  const [taken, setTaken] = useState(0)
  const padRef = useRef<HTMLDivElement>(null)

  /**
   * Every number goes red for a moment. Clearing the attribute and reading a
   * layout property in between is what forces the restyle — without it a second
   * slip changes nothing and the animation never plays again.
   */
  const flashPad = () => {
    const pad = padRef.current
    if (!pad) return
    pad.dataset.wrong = ''
    void pad.offsetWidth
    pad.dataset.wrong = 'true'
  }

  /**
   * One number leaves the pad and the next of the run takes its place, in a
   * spot chosen away from whatever else is still down. It waits there for its
   * turn — nothing here changes under a finger that is on its way to it.
   */
  const retire = (n: number) => {
    next.current = n + 1
    setTaken(n)

    const current = pad.current ?? spots
    const left = current.filter((spot) => spot.n !== n)
    const highest = current.reduce((top, spot) => Math.max(top, spot.n), 0)
    // The run has no end: one leaves and the next takes its place, for as long
    // as the animation lasts.
    pad.current = [...left, spotFor(highest + 1, left, variation)]
    setSpots(pad.current)
  }

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
    if (arming.armedAt === null) arming.arm(t)

    if (n !== next.current) {
      // A slip costs a chance, but it must not change the pad. Retiring the
      // number you were reaching for left you hunting for one that was no
      // longer there, so a single mistake cost you the thread as well. The
      // whole pad flashes red instead and the target stays put.
      run.beat('missed')
      flashPad()
      return
    }

    run.beat('clean')
    retire(n)
  }

  return (
    <div className="qte" ref={rootRef} data-live="false">
      <div className="qte__title">
        {card.emoji} {card.name}
        <em className="qte__hint-grab">
          {t('qte.start.order')} <b ref={armRef} className="qte__count" />
        </em>
        <em className="qte__hint-live">{t('qte.live.order', { n: taken + 1 })}</em>
      </div>

      <div className="qte__timer">
        <div ref={timeRef} className="qte__timer-fill" />
      </div>

      <QteMeter run={run} unit={t('qte.unit.numbers')} />

      <div className="qte__area order" ref={padRef}>
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
