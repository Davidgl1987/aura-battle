import { Quaternion, Vector3 } from 'three'
import type { AnimationClip, Interpolant, Object3D } from 'three'
import type { Pose } from '../pose'
import { AT_REST, advance, type Handover, type Phase, type Playing } from './handover'
import { applyPose, restPose, type Rig } from './rig'

/**
 * The half of the handover that writes bones. `handover.ts` decides which
 * phase a body is in; this puts it there.
 *
 * Both blends are the same three steps, which is why there is so little here:
 *
 * 1. **Capture** what is showing, all sixty-five bones of it, on the frame the
 *    blend begins.
 * 2. **Write the target** over the whole skeleton — the clip's frame, or the
 *    rest pose with a `Pose` laid over it.
 * 3. **Pull back** toward the capture by however much of the blend is left.
 *
 * The rest pose is written first in both blends on purpose. A `Pose` touches
 * eleven joints and a clip fifty-three, so without it the fingers a clip
 * curled would still be curled once the pose system had the body back.
 *
 * **Why the clip is read rather than played.** This does not use an
 * `AnimationMixer`, and the reason is worth writing down because it cost an
 * afternoon. `PropertyMixer.apply` compares what it is about to write against
 * what it wrote last time and skips the assignment if they match — which is
 * sound when the mixer owns the skeleton, and wrong here, because step 3
 * moves those same bones behind its back. During a blend in, the playhead is
 * pinned to the clip's first frame, so the mixer wrote it once and then went
 * quiet: every frame after that blended toward the *rest* pose instead of the
 * clip, and the body snapped 51° into place the moment the playhead moved.
 * Reading the tracks directly is fewer moving parts than working around that,
 * and it is the same interpolants the mixer would have used.
 */

interface Channel {
  bone: Object3D
  /** Quaternions are the whole clip bar one: only the hips travel. */
  rotates: boolean
  at: Interpolant
}

export interface ClipPlayer {
  /** Write the body for this frame, from the clip, the pose, or both. */
  frame(now: number, playing: Playing | null, pose: Pose): void
}

export function makeClipPlayer(rig: Rig, clip: AnimationClip): ClipPlayer {
  const bones = new Map(rig.rest.map((r) => [r.bone.name, r.bone]))

  // Bound once. A track whose bone this body does not have is dropped here
  // rather than checked for sixty times a second.
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

  // What was showing when the current blend began.
  const held = rig.rest.map(() => ({ quaternion: new Quaternion(), position: new Vector3() }))
  const heldScale = new Vector3(1, 1, 1)
  let state: Handover = AT_REST
  let previous: Phase = 'pose'

  const capture = () => {
    for (let i = 0; i < rig.rest.length; i++) {
      held[i].quaternion.copy(rig.rest[i].bone.quaternion)
      held[i].position.copy(rig.rest[i].bone.position)
    }
    heldScale.copy(rig.root.scale)
  }

  /** The clip, at this instant, straight onto the skeleton. */
  const writeClip = (time: number) => {
    for (const channel of channels) {
      const value = channel.at.evaluate(time)
      if (channel.rotates) channel.bone.quaternion.fromArray(value)
      else channel.bone.position.fromArray(value)
    }
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
      if (fresh) capture()
      const was = previous

      previous = phase

      switch (phase) {
        case 'pose':
          // The fifty-four joints a pose leaves alone are already at rest: a
          // blend out is what put them there — bar the last fraction of a
          // per cent it stopped short of, which is what this clears. Without
          // it a finger stays a tenth of a degree into the clip for good.
          if (was === 'out') restPose(rig)
          applyPose(rig, pose)
          return
        case 'clip':
          writeClip(clipTime)
          return
        case 'in':
          restPose(rig)
          writeClip(clipTime)
          towardHeld(1 - k)
          return
        case 'out':
          restPose(rig)
          applyPose(rig, pose)
          towardHeld(1 - k)
      }
    },
  }
}
