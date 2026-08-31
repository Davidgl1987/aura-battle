import { useImperativeHandle, useRef } from 'react'
import type { LanesParams, SpeedParams, TimingParams } from '../../engine/types'
import {
  LANE_LINE,
  type DriveHandle,
  type LanesHandle,
  type OrderHandle,
  type SweepHandle,
  type ZoneHandle,
} from './boardPaint'
import type { Note } from './lanes'
import type { Spot } from './order'
import { zoneCentres } from './timing'

/**
 * The six boards, without the game around them.
 *
 * A board is the markup and nothing else: no clock, no judgement, no pointer
 * handling unless it is handed some. The widget wraps one and grades what
 * happens on it; the tutorial wraps the same one and moves a scripted hand over
 * it. Neither draws its own version, which is the point — the tutorial used to
 * be a separate drawing in CSS keyframes and it drifted far enough that the
 * drive-test one showed a gesture the game does not have.
 *
 * Each exposes its nodes through a handle rather than taking a bag to fill,
 * because a component may not write to its own props. `boardPaint.ts` has the
 * one `paint` per board that positions whatever moves.
 */

/* --- Sweep ---------------------------------------------------------------- */

export function SweepBoard({
  params,
  ref,
}: {
  params: TimingParams
  ref?: React.Ref<SweepHandle>
}) {
  const bar = useRef<HTMLDivElement>(null)
  const cursor = useRef<HTMLDivElement>(null)
  useImperativeHandle(
    ref,
    () => ({
      get bar() {
        return bar.current
      },
      get cursor() {
        return cursor.current
      },
    }),
    [],
  )

  // The cursor covers the whole bar in one sweep, so a window measured in
  // milliseconds is a share of the width. Doubled because the numbers are
  // half-widths: the window opens on both sides of the zone.
  const goodWidth = (params.goodMs / params.sweepMs) * 200
  const perfectWidth = (params.perfectMs / params.sweepMs) * 200
  const centres = zoneCentres(params.zones)

  return (
    <div className="qte__bar" ref={bar}>
      {/* Amber outside, green inside. Landing on the amber still scores, and it
          is also the moment a flawless run stops being one — so it is drawn as
          the border of the target rather than as a target of its own. Both are
          placed against the bar itself: the widths are shares of the bar, so a
          wrapper of its own would have nothing to be a share of. */}
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
      <div ref={cursor} className="qte__cursor" />
    </div>
  )
}

/* --- Lanes ---------------------------------------------------------------- */

export function LanesBoard({
  params,
  notes,
  onLane,
  ref,
}: {
  params: LanesParams
  notes: Note[]
  onLane?: (lane: number) => (event: React.PointerEvent) => void
  ref?: React.Ref<LanesHandle>
}) {
  const board = useRef<HTMLDivElement>(null)
  const lanes = useRef<(HTMLButtonElement | null)[]>([])
  const lines = useRef<(HTMLSpanElement | null)[]>([])
  const noteNodes = useRef<(HTMLSpanElement | null)[]>([])
  useImperativeHandle(
    ref,
    () => ({
      get board() {
        return board.current
      },
      get lanes() {
        return lanes.current
      },
      get lines() {
        return lines.current
      },
      get notes() {
        return noteNodes.current
      },
    }),
    [],
  )

  return (
    <div className="lanes" ref={board}>
      {Array.from({ length: params.lanes }, (_, lane) => (
        <button
          key={lane}
          type="button"
          className="lanes__lane"
          ref={(node) => {
            lanes.current[lane] = node
          }}
          onPointerDown={onLane?.(lane)}
        >
          <span
            ref={(node) => {
              lines.current[lane] = node
            }}
            className="lanes__line"
            style={{ top: `${LANE_LINE * 100}%` }}
          />
          {notes.map((note, i) =>
            note.lane === lane ? (
              <span
                key={i}
                ref={(node) => {
                  noteNodes.current[i] = node
                }}
                className="lanes__note"
              />
            ) : null,
          )}
        </button>
      ))}
    </div>
  )
}

/* --- Mash: one, two or three pads. Nothing on it moves. ------------------- */

