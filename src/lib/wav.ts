/** Parse PCM / IEEE-float WAV so a file hashes the same in every booth. */
export function parseWavPcm(
  buf: ArrayBuffer,
): { mono: Float32Array; sampleRate: number } | null {
  if (buf.byteLength < 44) return null
  const v = new DataView(buf)
  const tag = (offset: number) =>
    String.fromCharCode(
      v.getUint8(offset),
      v.getUint8(offset + 1),
      v.getUint8(offset + 2),
      v.getUint8(offset + 3),
    )
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return null

  let sampleRate = 0
  let channels = 0
  let bits = 0
  let floatFmt = false
  let dataOffset = 0
  let dataBytes = 0
  let offset = 12

  while (offset + 8 <= v.byteLength) {
    const id = tag(offset)
    const size = v.getUint32(offset + 4, true)
    const start = offset + 8
    if (start + size > v.byteLength) break
    if (id === 'fmt ') {
      const format = v.getUint16(start, true)
      if (format === 3) floatFmt = true
      else if (format !== 1) return null
      channels = v.getUint16(start + 2, true)
      sampleRate = v.getUint32(start + 4, true)
      bits = v.getUint16(start + 14, true)
    } else if (id === 'data') {
      dataOffset = start
      dataBytes = size
    }
    offset = start + size + (size % 2)
  }

  if (!sampleRate || !channels || !dataOffset || !bits) return null

  const bytesPer = bits / 8
  if (bytesPer !== 1 && bytesPer !== 2 && bytesPer !== 4) return null
  const frames = Math.floor(dataBytes / (bytesPer * channels))
  if (frames < 1) return null

  const mono = new Float32Array(frames)
  for (let i = 0; i < frames; i++) {
    let acc = 0
    for (let c = 0; c < channels; c++) {
      const o = dataOffset + (i * channels + c) * bytesPer
      if (floatFmt && bits === 32) acc += v.getFloat32(o, true)
      else if (bits === 16) acc += v.getInt16(o, true) / 32768
      else if (bits === 8) acc += (v.getUint8(o) - 128) / 128
      else if (bits === 32 && !floatFmt) acc += v.getInt32(o, true) / 2147483648
      else return null
    }
    mono[i] = acc / channels
  }
  return { mono, sampleRate }
}

export function formatCallsign(address: string): string {
  return address.match(/.{1,4}/g)?.join(' ') ?? address
}
