import './style.css'
import { copyText, micAvailable } from './lib/clipboard'
import { makeAudioContext, mixToMono } from './lib/pcm'
import { seedFromMono, type Seed } from './lib/seed'
import { formatCallsign, parseWavPcm } from './lib/wav'
import { TakeRecorder } from './record'
import { paintVu } from './vu'

const booth = document.querySelector<HTMLDivElement>('#booth')!
const capsule = document.querySelector<HTMLButtonElement>('#capsule')!
const word = document.querySelector<HTMLSpanElement>('#capsule-word')!
const meter = document.querySelector<HTMLSpanElement>('#capsule-meter')!
const status = document.querySelector<HTMLParagraphElement>('#status')!
const plate = document.querySelector<HTMLElement>('#plate')!
const addressEl = document.querySelector<HTMLElement>('#address')!
const chipsEl = document.querySelector<HTMLDivElement>('#chips')!
const crumb = document.querySelector<HTMLParagraphElement>('#crumb')!
const copyBtn = document.querySelector<HTMLButtonElement>('#copy')!
const againBtn = document.querySelector<HTMLButtonElement>('#again')!
const fileInput = document.querySelector<HTMLInputElement>('#file')!
const dropLabel = document.querySelector<HTMLSpanElement>('#drop-label')!
const canvas = document.querySelector<HTMLCanvasElement>('#vu')!

const recorder = new TakeRecorder()
let ctx: AudioContext | null = null
let holding = false
let armed = false
let developing = false
let seed: Seed | null = null
let copyReset = 0

function setStatus(text: string): void {
  status.textContent = text
}

function setWord(text: string): void {
  word.textContent = text
}

function applyLevel(level: number): void {
  booth.style.setProperty('--level', level.toFixed(3))
}

function showPlate(next: Seed, source: 'mic' | 'file'): void {
  seed = next
  booth.classList.add('is-ready')
  plate.hidden = false
  addressEl.textContent = formatCallsign(next.address)
  chipsEl.replaceChildren(
    ...next.chips.map((chip) => {
      const el = document.createElement('span')
      el.className = 'chip'
      el.textContent = chip
      return el
    }),
  )
  const take = next.durationSec < 1.5 ? next.durationSec : 1.5
  const via = source === 'file' ? 'file' : 'booth'
  crumb.textContent = next.quiet
    ? `quiet take · ${via} · ${next.hashHex.slice(0, 8)}`
    : `${take.toFixed(1)}s · 16 kHz mono · ${via} · ${next.hashHex.slice(0, 8)}`
  setStatus(next.quiet ? 'callsign from a quiet take' : 'callsign on the plate')
  setWord('hold again')
  meter.textContent = ''
  copyBtn.textContent = 'copy address'
}

function clearPlate(): void {
  seed = null
  booth.classList.remove('is-ready')
  plate.hidden = true
  addressEl.textContent = ''
  chipsEl.replaceChildren()
  crumb.textContent = ''
  applyLevel(0)
}

function blockBooth(reason: 'insecure' | 'denied'): void {
  booth.classList.add('is-blocked')
  capsule.disabled = true
  if (reason === 'insecure') {
    setStatus('insecure context — drop a take instead')
    setWord('booth closed')
    dropLabel.textContent = 'drop a take · wav / webm / mp3'
  } else {
    setStatus('mic denied — drop a take instead')
    setWord('lens of the ear closed')
  }
}

async function audioCtx(): Promise<AudioContext> {
  if (!ctx) ctx = makeAudioContext()
  if (ctx.state === 'suspended') await ctx.resume()
  return ctx
}

async function develop(mono: Float32Array, sampleRate: number, source: 'mic' | 'file'): Promise<void> {
  developing = true
  setWord('developing')
  setStatus('hashing the take')
  meter.textContent = ''
  try {
    const next = await seedFromMono(mono, sampleRate)
    showPlate(next, source)
  } catch (err) {
    setStatus(err instanceof Error ? err.message : 'could not develop that take')
    setWord('hold to speak')
  } finally {
    developing = false
    applyLevel(0)
  }
}

async function beginHold(): Promise<void> {
  if (developing || holding || !micAvailable()) return
  holding = true
  armed = true
  clearPlate()
  booth.classList.add('is-live')
  capsule.setAttribute('aria-pressed', 'true')
  setWord('listening')
  setStatus('release to hash')
  try {
    const ac = await audioCtx()
    if (!armed) return
    await recorder.start(ac, () => {
      void endHold()
    })
    if (!armed) {
      recorder.stop()
      return
    }
  } catch (err) {
    holding = false
    armed = false
    booth.classList.remove('is-live')
    capsule.setAttribute('aria-pressed', 'false')
    const name = err instanceof DOMException ? err.name : ''
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      blockBooth('denied')
      return
    }
    setStatus(err instanceof Error ? err.message : 'mic failed — drop a take')
    setWord('hold to speak')
  }
}

