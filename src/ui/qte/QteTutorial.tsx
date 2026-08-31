import { useEffect, useMemo, useRef } from 'react'
import { getCard } from '../../engine/cards'
import type {
  Card,
  ControlParams,
  LanesParams,
  PathsParams,
  QteGame,
  SpeedParams,
  TimingParams,
} from '../../engine/types'
import { useI18n } from '../../i18n'
import {
  LANE_LINE,
  paintDrive,
  paintLanes,
  paintSweep,
  paintZone,
  type DriveHandle,
  type LanesHandle,
  type SweepHandle,
  type ZoneHandle,
} from './boardPaint'
import { DriveBoard, LanesBoard, OrderBoard, PadsBoard, SweepBoard, ZoneBoard } from './boards'
import { drifted } from './control'
import { chart } from './lanes'
import { spotFor, type Spot } from './order'
import { padLabel } from './speed'
import { startPhase, zoneCentres } from './timing'

interface Props {
  game: QteGame
  onDismiss: () => void
}

/**
 * What this minigame wants, the first time it comes up.
 *
 * The battle is stopped while this is on screen — not slowed, stopped: it takes
 * its own hold on the game clock, so the QTE's own deadline is not running
 * behind it and nobody loses a card to reading an explanation. Which is also
 * why every demo here runs on a clock of its own.
 *
 * One per minigame rather than one per card. A sweep and a chart are both filed
 * under Timing and have nothing in common, so the tier a card sits at is never
 * what needs explaining — the gesture is.
 *
 * **The board is the real one.** These render the same components the card
 * does, driven by the same geometry, and the hand is placed from what that
 * geometry returns rather than from keyframes written to match it by eye. The
 * demos used to be a separate drawing in CSS and they drifted: the drive-test
 * one ended up showing two upright bars with a finger in each, which is not a
 * gesture this game has. A board that is literally the same component cannot
 * drift, and a hand told where the target is cannot point somewhere else.
 */
export function QteTutorial({ game, onDismiss }: Props) {
  const { t } = useI18n()

  return (
    <div className="tutorial" role="dialog" aria-modal="true">
      <div className="tutorial__card">
        <span className="tutorial__eyebrow">{t('tutorial.title')}</span>
        <div className="tutorial__demo" data-game={game}>
          <Demo game={game} />
        </div>
        <p className="tutorial__text">{t(`tutorial.${game}`)}</p>
        <button className="btn btn--big" onPointerDown={onDismiss} autoFocus>
          {t('tutorial.skip')}
        </button>
      </div>
    </div>
  )
}

/** The EASY card of a gesture — the one the demo is built from. */
const easiest: Record<QteGame, string> = {
  sweep: 'mewing',
  lanes: 'vibe-check',
  mash: 'rizz-clap',
  order: 'npc-mode',
  zone: 'lean',
  paths: 'cruise-control',
}

function Demo({ game }: { game: QteGame }) {
  const card = useMemo(() => getCard(easiest[game]), [game])
  switch (game) {
    case 'sweep':
      return <SweepDemo card={card} />
    case 'lanes':
      return <LanesDemo card={card} />
    case 'mash':
      return <MashDemo />
    case 'order':
      return <OrderDemo card={card} />
    case 'zone':
      return <ZoneDemo card={card} />
    case 'paths':
      return <DriveDemo card={card} />
  }
}

/**
 * A clock of its own, because the game's is deliberately stopped behind this.
 *
 * Hands back milliseconds since the demo appeared and calls `frame` with them
 * every frame, and stops when the tutorial goes away.
 */
