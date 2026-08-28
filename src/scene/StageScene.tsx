import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { BloomEffect } from 'postprocessing'
import type { Mesh } from 'three'
import { getCharacter } from '../engine/characters'
import { now, useGame } from '../state/store'
import { Fighter } from './Fighter'
import { Motes } from './Motes'
import { Floor, StageShell } from './StageShell'
import { SLOTS, fighterAction, slotOf } from './stageState'

/** How hard the camera is knocked by each result. */
const SHAKE: Record<string, number> = {
  PERFECT: 0.15,
  GOOD: 0.04,
  MISS: 0.1,
  LOST_COMPOSURE: 0.05,
}

function Spotlight({ accent }: { accent: string }) {
  const ringRef = useRef<Mesh>(null)

  useFrame(() => {
    if (!ringRef.current) return
    // A slow pulse under whoever is up, so the eye knows where to look.
    const pulse = 1 + Math.sin(now() / 420) * 0.05
    ringRef.current.scale.set(pulse, pulse, 1)
  })

  return (
    <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0.25]}>
      <ringGeometry args={[0.85, 1.05, 40]} />
      <meshBasicMaterial color={accent} transparent opacity={0.35} />
    </mesh>
  )
}

/** Leans in for the performance and flinches on the judgement. */
function CameraRig() {
  const match = useGame((s) => s.match)
  const phase = match.phase

  // The camera comes from the frame rather than a hook: moving it is the whole
  // point of a rig, and r3f hands it over here already.
  useFrame(({ camera }, delta) => {
    const t = now()
    const close = phase.kind === 'qte' || phase.kind === 'performIntro'
    const targetZ = close ? 6.7 : 7.2
    const k = 1 - Math.exp(-3 * Math.min(delta, 0.1))
    camera.position.z += (targetZ - camera.position.z) * k

    let shakeX = 0
    let shakeY = 0
    if (phase.kind === 'resolve' || phase.kind === 'lostComposure') {
      // Hardest on the frame the judgement lands, gone a third of a second later.
      const decay = Math.max(0, 1 - (t - phase.startedAt) / 320)
      const power = SHAKE[phase.result.judgement] ?? 0.05
      shakeX = Math.sin(t / 19) * power * decay
      shakeY = Math.cos(t / 14) * power * decay
    }

    camera.position.x = Math.sin(t / 2600) * 0.12 + shakeX
    camera.position.y = 1.55 + Math.sin(t / 3100) * 0.05 + shakeY
    // Aimed low so the fighters sit in the band between the top bar and the
    // console, rather than behind either of them.
    camera.lookAt(0, 0.45, -0.3)
  })

  return null
}

/** Rides bloom up and down with GOD AURA — anyone's, whosever turn it is. */
function GodAuraGlow({ bloomRef }: { bloomRef: React.RefObject<BloomEffect | null> }) {
  const godAura = useGame((s) => s.match.players.some((p) => p.godAura))

  useFrame((_, delta) => {
    if (!bloomRef.current) return
    const target = godAura ? 2.7 : 0.4
    bloomRef.current.intensity +=
      (target - bloomRef.current.intensity) * (1 - Math.exp(-4 * Math.min(delta, 0.1)))
  })

  return null
}

function Cast({ bloomRef }: { bloomRef: React.RefObject<BloomEffect | null> }) {
  const match = useGame((s) => s.match)
  const active = match.players[match.active]
  const accent = getCharacter(active.characterId).color

  return (
    <>
      <pointLight position={[-2.4, 1.6, 1.4]} color={accent} intensity={3.5} />
      <pointLight position={[2.4, 2.2, -1.5]} color="#f472b6" intensity={2.2} />

      {/* A lamp of their own for anyone alight, on their own mark, so the state
          reads from across the stage and does not go out on their rival's turn
          or when the battle is already over. */}
      {match.players.map((player) =>
        player.godAura ? (
          <pointLight
            key={player.id}
            position={[
              SLOTS[slotOf(match, player.id)].x,
              1.7,
              SLOTS[slotOf(match, player.id)].z + 1.1,
            ]}
            color={getCharacter(player.characterId).color}
            intensity={9}
            distance={7}
          />
        ) : null,
      )}

      <Floor>
        <Spotlight accent={accent} />
      </Floor>
      <Motes />
      <CameraRig />
      <GodAuraGlow bloomRef={bloomRef} />

      {match.players.map((player) => (
        <Fighter
          key={player.id}
          characterId={player.characterId}
          color={getCharacter(player.characterId).color}
          slot={slotOf(match, player.id)}
          action={fighterAction(match, player.id)}
          charged={player.godAura}
          now={now}
        />
      ))}
    </>
  )
}

export function StageScene() {
  const bloomRef = useRef<BloomEffect>(null)

  return (
    <div className="stage__scene">
      <StageShell bloomRef={bloomRef}>
        <Cast bloomRef={bloomRef} />
      </StageShell>
    </div>
  )
}
