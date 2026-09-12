# micseed

Hold to speak (or hum). Hash the sound. Get a Solana-ish address out.

Live: **https://robertkodes.github.io/micseed/**

Sibling to [drawseed](https://github.com/RobertKodes/drawseed) (ink) and [camseed](https://github.com/RobertKodes/camseed) (light). Hearing is the input. Not [hearslot](https://github.com/RobertKodes/hearslot) (chain → sound). Not a wallet, not an explorer, not a fee/slot costume.

## Design thesis

The booth stays dark so the voice can be the only light.
One filament — amber — blooms inside a capsule when you hold.
The waveform is a tape-head scrape across that capsule, not a dashboard chart.
The address arrives like a callsign, stamped in mono on a studio plate.
No Inter, no purple, no cards, no hero: hold, hear yourself, take a seed.

Type: **Instrument Serif** (station face) + **IBM Plex Mono** (callsign). Fallbacks are Palatino / Courier New.

| token | hex | job |
| --- | --- | --- |
| `booth` | `#0b0907` | dark field |
| `oak` | `#1a1410` | panel / capsule well |
| `oxide` | `#3d2a18` | tape edges |
| `dust` | `#8c7a62` | mute labels |
| `paper` | `#e6d6ba` | warm ink |
| `filament` | `#e39a3c` | the one accent |
| `bloom` | `#ffc46a` | peak glow |

## How it works

1. **Hold** the capsule (pointer or touch). That gesture starts `getUserMedia({ audio: true })` and an `AudioContext`. Release stops. A two-second ceiling cuts the take.
2. While holding, an analyser paints spectrum bars inside the capsule and the filament blooms with level.
3. On release we keep **0.5–1.5 s** of mono PCM, resample to **16 kHz**, peak-normalize, quantize to little-endian int16, then **SHA-256** (Web Crypto).
4. The 32-byte digest is **base58**-encoded (Solana alphabet). That string is 32–44 chars — a PDA-*looking* preview, not `findProgramAddress` with a program id.
5. Same pipeline for a dropped or picked **.wav / .webm / .mp3**. PCM `.wav` is parsed in-app (stable across browsers); compressed formats go through Web Audio decode. First 1.5 s. Same bytes → same address.
6. Copy the callsign. **Resample** clears the plate and arms another take.
7. Denied mic or insecure context: the booth says so; file drop still works. No wallet, no signing, no RPC.

This is a *preview* seed from the take. It is not a real program-derived PDA. Do not send funds to a hum.

## Local

```bash
npm i
npm run dev
```

The app is built at `/micseed/` (GitHub Pages project path). Production check:

```bash
npm run build && npm run preview
```

Tests (hash + base58 stability):

```bash
npm test
```

## Pages

`vite.config.ts` sets `base: '/micseed/'`. Push to `main` runs `.github/workflows/pages.yml` (`actions/deploy-pages`). The workflow also writes `dist/.nojekyll` and a `404.html` copy.

Manual republish of a built `dist/` to the `gh-pages` branch:

```bash
npm run pages
```

If the live URL 404s, repo Settings → Pages → GitHub Actions (or branch `gh-pages`, folder `/`).
