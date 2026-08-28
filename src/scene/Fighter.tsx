import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { NEUTRAL, type Pose } from './pose'
import {
  finalePose,
  flourish,
  idlePose,
  moveAt,
  reactPose,
  settle,
  watchPose,
  windUpPose,
} from './animations'
import { getBuild, type Build } from './builds'
import { Drip } from './Drip'
import { dripFor } from './dripAnchors'
import { SLOTS, actionProgress, type FighterAction, type Slot } from './stageState'

interface Props {
  characterId: string
  color: string
  slot: Slot
  action: FighterAction
  /** Lit from within while GOD AURA holds. */
  charged: boolean
  /** Accessory ids to dress them in. Each is parented to the part it sits on. */
  accessories?: readonly string[]
  /** Time base shared with the rest of the game. */
  now: () => number
}

/** Boxy fighters get boxy limbs; everyone else gets capsules. */
function Limb({ build, length, thickness }: { build: Build; length: number; thickness: number }) {
  return (
    <mesh position={[0, -length / 2, 0]} castShadow={false}>
      {build.shape === 'box' ? (
        <boxGeometry args={[thickness, length, thickness]} />
      ) : (
        <capsuleGeometry args={[thickness / 2, Math.max(0.01, length - thickness), 3, 8]} />
      )}
      <meshStandardMaterial color="#453a7a" flatShading roughness={0.7} />
    </mesh>
  )
}

function Torso({ build, color, charged }: { build: Build; color: string; charged: boolean }) {
  const [w, h, d] = build.torso
  return (
    <mesh position={[0, h / 2, 0]}>
      {build.shape === 'box' ? (
        <boxGeometry args={[w, h, d]} />
      ) : build.shape === 'sphere' ? (
        <sphereGeometry args={[w / 2, 12, 8]} />
      ) : (
        <capsuleGeometry args={[w / 2, Math.max(0.01, h - w), 3, 10]} />
      )}
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={charged ? 0.85 : 0}
        flatShading
        roughness={0.5}
        metalness={0.06}
      />
    </mesh>
  )
}

