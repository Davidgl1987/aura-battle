import { describe, expect, it } from 'vitest'
import { QTE_ARM_MS } from '../../engine/balance'
import { armTime, createArming } from './arming'

describe('waiting for the first touch', () => {
  it('stays asleep no matter how many frames go by', () => {
    const a = createArming(1000)
    for (let t = 1000; t < 1000 + QTE_ARM_MS; t += 16) {
      expect(a.resolve(t)).toBeNull()
    }
    expect(a.armedAt).toBeNull()
  })

  it('goes live exactly when the finger lands', () => {
    const a = createArming(1000)
    a.resolve(1200)
    a.arm(1240)
    expect(a.resolve(1256)).toBe(1240)
  })

  it('ignores every touch after the first', () => {
    const a = createArming(1000)
    a.arm(1100)
    a.arm(1400)
    expect(a.armedAt).toBe(1100)
  })

  it('starts on its own eventually, so a battle cannot hang', () => {
    const a = createArming(1000)
    expect(a.resolve(1000 + QTE_ARM_MS - 1)).toBeNull()
    expect(a.resolve(1000 + QTE_ARM_MS)).toBe(1000 + QTE_ARM_MS)
  })

  it('never backdates the auto-start to whenever the frame happened to land', () => {
    // A hidden tab can deliver the next frame seconds late; the QTE should
    // still begin where the wait ended, not where the frame arrived.
    expect(armTime(1000, null, 9000)).toBe(1000 + QTE_ARM_MS)
  })
})

describe('surviving a pause', () => {
  it('carries the arm time with the shifted phase clock', () => {
    const a = createArming(1000)
    a.arm(1300) // 300ms in
    a.rebase(6000) // the tab was hidden for 5s and the phase moved
    expect(a.armedAt).toBe(6300)
  })

  it('leaves an unarmed QTE waiting from the new start', () => {
    const a = createArming(1000)
    a.rebase(6000)
    expect(a.resolve(6000 + QTE_ARM_MS - 1)).toBeNull()
    expect(a.resolve(6000 + QTE_ARM_MS)).toBe(6000 + QTE_ARM_MS)
  })
})
