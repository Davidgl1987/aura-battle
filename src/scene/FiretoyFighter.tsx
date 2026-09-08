import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import type { FiretoyLook } from '../engine/types'
import { animationFor, poseForAction, settle } from './animations'
import { getBuild } from './builds'
import { type ClipCue, FiretoyCharacter } from './firetoy/FiretoyCharacter'
import { FIRETOY_SCALE } from './firetoy/models'
import { useMocap } from './firetoy/useMocap'
import { NEUTRAL, type Pose } from './pose'
import { SLOTS, type FighterAction, type Slot } from './stageState'

/**
 * A Firetoy character standing on a mark, doing what the match says.
 *
 * The same shape as `Fighter`, which is still what the title screen's ring of
 * primitives uses: it takes a slot and an action and works out the rest. What
 * it does not take is a colour, because a Firetoy character already has one —
 * the whole point of dressing them is that the rival is recognisable, and
 * repainting them player-pink would undo it.
 */
interface Props {
  character: FiretoyLook
  /**
   * Still the primitive character's id, and still what decides how they move:
   * how much they bounce on the spot, how far a move overshoots. A rival's
   * body changed; their timing did not.
   */
  characterId: string
  slot: Slot
  action: FighterAction
  /** Lit from within while GOD AURA holds, in their own colour. */
  charged: boolean
  color: string
  /** Time base shared with the rest of the game. */
  now: () => number
}

export function FiretoyFighter({
  character,
  characterId,
  slot,
  action,
  charged,
  color,
  now,
}: Props) {
  const build = useMemo(() => getBuild(characterId), [characterId])
  // Start on the mark rather than sliding in from the origin: otherwise both
  // fighters open the match standing on top of each other.
  const [openingSlot] = useState(() => SLOTS[slot])

  const slotRef = useRef<Group>(null)
  const current = useRef<Pose>({ ...NEUTRAL })
  const lastAt = useRef(0)

  // Whether this card is performed by an imported clip, and if so, since when.
  // The instant is the action's own, not the moment the file arrived: a clip
  // that turns up late is joined where the match says it should be, so two
  // fighters and a reload all show the same frame of it.
  const source = action.kind === 'move' ? animationFor(action.animation) : null
  const external = source?.type === 'clip' ? source.clip : null
  const mocap = useMocap(external?.src ?? null)

  const clip = useMemo<ClipCue | null>(
    () =>
      external && mocap && action.kind === 'move'
        ? {
            source: mocap,
            id: external.id,
            startedAt: action.startedAt,
            rate: external.playbackRate,
            loop: external.loop,
          }
        : null,
    [external, mocap, action],
  )

  useFrame((_, delta) => {
    if (!slotRef.current) return
    const to = SLOTS[slot]
    const k = 1 - Math.exp(-6 * Math.min(delta, 0.1))
    slotRef.current.position.x += (to.x - slotRef.current.position.x) * k
    slotRef.current.position.z += (to.z - slotRef.current.position.z) * k
    slotRef.current.rotation.y += (to.turn - slotRef.current.rotation.y) * k
  })

  /**
   * Read once a frame by the character itself, rather than pushed to it from
   * a frame callback here: a parent's callback runs after its children's, so
   * posing from up here would always be showing the frame before.
   */
  const poseAt = () => {
    const t = now()
    const step = lastAt.current === 0 ? 0 : Math.min((t - lastAt.current) / 1000, 0.1)
    lastAt.current = t
    current.current = settle(current.current, poseForAction(action, build, t), step, 14)
    return current.current
  }

  return (
    <group
      ref={slotRef}
      position={[openingSlot.x, 0, openingSlot.z]}
      rotation={[0, openingSlot.turn, 0]}
    >
      <FiretoyCharacter
        gender={character.gender}
        outfit={character.outfit}
        poseAt={poseAt}
        clip={clip}
        now={now}
        glow={charged ? color : null}
        scale={FIRETOY_SCALE}
      />
    </group>
  )
}
