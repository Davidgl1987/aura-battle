import { useEffect, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { CARDS } from '../engine/cards'
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
function useIdleShow(offsetMs: number): FighterAction {
  const [action, setAction] = useState<FighterAction>({ kind: 'idle' })

  useEffect(() => {
    let timer = 0
    const schedule = (wait: number) => {
      timer = window.setTimeout(() => {
        const card = CARDS[Math.floor(Math.random() * CARDS.length)]
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
  }, [offsetMs])

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
}: {
  characterId: string
  slot: Slot
  action: FighterAction
}) {
  const character = getCharacter(characterId)
  return (
    <>
      <pointLight position={keyLight(slot)} color={character.color} intensity={3} />
      <Fighter
        characterId={characterId}
        color={character.color}
        slot={slot}
        action={action}
        charged={false}
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
 * Where the feet sit in the frame, top to bottom. Not the very bottom: the
 * shelf fades out into the list below it, and a fighter standing on the last
 * pixel has that fade eat their legs.
 */
const FEET_AT = 0.8

/**
 * Frames one specific fighter rather than the tallest one there is. A fixed
 * lens sized for NOODLE mid-levitate left BLOCKY marooned under a sky of empty
 * air, so the shot is worked out from the body that is actually standing there.
 */
function framing(characterId: string) {
  // Gestures lift and stretch well past standing height, and the shot has to
  // hold the whole of one without cropping it.
  const reach = standingHeight(getBuild(characterId)) * 1.42
  // Tall enough to hold `reach` in the top `FEET_AT` of the frame, aimed so
  // the remainder falls below as floor.
  const covers = reach / FEET_AT
  return {
    aim: covers * (FEET_AT - 0.5),
    height: covers * (FEET_AT - 0.5),
    distance: covers / 2 / Math.tan(((PREVIEW_FOV / 2) * Math.PI) / 180),
  }
}

interface PreviewProps {
  characterId: string
  /** The gesture to try out, set fresh each time a card is tapped. */
  preview: { animation: string; durationMs: number; startedAt: number } | null
}

function PreviewCast({ characterId, preview }: PreviewProps) {
  const idle = useIdleShow(2500)
  const action: FighterAction = preview
    ? { kind: 'move', animation: preview.animation, startedAt: preview.startedAt, durationMs: preview.durationMs }
    : idle
  const shot = framing(characterId)

  return (
    <>
      <Floor />
      <Drifting height={shot.height} distance={shot.distance} aim={shot.aim} />
      <Performer characterId={characterId} slot="showCentre" action={action} />
    </>
  )
}

/**
 * The fighter you are about to take into a battle, trying out the cards you
 * tap. Picking a deck blind and finding out what "Griddy Drop" looks like
 * mid-match was a worse way round.
 */
export function SetupShowcase({ characterId, preview }: PreviewProps) {
  return (
    <div className="stage__scene">
      <StageShell camera={[0, 1.35, 5.2]} fov={PREVIEW_FOV} fog={[8, 16]}>
        <PreviewCast characterId={characterId} preview={preview} />
      </StageShell>
    </div>
  )
}
