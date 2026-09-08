import { describe, expect, it } from 'vitest'
import { Bone, Group, Vector3 } from 'three'
import { pose } from '../pose'
import { loadedName } from './characterParts'
import { applyPose, makeRig, restPose } from './rig'

/**
 * The joints a `Pose` drives, plus one it does not. A clip moves fifty-two
 * bones and a pose moves eleven, so the interesting bone in this armature is
 * the finger: nothing in `applyPose` will ever put it back.
 */
const POSED = [
  'Hips',
  'Spine',
  'Spine1',
  'Spine2',
  'Head',
  'Arm.L',
  'Arm.R',
  'ForeArm.L',
  'ForeArm.R',
  'UpLeg.L',
  'UpLeg.R',
]

function fakeArmature() {
  const armature = new Group()
  armature.name = 'Armature'
  for (const name of [...POSED, 'HandIndex1.L']) {
    const bone = new Bone()
    bone.name = loadedName(name)
    // Something other than the identity, so "back to rest" means something.
    bone.quaternion.setFromAxisAngle(new Vector3(0, 1, 0), 0.3)
    bone.position.set(0, 0.2, 0)
    armature.add(bone)
  }
  return armature
}

describe('putting a body back', () => {
  it('remembers every bone, not only the ones a pose drives', () => {
    const rig = makeRig(fakeArmature())!
    expect(rig.rest.map((r) => r.bone.name)).toContain('HandIndex1L')
    expect(rig.rest).toHaveLength(POSED.length + 1)
  })

  it('undoes a pose, a clip and the squash between them', () => {
    const armature = fakeArmature()
    const rig = makeRig(armature)!
    const before = rig.rest.map((r) => ({
      quaternion: r.bone.quaternion.clone(),
      position: r.bone.position.clone(),
    }))

    applyPose(rig, pose({ armRaiseL: 1.2, y: 0.4, squash: 1.3 }))
    // And a bone no pose touches, the way an imported clip would leave it.
    const finger = armature.getObjectByName('HandIndex1L')!
    finger.quaternion.setFromAxisAngle(new Vector3(1, 0, 0), 1)
    expect(rig.root.scale.y).not.toBe(1)

    restPose(rig)

    rig.rest.forEach((r, i) => {
      expect(r.bone.quaternion.angleTo(before[i].quaternion)).toBeCloseTo(0)
      expect(r.bone.position.distanceTo(before[i].position)).toBeCloseTo(0)
    })
    expect(rig.root.scale.toArray()).toEqual([1, 1, 1])
  })

  it('has the hips back where the file put them, not only their height', () => {
    const rig = makeRig(fakeArmature())!
    rig.joints.Hips.bone.position.set(0.3, 2, -0.4)

    applyPose(rig, pose({}))

    expect(rig.joints.Hips.bone.position.toArray()).toEqual(rig.hipsRest.toArray())
  })
})
