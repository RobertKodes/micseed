import { MAX_SEC, concatFloat32 } from './lib/pcm'

export class TakeRecorder {
  private ctx: AudioContext | null = null
  private stream: MediaStream | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private processor: ScriptProcessorNode | null = null
  private mute: GainNode | null = null
  private analyser: AnalyserNode | null = null
  private chunks: Float32Array[] = []
  private startedAt = 0
  private rms = 0
  private onMax: (() => void) | null = null
  private maxTimer = 0

  get analyserNode(): AnalyserNode | null {
    return this.analyser
  }

  get level(): number {
    return this.rms
  }

  get elapsedSec(): number {
    return this.startedAt ? (performance.now() - this.startedAt) / 1000 : 0
  }

  async start(ctx: AudioContext, onMax?: () => void): Promise<void> {
    this.dispose()
    this.onMax = onMax ?? null
    if (ctx.state === 'suspended') await ctx.resume()
    this.ctx = ctx
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    this.source = ctx.createMediaStreamSource(this.stream)
    this.analyser = ctx.createAnalyser()
    this.analyser.fftSize = 1024
    this.analyser.smoothingTimeConstant = 0.72
    this.processor = ctx.createScriptProcessor(2048, 1, 1)
    this.mute = ctx.createGain()
    this.mute.gain.value = 0
    this.chunks = []
    this.rms = 0
    this.startedAt = performance.now()

    this.processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0)
      this.chunks.push(new Float32Array(input))
      let sum = 0
      for (let i = 0; i < input.length; i++) sum += input[i]! * input[i]!
      this.rms = Math.min(1, Math.sqrt(sum / input.length) * 3.2)
    }

    this.source.connect(this.analyser)
    this.analyser.connect(this.processor)
    this.processor.connect(this.mute)
    this.mute.connect(ctx.destination)

    this.maxTimer = window.setTimeout(() => {
      this.onMax?.()
    }, MAX_SEC * 1000)
  }

  stop(): { mono: Float32Array; sampleRate: number } | null {
    const sampleRate = this.ctx?.sampleRate ?? 48_000
    const mono = concatFloat32(this.chunks)
    this.teardownGraph()
    if (mono.length === 0) return null
    return { mono, sampleRate }
  }

  dispose(): void {
    this.teardownGraph()
    this.chunks = []
    this.rms = 0
    this.startedAt = 0
  }

  private teardownGraph(): void {
    if (this.maxTimer) {
      clearTimeout(this.maxTimer)
      this.maxTimer = 0
    }
    if (this.processor) {
      this.processor.onaudioprocess = null
      this.processor.disconnect()
      this.processor = null
    }
    this.source?.disconnect()
    this.analyser?.disconnect()
    this.mute?.disconnect()
    this.source = null
    this.analyser = null
    this.mute = null
    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop()
      this.stream = null
    }
  }
}