function useDemoClock(frame: (elapsed: number) => void) {
  // The callback closes over fresh values every render; the loop is started
  // once. Writing to the ref inside an effect rather than during the render is
  // what keeps that legal.
  const latest = useRef(frame)
  useEffect(() => {
    latest.current = frame
  })

  useEffect(() => {
    let raf = 0
    const from = performance.now()
    const loop = () => {
      latest.current(performance.now() - from)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
}

/** The pointing hand, moved by whatever the board's own geometry says. */
function Hand({ ref }: { ref: React.Ref<HTMLSpanElement> }) {
  return <span className="tutorial__hand" ref={ref} aria-hidden />
}

/** Puts the hand at a point inside `host`, in that element's own pixels. */
function place(hand: HTMLSpanElement | null, host: Element | null, x: number, y: number) {
  if (!hand || !host) return
  const box = host.getBoundingClientRect()
  const frame = hand.offsetParent?.getBoundingClientRect()
  if (!frame) return
  hand.style.left = `${box.left - frame.left + x}px`
  hand.style.top = `${box.top - frame.top + y}px`
}

/* --- Sweep: tap it inside a green zone ------------------------------------ */

function SweepDemo({ card }: { card: Card }) {
  const params = card.qte as TimingParams
  const board = useRef<SweepHandle>(null)
  const hand = useRef<HTMLSpanElement>(null)
  const phase = useRef(0)

  useDemoClock((elapsed) => {
    if (!phase.current) phase.current = startPhase(elapsed, params.sweepMs, 0.2)
    const x = paintSweep(board.current, {
      t: elapsed,
      phase: phase.current,
      params,
      parkedAt: null,
    })
    // The hand waits over the zone the cursor is heading for and taps as it
    // arrives — the position comes from `zoneCentres`, so moving a zone moves
    // the finger with it.
    const centres = zoneCentres(params.zones)
    const target = centres.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a))
    const bar = board.current?.bar
    if (bar && hand.current) {
      const box = bar.getBoundingClientRect()
      place(hand.current, bar, target * box.width, box.height * 0.62)
      // Close to the zone is close to the tap.
      const near = Math.max(0, 1 - Math.abs(x - target) * 14)
      hand.current.style.transform = `translate(-50%, ${8 - near * 14}px) scale(${1 - near * 0.12})`
      hand.current.style.opacity = String(0.55 + near * 0.45)
    }
  })

  return (
    <>
      <SweepBoard params={params} ref={board} />
      <Hand ref={hand} />
    </>
  )
}

/* --- Lanes: hit each note on the line ------------------------------------- */

function LanesDemo({ card }: { card: Card }) {
  const params = card.qte as LanesParams
  const notes = useMemo(() => chart(params, 0.42), [params])
  const board = useRef<LanesHandle>(null)
  const hand = useRef<HTMLSpanElement>(null)
  const span = notes[notes.length - 1].atMs + params.travelMs

  useDemoClock((raw) => {
    const elapsed = raw % span
    paintLanes(board.current, { elapsed, notes, params, parked: false })

    // A note that has gone past is gone, rather than sliding on down the lane
    // and piling up under the line where the real card would have taken it.
    notes.forEach((note, i) => {
      const node = board.current?.notes[i]
      if (node) node.style.opacity = note.atMs + params.goodMs < elapsed ? '0' : '1'
    })

    // Follow whichever note is next to reach the line, and strike as it lands.
    const next = notes.find((n) => n.atMs >= elapsed) ?? notes[0]
    const lane = board.current?.lanes[next.lane]
    if (lane && hand.current) {
      const box = lane.getBoundingClientRect()
      place(hand.current, lane, box.width / 2, box.height * LANE_LINE)
      const near = Math.max(0, 1 - Math.abs(next.atMs - elapsed) / (params.goodMs * 3))
      hand.current.style.transform = `translate(-50%, ${12 - near * 18}px)`
      hand.current.style.opacity = String(0.5 + near * 0.5)
    }
  })

  return (
    <>
      <LanesBoard params={params} notes={notes} ref={board} />
      <Hand ref={hand} />
    </>
  )
}

/* --- Mash: walk the pads -------------------------------------------------- */

function MashDemo() {
  // The three-pad card is the one worth showing: a single pad has no walk to
  // teach, and the walk is the whole of what a player gets wrong here.
  const params = getCard('sturdy').qte as SpeedParams
  const hand = useRef<HTMLSpanElement>(null)
  const host = useRef<HTMLDivElement>(null)

  useDemoClock((elapsed) => {
    const pads = host.current?.querySelectorAll('.pad')
    if (!pads || !pads.length || !hand.current) return
    // Left, middle, right, middle — the one path across three pads that never
    // repeats one and never skips one, which is what `countsAsTap` allows.
    const walk = [...pads.keys(), ...[...pads.keys()].slice(1, -1).reverse()]
    const step = walk[Math.floor(elapsed / 420) % walk.length]
    const pad = pads[step]
    const box = pad.getBoundingClientRect()
    place(hand.current, pad, box.width / 2, box.height * 0.62)
    pads.forEach((p, i) => ((p as HTMLElement).dataset.lit = String(i === step)))
  })

  return (
    <div className="tutorial__host" ref={host}>
      <PadsBoard params={params} label={padLabel} />
      <Hand ref={hand} />
    </div>
  )
}

/* --- Order: press them in order ------------------------------------------- */

function OrderDemo({ card }: { card: Card }) {
  const params = card.qte as { visible: number }
  const spots = useMemo(() => {
    const out: Spot[] = []
    for (let n = 1; n <= params.visible; n++) out.push(spotFor(n, out, 0.31))
    return out
  }, [params.visible])

  const hand = useRef<HTMLSpanElement>(null)
  const host = useRef<HTMLDivElement>(null)

  useDemoClock((elapsed) => {
    const keys = host.current?.querySelectorAll('.order__key')
    if (!keys || !keys.length || !hand.current) return
    const n = Math.floor(elapsed / 700) % keys.length
    const key = keys[n]
    const box = key.getBoundingClientRect()
    // The centre of the key itself, so the finger lands on the number rather
    // than beside it however the scatter fell.
    place(hand.current, key, box.width / 2, box.height / 2)
    keys.forEach((k, i) => ((k as HTMLElement).dataset.next = String(i === n)))
  })

  return (
    <div className="tutorial__host" ref={host}>
      <OrderBoard spots={spots} next={0} />
      <Hand ref={hand} />
    </div>
  )
}

/* --- Zone: keep a finger on the ring -------------------------------------- */

function ZoneDemo({ card }: { card: Card }) {
  const params = card.qte as ControlParams
  const board = useRef<ZoneHandle>(null)
  const hand = useRef<HTMLSpanElement>(null)

  useDemoClock((elapsed) => {
    const ring = paintZone(board.current, {
      at: drifted(elapsed % card.durationMs, card.durationMs),
      params,
      variation: 0.18,
    })
    const area = board.current?.area
    if (ring && area && hand.current) {
      // Dead on the ring's centre, because that is the gesture: the finger goes
      // where the ring is and stays there.
      place(hand.current, area, ring.cx, ring.cy)
      hand.current.style.transform = 'translate(-50%, -14%)'
    }
  })

  return (
    <>
      <ZoneBoard ref={board} />
      <Hand ref={hand} />
    </>
  )
}

/* --- Paths: a thumb on each wheel ----------------------------------------- */

function DriveDemo({ card }: { card: Card }) {
  const params = card.qte as PathsParams
  const board = useRef<DriveHandle>(null)
  const left = useRef<HTMLSpanElement>(null)
  const right = useRef<HTMLSpanElement>(null)

  useDemoClock((elapsed) => {
    const scroll = (elapsed / 1000) * params.speed
    // Steered perfectly: the markers sit on the lane centres `paintDrive` hands
    // back, so a change to the winding moves the demo with it and the thumbs
    // stay where a good player's would be.
    const centres = paintDrive(board.current, {
      scroll,
      at: [0, 0],
      params,
      variation: 0.27,
      gripped: [true, true],
    }).centres
    paintDrive(board.current, {
      scroll,
      at: centres,
      params,
      variation: 0.27,
      gripped: [true, true],
    })

    for (const [lane, hand] of [
      [0, left.current],
      [1, right.current],
    ] as const) {
      const knob = board.current?.knobs[lane]
      const wheel = knob?.parentElement
      if (!knob || !wheel || !hand) continue
      const box = wheel.getBoundingClientRect()
      const at = knob.getBoundingClientRect()
      place(hand, wheel, at.left - box.left + at.width / 2, box.height * 0.5)
    }
  })

  return (
    <>
      <DriveBoard ref={board} />
      <Hand ref={left} />
      <Hand ref={right} />
    </>
  )
}
