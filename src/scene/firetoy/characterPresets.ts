import type { Outfit } from './outfit'

/**
 * The twenty characters Firetoy actually built, as the exact list of nodes
 * each of their prefabs switches on.
 *
 * These are transcriptions, not reconstructions. Where a preset does something
 * that looks like a mistake it is kept: male 05, 08 and 09 wear no eyes, male
 * 07 wears hair *and* a hat, female 01 wears a bra under a torso. The asset map
 * could not tell whether those were choices or oversights, and guessing would
 * mean shipping a character Firetoy never drew.
 *
 * Nothing is inferred. No preset activates `Male_Body` or `Fem_Body`, so
 * neither appears here; no preset wearing a Full_Body also wears a torso, so
 * none of them do here either.
 */

const male = (...pieces: string[]): Outfit =>
  Object.freeze(pieces.map((piece) => `Ib_MALE_01_${piece}`))

const female = (...pieces: string[]): Outfit =>
  Object.freeze(pieces.map((piece) => `Ib_FEMALE_01_${piece}`))

export type PresetId =
  | 'male01'
  | 'male02'
  | 'male03'
  | 'male04'
  | 'male05'
  | 'male06'
  | 'male07'
  | 'male08'
  | 'male09'
  | 'male10'
  | 'female01'
  | 'female02'
  | 'female03'
  | 'female04'
  | 'female05'
  | 'female06'
  | 'female07'
  | 'female08'
  | 'female09'
  | 'female10'

