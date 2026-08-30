import { useEffect, useRef } from 'react'
import { now, stamp } from '../../state/store'
import type { Card, QteOutcome, TimingParams } from '../../engine/types'
import { useArming } from './arming'
import { useRun } from './run'
import { QteMeter } from './QteMeter'
import { cursorAt, gradeHit, startPhase, zoneCentres, zoneErrorAt } from './timing'

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
  const run = useRun(card, onResult)
  const arming = useArming(startedAt)

  const rootRef = useRef<HTMLDivElement>(null)
  const armRef = useRef<HTMLElement>(null)
  const cursorRef = useRef<HTMLDivElement>(null)
  const timeRef = useRef<HTMLDivElement>(null)
  const hitsRef = useRef<HTMLDivElement>(null)

  // One pace from the first frame to the last. The bar used to tighten with
  // every landed tap, which made the same input worth less the better you were
  // doing and read as the card moving the target under you.
  const phase = useRef(0)

  useEffect(() => {
    let raf = 0
    const loop = () => {
      const t = now()
      const armedAt = arming.resolve(t)

      const x = armedAt === null ? 0.5 : cursorAt(t, phase.current, params.sweepMs)
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
  }, [startedAt, card.durationMs, params.sweepMs, arming, run])

  const tap = (event: React.PointerEvent) => {
    // No ceiling: tap the centre as many times as the bar comes past.
    if (run.done) return
    // The native timestamp is the moment the finger landed, not the moment
    // React got around to us — that difference is a whole judgement grade.
    const t = event.nativeEvent.timeStamp ? stamp(event.nativeEvent.timeStamp) : now()

    // The first touch only sets the cursor moving: grading a tap against a
    // parked cursor would be a free MISS.
    if (arming.armedAt === null) {
      arming.arm(t)
      // Live from the middle of the bar, so the card opens on its target
      // rather than on half a stroke of waiting.
      phase.current = startPhase(t, params.sweepMs, variation)
      return
    }

    // Against the nearest green zone, of which there may be one, two or three.
    const hit = gradeHit(zoneErrorAt(t, phase.current, params.sweepMs, params), params)
    run.beat(hit === 'PERFECT' ? 'clean' : hit === 'GOOD' ? 'scrappy' : 'missed')

    const dot = hitsRef.current?.children[run.ledger.taken - 1] as HTMLElement | undefined
    if (dot) dot.dataset.hit = hit
  }

  // The cursor covers the whole bar in one sweep, so a window measured in
  // milliseconds is a share of the width. Doubled because the numbers are
  // half-widths: the window opens on both sides of the zone.
  const goodWidth = (params.goodMs / params.sweepMs) * 200
  const perfectWidth = (params.perfectMs / params.sweepMs) * 200
  const centres = zoneCentres(params.zones)

  return (
    <div className="qte" ref={rootRef} data-live="false" data-perfect="true" onPointerDown={tap}>
      <div className="qte__title">
        {card.emoji} {card.name}
        <em className="qte__hint-grab">
          TAP TO START <b ref={armRef} className="qte__count" />
        </em>
        <em className="qte__hint-live">
          AMBER SCORES BUT IS NOT CLEAN
        </em>
      </div>

      <div className="qte__timer">
        <div ref={timeRef} className="qte__timer-fill" />
      </div>

      <div className="qte__bar">
        {/* Amber outside, green inside. Landing on the amber still scores, and
            it is also the moment a flawless run stops being one — so it is
            drawn as the border of the target rather than as a target of its
            own. Both are placed against the bar itself: the widths are shares
            of the bar, so a wrapper of its own would have nothing to be a
            share of. */}
        {centres.map((centre, i) => (
          <div
            key={`good-${i}`}
            className="qte__zone qte__zone--good"
            style={{ left: `${centre * 100}%`, width: `${goodWidth}%` }}
          />
        ))}
        {centres.map((centre, i) => (
          <div
            key={`perfect-${i}`}
            className="qte__zone qte__zone--perfect"
            style={{ left: `${centre * 100}%`, width: `${perfectWidth}%` }}
          />
        ))}
        <div ref={cursorRef} className="qte__cursor" />
      </div>

      {/* One dot per pass the bar makes, so the count you are keeping is the
          same count the card is keeping. */}
      <div className="qte__hits" ref={hitsRef}>
        {Array.from({ length: run.chances }, (_, i) => (
          <span key={i} className="qte__hit" data-hit="pending" />
        ))}
      </div>

      <QteMeter run={run} unit="HITS" />
    </div>
  )
}
