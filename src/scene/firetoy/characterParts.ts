import { PropertyBinding } from 'three'

/**
 * The Firetoy wardrobe, as it exists inside the two GLB files.
 *
 * Every entry is one skinned node of `firetoy-male.glb` or
 * `firetoy-female.glb`. The node name is the only stable identifier the export
 * kept: Blender renamed every internal mesh resource to things like `Mesh.009`
 * and `Plane.017`, and glTF indices are an ordering, not a contract. So a part
 * is addressed by name, always, and never by `mesh.name` or by position.
 *
 * The catalogue is generated from the naming pattern rather than typed out.
 * 310 names entered by hand would be 310 chances to typo one, and the pattern
 * is exact: `Ib_<GENDER>_01_<Family>_<design>_<colorway>[_Left|_Right]`. What
 * cannot be generated — the anatomy pieces, and one name Firetoy shipped with
 * a full stop on the end — is listed literally below.
 *
 * Male and female are separate catalogues. The pack ships no rule for wearing
 * one gender's clothes on the other's body, and the meshes are cut for
 * different proportions.
 *
 * Source of truth: `public/models/characters/FIRETOY_ASSET_MAP.md`.
 */

export type Gender = 'male' | 'female'


/**
 * The categories you dress a character in, one choice each. These are
 * Firetoy's own technical families, not a taxonomy invented here: the pack has
 * no `jacket`, `top`, `chain` or `accessory` — anything worn on the chest is a
 * `Torso`, however much it looks like a coat.
 */
export type WearCategory =
  | 'beard'
  | 'eyebrows'
  | 'glasses'
  | 'fullbody'
  | 'hair'
  | 'hat'
  | 'mask'
  | 'headphones'
  | 'torso'
  | 'pants'
  | 'shoes'
  | 'gloves'

/**
 * Anatomy is the odd one out: it is a checklist rather than a choice. The
 * original presets switch head, eyes, lashes and bra on one at a time and
 * never pick between them, so this catalogue does not either.
 */
export type PartCategory = WearCategory | 'anatomy'

export interface CharacterPart {
  /** The exact GLB node name. The identifier for everything else. */
  node: string
  gender: Gender
  category: PartCategory
  /** Which shape within the family. Anatomy pieces have no design index. */
  design: number | null
  /** 1, 2 or 3 — the palette variant. A real, separate mesh, not a tint. */
  colorway: number | null
  /** Only gloves come in halves. */
  side: 'left' | 'right' | null
}

interface Family {
  category: WearCategory
  /** What sits between the gender prefix and the two indices. */
  stem: string
  designs: number
  /** Gloves ship as a left and a right mesh for every colorway. */
  sides?: boolean
}

/** Every family in the pack has exactly three palettes. */
const COLORWAYS = 3

const SIDES = ['left', 'right'] as const

const PREFIX: Record<Gender, string> = {
  male: 'Ib_MALE_01_',
  female: 'Ib_FEMALE_01_',
}

/**
 * Ordered as the wardrobe reads rather than as Unity serialised it: face
 * first, then the head, then the body downwards. The order decides how a
 * resolved outfit is written out, so it is worth being legible.
 */
const FAMILIES: Record<Gender, readonly Family[]> = {
  male: [
    { category: 'eyebrows', stem: 'Male_Eyebrows', designs: 11 },
    { category: 'beard', stem: 'Beard', designs: 8 },
    { category: 'glasses', stem: 'Glasses', designs: 2 },
    { category: 'mask', stem: 'Mask', designs: 2 },
    { category: 'hair', stem: 'Hair', designs: 5 },
    { category: 'hat', stem: 'Hat', designs: 4 },
    { category: 'headphones', stem: 'Headphones', designs: 1 },
    { category: 'fullbody', stem: 'Full_Body', designs: 1 },
    { category: 'torso', stem: 'Torso', designs: 5 },
    { category: 'pants', stem: 'Pants', designs: 5 },
    { category: 'shoes', stem: 'Shoes', designs: 5 },
    { category: 'gloves', stem: 'Gloves', designs: 2, sides: true },
  ],
  female: [
    { category: 'eyebrows', stem: 'Female_Eyebrows', designs: 11 },
    { category: 'glasses', stem: 'Glasses', designs: 2 },
    { category: 'mask', stem: 'Mask', designs: 2 },
    { category: 'hair', stem: 'Hair', designs: 4 },
    { category: 'hat', stem: 'Hat', designs: 4 },
    { category: 'headphones', stem: 'Headphones', designs: 1 },
    { category: 'fullbody', stem: 'Full_Body', designs: 1 },
    { category: 'torso', stem: 'Torso', designs: 5 },
    { category: 'pants', stem: 'Pants', designs: 5 },
    { category: 'shoes', stem: 'Shoes', designs: 6 },
    { category: 'gloves', stem: 'Gloves', designs: 2, sides: true },
  ],
}

/**
 * The body underneath. No design or colorway indices, and no defaults: the
 * male hands are one combined mesh while the female ones are separate, and
 * `Male_Body` / `Fem_Body` are inactive in all twenty original presets, so
 * nothing here is ever switched on by inference.
 */
