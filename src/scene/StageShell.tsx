import type { ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import type { BloomEffect } from 'postprocessing'
import type { RefObject } from 'react'

/** Light enough that a dark fighter still reads as a silhouette against it. */
export const BACKDROP = '#1b1240'
export const FLOOR = '#241a4d'

interface Props {
  /** Where the camera starts; the rig inside can take it from there. */
  camera?: [number, number, number]
  fov?: number
  /** Handed the bloom effect so a rig can ride its intensity. */
  bloomRef?: RefObject<BloomEffect | null>
  bloom?: number
  /** Where the air starts to swallow things, and where it finishes. */
  fog?: [near: number, far: number]
  children: ReactNode
}

/**
 * The stage everything is performed on: canvas, air, floor and glow. Shared so
 * the title and the deck builder show the same world the battle happens in,
 * rather than a different one that happens to use the same models.
 */
export function StageShell({
  camera = [0, 1.55, 7.2],
  fov = 42,
  bloomRef,
  bloom = 0.4,
  fog = [6, 13],
  children,
}: Props) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: camera, fov }}
      gl={{ antialias: true }}
      // The UI above owns every tap; the scene is scenery.
      style={{ pointerEvents: 'none' }}
    >
      <color attach="background" args={[BACKDROP]} />
      <fog attach="fog" args={[BACKDROP, fog[0], fog[1]]} />

      <hemisphereLight args={['#b9a8ff', FLOOR, 1]} />
      <directionalLight position={[2.6, 4.2, 3]} intensity={1.5} />
      {/* Rim from behind, so a silhouette separates from the backdrop. */}
      <directionalLight position={[-1.8, 2.4, -3.4]} intensity={0.9} color="#8fb4ff" />

      {children}

      <EffectComposer>
        <Bloom
          ref={bloomRef}
          intensity={bloom}
          luminanceThreshold={0.5}
          luminanceSmoothing={0.35}
          mipmapBlur
        />
        <Vignette darkness={0.45} offset={0.32} />
      </EffectComposer>
    </Canvas>
  )
}

/** The disc they all stand on. Wider when the camera stands further back. */
export function Floor({ radius = 9, children }: { radius?: number; children?: ReactNode }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <circleGeometry args={[radius, 48]} />
        <meshStandardMaterial color={FLOOR} roughness={0.9} />
      </mesh>
      {children}
    </group>
  )
}
