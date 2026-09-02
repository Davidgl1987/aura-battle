import { describe, expect, it } from 'vitest'
import { BufferGeometry, Bone, Group, MeshBasicMaterial, Skeleton, SkinnedMesh } from 'three'
import type { Object3D } from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { FIRETOY_PARTS, type Gender, loadedName } from './characterParts'
import { FIRETOY_PRESETS } from './characterPresets'
import {
  applyOutfit,
  choiceFromOutfit,
  fitsGender,
  indexParts,
  ownMaterials,
  resolveOutfit,
} from './outfit'

/**
 * A stand-in for a loaded GLB: one armature, one skeleton, and every piece of
 * the catalogue hanging off it as a visible skinned mesh. That is how the real
 * file arrives — the whole wardrobe on at once.
 *
 * Named the way the loader names things, not the way the file does, which for
 * one eyebrow is not the same thing.
 */
function fakeModel(gender: Gender): Object3D {
  const armature = new Group()
  armature.name = 'Armature'
  const hips = new Bone()
  hips.name = 'Hips'
  armature.add(hips)
  const skeleton = new Skeleton([hips])
  // One material for the whole wardrobe, the way the real file ships.
  const atlas = new MeshBasicMaterial()

  for (const part of FIRETOY_PARTS[gender]) {
    const mesh = new SkinnedMesh(new BufferGeometry(), atlas)
    mesh.name = loadedName(part.node)
    armature.add(mesh)
    mesh.bind(skeleton)
  }
  return armature
}

const visibleIn = (root: Object3D): string[] => {
  const shown: string[] = []
  root.traverse((n) => {
    if ((n as { isMesh?: boolean }).isMesh && n.visible) shown.push(n.name)
  })
  return shown.sort()
}

