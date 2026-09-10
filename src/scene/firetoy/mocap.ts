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
 * Two more are the registry's doing rather than the rigs': a clip may name a
 * `window` of itself to play, and may ask for its drift to be taken out. Both
 * are here because a keyframe track is the only place either can happen — see
 * `slice` and `held` below.
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

/** Seconds of a clip to play, measured from its own first frame. */
export interface ClipWindow {
  readonly startTime?: number
  readonly endTime?: number
}

/**
 * How a clip may be changed on the way in. Both are the registry's decisions
 * rather than the file's, and both are described in `clips.ts`.
 */
export interface Retarget extends ClipWindow {
  /** Take the drift out of the hips, so the fighter keeps their mark. */
  readonly hold?: boolean
}

/**
 * How long a wander has to last before it counts as going somewhere.
 *
 * `held` keeps whatever is faster than this and drops whatever is slower. A
 * dance shifts its weight about once a second and the planted foot pays for
 * none of that — the body is moving over the foot — so a window that short
 * would charge the foot for the sway and put the fighter on ice. Measured
 * across the nine travelling clips: at 1.4 s the backflip loses its 74 cm of
 * travel and gains 12 cm/s of foot slide, which reads as a pivot; at 0.4 s the
 * same clip gains 15 cm/s and every dance in the set gains 20–26.
 */
const DRIFT_SECONDS = 1.4

/**
 * Where the keyframes of `window` begin and end, as indices into `times`.
 *
 * The smallest range that covers what was asked for, rather than the largest
 * that fits inside it: the frames straddling each bound are kept, so a window
 * is never a frame short of its own first gesture. At 30 fps that is 33 ms of
 * slack at each end.
 */
function span(times: ArrayLike<number>, { startTime, endTime }: ClipWindow) {
  let from = 0
  let to = times.length - 1
  if (startTime !== undefined) while (from < to && times[from + 1] <= startTime) from++
  if (endTime !== undefined) while (to > from && times[to - 1] >= endTime) to--
  return { from, to }
}

/**
 * One track, cut to `window` and re-based so the window's first frame is time
 * zero. Whole clips are handed back untouched — and by reference, which is what
 * lets two characters playing the same clip share one set of keyframes.
 */
function slice(times: Float32Array | ArrayLike<number>, values: ArrayLike<number>, stride: number, window: ClipWindow) {
  const { from, to } = span(times, window)
  if (from === 0 && to === times.length - 1) return { times, values }
  const zero = times[from]
  const cut = new Float32Array(to - from + 1)
  for (let i = from; i <= to; i++) cut[i - from] = times[i] - zero
  return { times: cut, values: (values as Float32Array).slice(from * stride, (to + 1) * stride) }
}

/**
 * The same numbers with their slow half taken away: each one minus the average
 * of its neighbours within `DRIFT_SECONDS`. What is left oscillates about zero,
 * so a fighter sways where they stood instead of arriving somewhere else.
 *
 * Only ever asked of X and Z. A jump is drift in Y and taking it out would land
 * the backflip on the floor it left.
 *
 * Never quite zero at the two ends, and it cannot be: the average on the first
 * frame only has the half of its window that exists, so it lags by up to half a
 * window's worth of travel. That is the whole of the 27 cm the desk still
 * measures on the backflip, and it is at the ends, where the fighter is
 * standing rather than mid-flip.
 */
function held(times: ArrayLike<number>, values: ArrayLike<number>, axis: number): Float32Array {
  const out = new Float32Array(times.length)
  const half = DRIFT_SECONDS / 2
  let from = 0
  let to = 0
  let sum = 0
  for (let i = 0; i < times.length; i++) {
    // Both ends only ever move forward, so the average costs one pass and not
    // one per frame.
    while (to < times.length && times[to] <= times[i] + half) sum += values[to++ * 3 + axis]
    while (times[from] < times[i] - half) sum -= values[from++ * 3 + axis]
    out[i] = values[i * 3 + axis] - sum / (to - from)
  }
  return out
}

/**
 * The same motion, addressed to a Firetoy skeleton whose hips rest at
 * `hipsRest`. Tracks are handed on by reference where nothing had to change
 * them: nothing here or in the mixer writes to a track, so two characters
 * retargeting the same clip share its keyframes rather than each keeping a
 * copy. A windowed or held clip is the exception, and copies what it cut.
 */
export function retargetToFiretoy(
  { clip, hipsRest }: MixamoClip,
  rest: Vector3,
  how: Retarget = {},
): AnimationClip {
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
      const { times, values } = slice(track.times, track.values, 4, how)
      tracks.push(new QuaternionKeyframeTrack(`${bone}.quaternion`, times, values))
      continue
    }
    // Only the hips travel. A position track on any other bone would be that
    // rig's bone lengths, and writing those into this one stretches it.
    if (property !== 'position' || bone !== HIPS) continue

    const { times, values } = slice(track.times, track.values, 3, how)
    // Held after the window, not before: the drift of the whole clip is not the
    // drift of the two seconds being played, and it is the latter that decides
    // where this fighter ends up.
    const x = how.hold ? held(times, values, 0) : null
    const z = how.hold ? held(times, values, 2) : null
    const moved = new Float32Array(values.length)
    for (let i = 0; i < moved.length; i += 3) {
      const frame = i / 3
      moved[i] = rest.x + (x ? x[frame] : values[i] - hipsRest.x) * scale
      moved[i + 1] = rest.y + (values[i + 1] - hipsRest.y) * scale
      moved[i + 2] = rest.z + (z ? z[frame] : values[i + 2] - hipsRest.z) * scale
    }
    tracks.push(new VectorKeyframeTrack(`${bone}.position`, times, moved))
  }

  // A window is shorter than the clip it came out of, and the playhead is
  // fitted to the duration — so a windowed clip is measured from its own
  // tracks. A whole one keeps the file's answer, which is what the desk
  // measured and what the lab prints.
  const windowed = how.startTime !== undefined || how.endTime !== undefined
  const out = new AnimationClip(clip.name, windowed ? -1 : clip.duration, tracks)
  if (windowed && tracks.length === 0) out.duration = clip.duration
  return out
}
