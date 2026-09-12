import { encodeBase58 } from './base58'
import { prepareTake } from './pcm'

export type Seed = {
  address: string
  hashHex: string
  chips: string[]
  peak: number
  durationSec: number
  quiet: boolean
}

export async function sha256Bytes(bytes: Uint8Array): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))
  return new Uint8Array(digest)
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function chipsFromAddress(address: string, count = 4, width = 4): string[] {
  const chips: string[] = []
  for (let i = 0; i < count; i++) {
    const slice = address.slice(i * width, i * width + width)
    if (slice) chips.push(slice)
  }
  return chips
}

export async function seedFromMono(mono: Float32Array, sampleRate: number): Promise<Seed> {
  const { bytes, peak, durationSec } = prepareTake(mono, sampleRate)
  const hash = await sha256Bytes(bytes)
  const address = encodeBase58(hash)
  return {
    address,
    hashHex: bytesToHex(hash),
    chips: chipsFromAddress(address),
    peak,
    durationSec,
    quiet: peak < 1e-4,
  }
}