describe('resolving a choice into nodes', () => {
  it('shows nothing for a category left empty', () => {
    // "None" is the absence of a node. Unity's empty stand-in objects were
    // never exported, so there is no such thing as a mesh called no-hat.
    expect(resolveOutfit('male', { anatomy: [], wear: {} })).toEqual([])
    expect(resolveOutfit('male', { anatomy: [], wear: { hat: null } })).toEqual([])
  })

  it('brings the other glove with it', () => {
    const outfit = resolveOutfit('male', {
      anatomy: [],
      wear: { gloves: 'Ib_MALE_01_Gloves_2_3_Left' },
    })
    expect(outfit).toEqual(['Ib_MALE_01_Gloves_2_3_Left', 'Ib_MALE_01_Gloves_2_3_Right'])
  })

  it('pairs from either half', () => {
    expect(
      resolveOutfit('female', { anatomy: [], wear: { gloves: 'Ib_FEMALE_01_Gloves_1_2_Right' } }),
    ).toEqual(['Ib_FEMALE_01_Gloves_1_2_Left', 'Ib_FEMALE_01_Gloves_1_2_Right'])
  })

  it('lets a full body take the place of torso, trousers and shoes', () => {
    const outfit = resolveOutfit('male', {
      anatomy: [],
      wear: {
        fullbody: 'Ib_MALE_01_Full_Body_1_2',
        torso: 'Ib_MALE_01_Torso_1_1',
        pants: 'Ib_MALE_01_Pants_1_1',
        shoes: 'Ib_MALE_01_Shoes_1_1',
        hat: 'Ib_MALE_01_Hat_1_1',
      },
    })
    expect(outfit).toEqual(['Ib_MALE_01_Hat_1_1', 'Ib_MALE_01_Full_Body_1_2'])
  })

  it('gives the three back when the full body comes off', () => {
    const wear = {
      torso: 'Ib_MALE_01_Torso_1_1',
      pants: 'Ib_MALE_01_Pants_1_1',
      shoes: 'Ib_MALE_01_Shoes_1_1',
    }
    expect(resolveOutfit('male', { anatomy: [], wear })).toHaveLength(3)
  })

  it('keeps hair and a hat together when both are chosen', () => {
    // Male 07 wears both, so the rule the presets mostly follow is a habit,
    // not a constraint, and this is not the place to enforce it.
    const outfit = resolveOutfit('male', {
      anatomy: [],
      wear: { hair: 'Ib_MALE_01_Hair_4_1', hat: 'Ib_MALE_01_Hat_3_2' },
    })
    expect(outfit).toHaveLength(2)
  })

  it('leaves glasses with a mask, and a hat with headphones', () => {
    // Nothing in the pack forbids either. Untested is not the same as invalid.
    expect(
      resolveOutfit('female', {
        anatomy: [],
        wear: {
          glasses: 'Ib_FEMALE_01_Glasses_1_1',
          mask: 'Ib_FEMALE_01_Mask_1_1',
          hat: 'Ib_FEMALE_01_Hat_1_1',
          headphones: 'Ib_FEMALE_01_Headphones_1_1',
        },
      }),
    ).toHaveLength(4)
  })

  it('switches anatomy on one piece at a time', () => {
    const outfit = resolveOutfit('female', {
      anatomy: ['Ib_FEMALE_01_Female_Head', 'Ib_FEMALE_01_Female_Bra'],
      wear: {},
    })
    expect(outfit).toEqual(['Ib_FEMALE_01_Female_Head', 'Ib_FEMALE_01_Female_Bra'])
    // Nothing arrives uninvited: no eyes, no body, no hands.
    expect(outfit).not.toContain('Ib_FEMALE_01_Female_Eyes')
    expect(outfit).not.toContain('Ib_FEMALE_01_Fem_Body')
  })

  it('writes an outfit out in catalogue order however it was chosen', () => {
    const wear = { shoes: 'Ib_MALE_01_Shoes_1_1', hat: 'Ib_MALE_01_Hat_1_1' }
    expect(resolveOutfit('male', { anatomy: ['Ib_MALE_01_Male_Head'], wear })).toEqual([
      'Ib_MALE_01_Male_Head',
      'Ib_MALE_01_Hat_1_1',
      'Ib_MALE_01_Shoes_1_1',
    ])
  })

  it('refuses a piece from the other wardrobe', () => {
    expect(() =>
      resolveOutfit('male', { anatomy: [], wear: { hair: 'Ib_FEMALE_01_Hair_1_1' } }),
    ).toThrow(/Unknown male part/)
    expect(fitsGender('male', FIRETOY_PRESETS.female01)).toBe(false)
    expect(fitsGender('female', FIRETOY_PRESETS.female01)).toBe(true)
  })
})

describe('reading an outfit back', () => {
  it('collapses a pair of gloves to one choice', () => {
    const choice = choiceFromOutfit('male', FIRETOY_PRESETS.male01)
    expect(choice.wear.gloves).toBe('Ib_MALE_01_Gloves_1_1_Left')
    expect(choice.anatomy).toEqual(['Ib_MALE_01_Male_Head', 'Ib_MALE_01_Male_Eyes'])
    expect(choice.wear.hat).toBeUndefined()
  })
})

