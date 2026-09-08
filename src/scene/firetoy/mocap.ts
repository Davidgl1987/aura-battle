import { AnimationClip, QuaternionKeyframeTrack, Vector3, VectorKeyframeTrack } from 'three'
import type { KeyframeTrack, Object3D } from 'three'
import { loadedName } from './characterParts'

/**
 * Imported motion, retargeted onto the Firetoy skeleton.
 *
 * The retarget turned out to be a rename. Firetoy's rig *is* a Mixamo rig:
 * both skeletons are the same 65 joints in the same order, with the same
 * "+Y points at the child" convention, and the names differ by one rule —
 * `mixamorig:LeftHandThumb1` is Firetoy's `HandThumb1.L`. Measured against the
 * real files, the mapping is a bijection with nothing left over on either side.
 *
 * That is what makes this eight lines of arithmetic instead of a retargeting
 * library. A clip states, per bone and per frame, where that bone points in
 * world space; a bone's local rotation is that world orientation with its
 * parent's taken off. When every bone maps and both rigs agree on their axes,
 * the parent's world orientation is the same on both sides, so it cancels: the
 * source's local rotation *is* the target's local rotation, verbatim.
 *
 * The rest poses being different does not enter into it, and that is the part
 * worth stating plainly, because it is the opposite of what `rig.ts` does. A
 * `Pose` is a *delta* — fifteen numbers laid over whatever the body was doing —
 * so it has to subtract the A-pose or the arms end up 39° wide. A clip is
 * *absolute*: it overwrites all 52 bones it touches, so Firetoy's A-pose rest
 * is simply gone for the duration, and subtracting it would bend the move.
 *
 * Two things are not renames:
 *
 * 1. **The hips translation.** It arrives in the source rig's centimetres and
 *    has to land in the target's metres, on legs of a different length. One
 *    ratio does both — hips-height to hips-height — applied to the offset from
 *    each rig's own rest, so the body keeps the place its own file put it and
 *    only the motion is borrowed. Measured on the real clip, the feet then land
 *    within 13 mm of the floor on the male body and 7 mm on the female.
 *
 * 2. **The track name.** `GLTFLoader` strips the full stops out of node names,
 *    so the bone the file calls `Arm.L` answers to `ArmL` in a loaded scene —
 *    and a track called `Arm.L.quaternion` would not merely miss it, it would
 *    be read as node `Arm`, property `L`. Every name here goes through
 *    `loadedName` for that reason.
 *
 * Findings are written up in `docs/firetoy.md`.
 */

/** Where a whole-body clip's translation lives, and the only one we keep. */
const HIPS = loadedName('Hips')

/**
 * `mixamorig:LeftHandThumb1` → `HandThumb1L`. Null for anything that is not a
 * bone of the source rig, which is how the armature's own tracks get dropped.
 *
 * The colon is optional because `FBXLoader` has usually taken it out already —
 * it sanitises node names the same way `GLTFLoader` does, so a parsed clip
 * addresses `mixamorigHips`, not `mixamorig:Hips`.
 */
export function firetoyBone(mixamo: string): string | null {
  const bare = /^mixamorig:?(.+)$/.exec(mixamo)?.[1]
  if (!bare) return null
  const side = bare.startsWith('Left') ? 'L' : bare.startsWith('Right') ? 'R' : null
  return loadedName(side ? `${bare.slice(side === 'L' ? 4 : 5)}.${side}` : bare)
}

/** A clip as Mixamo exported it, with the rig's own rest to measure against. */
export interface MixamoClip {
  readonly clip: AnimationClip
  /** The source hips at rest, in the file's own units — centimetres. */
  readonly hipsRest: Vector3
}

/**
 * Read a parsed Mixamo FBX. Null for a file that is not one: no clip in it, or
 * no hips to scale against.
 *
 * The rest pose has to be read before anything plays the clip on this object,
 * which is why it is captured here rather than looked up later.
 */
export function readMixamo(fbx: Object3D): MixamoClip | null {
  const clip = fbx.animations[0]
  const hips = fbx.getObjectByName('mixamorigHips') ?? fbx.getObjectByName('mixamorig:Hips')
  if (!clip || !hips) return null
  return { clip, hipsRest: hips.position.clone() }
}

/**
 * The same motion, addressed to a Firetoy skeleton whose hips rest at
 * `hipsRest`. Tracks are handed on by reference: nothing here or in the mixer
 * writes to them, so two characters retargeting the same clip share its
 * keyframes rather than each keeping a copy.
 */
export function retargetToFiretoy({ clip, hipsRest }: MixamoClip, rest: Vector3): AnimationClip {
  // Hips height to hips height: the unit conversion and the difference in leg
  // length are the same number, and there is only one of them to get wrong.
  const scale = rest.y / hipsRest.y
  const tracks: KeyframeTrack[] = []

  for (const track of clip.tracks) {
    const cut = track.name.lastIndexOf('.')
    const bone = firetoyBone(track.name.slice(0, cut))
    const property = track.name.slice(cut + 1)
    if (!bone) continue

    if (property === 'quaternion') {
      tracks.push(new QuaternionKeyframeTrack(`${bone}.quaternion`, track.times, track.values))
      continue
    }
    // Only the hips travel. A position track on any other bone would be that
    // rig's bone lengths, and writing those into this one stretches it.
    if (property !== 'position' || bone !== HIPS) continue

    const moved = new Float32Array(track.values.length)
    for (let i = 0; i < moved.length; i += 3) {
      moved[i] = rest.x + (track.values[i] - hipsRest.x) * scale
      moved[i + 1] = rest.y + (track.values[i + 1] - hipsRest.y) * scale
      moved[i + 2] = rest.z + (track.values[i + 2] - hipsRest.z) * scale
    }
    tracks.push(new VectorKeyframeTrack(`${bone}.position`, track.times, moved))
  }

  return new AnimationClip(clip.name, clip.duration, tracks)
}
