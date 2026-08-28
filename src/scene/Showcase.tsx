import { useEffect, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { CARDS, getCard } from '../engine/cards'
import type { Rival } from '../engine/rivals'
import type { Look } from '../engine/types'
import { CHARACTERS, getCharacter } from '../engine/characters'
import { now } from '../state/store'
import { AuraCore } from './AuraCore'
import { getBuild, standingHeight } from './builds'
import { Fighter } from './Fighter'
import { Floor, StageShell } from './StageShell'
import { SLOTS, type FighterAction, type Slot } from './stageState'

/**
 * Picks a gesture, performs it, waits a moment, picks another. Nobody is
 * watching a menu, so the fighters may as well be doing something while it
 * is open.
 */
function useIdleShow(offsetMs: number, cardIds?: readonly string[]): FighterAction {
  const [action, setAction] = useState<FighterAction>({ kind: 'idle' })
  // Joined so a changed deck restarts the loop, rather than a new array
  // identity restarting it on every render.
  const pool = cardIds?.join(',')

  useEffect(() => {
    let timer = 0
    const cards = pool ? pool.split(',').map(getCard) : CARDS
    const schedule = (wait: number) => {
      timer = window.setTimeout(() => {
        const card = cards[Math.floor(Math.random() * cards.length)]
        setAction({
          kind: 'move',
          animation: card.animation,
          startedAt: now(),
          durationMs: card.durationMs,
        })
        schedule(card.durationMs + 600 + Math.random() * 1400)
      }, wait)
    }

    schedule(offsetMs)
    return () => window.clearTimeout(timer)
  }, [offsetMs, pool])

  return action
}

function Drifting({
  height,
  distance,
  aim,
}: {
  height: number
  distance: number
  aim: number
}) {
  useFrame(({ camera }) => {
    const t = now()
    camera.position.x = Math.sin(t / 4200) * 0.4
    camera.position.y = height + Math.sin(t / 3300) * 0.08
    camera.position.z = distance
    camera.lookAt(0, aim, -0.4)
  })
  return null
}

/** A lamp in their own colour, set just outside their mark on the floor. */
function keyLight(slot: Slot): [number, number, number] {
  const mark = SLOTS[slot]
  const radius = Math.hypot(mark.x, mark.z) || 1
  const out = radius + 1.3
  return [(mark.x / radius) * out, 1.9, (mark.z / radius) * out]
}

function Performer({
  characterId,
  slot,
  action,
  look,
}: {
  characterId: string
  slot: Slot
  action: FighterAction
  /** A rival's own colour and drip. Absent means the build's own colour. */
  look?: Look
}) {
  const color = look?.color ?? getCharacter(characterId).color
  return (
    <>
      <pointLight position={keyLight(slot)} color={color} intensity={3} />
      <Fighter
        characterId={characterId}
        color={color}
        slot={slot}
        action={action}
        charged={false}
        accessories={look?.accessories}
        now={now}
      />
    </>
  )
}

/** Circles the ring, so every fighter gets the lens pointed at them in turn. */
function Orbit({
  radius,
  height,
  aim,
  periodMs,
}: {
  radius: number
  height: number
  aim: number
  periodMs: number
}) {
  useFrame(({ camera }) => {
    const t = now()
    const angle = (t / periodMs) * Math.PI * 2
    camera.position.x = Math.sin(angle) * radius
    camera.position.z = Math.cos(angle) * radius
    camera.position.y = height + Math.sin(t / 3400) * 0.14
    camera.lookAt(0, aim, 0)
  })
  return null
}

/** One member of the cast, warming up on their mark. */
function RingMember({ index, characterId }: { index: number; characterId: string }) {
  // Staggered so they are never all doing the same thing on the same beat.
  const action = useIdleShow(300 + index * 900)
  return <Performer characterId={characterId} slot={`ring${index}` as Slot} action={action} />
}

function TitleCast() {
  // Everyone is on the title, in a shuffled order, so the ring is not the same
  // picture every time the game is opened.
  const [order] = useState(() => [...CHARACTERS].sort(() => Math.random() - 0.5))

  return (
    <>
      <Floor radius={20} />
      <AuraCore />
      {/* A phone in portrait is narrow: the ring is under three units across and
          the lens only covers that much width from a dozen units back. The
          height is what pulls the far side of the ring clear of the near one. */}
      <Orbit radius={12.2} height={4.4} aim={0.9} periodMs={52_000} />
      {order.map((c, i) => (
        <RingMember key={c.id} index={i} characterId={c.id} />
      ))}
    </>
  )
}

/** The whole cast in a ring behind the title, with the camera walking round. */
export function TitleShowcase() {
  return (
    <div className="stage__scene">
      {/* The cast stands a dozen units out, so the air has to reach much
          further than the battle's or all four dissolve into it. */}
      <StageShell camera={[0, 4.4, 12.2]} fog={[17, 40]} bloom={0.9}>
        <TitleCast />
      </StageShell>
    </div>
  )
}

/** The lens the deck builder uses; the framing below is derived from it. */
const PREVIEW_FOV = 34

/**
 * How much of the frame the fighter fills, and where their feet land in it —
 * both measured top to bottom. Two numbers rather than one because the two
 * screens want different shots out of the same body: the deck builder gives
 * the fighter a short shelf and nearly all of it, while the rival screen is a
 * whole phone with a roster over the top and a sheet across the bottom, and
 * the fighter has to fit in the band between them.
 */
interface Frame {
  fill: number
  feetAt: number
}

const DECK_FRAME: Frame = { fill: 0.8, feetAt: 0.8 }
/** Clear of the roster, feet melting into the top of the sheet. */
const RIVAL_FRAME: Frame = { fill: 0.4, feetAt: 0.58 }

/**
 * Frames one specific fighter rather than the tallest one there is. A fixed
 * lens sized for NOODLE mid-levitate left BLOCKY marooned under a sky of empty
 * air, so the shot is worked out from the body that is actually standing there.
 */
function framing(characterId: string, frame: Frame) {
  // Gestures lift and stretch well past standing height, and the shot has to
  // hold the whole of one without cropping it.
  const reach = standingHeight(getBuild(characterId)) * 1.42
  // Tall enough to hold `reach` across `fill` of the frame, aimed so the
  // ground lands at `feetAt` and the rest falls below as floor.
  const covers = reach / frame.fill
  const aim = covers * (frame.feetAt - 0.5)
  return {
    aim,
    height: aim,
    distance: covers / 2 / Math.tan(((PREVIEW_FOV / 2) * Math.PI) / 180),
  }
}

interface PreviewProps {
  characterId: string
  /** The gesture to try out, set fresh each time a card is tapped. */
  preview: { animation: string; durationMs: number; startedAt: number } | null
  look?: Look
  /** Gestures to idle through. A rival warms up with their own deck. */
  cardIds?: readonly string[]
  frame?: Frame
}

function PreviewCast({ characterId, preview, look, cardIds, frame = DECK_FRAME }: PreviewProps) {
  const idle = useIdleShow(2500, cardIds)
  const action: FighterAction = preview
    ? { kind: 'move', animation: preview.animation, startedAt: preview.startedAt, durationMs: preview.durationMs }
    : idle
  const shot = framing(characterId, frame)

  return (
    <>
      <Floor />
      <Drifting height={shot.height} distance={shot.distance} aim={shot.aim} />
      <Performer characterId={characterId} slot="showCentre" action={action} look={look} />
    </>
  )
}

/**
 * The fighter you are about to take into a battle, trying out the cards you
 * tap. Picking a deck blind and finding out what "Griddy Drop" looks like
 * mid-match was a worse way round.
 */
export function SetupShowcase({ characterId, preview, look, cardIds, frame }: PreviewProps) {
  return (
    <div className="stage__scene">
      {/* Further out than the deck builder's shot needs, so the rival screen's
          wider frame does not start inside the fog. */}
      <StageShell camera={[0, 1.35, 5.2]} fov={PREVIEW_FOV} fog={[11, 22]}>
        <PreviewCast
          characterId={characterId}
          preview={preview}
          look={look}
          cardIds={cardIds}
          frame={frame}
        />
      </StageShell>
    </div>
  )
}

/**
 * One rival on their mark, warming up with the deck they will actually bring —
 * signature card included, so the move you are playing for is on screen before
 * you have agreed to fight for it.
 */
export function RivalShowcase({ rival }: { rival: Rival }) {
  return (
    <SetupShowcase
      characterId={rival.characterId}
      preview={null}
      look={rival.look}
      cardIds={rival.deck}
      frame={RIVAL_FRAME}
    />
  )
}