export const FIRETOY_PRESETS: Record<PresetId, Outfit> = {
  male01: male(
    'Male_Head',
    'Male_Eyes',
    'Male_Eyebrows_1_1',
    'Beard_1_1',
    'Hair_1_1',
    'Glasses_1_1',
    'Headphones_1_1',
    'Full_Body_1_1',
    'Gloves_1_1_Left',
    'Gloves_1_1_Right',
  ),
  male02: male(
    'Male_Head',
    'Male_Eyes',
    'Male_Eyebrows_2_1',
    'Beard_2_2',
    'Hair_2_2',
    'Headphones_1_3',
    'Full_Body_1_3',
    'Gloves_2_1_Left',
    'Gloves_2_1_Right',
  ),
  male03: male(
    'Male_Head',
    'Male_Eyes',
    'Male_Eyebrows_3_1',
    'Beard_2_1',
    'Hair_3_1',
    'Mask_1_1',
    'Torso_1_1',
    'Pants_1_1',
    'Shoes_1_1',
    'Gloves_2_2_Left',
    'Gloves_2_2_Right',
  ),
  male04: male(
    'Male_Head',
    'Male_Eyes',
    'Male_Eyebrows_4_1',
    'Beard_3_1',
    'Hat_2_3',
    'Glasses_2_1',
    'Torso_2_1',
    'Pants_2_2',
    'Shoes_2_1',
    'Gloves_1_3_Left',
    'Gloves_1_3_Right',
  ),
  // No eyes, as shipped.
  male05: male(
    'Male_Head',
    'Male_Eyebrows_5_1',
    'Beard_5_1',
    'Hair_5_1',
    'Mask_1_3',
    'Torso_3_1',
    'Pants_3_1',
    'Shoes_3_1',
    'Gloves_1_1_Left',
    'Gloves_1_1_Right',
  ),
  male06: male(
    'Male_Head',
    'Male_Eyes',
    'Male_Eyebrows_6_1',
    'Beard_6_1',
    'Hat_4_2',
    'Torso_5_3',
    'Pants_3_2',
    'Shoes_2_3',
    'Gloves_2_2_Left',
    'Gloves_2_2_Right',
  ),
  // Hair under a hat: the one preset that proves the two are not exclusive.
  male07: male(
    'Male_Head',
    'Male_Eyes',
    'Male_Eyebrows_7_1',
    'Beard_7_1',
    'Hair_4_1',
    'Hat_3_2',
    'Torso_3_2',
    'Pants_1_1',
    'Shoes_2_3',
    'Gloves_2_1_Left',
    'Gloves_2_1_Right',
  ),
  // No eyes, as shipped.
  male08: male(
    'Male_Head',
    'Male_Eyebrows_8_3',
    'Beard_8_1',
    'Hair_5_2',
    'Mask_2_2',
    'Headphones_1_3',
    'Torso_4_2',
    'Pants_2_2',
    'Shoes_3_2',
    'Gloves_2_3_Left',
    'Gloves_2_3_Right',
  ),
  // No eyes, and the eyebrow whose name ends in a full stop.
  male09: male(
    'Male_Head',
    'Male_Eyebrows_10_1.',
    'Beard_8_3',
    'Hat_3_1',
    'Torso_2_2',
    'Pants_3_1',
    'Shoes_4_1',
    'Gloves_1_3_Left',
    'Gloves_1_3_Right',
  ),
  male10: male(
    'Male_Head',
    'Male_Eyes',
    'Male_Eyebrows_5_2',
    'Beard_6_2',
    'Hat_2_2',
    'Torso_3_2',
    'Pants_3_2',
    'Shoes_3_2',
    'Gloves_2_2_Left',
    'Gloves_2_2_Right',
  ),

  // The only preset with a bra under a torso, and one of two with lashes.
  female01: female(
    'Female_Head',
    'Female_Eyes',
    'Female_Eyelashes',
    'Female_Bra',
    'Female_Eyebrows_1_1',
    'Hair_1_1',
    'Glasses_1_1',
    'Headphones_1_1',
    'Torso_1_1',
    'Pants_1_1',
    'Shoes_1_1',
    'Gloves_1_1_Left',
    'Gloves_1_1_Right',
  ),
  female02: female(
    'Female_Head',
    'Female_Eyes',
    'Female_Eyebrows_2_1',
    'Hair_2_1',
    'Glasses_2_1',
    'Headphones_1_3',
    'Full_Body_1_1',
    'Gloves_2_1_Left',
    'Gloves_2_1_Right',
  ),
  female03: female(
    'Female_Head',
    'Female_Eyes',
    'Female_Eyebrows_3_1',
    'Hat_1_1',
    'Full_Body_1_3',
    'Gloves_1_2_Left',
    'Gloves_1_2_Right',
  ),
  female04: female(
    'Female_Head',
    'Female_Eyes',
    'Female_Eyebrows_4_1',
    'Hair_3_1',
    'Mask_1_1',
    'Torso_1_1',
    'Pants_1_1',
    'Shoes_1_1',
    'Gloves_2_2_Left',
    'Gloves_2_2_Right',
  ),
  female05: female(
    'Female_Head',
    'Female_Eyes',
    'Female_Eyebrows_5_1',
    'Hair_1_2',
    'Mask_2_1',
    'Torso_2_1',
    'Pants_2_1',
    'Shoes_2_1',
    'Gloves_1_3_Left',
    'Gloves_1_3_Right',
  ),
  female06: female(
    'Female_Head',
    'Female_Eyes',
    'Female_Eyebrows_6_1',
    'Hat_2_3',
    'Glasses_2_2',
    'Torso_3_3',
    'Pants_3_3',
    'Shoes_3_3',
    'Gloves_2_3_Left',
    'Gloves_2_3_Right',
  ),
  female07: female(
    'Female_Head',
    'Female_Eyes',
    'Female_Eyebrows_7_2',
    'Hair_4_2',
    'Mask_2_3',
    'Headphones_1_3',
    'Torso_5_2',
    'Pants_5_2',
    'Shoes_6_1',
    'Gloves_1_1_Left',
    'Gloves_1_1_Right',
  ),
  female08: female(
    'Female_Head',
    'Female_Eyes',
    'Female_Eyebrows_8_1',
    'Hat_3_3',
    'Torso_5_3',
    'Pants_2_2',
    'Shoes_5_2',
    'Gloves_1_3_Left',
    'Gloves_1_3_Right',
  ),
  female09: female(
    'Female_Head',
    'Female_Eyes',
    'Female_Eyelashes',
    'Female_Eyebrows_9_1',
    'Hair_3_3',
    'Mask_2_3',
    'Torso_2_2',
    'Pants_2_3',
    'Shoes_3_3',
    'Gloves_2_1_Left',
    'Gloves_2_1_Right',
  ),
  female10: female(
    'Female_Head',
    'Female_Eyes',
    'Female_Eyebrows_10_1',
    'Hair_2_3',
    'Headphones_1_3',
    'Torso_1_3',
    'Pants_1_2',
    'Shoes_1_2',
    'Gloves_2_1_Left',
    'Gloves_2_1_Right',
  ),
}

export const PRESET_IDS = Object.keys(FIRETOY_PRESETS) as readonly PresetId[]

export const MALE_PRESET_IDS = PRESET_IDS.filter((id) => id.startsWith('male'))
export const FEMALE_PRESET_IDS = PRESET_IDS.filter((id) => id.startsWith('female'))