export function Fighter({ characterId, color, slot, action, charged, accessories, now }: Props) {
  const build = useMemo(() => getBuild(characterId), [characterId])
  // Grouped once rather than filtered three times per frame, and keyed on the
  // ids so a rival changing clothes actually re-groups.
  const drip = useMemo(
    () => ({
      head: dripFor(accessories, 'head'),
      body: dripFor(accessories, 'body'),
      root: dripFor(accessories, 'root'),
    }),
    [accessories],
  )
  // Start on the mark rather than sliding in from the origin: otherwise both
  // fighters open the match standing on top of each other.
  const [openingSlot] = useState(() => SLOTS[slot])
  const [torsoW, torsoH] = build.torso

  const slotRef = useRef<Group>(null)
  const rootRef = useRef<Group>(null)
  const bodyRef = useRef<Group>(null)
  const headRef = useRef<Group>(null)
  const armL = useRef<Group>(null)
  const armR = useRef<Group>(null)
  const foreL = useRef<Group>(null)
  const foreR = useRef<Group>(null)
  const legL = useRef<Group>(null)
  const legR = useRef<Group>(null)

  // The pose currently on screen, eased toward the target every frame so a
  // change of action never snaps.
  const current = useRef<Pose>({ ...NEUTRAL })

  useFrame((_, delta) => {
    const t = now()
    const seconds = t / 1000
    const p = actionProgress(action, t)

    let target: Pose
    switch (action.kind) {
      case 'windUp':
        target = windUpPose(p)
        break
      case 'move':
        target = flourish(moveAt(action.animation, p), build, p)
        break
      case 'react':
        target = reactPose(action.judgement, p)
        break
      case 'watch':
        target = watchPose(action.judgement, p)
        break
      case 'finale':
        target = finalePose(action.won, seconds)
        break
      default:
        target = idlePose(seconds, build)
    }

    const pose = settle(current.current, target, Math.min(delta, 0.1), 14)
    current.current = pose

    if (slotRef.current) {
      const to = SLOTS[slot]
      const k = 1 - Math.exp(-6 * Math.min(delta, 0.1))
      slotRef.current.position.x += (to.x - slotRef.current.position.x) * k
      slotRef.current.position.z += (to.z - slotRef.current.position.z) * k
      slotRef.current.rotation.y += (to.turn - slotRef.current.rotation.y) * k
    }

    if (rootRef.current) {
      rootRef.current.position.y = pose.y
      rootRef.current.rotation.y = pose.turn
    }
    if (bodyRef.current) {
      bodyRef.current.rotation.x = pose.lean
      bodyRef.current.rotation.z = pose.tilt
      // Squash preserves volume, so a flattened fighter spreads sideways.
      const spread = 1 / Math.sqrt(pose.squash)
      bodyRef.current.scale.set(spread, pose.squash, spread)
    }
    if (headRef.current) {
      headRef.current.rotation.x = pose.headPitch
      headRef.current.rotation.y = pose.headYaw
    }
    if (armL.current) {
      armL.current.rotation.z = pose.armRaiseL
      armL.current.rotation.x = -pose.armSwingL
    }
    if (armR.current) {
      armR.current.rotation.z = -pose.armRaiseR
      armR.current.rotation.x = -pose.armSwingR
    }
    if (foreL.current) foreL.current.rotation.x = -pose.elbowL
    if (foreR.current) foreR.current.rotation.x = -pose.elbowR
    if (legL.current) legL.current.rotation.x = -pose.legL
    if (legR.current) legR.current.rotation.x = -pose.legR
  })

  const shoulderY = torsoH * 0.82
  const hipX = torsoW * 0.26
  const headY = torsoH + build.headSize * 0.45
  const eye = build.headSize * 0.17

  return (
    <group
      ref={slotRef}
      position={[openingSlot.x, 0, openingSlot.z]}
      rotation={[0, openingSlot.turn, 0]}
      scale={build.scale}
    >
      <group ref={rootRef}>
        {/* Outside the body group on purpose: squash and stretch belongs to
            the fighter, not to the ring orbiting them. */}
        {drip.root.map((a) => (
          <Drip key={a.id} accessory={a} build={build} charged={charged} now={now} />
        ))}

        <group ref={bodyRef} position={[0, build.legLength, 0]}>
          <Torso build={build} color={color} charged={charged} />
          {drip.body.map((a) => (
            <Drip key={a.id} accessory={a} build={build} charged={charged} now={now} />
          ))}

          <group ref={headRef} position={[0, headY, 0]}>
            <mesh>
              {build.shape === 'box' ? (
                <boxGeometry args={[build.headSize, build.headSize, build.headSize]} />
              ) : (
                <sphereGeometry args={[build.headSize / 2, 12, 8]} />
              )}
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={charged ? 0.7 : 0}
                flatShading
                roughness={0.45}
              />
            </mesh>
            {[-1, 1].map((side) => (
              <mesh key={side} position={[side * build.headSize * 0.22, 0.02, build.headSize * 0.5]}>
                <sphereGeometry args={[eye, 8, 6]} />
                <meshStandardMaterial color="#0b0713" />
              </mesh>
            ))}
            {drip.head.map((a) => (
              <Drip key={a.id} accessory={a} build={build} charged={charged} now={now} />
            ))}
          </group>

          <group ref={armL} position={[build.shoulder, shoulderY, 0]}>
            <Limb build={build} length={build.armLength} thickness={build.armThickness} />
            <group ref={foreL} position={[0, -build.armLength, 0]}>
              <Limb build={build} length={build.armLength} thickness={build.armThickness * 0.9} />
            </group>
          </group>

          <group ref={armR} position={[-build.shoulder, shoulderY, 0]}>
            <Limb build={build} length={build.armLength} thickness={build.armThickness} />
            <group ref={foreR} position={[0, -build.armLength, 0]}>
              <Limb build={build} length={build.armLength} thickness={build.armThickness * 0.9} />
            </group>
          </group>

          <group ref={legL} position={[hipX, 0, 0]}>
            <Limb build={build} length={build.legLength} thickness={build.legThickness} />
          </group>
          <group ref={legR} position={[-hipX, 0, 0]}>
            <Limb build={build} length={build.legLength} thickness={build.legThickness} />
          </group>
        </group>
      </group>
    </group>
  )
}
