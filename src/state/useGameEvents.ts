import { useEffect, useRef } from 'react'
import { useGame } from './store'
import type { GameEvent } from '../engine/types'

/**
 * Drains the reducer's event bus. The store only replaces `bus` on a step that
 * actually emitted something, so each batch arrives exactly once — which is
 * what lets sound and particles fire on the beat instead of on every render.
 */
export function useGameEvents(onEvent: (event: GameEvent) => void): void {
  const bus = useGame((s) => s.bus)
  const handler = useRef(onEvent)

  useEffect(() => {
    handler.current = onEvent
  })

  useEffect(() => {
    for (const event of bus) handler.current(event)
  }, [bus])
}
