import type { ControlParams, LanesParams, PathsParams, TimingParams } from '../../engine/types'
import { zoneAt } from './control'
import type { Note } from './lanes'
import { noteProgress } from './lanes'
import { laneCentre, laneRange, onTrack } from './paths'
import { cursorAt } from './timing'

/**
 * Where everything that moves on a board goes, from the same pure geometry the
 * widget grades against.
 *
 * Split from `boards.tsx` only because fast refresh wants a file of components
 * to be nothing but components. Read the two together: a board is its markup
 * plus the one `paint` here that drives it.
 *
 * The widget calls these from its own frame loop and the tutorial calls them
 * from its own. That is the whole point — the tutorial used to be a separate
 * drawing in CSS keyframes and it drifted, badly enough that the drive-test one
 * ended up showing a gesture the game does not have.
 */

/* --- Sweep ---------------------------------------------------------------- */

export interface SweepHandle {
  bar: HTMLDivElement | null
  cursor: HTMLDivElement | null
}

/**
 * Where the cursor is now, and where it is put.
 *
 * `parkedAt` is where it waits before the bar goes live — the caller's business,
 * not this function's: the card parks it at the end it will set off from so it
 * never appears to jump, while a tutorial may want it somewhere else entirely.
 * `phase` is the origin `startPhase` handed back.
 */
export function paintSweep(
  handle: SweepHandle | null,
  {
    t,
    phase,
    params,
    parkedAt,
  }: { t: number; phase: number; params: TimingParams; parkedAt: number | null },
): number {
  const x = parkedAt ?? cursorAt(t, phase, params.sweepMs)
  if (handle?.cursor) handle.cursor.style.left = `${x * 100}%`
  return x
}

/* --- Lanes ---------------------------------------------------------------- */

/** How far down a lane the hit line sits. Low, because that is where the thumb
 * already is: notes fall toward it with the whole lane above as warning. */
export const LANE_LINE = 0.78

export interface LanesHandle {
  board: HTMLDivElement | null
  lanes: (HTMLButtonElement | null)[]
  lines: (HTMLSpanElement | null)[]
  notes: (HTMLSpanElement | null)[]
}

export function paintLanes(
  handle: LanesHandle | null,
  {
    elapsed,
    notes,
    params,
    parked,
  }: { elapsed: number; notes: Note[]; params: LanesParams; parked: boolean },
) {
  if (!handle) return
  // One layout read for the whole board rather than one per note.
  const height = handle.board?.clientHeight ?? 0
  notes.forEach((note, i) => {
    const node = handle.notes[i]
    if (!node) return
    // Parked at the top until the board starts moving.
    const at = parked ? 1 : noteProgress(note, elapsed, params.travelMs)
    node.style.transform = `translateY(${(LANE_LINE - at * LANE_LINE) * height}px)`
  })
}

/* --- Order ---------------------------------------------------------------- */

export interface OrderHandle {
  pad: HTMLDivElement | null
}

/* --- Zone ----------------------------------------------------------------- */

export interface ZoneHandle {
  area: HTMLDivElement | null
  zone: HTMLDivElement | null
}

/** Where the ring is now, and how big — returned so a hand can follow it. */
export function paintZone(
  handle: ZoneHandle | null,
  { at, params, variation }: { at: number; params: ControlParams; variation: number },
): { cx: number; cy: number; radius: number } | null {
  const area = handle?.area
  const zone = handle?.zone
  if (!area || !zone) return null

  const rect = area.getBoundingClientRect()
  const size = Math.min(rect.width, rect.height)
  const radius = params.zoneRadius * size
  // Both axes travel the same square region, so the drift is not twice as fast
  // down the long side of the pad.
  const span = size / 2 - radius
  const offset = zoneAt(at, params, variation)
  const cx = rect.width / 2 + offset.x * span
  const cy = rect.height / 2 + offset.y * span

  zone.style.width = `${radius * 2}px`
  zone.style.height = `${radius * 2}px`
  zone.style.transform = `translate(${cx - radius}px, ${cy - radius}px)`
  return { cx, cy, radius }
}

/* --- Paths ---------------------------------------------------------------- */

/** Where the markers sit down the track, as a share of its height. */
export const MARKER_Y = 0.6
/** How much track is on screen at once, in the units `laneCentre` takes. */
export const VIEW = 3
/** How many points the drawn corridor is built from. */
const STEPS = 26

export interface DriveHandle {
  track: HTMLDivElement | null
  lanes: (SVGPathElement | null)[]
  marks: (HTMLDivElement | null)[]
  knobs: (HTMLDivElement | null)[]
}

/**
 * Draws both corridors at this point along the track and places the markers.
 *
 * `at` is where each thumb has put its marker, in pad units. Returns whether
 * both are inside their lane, and where the lanes are — the second is what lets
 * a tutorial steer itself down the same track the player would.
 */
export function paintDrive(
  handle: DriveHandle | null,
  {
    scroll,
    at,
    params,
    variation,
    gripped,
  }: {
    scroll: number
    at: readonly [number, number]
    params: PathsParams
    variation: number
    gripped?: readonly [boolean, boolean]
  },
): { onLanes: boolean; centres: [number, number] } {
  const track = handle?.track
  if (!handle || !track) return { onLanes: false, centres: [0, 0] }

  const width = track.clientWidth
  const height = track.clientHeight
  const half = width / 2
  // Pad units run -1 to 1 across, so a unit is half the width.
  const toPx = (x: number) => half + x * half
  let onLanes = true
  const centres: [number, number] = [0, 0]

  for (const lane of [0, 1] as const) {
    // The corridor, drawn from the marker line outward in both directions:
    // above the line is track still to come.
    let d = ''
    for (let i = 0; i <= STEPS; i++) {
      const y = (i / STEPS) * height
      const distance = scroll + (MARKER_Y - y / height) * VIEW
      d += `${i === 0 ? 'M' : 'L'}${toPx(laneCentre(distance, params, variation, lane)).toFixed(1)} ${y.toFixed(1)}`
    }
    const path = handle.lanes[lane]
    if (path) {
      path.setAttribute('d', d)
      path.setAttribute('stroke-width', String(params.laneWidth * 2 * half))
    }

    const centre = laneCentre(scroll, params, variation, lane)
    centres[lane] = centre
    const inside = onTrack(at[lane], centre, params)
    if (!inside) onLanes = false

    const mark = handle.marks[lane]
    if (mark) {
      mark.style.left = `${toPx(at[lane])}px`
      mark.style.top = `${MARKER_Y * height}px`
      mark.dataset.on = String(inside)
    }
    const knob = handle.knobs[lane]
    if (knob) {
      const [min, max] = laneRange(lane)
      knob.style.left = `${((at[lane] - min) / (max - min)) * 100}%`
      knob.dataset.on = String(gripped ? gripped[lane] : false)
    }
  }

  return { onLanes, centres }
}
