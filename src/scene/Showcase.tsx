import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { CARDS, getCard } from '../engine/cards'
import type { Rival } from '../engine/rivals'
import type { Look } from '../engine/types'
import { getCharacter } from '../engine/characters'
import { PLAYER_CHARACTER, now } from '../state/store'
import { AuraCore } from './AuraCore'
import { BodyBoundary } from './BodyBoundary'
import { getBuild, standingHeight } from './builds'
import { Fighter } from './Fighter'
import { FiretoyFighter } from './FiretoyFighter'
import { DEFAULT_PLAYER_CHARACTER, RIVAL_CHARACTER_PRESETS } from './firetoy/cast'
import { FIRETOY_HEIGHT, preloadFiretoy } from './firetoy/models'
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
      {/* A look carrying a Firetoy character gets one. The title screen's ring
          does not pass one, and must not: four bodies on the home screen would
          be twenty-three megabytes before the game has been opened. */}
      {look?.character ? (
        <FiretoyFighter
          character={look.character}
          characterId={characterId}
          color={color}
          slot={slot}
          action={action}
          charged={false}
          now={now}
        />
      ) : (
        <Fighter
          characterId={characterId}
          color={color}
          slot={slot}
          action={action}
          charged={false}
          accessories={look?.accessories}
          now={now}
        />
      )}
    </>
  )
}

/**
 * A slow arc to one side of them and back, never round the far side.
 *
 * The title used to hold a ring of four and the camera walked the whole
 * circuit, which is how you get to see all of them. With one character on the
 * mark, a full circuit means half the time looking at the back of their head.
 */
function Sway({
  radius,
  height,
  aim,
  periodMs,
  spread,
}: {
  radius: number
  height: number
  aim: number
  periodMs: number
  /** Half the arc, in radians, either side of straight on. */
  spread: number
}) {
  useFrame(({ camera }) => {
    const t = now()
    const angle = Math.sin((t / periodMs) * Math.PI * 2) * spread
    camera.position.x = Math.sin(angle) * radius
    camera.position.z = Math.cos(angle) * radius
    camera.position.y = height + Math.sin(t / 3400) * 0.08
    camera.lookAt(0, aim, 0)
  })
  return null
}

/** Fires on the first frame the title is actually able to draw. */
function OnScreen({ report }: { report: () => void }) {
  const done = useRef(false)
  useFrame(() => {
    if (done.current) return
    done.current = true
    report()
  })
  return null
}

function TitleCast({ report }: { report: () => void }) {
  const action = useIdleShow(600)

  return (
    <>
      <Floor radius={9} />
      {/* Behind them rather than around them. The column of light is sized for
          a camera a dozen units back, which is where the ring of four used to
          stand; from four units it is a beam the width of a person, and a
          person standing inside it is on fire rather than lit. */}
      <group position={[0, 0, -2.1]}>
        <AuraCore />
      </group>
      {/* Far enough back that the whole of them lands in the band between the
          name and the PLAY button, gestures included: several moves throw the
          arms overhead, and a title that crops them at the wrist is worse than
          one where they stand a little smaller. */}
      <Sway radius={5.6} height={1.0} aim={0.9} periodMs={19_000} spread={0.34} />
      {/* Inside the canvas, never outside it — see `loading.test.ts`. The
          splash is waiting on `report`, so the boundary has to settle it even
          when the body never arrives. */}
      <BodyBoundary onSettled={report}>
        <Performer
          characterId={PLAYER_CHARACTER}
          slot="showCentre"
          action={action}
          look={{ character: DEFAULT_PLAYER_CHARACTER }}
        />
        <OnScreen report={report} />
      </BodyBoundary>
    </>
  )
}

/**
 * One character on the title, doing what they would do in a battle.
 *
 * It used to be all four primitive fighters in a ring with the camera walking
 * round them, which was a picture of a cast the game no longer has. One
 * Firetoy character reads at phone size, costs one body rather than two, and
 * is the same fighter the player takes into a battle.
 *
 * `report` is what dismisses the splash: the entry bundle cannot ask three.js
 * whether it is ready, so the scene says so from in here.
 */
export function TitleShowcase({ report }: { report: () => void }) {
  const started = useRef(false)

  const onScreen = () => {
    if (started.current) return
    started.current = true
    report()
    // The other body, now that nothing is waiting on it. By the time anyone
    // reaches a female rival — or the hot-seat setup — it is already in.
    preloadFiretoy('female')
  }

  return (
    <div className="stage__scene">
      <StageShell camera={[0, 1.0, 5.6]} fog={[9, 24]} bloom={0.9}>
        <TitleCast report={onScreen} />
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
function framing(standing: number, frame: Frame) {
  // Gestures lift and stretch well past standing height, and the shot has to
  // hold the whole of one without cropping it.
  const reach = standing * 1.42
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
  // A Firetoy body is the same height whichever character is wearing it, so
  // the shot follows the body on the mark rather than the build behind it.
  const shot = framing(
    look?.character ? FIRETOY_HEIGHT : standingHeight(getBuild(characterId)),
    frame,
  )

  return (
    <>
      <Floor />
      <Drifting height={shot.height} distance={shot.distance} aim={shot.aim} />
      <BodyBoundary>
        <Performer characterId={characterId} slot="showCentre" action={action} look={look} />
      </BodyBoundary>
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
  // The rival's own body comes down with this screen. The player's does not —
  // they are not on it — so it is fetched here, while the objectives are being
  // read, rather than at the first card of the battle. From inside this chunk
  // rather than from the screen above, which would put three.js in the bundle
  // the title screen loads.
  useEffect(() => {
    preloadFiretoy(DEFAULT_PLAYER_CHARACTER.gender)
  }, [])

  return (
    <SetupShowcase
      characterId={rival.characterId}
      preview={null}
      // The rival you are about to fight, wearing what you are playing for.
      // Reading a challenge next to a fighter who is not wearing its reward is
      // how the accessory stopped being a reason to take the challenge.
      look={{ ...rival.look, character: RIVAL_CHARACTER_PRESETS[rival.id] }}
      cardIds={rival.deck}
      frame={RIVAL_FRAME}
    />
  )
}
