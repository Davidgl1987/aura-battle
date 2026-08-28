import { useCallback, useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, type Points } from 'three'
import { getCharacter } from '../engine/characters'
import { useGame } from '../state/store'
import { useGameEvents } from '../state/useGameEvents'
import { SLOTS, slotOf } from './stageState'

/** One pool, reused forever: no allocation during a battle. */
const COUNT = 220

/**
 * Module scope on purpose. The geometry has to read these buffers while
 * rendering and the frame loop has to write them every tick; no hook gives
 * both, and exactly one of this effect exists at a time. `resetPool` clears
 * them when a fresh battle mounts.
 */
function createPool() {
  return {
    position: new Float32Array(COUNT * 3),
    /** What the renderer reads: the base colour faded by remaining life. */
    color: new Float32Array(COUNT * 3),
    /** The colour it was born with, so fading never eats its own output. */
    base: new Float32Array(COUNT * 3),
    velocity: new Float32Array(COUNT * 3),
    life: new Float32Array(COUNT),
    span: new Float32Array(COUNT),
    next: 0,
  }
}

const COLORS: Record<string, [number, number, number]> = {
  PERFECT: [1, 0.78, 0.22],
  GOOD: [0.36, 0.9, 0.55],
  MISS: [0.98, 0.42, 0.5],
  LOST_COMPOSURE: [0.62, 0.56, 0.75],
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

/**
 * Aura, made visible. Bursts on a judgement and streams upward for as long as
 * GOD AURA holds. Additive blending means a dying mote just fades to black and
 * disappears, so there is no alpha buffer to sort.
 */
const pool = createPool()

function resetPool() {
  pool.life.fill(0)
  pool.color.fill(0)
  pool.next = 0
}

export function Motes() {
  const points = useRef<Points>(null)
  // The whole match: god aura belongs to a player, not to whoever is up, and
  // the effect has to follow them upstage and past the final bell.
  const match = useGame((s) => s.match)

  useEffect(resetPool, [])

  const spawn = useCallback(
    (
      rgb: [number, number, number],
      speed: number,
      lifeSeconds: number,
      rise: number,
      at: { x: number; z: number } = SLOTS.front,
    ) => {
      const i = pool.next
      pool.next = (pool.next + 1) % COUNT
      const p = i * 3

      // Around the fighter's chest, wherever on the stage they are standing.
      pool.position[p] = at.x + (Math.random() - 0.5) * 0.7
      pool.position[p + 1] = 0.85 + Math.random() * 0.7
      pool.position[p + 2] = at.z + (Math.random() - 0.5) * 0.5

      const angle = Math.random() * Math.PI * 2
      const spread = Math.random() * speed
      pool.velocity[p] = Math.cos(angle) * spread
      pool.velocity[p + 1] = rise + Math.random() * speed
      pool.velocity[p + 2] = Math.sin(angle) * spread * 0.6

      pool.base[p] = rgb[0]
      pool.base[p + 1] = rgb[1]
      pool.base[p + 2] = rgb[2]
      pool.color[p] = rgb[0]
      pool.color[p + 1] = rgb[1]
      pool.color[p + 2] = rgb[2]

      pool.life[i] = lifeSeconds
      pool.span[i] = lifeSeconds
    },
    [],
  )

  useGameEvents(
    useCallback(
      (event) => {
        if (event.type === 'judgement') {
          const rgb = COLORS[event.result.judgement] ?? COLORS.GOOD
          const count = event.result.judgement === 'PERFECT' ? 90 : 34
          const speed = event.result.judgement === 'PERFECT' ? 2.6 : 1.2
          const rise = event.result.judgement === 'MISS' ? -0.6 : 1.1
          for (let i = 0; i < count; i++) spawn(rgb, speed, 0.9 + Math.random() * 0.5, rise)
        }
        if (event.type === 'godAura' && event.on) {
          for (let i = 0; i < 70; i++) spawn([1, 0.78, 0.22], 2.2, 1.2, 1.6)
        }
        if (event.type === 'mogged') {
          for (let i = 0; i < 110; i++) spawn([1, 0.9, 0.6], 3.2, 1.4, 1.4)
        }
      },
      [spawn],
    ),
  )

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)

    // A steady updraft for everyone who is lit, wherever they are standing.
    // Watching the rival burn while you wait is half the point of the state.
    for (const player of match.players) {
      if (!player.godAura || Math.random() >= delta * 45) continue
      const mark = SLOTS[slotOf(match, player.id)]
      spawn(hexToRgb(getCharacter(player.characterId).color), 0.5, 1.5, 1.2, mark)
    }

    const { position, color, base, velocity, life, span } = pool
    for (let i = 0; i < COUNT; i++) {
      if (life[i] <= 0) continue
      const p = i * 3
      life[i] -= delta

      velocity[p + 1] -= 1.6 * delta // a light gravity, so bursts arc
      position[p] += velocity[p] * delta
      position[p + 1] += velocity[p + 1] * delta
      position[p + 2] += velocity[p + 2] * delta

      // Squared so a mote holds its colour and then goes quickly, rather than
      // lingering as a grey smudge.
      const fade = Math.max(0, life[i] / span[i]) ** 2
      color[p] = base[p] * fade
      color[p + 1] = base[p + 1] * fade
      color[p + 2] = base[p + 2] * fade
    }

    const geometry = points.current?.geometry
    if (geometry) {
      geometry.attributes.position.needsUpdate = true
      geometry.attributes.color.needsUpdate = true
    }
  })

  return (
    <points ref={points} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pool.position, 3]} />
        <bufferAttribute attach="attributes-color" args={[pool.color, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.09}
        sizeAttenuation
        vertexColors
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  )
}
