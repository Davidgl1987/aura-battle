import { useLayoutEffect, useMemo } from 'react'
import { useFrame, type ThreeElements } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { Color, type MeshStandardMaterial } from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { Pose } from '../pose'
import type { Gender } from './characterParts'
import { MODELS } from './models'
import { applyOutfit, indexParts, ownMaterials, type Outfit } from './outfit'
import { applyPose, makeRig } from './rig'

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
export function FiretoyCharacter({ gender, outfit, poseAt, glow, ...group }: Props) {
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

  useFrame(() => {
    if (rig && poseAt) applyPose(rig, poseAt())
  })

  return (
    <group {...group}>
      <primitive object={root} />
    </group>
  )
}