async function endHold(): Promise<void> {
  if (!holding && !armed) return
  armed = false
  holding = false
  booth.classList.remove('is-live')
  capsule.setAttribute('aria-pressed', 'false')
  applyLevel(0)
  const take = recorder.stop()
  if (!take) {
    setWord('hold to speak')
    setStatus('no buffer — hold a little longer')
    return
  }
  await develop(take.mono, take.sampleRate, 'mic')
}

function bindHold(): void {
  const onDown = (event: PointerEvent) => {
    if (capsule.disabled || event.button !== 0) return
    event.preventDefault()
    capsule.setPointerCapture(event.pointerId)
    void beginHold()
  }
  const onUp = (event: PointerEvent) => {
    if (!capsule.hasPointerCapture(event.pointerId) && !holding && !armed) return
    event.preventDefault()
    if (capsule.hasPointerCapture(event.pointerId)) {
      capsule.releasePointerCapture(event.pointerId)
    }
    void endHold()
  }
  capsule.addEventListener('pointerdown', onDown)
  capsule.addEventListener('pointerup', onUp)
  capsule.addEventListener('pointercancel', onUp)
  capsule.addEventListener('lostpointercapture', () => {
    if (holding || armed) void endHold()
  })
  capsule.addEventListener('contextmenu', (event) => event.preventDefault())

  const spaceTarget = (target: EventTarget | null) =>
    target === document.body || target === document.documentElement || target === capsule

  window.addEventListener('keydown', (event) => {
    if (event.code !== 'Space' || event.repeat || !spaceTarget(event.target)) return
    event.preventDefault()
    void beginHold()
  })
  window.addEventListener('keyup', (event) => {
    if (event.code !== 'Space') return
    event.preventDefault()
    void endHold()
  })
}

async function ingestFile(file: File): Promise<void> {
  if (developing) return
  if (holding || armed) {
    armed = false
    holding = false
    recorder.stop()
    booth.classList.remove('is-live')
  }
  clearPlate()
  setWord('developing')
  setStatus(`decoding ${file.name}`)
  try {
    const raw = await file.arrayBuffer()
    const wav = parseWavPcm(raw)
    if (wav) {
      await develop(wav.mono, wav.sampleRate, 'file')
      return
    }
    const ac = await audioCtx()
    const buffer = await ac.decodeAudioData(raw.slice(0))
    const mono = mixToMono(buffer)
    await develop(mono, buffer.sampleRate, 'file')
  } catch (err) {
    setWord('hold to speak')
    setStatus(err instanceof Error ? err.message : 'could not read that file')
  }
}

function bindFiles(): void {
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0]
    fileInput.value = ''
    if (file) void ingestFile(file)
  })

  const onDrag = (event: DragEvent) => {
    event.preventDefault()
    booth.classList.add('is-drop')
  }
  booth.addEventListener('dragenter', onDrag)
  booth.addEventListener('dragover', onDrag)
  booth.addEventListener('dragleave', (event) => {
    if (event.relatedTarget && booth.contains(event.relatedTarget as Node)) return
    booth.classList.remove('is-drop')
  })
  booth.addEventListener('drop', (event) => {
    event.preventDefault()
    booth.classList.remove('is-drop')
    const file = event.dataTransfer?.files[0]
    if (file) void ingestFile(file)
  })
}

function bindPlate(): void {
  copyBtn.addEventListener('click', async () => {
    if (!seed) return
    const ok = await copyText(seed.address)
    copyBtn.textContent = ok ? 'copied' : 'copy failed'
    window.clearTimeout(copyReset)
    copyReset = window.setTimeout(() => {
      copyBtn.textContent = 'copy address'
    }, 1400)
  })
  againBtn.addEventListener('click', () => {
    clearPlate()
    if (!capsule.disabled) {
      setWord('hold to speak')
      setStatus('hold the capsule')
    }
  })
}

function loop(): void {
  paintVu(canvas, recorder.analyserNode, holding)
  if (holding) {
    applyLevel(recorder.level)
    meter.textContent = `${Math.min(2, recorder.elapsedSec).toFixed(1)}s`
  }
  requestAnimationFrame(loop)
}

function boot(): void {
  bindHold()
  bindFiles()
  bindPlate()
  requestAnimationFrame(loop)

  if (!micAvailable()) {
    blockBooth('insecure')
    return
  }
  setStatus('hold the capsule')
}

boot()