export function PadsBoard({
  params,
  label,
  onPad,
}: {
  params: SpeedParams
  /** What a pad is called. `padLabel` in `speed.ts` is the card's own answer. */
  label: (zone: number, pads: number) => string
  onPad?: (zone: number) => (event: React.PointerEvent<HTMLButtonElement>) => void
}) {
  return (
    <div className="qte__pads">
      {Array.from({ length: params.pads }, (_, zone) => (
        <button key={zone} className="pad" onPointerDown={onPad?.(zone)}>
          {label(zone, params.pads)}
        </button>
      ))}
    </div>
  )
}

/* --- Order: numbers scattered on a pad. Nothing on it moves either. ------- */

export function OrderBoard({
  spots,
  next,
  onKey,
  ref,
}: {
  spots: Spot[]
  /** Which number is wanted now, so the pad can point at it. */
  next: number
  onKey?: (n: number) => (event: React.PointerEvent) => void
  ref?: React.Ref<OrderHandle>
}) {
  const pad = useRef<HTMLDivElement>(null)
  useImperativeHandle(
    ref,
    () => ({
      get pad() {
        return pad.current
      },
    }),
    [],
  )

  return (
    <div className="qte__area order" ref={pad}>
      {spots.map((spot) => (
        <button
          key={spot.n}
          type="button"
          className="order__key"
          data-next={spot.n === next}
          style={{ left: `${spot.x * 100}%`, top: `${spot.y * 100}%` }}
          onPointerDown={onKey?.(spot.n)}
        >
          {spot.n}
        </button>
      ))}
    </div>
  )
}

/* --- Zone: a ring that drifts around a pad -------------------------------- */

export function ZoneBoard({
  handlers,
  ref,
}: {
  handlers?: {
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void
    onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void
    onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void
    onPointerCancel: (event: React.PointerEvent<HTMLDivElement>) => void
  }
  ref?: React.Ref<ZoneHandle>
}) {
  const area = useRef<HTMLDivElement>(null)
  const zone = useRef<HTMLDivElement>(null)
  useImperativeHandle(
    ref,
    () => ({
      get area() {
        return area.current
      },
      get zone() {
        return zone.current
      },
    }),
    [],
  )

  return (
    <div ref={area} className="qte__area" {...handlers}>
      {/* The wrapper owns the position and nothing else. Anything that animates
          lives on the ring inside it — a keyframe touching `transform` out here
          would fight the inline one and walk the target across the pad. */}
      <div ref={zone} className="zone" data-live="false">
        <div className="zone__ring" />
      </div>
    </div>
  )
}

/* --- Paths: two winding lanes above, a wheel under each ------------------- */

export function DriveBoard({
  wheel,
  ref,
}: {
  wheel?: (lane: 0 | 1) => {
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void
    onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void
    onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void
    onPointerCancel: (event: React.PointerEvent<HTMLDivElement>) => void
  }
  ref?: React.Ref<DriveHandle>
}) {
  const track = useRef<HTMLDivElement>(null)
  const lanes = useRef<(SVGPathElement | null)[]>([])
  const marks = useRef<(HTMLDivElement | null)[]>([])
  const knobs = useRef<(HTMLDivElement | null)[]>([])
  useImperativeHandle(
    ref,
    () => ({
      get track() {
        return track.current
      },
      get lanes() {
        return lanes.current
      },
      get marks() {
        return marks.current
      },
      get knobs() {
        return knobs.current
      },
    }),
    [],
  )

  return (
    <div className="drive">
      <div className="drive__track" ref={track}>
        <svg className="drive__lanes" aria-hidden="true">
          {[0, 1].map((lane) => (
            <path
              key={lane}
              ref={(node) => {
                lanes.current[lane] = node
              }}
              className="drive__lane"
              fill="none"
              strokeLinecap="round"
            />
          ))}
        </svg>
        {[0, 1].map((lane) => (
          <div
            key={lane}
            ref={(node) => {
              marks.current[lane] = node
            }}
            className="drive__mark"
            data-on="false"
          />
        ))}
      </div>

      <div className="drive__wheels">
        {([0, 1] as const).map((lane) => (
          <div key={lane} className="drive__wheel" {...wheel?.(lane)}>
            <div
              ref={(node) => {
                knobs.current[lane] = node
              }}
              className="drive__knob"
              data-on="false"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
