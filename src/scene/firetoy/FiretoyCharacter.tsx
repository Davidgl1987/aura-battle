import { useLayoutEffect, useMemo } from 'react'
import { useFrame, type ThreeElements } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { Color, type MeshStandardMaterial } from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { Span } from '../animations'
import { NEUTRAL, type Pose } from '../pose'
import type { Gender } from './characterParts'
import { makeClipPlayer } from './clipPlayer'
import { BLEND_IN_MS, BLEND_OUT_MS, type Playing } from './handover'
import { type MixamoClip, type Retarget, retargetToFiretoy } from './mocap'
import { MODELS } from './models'
import { applyOutfit, indexParts, ownMaterials, type Outfit } from './outfit'
import { applyPose, makeRig } from './rig'

/** A clip this body should be performing, and the instant it started. */
export interface ClipCue extends Omit<Playing, 'duration'> {
  /** As Mixamo exported it: each body retargets its own copy, to its own legs. */
  source: MixamoClip
  /** Which stretch of it, and whether to hold it on its mark. */
  window: Retarget
  blendInMs: number
  blendOutMs: number
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
   * The span to perform `poseAt` over, when there is no clip to perform the
   * action with. Blended in and out exactly as a clip is — see `spanOf`.
   */
  span?: Span | null
  /**
   * What the body does when nothing else is asked of it: `neutral-idle`,
   * retargeted here like any other clip and written under every frame. Left
   * out — which is every clone that has not downloaded the licensed files —
   * the rig's own rest pose stands in for it.
   */
  rest?: MixamoClip | null
  /** Shifts the resting loop, so two fighters do not breathe in unison. */
  restPhaseMs?: number
  /**
   * The game's clock, which stops when the game is paused. Read once a frame
   * to place the clip's playhead, so a held game holds its frame. Only needed
   * alongside `clip` or `rest`.
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
export function FiretoyCharacter({
  gender,
  outfit,
  poseAt,
  clip,
  span,
  rest,
  restPhaseMs = 0,
  now,
  glow,
  ...group
}: Props) {
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
  const how = clip?.window ?? null
  const retargeted = useMemo(
    () => (source && rig ? retargetToFiretoy(source, rig.hipsRest, how ?? {}) : null),
    [source, how, rig],
  )

  // The resting animation, retargeted once and kept for the life of the body:
  // it is under every frame, so it outlives every clip that plays over it.
  const resting = useMemo(
    () => (rest && rig ? retargetToFiretoy(rest, rig.hipsRest) : null),
    [rest, rig],
  )

  const player = useMemo(
    () => (rig ? makeClipPlayer(rig, retargeted, resting, restPhaseMs) : null),
    [retargeted, resting, restPhaseMs, rig],
  )

  // Built here rather than each frame: the clip's own length is this body's to
  // know, and a new object every frame is the one allocation on this path.
  // Read out rather than depended on whole: the span is rebuilt every render,
  // and a fresh one each frame would restart the blend sixty times a second.
  const spanId = span?.id ?? null
  const spanAt = span?.startedAt ?? 0
  const spanMs = span?.durationMs ?? 0
  const spanLoop = span?.loop ?? false

  const playing = useMemo<Playing | null>(() => {
    if (clip && retargeted) {
      return {
        id: clip.id,
        startedAt: clip.startedAt,
        rate: clip.rate,
        loop: clip.loop,
        duration: retargeted.duration,
        blendInMs: clip.blendInMs,
        blendOutMs: clip.blendOutMs,
      }
    }
    // No clip for this one, so the pose is what gets performed — over the
    // action's own span, and through the same blend.
    if (spanId === null) return null
    return {
      id: spanId,
      startedAt: spanAt,
      rate: 1,
      loop: spanLoop,
      duration: spanMs / 1000,
      blendInMs: BLEND_IN_MS,
      blendOutMs: BLEND_OUT_MS,
    }
  }, [clip, retargeted, spanId, spanAt, spanMs, spanLoop])

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

