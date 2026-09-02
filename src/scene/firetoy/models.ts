import { useGLTF } from '@react-three/drei'
import type { Gender } from './characterParts'

/** Where the two bodies live. Vite's base has to be on the front of it. */
export const MODELS: Record<Gender, string> = {
  male: `${import.meta.env.BASE_URL}models/characters/firetoy-male.glb`,
  female: `${import.meta.env.BASE_URL}models/characters/firetoy-female.glb`,
}

/**
 * Fetch and parse a body before anything needs it.
 *
 * Twelve megabytes arriving as the first card is dealt is a stage that stays
 * empty for the opening of a battle, so the screen before one starts the fetch
 * — the same trick the setup screen already plays on the stage's own chunk.
 */
export function preloadFiretoy(gender: Gender): void {
  useGLTF.preload(MODELS[gender])
}

/**
 * How tall a Firetoy character stands, from the floor to the top of the head:
 * 1.75 for the male body, 1.80 for the female. The primitive fighters run from
 * 1.41 to 2.45, so the stage's framing already holds them and they need no
 * scaling of their own — this is the one number to turn if that changes.
 */
export const FIRETOY_HEIGHT = 1.78

/** What a Firetoy character is scaled by on the stage. */
export const FIRETOY_SCALE = 1
