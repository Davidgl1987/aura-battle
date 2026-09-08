import { describe, expect, it } from 'vitest'
import {
  AnimationClip,
  Bone,
  Group,
  type KeyframeTrack,
  QuaternionKeyframeTrack,
  Vector3,
  VectorKeyframeTrack,
} from 'three'
import { firetoyBone, readMixamo, retargetToFiretoy } from './mocap'

/**
 * The Mixamo skeleton, in the order the exporter writes it. Sixty-five joints,
 * the same sixty-five Firetoy's bodies are rigged with — which is the whole
 * reason the retarget is a rename. Written out here because it is a fixed
 * outside contract: every clip the site exports arrives with these names, and
 * a mapping that stops covering them is the failure this file is here to catch.
 */
const MIXAMO_BONES = [
  'Hips',
  'Spine',
  'Spine1',
  'Spine2',
  'Neck',
  'Head',
  'HeadTop_End',
  ...['Left', 'Right'].flatMap((side) => [
    `${side}Shoulder`,
    `${side}Arm`,
    `${side}ForeArm`,
    `${side}Hand`,
    ...['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'].flatMap((finger) =>
      [1, 2, 3, 4].map((joint) => `${side}Hand${finger}${joint}`),
    ),
  ]),
  ...['Left', 'Right'].flatMap((side) => [
    `${side}UpLeg`,
    `${side}Leg`,
    `${side}Foot`,
    `${side}ToeBase`,
    `${side}Toe_End`,
  ]),
].map((bone) => `mixamorig${bone}`)

describe('the name rule', () => {
  it('covers the whole Mixamo skeleton, one bone each', () => {
    expect(MIXAMO_BONES).toHaveLength(65)
    const mapped = MIXAMO_BONES.map(firetoyBone)
    expect(mapped.filter((name) => name === null)).toEqual([])
    expect(new Set(mapped).size).toBe(65)
  })

  it('moves the side from the front to the back', () => {
    expect(firetoyBone('mixamorigLeftHandThumb1')).toBe('HandThumb1L')
    expect(firetoyBone('mixamorigRightToe_End')).toBe('Toe_EndR')
    expect(firetoyBone('mixamorigLeftUpLeg')).toBe('UpLegL')
  })

  it('leaves an unsided bone alone', () => {
    expect(firetoyBone('mixamorigHips')).toBe('Hips')
    expect(firetoyBone('mixamorigHeadTop_End')).toBe('HeadTop_End')
  })

  /**
   * The dot is what a loaded scene has already lost, and a track that kept it
   * would not merely miss: three reads `Arm.L.quaternion` as node `Arm`,
   * property `L`.
   */
  it('names bones the way a loaded scene does, not the way the file does', () => {
    for (const name of MIXAMO_BONES.map(firetoyBone)) {
      expect(name).not.toContain('.')
      expect(name).not.toContain(':')
    }
  })

  it('takes the colon, in case the loader has not', () => {
    expect(firetoyBone('mixamorig:LeftForeArm')).toBe('ForeArmL')
  })

  it('does not answer for anything that is not a bone of that rig', () => {
    expect(firetoyBone('Armature')).toBeNull()
    expect(firetoyBone('Hips')).toBeNull()
  })
})

/** One frame is enough for everything the retarget does to a track. */
const HIPS_REST = new Vector3(0, 100, 0)

function sourceClip(...tracks: KeyframeTrack[]) {
  return { clip: new AnimationClip('mixamo.com', 2, tracks), hipsRest: HIPS_REST.clone() }
}

const quaternions = (name: string) =>
  new QuaternionKeyframeTrack(`${name}.quaternion`, [0, 1], [0, 0, 0, 1, 0, 0.7, 0, 0.7])

describe('retargeting a clip', () => {
  const target = new Vector3(0, 90, -3)

  it('renames every rotation and keeps the timing', () => {
    const out = retargetToFiretoy(
      sourceClip(quaternions('mixamorigLeftArm'), quaternions('mixamorigSpine1')),
      target,
    )
    expect(out.tracks.map((t) => t.name)).toEqual(['ArmL.quaternion', 'Spine1.quaternion'])
    expect(out.duration).toBe(2)
    expect(out.name).toBe('mixamo.com')
  })

  /**
   * Shared, not copied: nothing here or in the mixer writes to a track, so two
   * characters playing the same clip hold one set of keyframes between them.
   */
  it('hands rotations on by reference', () => {
    const track = quaternions('mixamorigHead')
    const out = retargetToFiretoy(sourceClip(track), target)
    expect(out.tracks[0].values).toBe(track.values)
    expect(out.tracks[0].times).toBe(track.times)
  })

  it('drops what is not a bone of the source rig', () => {
    const out = retargetToFiretoy(sourceClip(quaternions('Armature')), target)
    expect(out.tracks).toEqual([])
  })

  it('scales the hips travel to the legs that carry it', () => {
    const out = retargetToFiretoy(
      sourceClip(
        new VectorKeyframeTrack('mixamorigHips.position', [0, 1], [0, 100, 0, 2, 110, -4]),
      ),
      target,
    )
    // 90/100: the centimetres and the shorter legs are the same one ratio.
    expect(out.tracks[0].name).toBe('Hips.position')
    // Rounded because a keyframe track holds 32-bit floats.
    const landed = [...out.tracks[0].values].map((v) => Number(v.toFixed(4)))
    expect(landed).toEqual([0, 90, -3, 1.8, 99, -6.6])
  })

  /**
   * Only the hips travel. Any other bone's position track is that rig's bone
   * lengths, and writing those into this one stretches it.
   */
  it('drops a position track on any other bone', () => {
    const out = retargetToFiretoy(
      sourceClip(new VectorKeyframeTrack('mixamorigLeftHand.position', [0], [1, 2, 3])),
      target,
    )
    expect(out.tracks).toEqual([])
  })
})

describe('reading a parsed FBX', () => {
  function fakeFbx({ hips = true, clip = true } = {}) {
    const group = new Group()
    if (hips) {
      const bone = new Bone()
      bone.name = 'mixamorigHips'
      bone.position.set(0, 104.27, 0)
      group.add(bone)
    }
    if (clip) group.animations = [new AnimationClip('mixamo.com', 2, [quaternions('mixamorigHead')])]
    return group
  }

  it('takes the clip and the rest the clip is measured against', () => {
    const source = readMixamo(fakeFbx())
    expect(source?.clip.name).toBe('mixamo.com')
    expect(source?.hipsRest.y).toBeCloseTo(104.27)
  })

  it('is null for a file that is not a Mixamo clip', () => {
    expect(readMixamo(fakeFbx({ clip: false }))).toBeNull()
    expect(readMixamo(fakeFbx({ hips: false }))).toBeNull()
  })
})
