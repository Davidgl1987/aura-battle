import type { Material, Mesh, Object3D } from 'three'
import {
  FIRETOY_PARTS,
  type Gender,
  type WearCategory,
  findPart,
  getPart,
  loadedName,
  otherGlove,
} from './characterParts'

/**
 * An outfit is the exact set of GLB node names that should be visible.
 * Everything else in the file stays hidden.
 *
 * "None" is the absence of a name. Unity had empty GameObjects standing in for
 * the none option in each category and they were not exported, so there is no
 * mesh to show for "no hat" — there is only a hat that is not in the list.
 */
export type Outfit = readonly string[]

/**
 * An outfit being edited: one choice per category, plus anatomy as a
 * checklist. `resolveOutfit` turns it into the node list above, applying the
 * two rules the original presets are unanimous about.
 */
export interface OutfitChoice {
  /** Head, eyes, lashes, bra… switched on individually, never inferred. */
  readonly anatomy: readonly string[]
  /**
   * One node per category; absent or `null` shows nothing. `gloves` holds the
   * left glove and the pairing rule brings its right.
   */
  readonly wear: Readonly<Partial<Record<WearCategory, string | null>>>
}

export const EMPTY_CHOICE: OutfitChoice = { anatomy: [], wear: {} }

/** Fullbody is one garment covering all three, so it takes their places. */
const COVERED_BY_FULLBODY: readonly WearCategory[] = ['torso', 'pants', 'shoes']

/**
 * The node list a choice comes to.
 *
 * Two rules, and only two, because they are the only ones the asset actually
 * demonstrates: every preset wearing a Full_Body leaves torso, pants and shoes
 * empty, and every preset wearing gloves wears a matching pair. Hats and hair
 * are *not* mutually exclusive — male preset 07 wears both on purpose — and
 * nothing in the pack says glasses and a mask, or a hat and headphones, cannot
 * be worn together. Those combinations are simply untested, which is not the
 * same as forbidden.
 */
export function resolveOutfit(gender: Gender, choice: OutfitChoice): Outfit {
  const wanted = new Set<string>()

  for (const node of choice.anatomy) {
    // Called for the throw: a name that is not in this gender's catalogue is a
    // mistake worth hearing about, rather than a piece that quietly never shows.
    getPart(gender, node)
    wanted.add(node)
  }

  const covered = choice.wear.fullbody ? COVERED_BY_FULLBODY : []

  for (const [category, node] of Object.entries(choice.wear)) {
    if (!node || covered.includes(category as WearCategory)) continue
    const part = getPart(gender, node)
    wanted.add(node)
    if (part.category === 'gloves') wanted.add(otherGlove(gender, node))
  }

  // Catalogue order, so the same outfit always writes out the same way.
  return FIRETOY_ORDER[gender].filter((node) => wanted.has(node))
}

/** Read an outfit back into something editable — how a preset opens in the lab. */
export function choiceFromOutfit(gender: Gender, outfit: Outfit): OutfitChoice {
  const anatomy: string[] = []
  const wear: Partial<Record<WearCategory, string>> = {}

  for (const node of outfit) {
    const part = getPart(gender, node)
    if (part.category === 'anatomy') anatomy.push(node)
    // A pair collapses back to the left glove it was chosen by.
    else if (part.side !== 'right') wear[part.category] = node
  }

  return { anatomy, wear }
}

/** The whole wardrobe of a loaded GLB, by exact node name. */
export function indexParts(root: Object3D): Map<string, Object3D> {
  const parts = new Map<string, Object3D>()
  root.traverse((node) => {
    if ((node as { isMesh?: boolean }).isMesh) parts.set(node.name, node)
  })
  return parts
}

/**
 * Give a character its own copy of the material every piece shares.
 *
 * One material covers the whole file, and cloning a scene shares it further
 * still, so anything that paints a character — lighting one up for GOD AURA,
 * say — would paint every character wearing that body. Returns the copies,
 * which are the only ones it is safe to touch.
 */
export function ownMaterials(root: Object3D): Material[] {
  const own = new Map<Material, Material>()
  root.traverse((node) => {
    const mesh = node as Mesh
    if (!mesh.isMesh) return
    const shared = mesh.material as Material
    const mine = own.get(shared) ?? shared.clone()
    own.set(shared, mine)
    mesh.material = mine
  })
  return [...own.values()]
}

/**
 * Hide the whole wardrobe, then show exactly the outfit.
 *
 * The GLB arrives with all 166 (or 144) pieces present and visible — every
 * hat, every beard, every pair of trousers, stacked on the same skeleton. A
 * character that has not been dressed is a heap, so this always hides first.
 */
export function applyOutfit(parts: Map<string, Object3D>, outfit: Outfit): void {
  for (const part of parts.values()) part.visible = false
  for (const node of outfit) {
    const part = parts.get(loadedName(node))
    if (!part) throw new Error(`Outfit names a node the model does not have: ${node}`)
    part.visible = true
  }
}

/** True when every name belongs to this gender's catalogue. */
export function fitsGender(gender: Gender, outfit: Outfit): boolean {
  return outfit.every((node) => findPart(gender, node) !== undefined)
}

/** Anatomy first, then the wardrobe: an outfit reads from the skin outwards. */
const FIRETOY_ORDER: Record<Gender, readonly string[]> = {
  male: FIRETOY_PARTS.male.map((p) => p.node),
  female: FIRETOY_PARTS.female.map((p) => p.node),
}