describe('dressing a model', () => {
  it('hides the whole wardrobe before showing the outfit', () => {
    const model = fakeModel('male')
    const parts = indexParts(model)
    expect(parts.size).toBe(166)
    expect(visibleIn(model)).toHaveLength(166)

    applyOutfit(parts, FIRETOY_PRESETS.male03)
    expect(visibleIn(model)).toEqual([...FIRETOY_PRESETS.male03].sort())
  })

  it('leaves nothing behind when the outfit changes', () => {
    const model = fakeModel('male')
    const parts = indexParts(model)
    applyOutfit(parts, FIRETOY_PRESETS.male03)
    applyOutfit(parts, FIRETOY_PRESETS.male09)
    expect(visibleIn(model)).toEqual([...FIRETOY_PRESETS.male09].map(loadedName).sort())
  })

  it('says so when an outfit names a node the model has not got', () => {
    const parts = indexParts(fakeModel('male'))
    expect(() => applyOutfit(parts, ['Ib_MALE_01_Nonsense_1_1'])).toThrow(
      /does not have: Ib_MALE_01_Nonsense_1_1/,
    )
  })

  /**
   * The catalogue keeps the name the file carries, full stop and all, and the
   * loader is the one that drops it. Asking for the piece by the name Firetoy
   * gave it still has to find the node three built.
   */
  it('finds the eyebrow with the full stop through the loader\'s name', () => {
    const model = fakeModel('male')
    const parts = indexParts(model)
    expect(parts.has('Ib_MALE_01_Male_Eyebrows_10_1.')).toBe(false)

    applyOutfit(parts, ['Ib_MALE_01_Male_Eyebrows_10_1.'])
    expect(visibleIn(model)).toEqual(['Ib_MALE_01_Male_Eyebrows_10_1'])
  })

  it('leaves every other name alone', () => {
    // 310 pieces and exactly one of them is renamed on the way in.
    for (const gender of ['male', 'female'] as const) {
      const renamed = FIRETOY_PARTS[gender].filter((p) => loadedName(p.node) !== p.node)
      expect(renamed.map((p) => p.node)).toEqual(
        gender === 'male' ? ['Ib_MALE_01_Male_Eyebrows_10_1.'] : [],
      )
    }
  })

})

/**
 * The reason every character gets its own clone. `useGLTF` hands the same
 * scene object to everyone who asks for the file, so dressing that scene would
 * dress every character in the game — and the second one on stage would
 * silently undress the first.
 */
describe('two characters at once', () => {
  it('keeps different outfits without touching each other or the source', () => {
    const source = fakeModel('male')

    const first = cloneSkinned(source)
    const second = cloneSkinned(source)
    applyOutfit(indexParts(first), FIRETOY_PRESETS.male01)
    applyOutfit(indexParts(second), FIRETOY_PRESETS.male07)

    expect(visibleIn(first)).toEqual([...FIRETOY_PRESETS.male01].sort())
    expect(visibleIn(second)).toEqual([...FIRETOY_PRESETS.male07].sort())
    // The cached scene is still the untouched heap it arrived as.
    expect(visibleIn(source)).toHaveLength(166)
  })

  it('gives each clone its own skeleton to be posed by', () => {
    const source = fakeModel('female')
    const first = cloneSkinned(source)
    const second = cloneSkinned(source)

    const boneOf = (root: Object3D) => root.getObjectByName('Hips')!
    expect(boneOf(first)).not.toBe(boneOf(second))
    expect(boneOf(first)).not.toBe(boneOf(source))

    boneOf(first).rotation.y = 1
    expect(boneOf(second).rotation.y).toBe(0)
    expect(boneOf(source).rotation.y).toBe(0)
  })

  it('gives each clone its own material to be lit by', () => {
    // Every piece of a file shares one material and cloning shares it on, so
    // GOD AURA on one fighter would light up the other one too.
    const source = fakeModel('male')
    const first = cloneSkinned(source)
    const second = cloneSkinned(source)
    const mine = ownMaterials(first)
    const theirs = ownMaterials(second)

    expect(mine).toHaveLength(1)
    expect(mine[0]).not.toBe(theirs[0])

    const name = FIRETOY_PRESETS.male01[0]
    const materialOf = (root: Object3D) => (root.getObjectByName(name) as SkinnedMesh).material
    expect(materialOf(first)).toBe(mine[0])
    expect(materialOf(second)).toBe(theirs[0])
    // And the cached scene keeps the one it arrived with.
    expect(materialOf(source)).not.toBe(mine[0])
  })

  it('shares geometry between clones rather than copying it', () => {
    // Cloning is about the skeleton and the node tree; the buffers stay put,
    // which is what makes a second character on stage nearly free. Materials
    // are the exception, and `ownMaterials` above is why.
    const source = fakeModel('male')
    const clone = cloneSkinned(source)
    const name = FIRETOY_PRESETS.male01[0]
    const from = (root: Object3D) => root.getObjectByName(name) as SkinnedMesh
    expect(from(clone).geometry).toBe(from(source).geometry)
  })
})
