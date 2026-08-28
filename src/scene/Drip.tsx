import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group, Mesh } from 'three'
import type { Accessory } from '../engine/types'
import type { Build } from './builds'

/**
 * What a fighter is wearing, assembled from primitives the same way the
 * fighter is. Nobody downloads a model for a hat either.
 *
 * Every piece sizes itself off the build it is worn by, so the same cap fits
 * ORB's sphere and CHAD's boulder of a head without a second set of numbers.
 * Each one is parented to the body part it belongs to, so it comes along for
 * the whole animation rather than being positioned per frame.
 */

interface Props {
  accessory: Accessory
  build: Build
  /** Lit from within while GOD AURA holds, like the body it is worn on. */
  charged: boolean
  now: () => number
}

function Material({ color, charged, metal = 0.3 }: { color: string; charged: boolean; metal?: number }) {
  return (
    <meshStandardMaterial
      color={color}
      emissive={color}
      emissiveIntensity={charged ? 0.6 : 0}
      flatShading
      roughness={0.4}
      metalness={metal}
    />
  )
}

function Cap({ build, color, charged }: { build: Build; color: string; charged: boolean }) {
  const r = build.headSize / 2
  return (
    <group position={[0, r * 0.78, 0]}>
      <mesh>
        <cylinderGeometry args={[r * 0.86, r * 1.04, r * 0.62, 10]} />
        <Material color={color} charged={charged} metal={0.1} />
      </mesh>
      {/* The peak, out over the eyes. */}
      <mesh position={[0, -r * 0.26, r * 0.92]}>
        <boxGeometry args={[r * 1.5, r * 0.13, r * 1.05]} />
        <Material color={color} charged={charged} metal={0.1} />
      </mesh>
    </group>
  )
}

/** Sits exactly where the eyes are, because that is the joke. */
function Shades({ build, color, charged }: { build: Build; color: string; charged: boolean }) {
  const s = build.headSize
  return (
    <group position={[0, 0.02, s * 0.5]}>
      <mesh>
        <boxGeometry args={[s * 0.82, s * 0.22, s * 0.08]} />
        <Material color={color} charged={charged} metal={0.7} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * s * 0.42, 0, -s * 0.06]}>
          <boxGeometry args={[s * 0.1, s * 0.1, s * 0.3]} />
          <Material color={color} charged={charged} metal={0.7} />
        </mesh>
      ))}
    </group>
  )
}

function Chain({ build, color, charged }: { build: Build; color: string; charged: boolean }) {
  const [w, h] = build.torso
  const radius = Math.max(w * 0.3, 0.1)
  return (
    <group position={[0, h * 0.84, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius, radius * 0.13, 5, 14]} />
        <Material color={color} charged={charged} metal={0.9} />
      </mesh>
      {/* The pendant, hanging where a pendant hangs. */}
      <mesh position={[0, -radius * 0.9, radius * 0.55]}>
        <octahedronGeometry args={[radius * 0.3]} />
        <Material color={color} charged={charged} metal={0.9} />
      </mesh>
    </group>
  )
}

/** A shell a little larger than the torso, open at the bottom. */
function Jacket({ build, color, charged }: { build: Build; color: string; charged: boolean }) {
  const [w, h, d] = build.torso
  return (
    <mesh position={[0, h * 0.56, 0]}>
      {build.shape === 'box' ? (
        <boxGeometry args={[w * 1.12, h * 0.78, d * 1.14]} />
      ) : (
        <capsuleGeometry args={[(w * 1.1) / 2, Math.max(0.01, h * 0.7 - w), 3, 10]} />
      )}
      <Material color={color} charged={charged} metal={0.15} />
    </mesh>
  )
}

/** Hangs off the hip and swings with whatever the body is doing. */
function Charm({
  build,
  color,
  charged,
  now,
}: {
  build: Build
  color: string
  charged: boolean
  now: () => number
}) {
  const ref = useRef<Group>(null)
  const size = Math.max(build.torso[0] * 0.17, 0.07)

  useFrame(() => {
    if (ref.current) ref.current.rotation.z = Math.sin(now() / 520) * 0.5
  })

  return (
    <group ref={ref} position={[build.torso[0] * 0.5, build.torso[1] * 0.22, build.torso[2] * 0.4]}>
      <mesh position={[0, -size * 1.4, 0]} rotation={[0.4, 0.6, 0]}>
        <boxGeometry args={[size, size, size]} />
        <Material color={color} charged={charged} metal={0.2} />
      </mesh>
    </group>
  )
}

/** A ring on its own axis, turning around the whole fighter. */
function AuraRing({
  build,
  color,
  now,
}: {
  build: Build
  color: string
  now: () => number
}) {
  const ref = useRef<Mesh>(null)
  const radius = Math.max(build.torso[0], 0.5) * 0.95
  const height = build.legLength + build.torso[1] * 0.5

  useFrame(() => {
    if (!ref.current) return
    const t = now()
    ref.current.rotation.y = t / 1400
    ref.current.rotation.z = 0.32 + Math.sin(t / 2600) * 0.14
  })

  return (
    <mesh ref={ref} position={[0, height, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[radius, radius * 0.055, 6, 24]} />
      {/* Always emissive: an aura that only glows in god aura is not an aura. */}
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={1.6}
        toneMapped={false}
        transparent
        opacity={0.85}
      />
    </mesh>
  )
}

export function Drip({ accessory, build, charged, now }: Props) {
  const color = accessory.color

  switch (accessory.shape) {
    case 'cap':
      return <Cap build={build} color={color} charged={charged} />
    case 'shades':
      return <Shades build={build} color={color} charged={charged} />
    case 'chain':
      return <Chain build={build} color={color} charged={charged} />
    case 'jacket':
      return <Jacket build={build} color={color} charged={charged} />
    case 'charm':
      return <Charm build={build} color={color} charged={charged} now={now} />
    case 'auraRing':
      return <AuraRing build={build} color={color} now={now} />
  }
}
