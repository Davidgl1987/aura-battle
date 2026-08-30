import { useCallback, useEffect, useRef } from 'react'
import { now, stamp } from '../../state/store'
import type { Card, QteOutcome, TimingParams } from '../../engine/types'
import { useArming } from './arming'
import { play } from '../../audio/engine'
import { useI18n } from '../../i18n'
import { useRun } from './run'
import { QteMeter } from './QteMeter'
import {
  cursorAt,
  startEdge,
  gradeHit,
  startPhase,
  zoneCentres,
  zoneErrorAt,
  zoneTripAt,
} from './timing'

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
  const { t } = useI18n()
  const run = useRun(card, onResult)
  const arming = useArming(startedAt)

  const rootRef = useRef<HTMLDivElement>(null)
  const armRef = useRef<HTMLElement>(null)
  const cursorRef = useRef<HTMLDivElement>(null)
  const timeRef = useRef<HTMLDivElement>(null)
  const hitsRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)

  // One pace from the first frame to the last. The bar used to tighten with
  // every landed tap, which made the same input worth less the better you were
  // doing and read as the card moving the target under you.
  const phase = useRef(0)
  /**
   * The last zone trip that was graded, so each one is answered once. No real
   * trip is ever negative — the phase never runs ahead of the clock — so this
   * is a sentinel meaning "nothing answered yet".
   */
  const answered = useRef(-1)
  /** Whether `begin` has run, so the two ways in cannot each do half of it. */
  const begun = useRef(false)

  /**
   * Everything that has to be true the instant the bar goes live.
   *
   * Both ways in come through here — the first touch, and the automatic start
   * once `QTE_ARM_MS` runs out — because they used not to. Only the touch set
   * the phase, so a card that armed itself swept from a phase of zero: the
   * cursor jumped to wherever that put it and the trips it was grading no
   * longer matched the zones being drawn.
   */
  const begin = useCallback((at: number) => {
    if (begun.current) return
    begun.current = true
    phase.current = startPhase(at, params.sweepMs, variation)
    answered.current = -1
  }, [params.sweepMs, variation])

  /**
   * A one-shot pulse. Clearing the attribute and reading a layout property in
   * between forces the restyle, without which a second pulse of the same kind
   * changes nothing and never plays.
   */
  const pulse = (kind: string) => {
    const node = barRef.current
    if (!node) return
    node.dataset.flash = ''
    void node.offsetWidth
    node.dataset.flash = kind
  }

  useEffect(() => {
    let raf = 0
    const loop = () => {
      const t = now()
      const armedAt = arming.resolve(t)
      // Catches the automatic start, and is a no-op when a touch got here
      // first — either way the phase is set before anything is drawn from it.
      if (armedAt !== null) begin(armedAt)

      // Parked at the end it will set off from, so the cursor never appears to
      // jump when the bar goes live.
      const x = armedAt === null ? startEdge(variation) : cursorAt(t, phase.current, params.sweepMs)
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
  }, [startedAt, card.durationMs, params.sweepMs, variation, arming, begin, run])

  const tap = (event: React.PointerEvent) => {
    // No ceiling: answer the bar as many times as it comes past.
    if (run.done) return
    // The native timestamp is the moment the finger landed, not the moment
    // React got around to us — that difference is a whole judgement grade.
    const t = event.nativeEvent.timeStamp ? stamp(event.nativeEvent.timeStamp) : now()

    // The first touch only sets the cursor moving: grading a tap against a
    // parked cursor would be a free MISS. It gets a sound and a pulse of its
    // own so it reads as having started something, rather than as a tap the
    // screen did not notice — the bar sets off from an end, so there is no
    // zone under the cursor for it to look like a fumbled hit on.
    if (arming.armedAt === null) {
      arming.arm(t)
      begin(t)
      play('tap')
      pulse('START')
      return
    }

    // One answer per trip through a zone. A second tap inside the same trip is
    // the same chance twice, so it is dropped rather than charged — otherwise
    // drumming on a busy bar would fumble chances that were never offered.
    // It still gets a pulse: a tap that changes nothing at all is
    // indistinguishable from a touch the phone missed.
    const trip = zoneTripAt(t, phase.current, params)
    if (trip === answered.current) {
      pulse('REPEAT')
      return
    }
    answered.current = trip

    // Against the nearest green zone, of which there may be one, two or three.
    const hit = gradeHit(zoneErrorAt(t, phase.current, params.sweepMs, params), params)
    run.beat(hit === 'PERFECT' ? 'clean' : hit === 'GOOD' ? 'scrappy' : 'missed')

    pulse(hit)
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
          {t('qte.start.timing')} <b ref={armRef} className="qte__count" />
        </em>
        <em className="qte__hint-live">{t('qte.live.timing')}</em>
      </div>

      <div className="qte__timer">
        <div ref={timeRef} className="qte__timer-fill" />
      </div>

      <div className="qte__bar" ref={barRef}>
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

      <QteMeter run={run} unit={t('qte.unit.hits')} />
    </div>
  )
}
