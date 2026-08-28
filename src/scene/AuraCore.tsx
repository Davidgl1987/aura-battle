import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, type Mesh, type Points } from 'three'
import { now } from '../state/store'

const COUNT = 170
/**
 * How wide the column of light is where it leaves the floor. Everything here is
 * sized for the title's camera, which stands a dozen units back: at the scale
 * the battle's motes use, the whole column came out sub-pixel.
 */
const RADIUS = 0.5
const RINGS = 3
/** Seconds for a floor ring to travel out and fade to nothing. */
const RING_CYCLE = 2.6

/**
 * Module scope, the same as the battle's motes: the geometry reads these while
 * rendering and the frame loop writes them every tick, and only one of these
 * exists at a time.
 */
const pool = {
  position: new Float32Array(COUNT * 3),
  color: new Float32Array(COUNT * 3),
  velocity: new Float32Array(COUNT * 3),
  life: new Float32Array(COUNT),
  span: new Float32Array(COUNT),
  next: 0,
}

function reset() {
  pool.life.fill(0)
  pool.color.fill(0)
  pool.next = 0
}

function spawn() {
  const i = pool.next
  pool.next = (pool.next + 1) % COUNT
  const p = i * 3

  // Anywhere on a small disc, so the column has body rather than being a line.
  const angle = Math.random() * Math.PI * 2
  const r = Math.sqrt(Math.random()) * RADIUS
  pool.position[p] = Math.cos(angle) * r
  pool.position[p + 1] = Math.random() * 0.25
  pool.position[p + 2] = Math.sin(angle) * r

  // Drifting inward as they climb, so the column tapers to a point.
  pool.velocity[p] = -Math.cos(angle) * 0.12
  pool.velocity[p + 1] = 1.6 + Math.random() * 1.5
  pool.velocity[p + 2] = -Math.sin(angle) * 0.12

  // Gold, warming toward white on the brightest ones.
  const heat = 0.55 + Math.random() * 0.45
  pool.color[p] = heat
  pool.color[p + 1] = heat * 0.78
  pool.color[p + 2] = heat * 0.32

  // Long enough to climb clear of the cast standing round it: at floor level
  // the column is simply behind whoever the camera is passing.
  const life = 2.1 + Math.random() * 1.3
  pool.life[i] = life
  pool.span[i] = life
}

/**
 * The aura itself, standing in the middle of the title's ring: a slow column of
 * light climbing out of the floor, with rings pushing outward under it. The
 * cast are all warming up around something, rather than around nothing.
 */
export function AuraCore() {
  const points = useRef<Points>(null)
  const rings = useRef<(Mesh | null)[]>([])

  useEffect(reset, [])

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)

    if (Math.random() < delta * 90) spawn()
    // A second draw on busy frames, so the column does not thin out at low fps.
    if (Math.random() < delta * 90) spawn()

    const { position, color, velocity, life, span } = pool
    for (let i = 0; i < COUNT; i++) {
      if (life[i] <= 0) continue
      const p = i * 3
      life[i] -= delta

      position[p] += velocity[p] * delta
      position[p + 1] += velocity[p + 1] * delta
      position[p + 2] += velocity[p + 2] * delta

      // Bright most of the way up, then gone: a smear of grey reads as dirt.
      const k = Math.max(0, life[i] / span[i]) ** 1.6
      color[p] = k
      color[p + 1] = k * 0.78
      color[p + 2] = k * 0.32
    }

    const geometry = points.current?.geometry
    if (geometry) {
      geometry.attributes.position.needsUpdate = true
      geometry.attributes.color.needsUpdate = true
    }

    // Rings ripple outward on a shared clock, evenly spaced around the cycle.
    const t = now() / 1000
    for (let i = 0; i < RINGS; i++) {
      const ring = rings.current[i]
      if (!ring) continue
      const phase = (((t / RING_CYCLE + i / RINGS) % 1) + 1) % 1
      const scale = 0.5 + phase * 3.4
      ring.scale.set(scale, scale, 1)
      const material = ring.material as { opacity: number }
      material.opacity = 0.6 * (1 - phase) ** 1.6
    }
  })

  return (
    <group>
      <points ref={points} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[pool.position, 3]} />
          <bufferAttribute attach="attributes-color" args={[pool.color, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.22}
          sizeAttenuation
          vertexColors
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </points>

      {Array.from({ length: RINGS }, (_, i) => (
        <mesh
          key={i}
          ref={(node) => {
            rings.current[i] = node
          }}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.02, 0]}
        >
          <ringGeometry args={[0.42, 0.56, 48]} />
          <meshBasicMaterial
            color="#fbbf24"
            transparent
            opacity={0}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </mesh>
      ))}

      {/* A warm lamp inside the column, so the ring is lit by the thing they
          are all standing around rather than by nothing in particular. */}
      <pointLight position={[0, 1.1, 0]} color="#fbbf24" intensity={14} distance={7} />
    </group>
  )
}
