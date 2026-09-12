import { prefersReducedMotion } from './lib/clipboard'

const BARS = 28

export function sizeCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const { width, height } = canvas.getBoundingClientRect()
  const w = Math.max(1, Math.round(width * dpr))
  const h = Math.max(1, Math.round(height * dpr))
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return ctx
}

const idle = new Array<number>(BARS).fill(0.08)
const shown = new Array<number>(BARS).fill(0.08)

export function paintVu(
  canvas: HTMLCanvasElement,
  analyser: AnalyserNode | null,
  holding: boolean,
): void {
  const ctx = sizeCanvas(canvas)
  if (!ctx) return
  const { width, height } = canvas.getBoundingClientRect()
  ctx.clearRect(0, 0, width, height)

  const reduce = prefersReducedMotion()
  const bins = new Uint8Array(analyser?.frequencyBinCount ?? 0)
  if (analyser && holding) analyser.getByteFrequencyData(bins)

  const padX = width * 0.1
  const inner = width - padX * 2
  const gap = 3
  const barW = (inner - gap * (BARS - 1)) / BARS
  const mid = height / 2

  for (let i = 0; i < BARS; i++) {
    let target = idle[i]!
    if (analyser && holding && bins.length) {
      const start = Math.floor((i / BARS) * bins.length * 0.42)
      const end = Math.max(start + 1, Math.floor(((i + 1) / BARS) * bins.length * 0.42))
      let acc = 0
      for (let k = start; k < end; k++) acc += bins[k] ?? 0
      target = Math.min(1, (acc / (end - start) / 255) * 1.35 + 0.06)
    }
    shown[i] = reduce ? target : shown[i]! + (target - shown[i]!) * 0.28
    const h = shown[i]! * (height * 0.72)
    const x = padX + i * (barW + gap)
    ctx.fillStyle = holding ? '#e39a3c' : '#3d2a18'
    ctx.globalAlpha = holding ? 0.55 + shown[i]! * 0.4 : 0.55
    ctx.beginPath()
    const r = Math.min(barW / 2, 2)
    roundRect(ctx, x, mid - h / 2, barW, Math.max(2, h), r)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