const ANATOMY_PIECES: Record<Gender, readonly string[]> = {
  male: [
    'Male_Head',
    'Male_Eyes',
    'Male_Body',
    'Male_Torso',
    'Male_Underwear',
    'Male_Hands',
    'Male_Feet',
  ],
  female: [
    'Female_Head',
    'Female_Eyes',
    'Female_Eyelashes',
    'Fem_Body',
    'Female_Bra',
    'Female_Underwear',
    'Female_Left_Hand',
    'Female_Right_Hand',
    'Female_Feet',
  ],
}

/**
 * Firetoy shipped one eyebrow with a full stop on the end of its name, and it
 * survived every step: prefab, FBX GameObject and GLB node all carry it. The
 * pattern generates the tidy name, so this is where it gets untidied again.
 * Correcting it instead would address a node that does not exist.
 */
const LITERAL_NAMES: Readonly<Record<string, string>> = {
  Ib_MALE_01_Male_Eyebrows_10_1: 'Ib_MALE_01_Male_Eyebrows_10_1.',
}

function buildCatalogue(gender: Gender): readonly CharacterPart[] {
  const prefix = PREFIX[gender]
  const parts: CharacterPart[] = ANATOMY_PIECES[gender].map((stem) => ({
    node: prefix + stem,
    gender,
    category: 'anatomy' as const,
    design: null,
    colorway: null,
    side: null,
  }))

  for (const family of FAMILIES[gender]) {
    for (let design = 1; design <= family.designs; design++) {
      for (let colorway = 1; colorway <= COLORWAYS; colorway++) {
        const stem = `${prefix}${family.stem}_${design}_${colorway}`
        for (const side of family.sides ? SIDES : [null]) {
          const generated = side ? `${stem}_${side === 'left' ? 'Left' : 'Right'}` : stem
          parts.push({
            node: LITERAL_NAMES[generated] ?? generated,
            gender,
            category: family.category,
            design,
            colorway,
            side,
          })
        }
      }
    }
  }

  return parts
}

/** Every piece in each GLB: 166 male, 144 female. */
export const FIRETOY_PARTS: Record<Gender, readonly CharacterPart[]> = {
  male: buildCatalogue('male'),
  female: buildCatalogue('female'),
}

const BY_NODE: Record<Gender, Map<string, CharacterPart>> = {
  male: new Map(FIRETOY_PARTS.male.map((p) => [p.node, p])),
  female: new Map(FIRETOY_PARTS.female.map((p) => [p.node, p])),
}

/**
 * The name a node answers to once three has loaded the file.
 *
 * `GLTFLoader` runs every node name through `PropertyBinding.sanitizeNodeName`
 * before it builds the scene graph — it strips the characters an animation
 * track path would otherwise break on (`. [ ] : /`) and turns whitespace into
 * underscores. So the wardrobe's names survive intact, with one exception, and
 * so does none of the skeleton: `Arm.L` arrives as `ArmL`, and Firetoy's
 * `Ib_MALE_01_Male_Eyebrows_10_1.` arrives without its full stop.
 *
 * The catalogue keeps the names the file actually contains, because that is
 * what the asset is and what every other tool will show. This is the one place
 * that translation happens, at the moment of looking something up in a scene.
 * Neither GLB has two names that collide once sanitised, so nothing is
 * renamed further.
 */
export const loadedName = (node: string): string => PropertyBinding.sanitizeNodeName(node)

export function findPart(gender: Gender, node: string): CharacterPart | undefined {
  return BY_NODE[gender].get(node)
}

export function getPart(gender: Gender, node: string): CharacterPart {
  const part = findPart(gender, node)
  if (!part) throw new Error(`Unknown ${gender} part: ${node}`)
  return part
}

/** In catalogue order, which is the order a resolved outfit is written in. */
export function partsIn(gender: Gender, category: PartCategory): readonly CharacterPart[] {
  return FIRETOY_PARTS[gender].filter((p) => p.category === category)
}

/** How many shapes a category offers, ignoring palettes. */
export function designCount(gender: Gender, category: WearCategory): number {
  return FAMILIES[gender].find((f) => f.category === category)?.designs ?? 0
}

export const COLORWAY_COUNT = COLORWAYS

/**
 * The piece at a coordinate in the catalogue. Gloves answer with their left
 * half — the pairing rule brings the right one along.
 */
export function partAt(
  gender: Gender,
  category: WearCategory,
  design: number,
  colorway: number,
): CharacterPart | undefined {
  return FIRETOY_PARTS[gender].find(
    (p) =>
      p.category === category &&
      p.design === design &&
      p.colorway === colorway &&
      p.side !== 'right',
  )
}

/** Anatomy piece names, in catalogue order. */
export function anatomyOf(gender: Gender): readonly string[] {
  return partsIn(gender, 'anatomy').map((p) => p.node)
}

/**
 * The other half of a glove. Firetoy never wore an odd pair, and on the male
 * body it could not: the bare hands are a single mesh with both of them in it,
 * so "one glove" would mean showing a bare left hand inside the right glove.
 */
export function otherGlove(gender: Gender, node: string): string {
  const part = getPart(gender, node)
  if (part.category !== 'gloves' || part.side === null) {
    throw new Error(`Not a glove: ${node}`)
  }
  const twin = FIRETOY_PARTS[gender].find(
    (p) =>
      p.category === 'gloves' &&
      p.design === part.design &&
      p.colorway === part.colorway &&
      p.side !== part.side,
  )
  if (!twin) throw new Error(`Glove has no pair: ${node}`)
  return twin.node
}
