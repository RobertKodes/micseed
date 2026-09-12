/** Bitcoin / Solana alphabet — no 0, O, I, l. */
export const BASE58_ALPHABET =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

export function encodeBase58(bytes: Uint8Array): string {
  if (bytes.length === 0) return ''

  let zeros = 0
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++

  const size = Math.ceil((bytes.length * 138) / 100) + 1
  const b58 = new Uint8Array(size)
  let length = 0

  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i]
    let j = 0
    for (let k = size - 1; (carry !== 0 || j < length) && k !== -1; k--, j++) {
      carry += 256 * b58[k]
      b58[k] = carry % 58
      carry = (carry / 58) | 0
    }
    length = j
  }

  let it = size - length
  while (it < size && b58[it] === 0) it++

  let out = '1'.repeat(zeros)
  for (; it < size; it++) out += BASE58_ALPHABET[b58[it]]
  return out
}
