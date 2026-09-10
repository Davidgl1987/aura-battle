import { Quaternion, Vector3 } from 'three'
import type { AnimationClip, Interpolant, Object3D } from 'three'
import type { Pose } from '../pose'
import { AT_REST, advance, type Handover, type Playing } from './handover'
import { applyPose, restPose, type Rig } from './rig'

/**
 * The half of the handover that writes bones. `handover.ts` decides which phase
 * a body is in; this puts it there.
 *
 * **One rule, and everything else follows from it: the base is written first,
 * every frame, over the whole skeleton.** The base is `neutral-idle` — the
 * fighter standing there breathing — so a bone nobody else has an opinion about
 * is idling rather than holding whatever it was left at. A performed clip is
 * written over the top of that, and faded in and out against it.
 *
 * This is the fix for a fighter who froze mid-gesture, and it is worth writing
 * down because the failure was invisible from the code. The base used to be the
 * rest pose plus a `Pose`, and a `Pose` is eleven joints. The other fifty-four —
 * every finger, both feet, the neck — were written once, on the frame a blend
 * out finished, and then never again. Any action that arrived without a clip
 * of its own (a GOOD is a nod; a wind-up is 400 ms) left them exactly where the
 * last clip had put them, for as long as that action lasted.
 *
 * The three writes, in order:
 *
 * 1. **The base**: the rig's own pose, and the resting clip over it. All
 *    sixty-five bones. Always.
 * 2. **Whatever is being performed**, eased against what was showing when the
 *    blend began — the clip this player was built around, or, for an action
 *    that has none, the `Pose` it carries instead. A wind-up is 400 ms and a
 *    GOOD is a nod, and neither has a clip; a body whose file never arrived has
 *    none either. All three go through the same blend as a clip, so none of
 *    them can appear or vanish on a single frame.
 *
 * **Why the clip is read rather than played.** This does not use an
 * `AnimationMixer`, and the reason is worth writing down because it cost an
 * afternoon. `PropertyMixer.apply` compares what it is about to write against
 * what it wrote last time and skips the assignment if they match — which is
 * sound when the mixer owns the skeleton, and wrong here, because step 3 moves
 * those same bones behind its back. During a blend in, the playhead is pinned
 * to the clip's first frame, so the mixer wrote it once and then went quiet:
 * every frame after that blended toward the *rest* pose instead of the clip,
 * and the body snapped 51° into place the moment the playhead moved. Reading
 * the tracks directly is fewer moving parts than working around that, and it is
 * the same interpolants the mixer would have used.
 */

interface Channel {
  bone: Object3D
  /** Quaternions are the whole clip bar one: only the hips travel. */
  rotates: boolean
  at: Interpolant
}

export interface ClipPlayer {
  /** Write the body for this frame, from the base, the clip, the pose, or all three. */
  frame(now: number, playing: Playing | null, pose: Pose): void
}

/**
 * Bind a clip's tracks to this body's bones. A track whose bone this body does
 * not have is dropped here rather than checked for sixty times a second.
 */
function bind(rig: Rig, clip: AnimationClip): Channel[] {
  const bones = new Map(rig.rest.map((r) => [r.bone.name, r.bone]))
  const channels: Channel[] = []
  for (const track of clip.tracks) {
    const cut = track.name.lastIndexOf('.')
    const bone = bones.get(track.name.slice(0, cut))
    // Linear, because that is what the retarget builds — and for a rotation
    // three's linear interpolant is a slerp, which is what a bone wants.
    if (bone) {
      channels.push({
        bone,
        rotates: track.name.slice(cut + 1) === 'quaternion',
        at: track.InterpolantFactoryMethodLinear(),
      })
    }
  }
  return channels
}

/**
 * `base` is the fighter's resting animation, and the only argument that may be
 * null: on a clone without the licensed clips there is nothing to rest in, and
 * the rig's own pose stands in for it, which is what the game did before any of
 * these files existed.
 *
 * `restPhaseMs` shifts the base's playhead. Two fighters handed the same clock
 * breathe in unison, which reads as a chorus line rather than two people
 * waiting.
 */
export function makeClipPlayer(
  rig: Rig,
  clip: AnimationClip | null,
  base: AnimationClip | null,
  restPhaseMs = 0,
): ClipPlayer {
  const channels = clip ? bind(rig, clip) : []
  const baseChannels = base ? bind(rig, base) : []

  // What was showing when the current blend began.
  const held = rig.rest.map(() => ({ quaternion: new Quaternion(), position: new Vector3() }))
  const heldScale = new Vector3(1, 1, 1)
  let state: Handover = AT_REST

  const capture = () => {
    for (let i = 0; i < rig.rest.length; i++) {
      held[i].quaternion.copy(rig.rest[i].bone.quaternion)
      held[i].position.copy(rig.rest[i].bone.position)
    }
    heldScale.copy(rig.root.scale)
  }

  const write = (from: readonly Channel[], time: number) => {
    for (const channel of from) {
      const value = channel.at.evaluate(time)
      if (channel.rotates) channel.bone.quaternion.fromArray(value)
      else channel.bone.position.fromArray(value)
    }
  }

  /**
   * Standing there, on a loop of its own that nothing ever interrupts.
   *
   * The rig's own pose goes down first, every time, and the resting clip over
   * it. That is two writes where one would nearly do, and the "nearly" is the
   * point: a clip names fifty-two bones and a body has sixty-five, so anything
   * the resting animation has no track for — the leaf tips, and every bone at
   * all on a clone that has not downloaded it — would otherwise be owned by
   * whatever last happened to touch it. This way the floor is absolute and
   * nothing above it has to be careful.
   */
  const writeBase = (now: number) => {
    restPose(rig)
    if (!base) return
    const seconds = (now + restPhaseMs) / 1000
    write(baseChannels, ((seconds % base.duration) + base.duration) % base.duration)
  }

  /** Every bone, so that a hand blends as carefully as an arm does. */
  const towardHeld = (amount: number) => {
    if (amount <= 0) return
    for (let i = 0; i < rig.rest.length; i++) {
      rig.rest[i].bone.quaternion.slerp(held[i].quaternion, amount)
      rig.rest[i].bone.position.lerp(held[i].position, amount)
    }
    rig.root.scale.lerp(heldScale, amount)
  }

  return {
    frame(now, playing, pose) {
      const next = advance(state, playing, now)
      state = next.state
      const { phase, k, clipTime, capture: fresh } = next.frame

      // Before anything overwrites it: a blend eases from the frame that was
      // actually on screen, whatever put it there.
      if (fresh) capture()

      writeBase(now)
      // Whatever is being performed, if anything: the clip this player was
      // built around, or the pose, for the wind-up and a GOOD and any body
      // whose clip file never arrived. The two are the same job, which is why
      // they take the same blend and the same ending.
      if (phase === 'in' || phase === 'clip') {
        if (channels.length > 0) write(channels, clipTime)
        else applyPose(rig, pose)
      }
      if (phase === 'in' || phase === 'out') towardHeld(1 - k)
    },
  }
}
