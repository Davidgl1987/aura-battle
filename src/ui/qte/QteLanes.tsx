import { useEffect, useMemo, useRef } from 'react'
import { play } from '../../audio/engine'
import { now, stamp } from '../../state/store'
import type { Card, Judgement, LanesParams, QteOutcome } from '../../engine/types'
import { useRun } from './run'
import { QteMeter } from './QteMeter'
import { useArming } from './arming'
import { chart, noteProgress, strikeAt } from './lanes'

interface Props {
  card: Card
  params: LanesParams
  startedAt: number
  variation: number
  onResult: (outcome: QteOutcome) => void
}

/**
 * How far down a lane the hit line sits. Low, because that is where the thumb
 * already is: notes fall toward it with the whole lane above as warning.
 */
const LINE = 0.78

export function QteLanes({ card, params, startedAt, variation, onResult }: Props) {
  const arming = useArming(startedAt)
  const notes = useMemo(() => chart(params, variation), [params, variation])

  /** How every note already dealt with turned out, hit or gone by. */
  const settled = useRef<Map<number, Judgement>>(new Map())
  const run = useRun(card, onResult)

  const rootRef = useRef<HTMLDivElement>(null)
  const armRef = useRef<HTMLElement>(null)
  const timeRef = useRef<HTMLDivElement>(null)
  const laneNodes = useRef<(HTMLButtonElement | null)[]>([])
  const lineRefs = useRef<(HTMLSpanElement | null)[]>([])
  const boardRef = useRef<HTMLDivElement>(null)
  const noteRefs = useRef<(HTMLSpanElement | null)[]>([])
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

      // One layout read for the whole board rather than one per note.
      const height = boardRef.current?.clientHeight ?? 0

      notes.forEach((note, i) => {
        const node = noteRefs.current[i]
        if (!node) return
        // Parked at the top until the board starts moving.
        const at = armedAt === null ? 1 : noteProgress(note, elapsed, params.travelMs)
        node.style.transform = `translateY(${(LINE - at * LINE) * height}px)`

        // Once it is past the window it can no longer be hit; count it lost.
        if (armedAt !== null && !settled.current.has(i) && elapsed - note.atMs > params.goodMs) {
          settled.current.set(i, 'MISS')
          // Told to the ledger as it happens rather than swept up at the end,
          // so the meter shows a dropped note the moment it goes past.
          run.beat('missed')
          node.dataset.hit = 'MISS'
          flash(laneNodes.current[note.lane], 'MISS')
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
      flash(laneNodes.current[lane], 'DEAD')
      play('dead')
      return
    }

    const hit = result.grade
    settled.current.set(result.note, hit)
    run.beat(hit === 'PERFECT' ? 'clean' : hit === 'GOOD' ? 'scrappy' : 'missed')
    const node = noteRefs.current[result.note]
    if (node) node.dataset.hit = hit
    flash(laneNodes.current[lane], hit)
    flash(lineRefs.current[lane], hit)
    play(hit === 'MISS' ? 'dead' : 'tap')
  }

  return (
    <div className="qte" ref={rootRef} data-live="false">
      <div className="qte__title">
        {card.emoji} {card.name}
        <em className="qte__hint-grab">
          TAP A LANE TO START <b ref={armRef} className="qte__count" />
        </em>
        <em className="qte__hint-live">HIT THEM ON THE LINE · A SWING AT NOTHING COSTS YOU</em>
      </div>

      <div className="qte__timer">
        <div ref={timeRef} className="qte__timer-fill" />
      </div>

      <QteMeter run={run} unit="NOTES" />

      <div className="lanes" ref={boardRef}>
        {Array.from({ length: params.lanes }, (_, lane) => (
          <button
            key={lane}
            type="button"
            className="lanes__lane"
            ref={(node) => {
              laneNodes.current[lane] = node
            }}
            onPointerDown={strike(lane)}
          >
            <span
              ref={(node) => {
                lineRefs.current[lane] = node
              }}
              className="lanes__line"
              style={{ top: `${LINE * 100}%` }}
            />
            {notes.map((note, i) =>
              note.lane === lane ? (
                <span
                  key={i}
                  ref={(node) => {
                    noteRefs.current[i] = node
                  }}
                  className="lanes__note"
                />
              ) : null,
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
