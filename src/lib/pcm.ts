export const TARGET_HZ = 16_000
export const WINDOW_SEC = 1.5
export const MIN_SEC = 0.5
export const MAX_SEC = 2
export const WINDOW_SAMPLES = Math.round(WINDOW_SEC * TARGET_HZ)
export const MIN_PEAK = 1e-4

export function mixToMono(buffer: AudioBuffer): Float32Array {
  const n = buffer.length
  const out = new Float32Array(n)
  const channels = buffer.numberOfChannels
  for (let c = 0; c < channels; c++) {
    const ch = buffer.getChannelData(c)
    for (let i = 0; i < n; i++) out[i] += ch[i]
  }
  if (channels > 1) {
    const inv = 1 / channels
    for (let i = 0; i < n; i++) out[i] *= inv
  }
  return out
}

export function concatFloat32(chunks: Float32Array[]): Float32Array {
  let total = 0
  for (const c of chunks) total += c.length
  const out = new Float32Array(total)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.length
  }
  return out
}

export function resampleLinear(
  input: Float32Array,
  fromHz: number,
  toHz: number,
): Float32Array {
  if (input.length === 0) return new Float32Array(0)
  if (fromHz === toHz) return new Float32Array(input)
  const ratio = fromHz / toHz
  const outLen = Math.max(1, Math.round(input.length / ratio))
  const out = new Float32Array(outLen)
  const last = input.length - 1
  for (let i = 0; i < outLen; i++) {
    const src = i * ratio
    const i0 = Math.min(Math.floor(src), last)
    const i1 = Math.min(i0 + 1, last)
    const t = src - i0
    out[i] = input[i0] * (1 - t) + input[i1] * t
  }
  return out
}

/** First `windowSamples` frames; shorter takes pad with silence. */
export function windowPcm(samples: Float32Array, windowSamples = WINDOW_SAMPLES): Float32Array {
  const out = new Float32Array(windowSamples)
  const n = Math.min(samples.length, windowSamples)
  if (n > 0) out.set(samples.subarray(0, n))
  return out
}

export function peakNormalize(samples: Float32Array): { pcm: Float32Array; peak: number } {
  let peak = 0
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i]!)
    if (a > peak) peak = a
  }
  const pcm = new Float32Array(samples.length)
  if (peak < MIN_PEAK) return { pcm, peak }
  const g = 1 / peak
  for (let i = 0; i < samples.length; i++) pcm[i] = samples[i]! * g
  return { pcm, peak }
}

export function toPcm16Bytes(samples: Float32Array): Uint8Array {
  const bytes = new Uint8Array(samples.length * 2)
  const view = new DataView(bytes.buffer)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!))
    view.setInt16(i * 2, Math.round(s * 32767), true)
  }
  return bytes
}

export function prepareTake(mono: Float32Array, sampleRate: number): {
  bytes: Uint8Array
  peak: number
  durationSec: number
} {
  const resampled = resampleLinear(mono, sampleRate, TARGET_HZ)
  const windowed = windowPcm(resampled)
  const { pcm, peak } = peakNormalize(windowed)
  return {
    bytes: toPcm16Bytes(pcm),
    peak,
    durationSec: resampled.length / TARGET_HZ,
  }
}

export function makeAudioContext(): AudioContext {
  const Ctor = window.AudioContext || (window as typeof window & {
    webkitAudioContext?: typeof AudioContext
  }).webkitAudioContext
  if (!Ctor) throw new Error('Web Audio is not available in this booth.')
  return new Ctor()
}

/** 16-bit mono WAV for tests and browser fixtures. */
export function encodeWav(samples: Float32Array, sampleRate = TARGET_HZ): ArrayBuffer {
  const bytes = toPcm16Bytes(samples)
  const header = new ArrayBuffer(44)
  const v = new DataView(header)
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) v.setUint8(offset + i, text.charCodeAt(i))
  }
  write(0, 'RIFF')
  v.setUint32(4, 36 + bytes.length, true)
  write(8, 'WAVE')
  write(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, 1, true)
  v.setUint32(24, sampleRate, true)
  v.setUint32(28, sampleRate * 2, true)
  v.setUint16(32, 2, true)
  v.setUint16(34, 16, true)
  write(36, 'data')
  v.setUint32(40, bytes.length, true)
  const out = new Uint8Array(44 + bytes.length)
  out.set(new Uint8Array(header), 0)
  out.set(bytes, 44)
  return out.buffer
}
