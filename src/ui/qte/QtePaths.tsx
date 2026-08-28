import { useEffect, useRef } from 'react'
import { now } from '../../state/store'
import type { Card, Judgement, PathsParams } from '../../engine/types'
import { isDown } from '../pointers'
import { useArming } from './arming'
import { bothHands, gradePaths, laneCentre, laneRange, onTrack } from './paths'

interface Props {
  card: Card
  params: PathsParams
  startedAt: number
  variation: number
  onResult: (judgement: Judgement) => void
}

/** Never bank a frame longer than this: a stall is not a held finger. */
const MAX_FRAME_MS = 60
/** Where the markers sit down the track, as a share of its height. */
const MARKER_Y = 0.6
/** How much track is on screen at once, in the units `laneCentre` takes. */
const VIEW = 3
/** How many points the drawn corridor is built from. */
const STEPS = 26

export function QtePaths({ card, params, startedAt, variation, onResult }: Props) {
  const arming = useArming(startedAt)
  const both = useRef(0)
  const done = useRef(false)
  const onResultRef = useRef(onResult)

  /** Where each marker has been steered to, across a pad of [-1, 1]. */
  const at = useRef<[number, number]>([-0.5, 0.5])
  /** The pointer currently steering each lane, if any. */
  const grip = useRef<[number | null, number | null]>([null, null])
  /** Whether both wheels have ever been held at the same time. */
  const placed = useRef(false)

  const rootRef = useRef<HTMLDivElement>(null)
  const armRef = useRef<HTMLElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const laneRefs = useRef<(SVGPathElement | null)[]>([])
  const markRefs = useRef<(HTMLDivElement | null)[]>([])
  const knobRefs = useRef<(HTMLDivElement | null)[]>([])
  const timeRef = useRef<HTMLDivElement>(null)
  const holdRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    onResultRef.current = onResult
  })

  useEffect(() => {
    let raf = 0
    let last = now()

    const loop = () => {
      const t = now()
      const dt = Math.min(t - last, MAX_FRAME_MS)
      last = t

      // A remembered pointer id is not a held one: a `pointerup` that never
      // arrived leaves a grip that looks live for the rest of the card. Drop
      // anything that is no longer on the glass before trusting it.
      for (const lane of [0, 1] as const) {
        const id = grip.current[lane]
        if (id !== null && !isDown(id)) grip.current[lane] = null
      }

      const bothOn = bothHands(grip.current, isDown)
      if (bothOn) placed.current = true

      // Both hands on the wheel is what starts the clock: reaching for the
      // second control should not be charged to the player.
      if (arming.armedAt === null && bothOn) arming.arm(t)
      const armedAt = arming.resolve(t)

      if (rootRef.current) rootRef.current.dataset.live = String(armedAt !== null)
      if (armRef.current) {
        armRef.current.textContent = `${(arming.countdown(t) / 1000).toFixed(1)}s`
      }

      const live = armedAt === null ? 0 : t - armedAt
      const scroll = (live / 1000) * params.speed
      const track = trackRef.current

      if (track) {
        const width = track.clientWidth
        const height = track.clientHeight
        const half = width / 2
        // Pad units run -1 to 1 across, so a unit is half the width.
        const toPx = (x: number) => half + x * half
        let holding = true

        for (const lane of [0, 1] as const) {
          // The corridor, drawn from the marker line outward in both
          // directions: above the line is track still to come.
          let d = ''
          for (let i = 0; i <= STEPS; i++) {
            const y = (i / STEPS) * height
            const distance = scroll + (MARKER_Y - y / height) * VIEW
            d += `${i === 0 ? 'M' : 'L'}${toPx(laneCentre(distance, params, variation, lane)).toFixed(1)} ${y.toFixed(1)}`
          }
          const path = laneRefs.current[lane]
          if (path) {
            path.setAttribute('d', d)
            path.setAttribute('stroke-width', String(params.laneWidth * 2 * half))
          }

          const centre = laneCentre(scroll, params, variation, lane)
          const inside = bothOn && onTrack(at.current[lane], centre, params)
          if (!inside) holding = false

          const mark = markRefs.current[lane]
          if (mark) {
            mark.style.left = `${toPx(at.current[lane])}px`
            mark.style.top = `${MARKER_Y * height}px`
            mark.dataset.on = String(inside)
          }
          const knob = knobRefs.current[lane]
          if (knob) {
            const [min, max] = laneRange(lane)
            knob.style.left = `${((at.current[lane] - min) / (max - min)) * 100}%`
            knob.dataset.on = String(grip.current[lane] !== null)
          }
        }

        if (armedAt !== null && holding) both.current += dt
      }

      const remaining = armedAt === null ? 1 : 1 - live / card.durationMs
      if (timeRef.current) timeRef.current.style.transform = `scaleX(${Math.max(0, remaining)})`
      if (holdRef.current) {
        holdRef.current.style.transform = `scaleX(${live > 0 ? both.current / live : 0})`
      }

      if (armedAt !== null && remaining <= 0 && !done.current) {
        done.current = true
        onResultRef.current(gradePaths(placed.current, both.current, card.durationMs, params))
        return
      }
      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [card.durationMs, params, variation, arming])

  /** Absolute steering: the marker goes where the thumb is, along its half. */
  const steer = (lane: 0 | 1) => (event: React.PointerEvent<HTMLDivElement>) => {
    const wheel = event.currentTarget
    const rect = wheel.getBoundingClientRect()
    const share = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    const [min, max] = laneRange(lane)
    at.current[lane] = min + share * (max - min)
  }

  const take = (lane: 0 | 1) => (event: React.PointerEvent<HTMLDivElement>) => {
    // The same pointer cannot hold both: dragging across from the other wheel
    // would otherwise read as a second hand.
    if (grip.current[1 - lane] === event.pointerId) return
    grip.current[lane] = event.pointerId
    // Keeps the moves coming once the thumb slides off the wheel. It throws if
    // the pointer has already gone, which is not worth dying over.
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Carry on without capture; steering still works inside the wheel.
    }
    steer(lane)(event)
  }

  const move = (lane: 0 | 1) => (event: React.PointerEvent<HTMLDivElement>) => {
    if (grip.current[lane] !== event.pointerId) return
    steer(lane)(event)
  }

  const release = (lane: 0 | 1) => (event: React.PointerEvent<HTMLDivElement>) => {
    if (grip.current[lane] === event.pointerId) grip.current[lane] = null
  }

  return (
    <div className="qte" ref={rootRef} data-live="false">
      <div className="qte__title">
        {card.emoji} {card.name}
        <em className="qte__hint-grab">
          A THUMB ON EACH WHEEL <b ref={armRef} className="qte__count" />
        </em>
        <em className="qte__hint-live">STAY IN YOUR LANE</em>
      </div>

      <div className="qte__timer">
        <div ref={timeRef} className="qte__timer-fill" />
      </div>

      <div className="drive">
        <div className="drive__track" ref={trackRef}>
          <svg className="drive__lanes" aria-hidden="true">
            {[0, 1].map((lane) => (
              <path
                key={lane}
                ref={(node) => {
                  laneRefs.current[lane] = node
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
                markRefs.current[lane] = node
              }}
              className="drive__mark"
              data-on="false"
            />
          ))}
        </div>

        <div className="drive__wheels">
          {([0, 1] as const).map((lane) => (
            <div
              key={lane}
              className="drive__wheel"
              onPointerDown={take(lane)}
              onPointerMove={move(lane)}
              onPointerUp={release(lane)}
              onPointerCancel={release(lane)}
            >
              <div
                ref={(node) => {
                  knobRefs.current[lane] = node
                }}
                className="drive__knob"
                data-on="false"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="qte__hold">
        <div ref={holdRef} className="qte__hold-fill" />
      </div>
    </div>
  )
}
