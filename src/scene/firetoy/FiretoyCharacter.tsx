import { useLayoutEffect, useMemo } from 'react'
import { useFrame, type ThreeElements } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { Color, type MeshStandardMaterial } from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { NEUTRAL, type Pose } from '../pose'
import type { Gender } from './characterParts'
import { makeClipPlayer } from './clipPlayer'
import type { Playing } from './handover'
import { type MixamoClip, retargetToFiretoy } from './mocap'
import { MODELS } from './models'
import { applyOutfit, indexParts, ownMaterials, type Outfit } from './outfit'
import { applyPose, makeRig } from './rig'

/** A clip this body should be performing, and the instant it started. */
export interface ClipCue extends Omit<Playing, 'duration'> {
  /** As Mixamo exported it: each body retargets its own copy, to its own legs. */
  source: MixamoClip
}

/** Enough to read as alight next to the bloom, short of washing the outfit out. */
const GLOW = 0.5
const BLACK = new Color(0, 0, 0)

/** Lights a character from within, or puts them out. */
function light(skin: readonly MeshStandardMaterial[], glow: string | null | undefined): void {
  for (const material of skin) {
    material.emissive = glow ? new Color(glow) : BLACK
    material.emissiveIntensity = glow ? GLOW : 0
  }
}

type Props = ThreeElements['group'] & {
  gender: Gender
  /** The exact node names to show. Everything else in the file stays hidden. */
  outfit: Outfit
  /**
   * Read every frame for the pose to hold. Left out, the character stands in
   * the rig's own rest pose. A function rather than a value because nothing
   * that ticks belongs in React state.
   */
  poseAt?: () => Pose
  /**
   * An imported clip to perform instead of the pose. The two are never on the
   * body at once — a clip moves fifty-two bones where a pose moves eleven —
   * but neither takes it outright either: `handover.ts` fades between them at
   * both ends. Taking the cue away is what starts the fade back.
   */
  clip?: ClipCue | null
  /**
   * The game's clock, which stops when the game is paused. Read once a frame
   * to place the clip's playhead, so a held game holds its frame. Only needed
   * alongside `clip`.
   */
  now?: () => number
  /**
   * Lit from within, in this colour. GOD AURA, and the only thing that ever
   * touches the character's material.
   */
  glow?: string | null
}

/**
 * One Firetoy character, dressed.
 *
 * The GLB is a whole wardrobe on one skeleton — 166 pieces for the male file,
 * 144 for the female — and it arrives with every one of them visible. Dressing
 * a character is choosing which stay on.
 *
 * `useGLTF` caches the parsed file and hands the same scene to everyone who
 * asks for it, so this never touches that scene: `SkeletonUtils.clone` rebuilds
 * the node tree and rebinds each skinned mesh to a fresh copy of the skeleton,
 * while geometry, material and texture stay shared. Two characters can then
 * wear different outfits and hold different poses, and the second one on stage
 * does not undress the first.
 */
export function FiretoyCharacter({ gender, outfit, poseAt, clip, now, glow, ...group }: Props) {
  const { scene } = useGLTF(MODELS[gender])

  const { root, skin } = useMemo(() => {
    const clone = cloneSkinned(scene)
    return { root: clone, skin: ownMaterials(clone) as MeshStandardMaterial[] }
  }, [scene])

  const parts = useMemo(() => indexParts(root), [root])
  const rig = useMemo(() => makeRig(root), [root])

  // Before the first paint, so nobody ever sees the heap.
  useLayoutEffect(() => applyOutfit(parts, outfit), [parts, outfit])

  useLayoutEffect(() => light(skin, glow), [skin, glow])

  // Retargeted per body, not once for the file: the hips travel is scaled to
  // the legs that carry it, and the two skeletons stand at different heights.
  const source = clip?.source ?? null
  const retargeted = useMemo(
    () => (source && rig ? retargetToFiretoy(source, rig.hipsRest) : null),
    [source, rig],
  )

  const player = useMemo(
    () => (retargeted && rig ? makeClipPlayer(rig, retargeted) : null),
    [retargeted, rig],
  )

  // Built here rather than each frame: the clip's own length is this body's to
  // know, and a new object every frame is the one allocation on this path.
  const playing = useMemo<Playing | null>(
    () =>
      clip && retargeted
        ? {
            id: clip.id,
            startedAt: clip.startedAt,
            rate: clip.rate,
            loop: clip.loop,
            duration: retargeted.duration,
          }
        : null,
    [clip, retargeted],
  )

  useFrame(() => {
    if (!rig) return
    if (player && now) player.frame(now(), playing, poseAt ? poseAt() : NEUTRAL)
    else if (poseAt) applyPose(rig, poseAt())
  })

  return (
    <group {...group}>
      <primitive object={root} />
    </group>
  )
}

