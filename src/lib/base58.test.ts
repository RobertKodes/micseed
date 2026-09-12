import { describe, expect, it } from 'vitest'
import { encodeBase58 } from './base58'

describe('encodeBase58', () => {
  it('encodes the empty buffer', () => {
    expect(encodeBase58(new Uint8Array())).toBe('')
  })

  it('keeps leading zeros as ones', () => {
    expect(encodeBase58(new Uint8Array([0, 0, 1]))).toMatch(/^11/)
  })

  it('matches a known hello vector', () => {
    const bytes = new TextEncoder().encode('hello')
    expect(encodeBase58(bytes)).toBe('Cn8eVZg')
  })

  it('maps 32 bytes to a Solana-length string', () => {
    const bytes = Uint8Array.from({ length: 32 }, (_, i) => (i * 17 + 3) & 0xff)
    const out = encodeBase58(bytes)
    expect(out.length).toBeGreaterThanOrEqual(32)
    expect(out.length).toBeLessThanOrEqual(44)
    expect(out).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/)
  })
})
