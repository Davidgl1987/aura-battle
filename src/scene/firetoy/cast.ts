import type { FiretoyLook } from '../../engine/types'
import type { Gender } from './characterParts'

/**
 * Who wears what.
 *
 * The catalogue says which pieces exist and `characterPresets.ts` holds the
 * twenty Firetoy shipped; this is Aura Battle's own cast, built out of them.
 * Each rival started from one original and changed a few pieces, because a
 * preset Firetoy drew already hangs together and a costume assembled from
 * scratch usually does not.
 *
 * The one rule the six of them have to obey: **a rival wears the accessory
 * their challenge pays out**, so the thing you are playing for is on the stage
 * for the whole battle. `cast.test.ts` is what keeps that true.
 */

const male = (...pieces: string[]): FiretoyLook => ({
  gender: 'male',
  outfit: Object.freeze(pieces.map((piece) => `Ib_MALE_01_${piece}`)),
})

const female = (...pieces: string[]): FiretoyLook => ({
  gender: 'female',
  outfit: Object.freeze(pieces.map((piece) => `Ib_FEMALE_01_${piece}`)),
})

/**
 * The Firetoy piece each unlockable accessory actually is, per catalogue.
 *
 * Gloves name their left half; the pair rule brings the right one along.
 * Families were picked so that both genders mean the same thing by them —
 * `Hat_2` is a helmet on either body, `Glasses_2` the aggressive shades, and
 * so on — which the `Hat_3` and `Hat_4` families do not manage.
 */
export const ACCESSORY_PIECES: Record<string, Record<Gender, string>> = {
  'starter-cap': { male: 'Ib_MALE_01_Hat_2_1', female: 'Ib_FEMALE_01_Hat_2_1' },
  'sixseven-shades': { male: 'Ib_MALE_01_Glasses_2_1', female: 'Ib_FEMALE_01_Glasses_2_1' },
  'jawline-chain': { male: 'Ib_MALE_01_Headphones_1_1', female: 'Ib_FEMALE_01_Headphones_1_1' },
  'drip-jacket': { male: 'Ib_MALE_01_Torso_5_3', female: 'Ib_FEMALE_01_Torso_5_3' },
  'dice-charm': {
    male: 'Ib_MALE_01_Gloves_2_3_Left',
    female: 'Ib_FEMALE_01_Gloves_2_3_Left',
  },
  'demon-aura': { male: 'Ib_MALE_01_Mask_2_3', female: 'Ib_FEMALE_01_Mask_2_3' },
}

/**
 * The six of them, by rival id.
 *
 * They alternate male and female down the ladder, and no two share a
 * silhouette: a helmet, a one-piece suit behind big shades, headphones over
 * long hair, a giant chicken head, a paper bag, and a rabbit mask. You can
 * tell which rival you are looking at from across the room with the sound off,
 * which is the whole job.
 */
export const RIVAL_CHARACTER_PRESETS: Record<string, FiretoyLook> = {
  /**
   * Plays it safe, so he came in a safety helmet. Nothing else on him: no
   * beard, no shades, no hair under the hat. He is the one rival meant to look
   * like he has not worked out a look yet — though not to the point of the
   * matching beige trousers he started with, which read as bare legs.
   */
  'the-rookie': male(
    'Male_Head',
    'Male_Eyes',
    'Male_Eyebrows_1_1',
    'Hat_2_1',
    'Torso_1_1',
    'Pants_3_1',
    'Shoes_1_1',
    'Gloves_2_2_Left',
    'Gloves_2_2_Right',
  ),

  /** From female 02: the one-piece suit, minus the headphones, shades kept. */
  '67-kid': female(
    'Female_Head',
    'Female_Eyes',
    'Female_Eyebrows_2_1',
    'Hair_2_1',
    'Glasses_2_1',
    'Full_Body_1_1',
    'Gloves_2_1_Left',
    'Gloves_2_1_Right',
  ),

  /**
   * From male 05, with the gas mask taken off and his eyes put back. Precision
   * over spectacle: long hair, studio cans, and a jawline you can see, which
   * is rather the point of him.
   */
  'the-mewer': male(
    'Male_Head',
    'Male_Eyes',
    'Male_Eyebrows_5_1',
    'Hair_5_1',
    'Headphones_1_1',
    'Torso_3_1',
    'Pants_3_1',
    'Shoes_3_1',
    'Gloves_1_1_Left',
    'Gloves_1_1_Right',
  ),

  /** Female 08 unchanged: a giant chicken head over the jacket she pays out. */
  'the-showoff': female(
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

  /**
   * From male 09: a paper bag over the head, which is the only poker face in
   * the pack. His eyes go back on under it, and he keeps the eyebrow whose
   * name ends in a full stop — the one piece in the whole wardrobe that the
   * loader renames on the way in.
   */
  'the-gambler': male(
    'Male_Head',
    'Male_Eyes',
    'Male_Eyebrows_10_1.',
    'Beard_8_3',
    'Hat_3_1',
    'Torso_2_2',
    'Pants_3_1',
    'Shoes_4_1',
    'Gloves_2_3_Left',
    'Gloves_2_3_Right',
  ),

  /** Female 09 unchanged. The rabbit mask is the last thing you see. */
  'aura-demon': female(
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
}

/**
 * What the player wears until there is a Customize screen to change it in.
 *
 * Deliberately plain and deliberately not wearing anything the ladder pays
 * out: the six accessories should read as new when they arrive, not as
 * something you were already in.
 */
export const DEFAULT_PLAYER_CHARACTER: FiretoyLook = male(
  'Male_Head',
  'Male_Eyes',
  'Male_Eyebrows_3_1',
  'Hair_1_1',
  'Torso_4_1',
  'Pants_4_2',
  'Shoes_5_3',
  'Gloves_1_2_Left',
  'Gloves_1_2_Right',
)

/**
 * A body for each of the four characters the hot-seat setup offers, so two
 * people on one phone are not the same person twice. Solo always plays as
 * `blocky`, which is why that one is the default above.
 *
 * The other three are originals as Firetoy drew them, picked for silhouette:
 * a masked one, a helmeted one, and one in headphones.
 */
export const PLAYER_CHARACTERS: Record<string, FiretoyLook> = {
  blocky: DEFAULT_PLAYER_CHARACTER,

  noodle: female(
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

  orb: male(
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

  chad: female(
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
