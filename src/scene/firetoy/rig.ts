import { Euler, Quaternion, Vector3 } from 'three'
import type { Object3D } from 'three'
import type { Pose } from '../pose'
import { loadedName } from './characterParts'

/**
 * One probe, to answer a single question: can the fifteen numbers the game
 * already animates with drive the Firetoy skeleton?
 *
 * The game's poses were written for the primitive fighters, whose arms are
 * groups hanging straight down from a shoulder with no rotation of their own.
 * The Firetoy rig is a Blender human: every bone points along its own local
 * +Y toward its child, the shoulders sit at odd angles, and the arms rest in
 * an A-pose about 39° out from vertical. So a pose value cannot be written
 * into a bone's rotation directly — it has to be applied *on top of* the rest
 * pose, about the axes the pose meant, which are the body's, not the bone's.
 *
 * That is what this does, and it is the whole of the retargeting: a rotation
 * expressed in the parent's world frame, laid over the bone's rest rotation.
 *
 *     q_local = P⁻¹ · Δ · P · q_rest        (P = parent's world rotation)
 *
 * Findings are written up in `docs/firetoy.md`.
 */

const SPINE = ['Spine', 'Spine1', 'Spine2'] as const

const BONES = [
  'Hips',
  ...SPINE,
  'Head',
  'Arm.L',
  'Arm.R',
  'ForeArm.L',
  'ForeArm.R',
  'UpLeg.L',
  'UpLeg.R',
] as const

type BoneName = (typeof BONES)[number]

interface Joint {
  bone: Object3D
  rest: Quaternion
}

export interface Rig {
  /** The armature, scaled for squash and stretch. */
  root: Object3D
  joints: Record<BoneName, Joint>
  hipsRestY: number
  /**
   * How far the arms already hang out to the side, in radians. Measured from
   * the rig rather than assumed, and subtracted from every raise: without it
   * an armRaise of 0.9 lands 39° wider than the move was drawn, and hands
   * meant for the jawline end up out at shoulder height.
   */
  aPose: number
}

/** Null when the model is not a Firetoy skeleton — nothing to drive. */
export function makeRig(root: Object3D): Rig | null {
  const joints = {} as Record<BoneName, Joint>
  for (const name of BONES) {
    // `Arm.L` in the file, `ArmL` once three has loaded it.
    const bone = root.getObjectByName(loadedName(name))
    if (!bone) return null
    joints[name] = { bone, rest: bone.quaternion.clone() }
  }

  root.updateWorldMatrix(false, true)
  // The arm bone's own +Y is the direction the arm points at rest.
  const arm = new Vector3(0, 1, 0).transformDirection(joints['Arm.L'].bone.matrixWorld)
  const aPose = Math.atan2(Math.abs(arm.x), Math.max(0, -arm.y))

  return { root, joints, hipsRestY: joints.Hips.bone.position.y, aPose }
}

const parentWorld = new Quaternion()
const inverseParent = new Quaternion()
const delta = new Quaternion()
const spin = new Euler()

/** A rotation in the parent's frame, laid over the bone's rest pose. */
function twist(joint: Joint, x: number, y: number, z: number): void {
  joint.bone.parent?.getWorldQuaternion(parentWorld)
  inverseParent.copy(parentWorld).invert()
  delta.setFromEuler(spin.set(x, y, z))
  joint.bone.quaternion
    .copy(inverseParent)
    .multiply(delta)
    .multiply(parentWorld)
    .multiply(joint.rest)
}

const hinge = new Quaternion()
const ELBOW_AXIS = new Vector3(0, 0, 1)

/**
 * The elbow is the one joint that cannot use a body axis: once the arm is
 * raised, "bend forward" is only meaningful in the forearm's own frame. Its
 * local Z is the hinge, and the two arms are mirrored, so the right one folds
 * the other way.
 */
function fold(joint: Joint, angle: number): void {
  hinge.setFromAxisAngle(ELBOW_AXIS, angle)
  joint.bone.quaternion.copy(joint.rest).multiply(hinge)
}

/** Write a pose onto the skeleton. Same fifteen numbers, same meanings. */
export function applyPose(rig: Rig, pose: Pose): void {
  const { joints } = rig

  joints.Hips.bone.position.y = rig.hipsRestY + pose.y
  twist(joints.Hips, 0, pose.turn, 0)

  // Spread across the three spine bones so the torso bends rather than hinges.
  for (const name of SPINE) twist(joints[name], pose.lean / 3, 0, pose.tilt / 3)

  twist(joints.Head, pose.headPitch, pose.headYaw, 0)

  twist(joints['Arm.L'], -pose.armSwingL, 0, pose.armRaiseL - rig.aPose)
  twist(joints['Arm.R'], -pose.armSwingR, 0, -(pose.armRaiseR - rig.aPose))
  fold(joints['ForeArm.L'], pose.elbowL)
  fold(joints['ForeArm.R'], -pose.elbowR)

  twist(joints['UpLeg.L'], -pose.legL, 0, 0)
  twist(joints['UpLeg.R'], -pose.legR, 0, 0)

  // Squash keeps volume, so a flattened fighter spreads sideways.
  const spread = 1 / Math.sqrt(pose.squash)
  rig.root.scale.set(spread, pose.squash, spread)
}
