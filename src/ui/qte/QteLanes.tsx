import { useEffect, useMemo, useRef } from 'react'
import { play } from '../../audio/engine'
import { now, stamp } from '../../state/store'
import type { Card, Judgement, LanesParams, QteOutcome } from '../../engine/types'
import { useI18n } from '../../i18n'
import { paintLanes, type LanesHandle } from './boardPaint'
import { LanesBoard } from './boards'
import { useRun } from './run'
import { QteMeter } from './QteMeter'
import { useArming } from './arming'
import { chart, strikeAt } from './lanes'

interface Props {
  card: Card
  params: LanesParams
  startedAt: number
  variation: number
  onResult: (outcome: QteOutcome) => void
}

export function QteLanes({ card, params, startedAt, variation, onResult }: Props) {
  const { t } = useI18n()
  const arming = useArming(startedAt)
  const notes = useMemo(() => chart(params, variation), [params, variation])

  /** How every note already dealt with turned out, hit or gone by. */
  const settled = useRef<Map<number, Judgement>>(new Map())
  const run = useRun(card, onResult)

  const rootRef = useRef<HTMLDivElement>(null)
  const armRef = useRef<HTMLElement>(null)
  const timeRef = useRef<HTMLDivElement>(null)
  const board = useRef<LanesHandle>(null)
  /** When the last tap into an empty lane was charged. See `EMPTY_GUARD_MS`. */
  const lastEmpty = useRef(Number.NEGATIVE_INFINITY)

  /**
   * Replays a one-shot animation. Clearing the attribute and reading a layout
   * property in between is what forces the restyle: without it a second hit on
   * the same lane changes nothing and the animation never plays again.
   */
  const flash = (node: HTMLElement | null, kind: string) => {
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

      if (rootRef.current) rootRef.current.dataset.live = String(armedAt !== null)
      if (armRef.current) {
        armRef.current.textContent = `${(arming.countdown(t) / 1000).toFixed(1)}s`
      }

      const elapsed = armedAt === null ? 0 : t - armedAt
      const left = armedAt === null ? 1 : 1 - elapsed / card.durationMs
      if (timeRef.current) timeRef.current.style.transform = `scaleX(${Math.max(0, left)})`

      paintLanes(board.current, { elapsed, notes, params, parked: armedAt === null })

      notes.forEach((note, i) => {
        const node = board.current?.notes[i]
        if (!node) return
        // Once it is past the window it can no longer be hit; count it lost.
        if (armedAt !== null && !settled.current.has(i) && elapsed - note.atMs > params.goodMs) {
          settled.current.set(i, 'MISS')
          // Told to the ledger as it happens rather than swept up at the end,
          // so the meter shows a dropped note the moment it goes past.
          run.beat('missed')
          node.dataset.hit = 'MISS'
          flash(board.current?.lanes[note.lane] ?? null, 'MISS')
        }
      })

      run.paint(rootRef.current)
      // The chart plays out even once the last note has gone by: the gesture
      // is as long as the animation, not as long as the notes.
      if (armedAt !== null && left <= 0) {
        run.finish()
        return
      }
      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [card.durationMs, params, notes, arming, run])

  const strike = (lane: number) => (event: React.PointerEvent) => {
    if (run.done) return
    const t = event.nativeEvent.timeStamp ? stamp(event.nativeEvent.timeStamp) : now()

    // The first touch only sets the board rolling; there is nothing on the
    // line yet to be graded against.
    if (arming.armedAt === null) {
      arming.arm(t)
      play('tap')
      return
    }

    const elapsed = t - arming.armedAt
    const result = strikeAt(notes, settled.current, lane, elapsed, params, lastEmpty.current)

    if (result.kind !== 'hit') {
      // A swing at nothing. It costs a chance — otherwise drumming on all three
      // lanes would be better than reading the chart, because every note gets
      // caught by somebody's finger and the taps in between are free.
      //
      // `muffled` is the same swing still being paid for: one hand across three
      // lanes is three events and one decision, so it is shown and not charged
      // twice.
      if (result.kind === 'empty') {
        lastEmpty.current = elapsed
        run.beat('missed')
      }
      flash(board.current?.lanes[lane] ?? null, 'DEAD')
      play('dead')
      return
    }

    const hit = result.grade
    settled.current.set(result.note, hit)
    run.beat(hit === 'PERFECT' ? 'clean' : hit === 'GOOD' ? 'scrappy' : 'missed')
    const node = board.current?.notes[result.note]
    if (node) node.dataset.hit = hit
    flash(board.current?.lanes[lane] ?? null, hit)
    flash(board.current?.lines[lane] ?? null, hit)
    play(hit === 'MISS' ? 'dead' : 'tap')
  }

  return (
    <div className="qte" ref={rootRef} data-live="false">
      <div className="qte__title">
        {card.emoji} {card.name}
        <em className="qte__hint-grab">
          {t('qte.start.lanes')} <b ref={armRef} className="qte__count" />
        </em>
        <em className="qte__hint-live">{t('qte.live.lanes')}</em>
      </div>

      <div className="qte__timer">
        <div ref={timeRef} className="qte__timer-fill" />
      </div>

      <QteMeter run={run} unit={t('qte.unit.notes')} />

      <LanesBoard params={params} notes={notes} onLane={strike} ref={board} />
    </div>
  )
}
