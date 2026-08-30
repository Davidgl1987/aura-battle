import { useEffect, useRef } from 'react'
import { play } from '../../audio/engine'
import { now } from '../../state/store'
import type { Card, ControlParams, QteOutcome } from '../../engine/types'
import { useI18n } from '../../i18n'
import { useRun } from './run'
import { QteMeter } from './QteMeter'
import { useArming } from './arming'
import { drifted, zoneAt } from './control'

interface Props {
  card: Card
  params: ControlParams
  startedAt: number
  variation: number
  onResult: (outcome: QteOutcome) => void
}

/** Never bank a frame longer than this: a stall is not a held finger. */
const MAX_FRAME_MS = 60

/**
 * How far outside the ring still counts as touching it, in pixels.
 *
 * A pointer is one coordinate; a finger is a pad about this wide. Requiring
 * that single point to sit inside the ring meant the smallest ring asked you to
 * place a fingertip more precisely than you can see it, and the card you could
 * not see under your own thumb was the hardest one in the game.
 */
const FINGER_SLOP = 22

export function QteControl({ card, params, startedAt, variation, onResult }: Props) {
  const { t } = useI18n()
  const run = useRun(card, onResult)
  const held = useRef(0)
  /** Milliseconds inside the ring since the last tick was banked. */
  const inTick = useRef(0)
  const ticks = useRef(0)
  const pointer = useRef<{ x: number; y: number } | null>(null)
  const arming = useArming(startedAt)

  const rootRef = useRef<HTMLDivElement>(null)
  const armRef = useRef<HTMLElement>(null)
  const areaRef = useRef<HTMLDivElement>(null)
  const zoneRef = useRef<HTMLDivElement>(null)
  const timeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let raf = 0
    let last = now()

    const loop = () => {
      const t = now()
      const dt = Math.min(t - last, MAX_FRAME_MS)
      last = t

      // Still and waiting until a finger lands on it.
      let armedAt = arming.resolve(t)
      const elapsed = armedAt === null ? 0 : t - armedAt

      const area = areaRef.current
      const zone = zoneRef.current
      if (area && zone) {
        const rect = area.getBoundingClientRect()
        const size = Math.min(rect.width, rect.height)
        const radius = params.zoneRadius * size
        // Both axes travel the same square region, so the drift is not twice
        // as fast down the long side of the pad.
        const span = size / 2 - radius
        // The ring picks up speed across the card, so holding it at the end
        // is a different ask from holding it at the start.
        const offset = zoneAt(drifted(elapsed, card.durationMs), params, variation)
        const cx = rect.width / 2 + offset.x * span
        const cy = rect.height / 2 + offset.y * span

        zone.style.width = `${radius * 2}px`
        zone.style.height = `${radius * 2}px`
        zone.style.transform = `translate(${cx - radius}px, ${cy - radius}px)`

        const p = pointer.current
        const inside =
          p !== null && Math.hypot(p.x - rect.left - cx, p.y - rect.top - cy) <= radius + FINGER_SLOP

        // The card says to put your finger on the ring, so that is what starts
        // it — landing on it or sliding onto it, but never a stray tap in a
        // corner that would begin the hold with you already outside.
        if (armedAt === null && inside) {
          arming.arm(t)
          armedAt = t
          play('tap')
        }
        if (inside && armedAt !== null) {
          const banked = Math.min(dt, elapsed)
          held.current += banked
          inTick.current += banked
        }

        zone.dataset.inside = String(inside)
        zone.dataset.live = String(armedAt !== null)
      }

      if (rootRef.current) rootRef.current.dataset.live = String(armedAt !== null)

      if (armRef.current) {
        armRef.current.textContent = `${(arming.countdown(t) / 1000).toFixed(1)}s`
      }
      if (timeRef.current) {
        const left = armedAt === null ? 1 : Math.max(0, 1 - elapsed / card.durationMs)
        timeRef.current.style.transform = `scaleX(${left})`
      }
      run.paint(rootRef.current)

      // Banked on a fixed clock rather than per frame, and each tick is
      // judged on the share of itself that was held — one dropped frame is
      // sixteen milliseconds and must not cost a PERFECT.
      //
      // The whole animation is banked, not just the bar's worth of it. Ticking
      // only as far as the bar meant the run held exactly as many chances as it
      // had to clear, so the first wobble put it out of reach for good and the
      // card was unloseable or unwinnable with nothing in between.
      if (armedAt !== null) {
        while (elapsed >= (ticks.current + 1) * run.tickMs && ticks.current < run.chances) {
          ticks.current += 1
          run.hold(inTick.current)
          inTick.current = 0
        }
      }

      if (armedAt !== null && elapsed >= card.durationMs) {
        run.finish()
        return
      }
      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [startedAt, card.durationMs, params, variation, arming, run])

  const track = (event: React.PointerEvent<HTMLDivElement>) => {
    pointer.current = { x: event.clientX, y: event.clientY }
  }

  const grab = (event: React.PointerEvent<HTMLDivElement>) => {
    // Capture so a finger that slides off the pad still reports as "out"
    // instead of silently ending the gesture. It throws if the pointer has
    // already gone, and an exception here would take the whole press with it —
    // the finger would land on the ring and nothing would happen.
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Carry on without capture; tracking still works inside the pad.
    }
    track(event)
  }

  const release = () => {
    pointer.current = null
  }

  return (
    <div className="qte" ref={rootRef} data-live="false">
      <div className="qte__title">
        {card.emoji} {card.name}
        <em className="qte__hint-grab">
          {t('qte.start.zone')} <b ref={armRef} className="qte__count" />
        </em>
        <em className="qte__hint-live">{t('qte.live.zone')}</em>
      </div>

      <div className="qte__timer">
        <div ref={timeRef} className="qte__timer-fill" />
      </div>
      <QteMeter run={run} unit={t('qte.unit.held')} />

      <div
        ref={areaRef}
        className="qte__area"
        onPointerDown={grab}
        onPointerMove={track}
        onPointerUp={release}
        onPointerCancel={release}
      >
        {/* The wrapper owns the position and nothing else. Anything that
            animates lives on the ring inside it — a keyframe touching
            `transform` out here would fight the inline one and walk the
            target across the pad. */}
        <div ref={zoneRef} className="zone" data-live="false">
          <div className="zone__ring" />
        </div>
      </div>
    </div>
  )
}
