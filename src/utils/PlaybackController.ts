import { ref, onUnmounted } from 'vue'

export type PlaybackSpeed = 0.1 | 0.5 | 1 | 2 | 5 | 10
export type PlaybackDirection = 1 | -1
export type LoopMode = 'none' | 'loop'

export interface PlaybackControllerOptions {
  startTime: number
  endTime: number
  windowDuration?: number
  onTick?: (currentTime: number) => void
}

export class PlaybackController {
  private rafId: number | null = null
  private lastRealTime: number = 0

  public isPlaying = ref(false)
  public currentTime = ref(0)
  public speed: PlaybackSpeed = 1
  public direction: PlaybackDirection = 1
  public loopMode: LoopMode = 'none'

  private startTime: number
  private endTime: number
  private windowDuration: number
  private onTick?: (currentTime: number) => void

  constructor(options: PlaybackControllerOptions) {
    this.startTime = options.startTime
    this.endTime = options.endTime
    this.windowDuration = options.windowDuration || 30000
    this.onTick = options.onTick
    this.currentTime.value = startTime
  }

  play(): void {
    if (this.isPlaying.value) return
    this.isPlaying.value = true
    this.lastRealTime = performance.now()
    this.tick()
  }

  pause(): void {
    this.isPlaying.value = false
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  stop(): void {
    this.pause()
    this.currentTime.value = this.startTime
    this.onTick?.(this.currentTime.value)
  }

  seek(timestamp: number): void {
    const clamped = Math.max(this.startTime, Math.min(this.endTime, timestamp))
    this.currentTime.value = clamped
    this.onTick?.(clamped)
  }

  setSpeed(speed: PlaybackSpeed): void {
    this.speed = speed
  }

  setDirection(dir: PlaybackDirection): void {
    this.direction = dir
  }

  setLoopMode(mode: LoopMode): void {
    this.loopMode = mode
  }

  seekRelative(deltaMs: number): void {
    const newTime = this.currentTime.value + deltaMs
    this.seek(newTime)
  }

  private tick = (): void => {
    if (!this.isPlaying.value) return

    const now = performance.now()
    const delta = (now - this.lastRealTime) * this.speed * this.direction
    this.lastRealTime = now

    let newTime = this.currentTime.value + delta

    if (newTime > this.endTime) {
      if (this.loopMode === 'loop') {
        newTime = this.startTime
      } else {
        newTime = this.endTime
        this.pause()
      }
    } else if (newTime < this.startTime) {
      if (this.loopMode === 'loop') {
        newTime = this.endTime
      } else {
        newTime = this.startTime
        this.pause()
      }
    }

    this.currentTime.value = newTime
    this.onTick?.(newTime)

    if (this.isPlaying.value) {
      this.rafId = requestAnimationFrame(this.tick)
    }
  }

  destroy(): void {
    this.pause()
  }
}
