import { describe, expect, it } from 'vitest'
import { TARGET_HZ, WINDOW_SAMPLES, prepareTake } from './pcm'
import { chipsFromAddress, seedFromMono } from './seed'

function tone(hz: number, seconds: number, rate = TARGET_HZ, amp = 0.4): Float32Array {
  const n = Math.round(seconds * rate)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = Math.sin((2 * Math.PI * hz * i) / rate) * amp
  return out
}

describe('prepareTake', () => {
  it('always emits a fixed int16 window', () => {
    const { bytes, peak } = prepareTake(tone(440, 0.8), TARGET_HZ)
    expect(bytes.byteLength).toBe(WINDOW_SAMPLES * 2)
    expect(peak).toBeGreaterThan(0.3)
  })

  it('is stable across amplitude (peak normalize)', () => {
    const a = prepareTake(tone(220, 1.2, TARGET_HZ, 0.2), TARGET_HZ).bytes
    const b = prepareTake(tone(220, 1.2, TARGET_HZ, 0.9), TARGET_HZ).bytes
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true)
  })
})

describe('seedFromMono', () => {
  it('hashes the same take to the same callsign', async () => {
    const mono = tone(330, 1.1)
    const once = await seedFromMono(mono, TARGET_HZ)
    const twice = await seedFromMono(mono, TARGET_HZ)
    expect(once.address).toBe(twice.address)
    expect(once.address.length).toBeGreaterThanOrEqual(32)
    expect(once.address.length).toBeLessThanOrEqual(44)
    expect(once.chips).toEqual(chipsFromAddress(once.address))
    expect(once.quiet).toBe(false)
  })

  it('changes when the tone changes', async () => {
    const a = await seedFromMono(tone(110, 1.2), TARGET_HZ)
    const b = await seedFromMono(tone(880, 1.2), TARGET_HZ)
    expect(a.address).not.toBe(b.address)
  })

  it('marks silence as quiet', async () => {
    const seed = await seedFromMono(new Float32Array(TARGET_HZ), TARGET_HZ)
    expect(seed.quiet).toBe(true)
  })
})
