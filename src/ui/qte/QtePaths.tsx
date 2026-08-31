import { useEffect, useRef } from 'react'
import { now } from '../../state/store'
import type { Card, PathsParams, QteOutcome } from '../../engine/types'
import { useI18n } from '../../i18n'
import { paintDrive, type DriveHandle } from './boardPaint'
import { DriveBoard } from './boards'
import { useRun } from './run'
import { QteMeter } from './QteMeter'
import { isDown } from '../pointers'
import { useArming } from './arming'
import { bothHands, laneRange } from './paths'

interface Props {
  card: Card
  params: PathsParams
  startedAt: number
  variation: number
  onResult: (outcome: QteOutcome) => void
}

/** Never bank a frame longer than this: a stall is not a held finger. */
const MAX_FRAME_MS = 60

export function QtePaths({ card, params, startedAt, variation, onResult }: Props) {
  const { t } = useI18n()
  const arming = useArming(startedAt)
  const both = useRef(0)
  const run = useRun(card, onResult)
  const inTick = useRef(0)
  const ticks = useRef(0)

  /** Where each marker has been steered to, across a pad of [-1, 1]. */
  const at = useRef<[number, number]>([-0.5, 0.5])
  /** The pointer currently steering each lane, if any. */
  const grip = useRef<[number | null, number | null]>([null, null])
  /** Whether both wheels have ever been held at the same time. */
  const placed = useRef(false)

  const rootRef = useRef<HTMLDivElement>(null)
  const armRef = useRef<HTMLElement>(null)
  const board = useRef<DriveHandle>(null)
  const timeRef = useRef<HTMLDivElement>(null)

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

      {
        const { onLanes } = paintDrive(board.current, {
          scroll,
          at: at.current,
          params,
          variation,
          gripped: [grip.current[0] !== null, grip.current[1] !== null],
        })
        // Both hands on the glass is a condition of its own: a marker sitting
        // in its lane with nobody holding the wheel is not a held card.
        const holding = bothOn && onLanes

        if (armedAt !== null && holding) {
          both.current += dt
          inTick.current += dt
        }
      }

      const remaining = armedAt === null ? 1 : 1 - live / card.durationMs
      if (timeRef.current) timeRef.current.style.transform = `scaleX(${Math.max(0, remaining)})`

      run.paint(rootRef.current)

      if (armedAt !== null) {
        while (live >= (ticks.current + 1) * run.tickMs && ticks.current < run.chances) {
          ticks.current += 1
          // A card played with one thumb is a refusal to attempt it, so a tick
          // with only one marker down banks as nothing at all.
          run.hold(placed.current ? inTick.current : 0)
          inTick.current = 0
        }
      }

      if (armedAt !== null && remaining <= 0) {
        run.finish()
        return
      }
      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [card.durationMs, params, variation, arming, run])

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
          {t('qte.start.paths')} <b ref={armRef} className="qte__count" />
        </em>
        <em className="qte__hint-live">{t('qte.live.paths')}</em>
      </div>

      <div className="qte__timer">
        <div ref={timeRef} className="qte__timer-fill" />
      </div>

      <DriveBoard
        ref={board}
        wheel={(lane) => ({
          onPointerDown: take(lane),
          onPointerMove: move(lane),
          onPointerUp: release(lane),
          onPointerCancel: release(lane),
        })}
      />

      <QteMeter run={run} unit={t('qte.unit.held')} />
    </div>
  )
}
