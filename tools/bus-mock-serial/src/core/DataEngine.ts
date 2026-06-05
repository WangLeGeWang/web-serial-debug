// tools/bus-mock-serial/src/core/DataEngine.ts

import type { ScenarioConfig, EngineState, FieldConfig } from '../scenarios/types.js'
import { computeFieldValue } from '../utils/noise.js'
import { getFormatFn, type FormatFn } from '../utils/format.js'

export type DataOutput = string | Buffer

export interface DataEngineCallbacks {
  onData: (data: DataOutput) => void
  onResponse: (response: string) => void
}

export class DataEngine {
  private config: ScenarioConfig
  private state: EngineState
  private startTime: number
  private formatFn: FormatFn
  private timer: ReturnType<typeof setInterval> | null = null
  private callbacks: DataEngineCallbacks

  constructor(config: ScenarioConfig, callbacks: DataEngineCallbacks) {
    this.config = config
    this.callbacks = callbacks
    this.state = {
      interval: config.interval,
      noiseScale: 1.0,
      driftScale: 1.0,
      stopped: false,
      fieldOverrides: new Map()
    }
    this.startTime = Date.now()
    this.formatFn = getFormatFn(config.format)
  }

  start(): void {
    if (this.timer) return
    this.startTime = Date.now()
    this.state.stopped = false
    this.timer = setInterval(() => this.tick(), this.state.interval)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.state.stopped = true
  }

  destroy(): void {
    this.stop()
  }

  private tick(): void {
    if (this.state.stopped) return

    const elapsedSecs = (Date.now() - this.startTime) / 1000
    const values = new Map<string, number>()

    for (const field of this.config.fields) {
      const override = this.state.fieldOverrides.get(field.key)
      const value = computeFieldValue(field, elapsedSecs, this.state.noiseScale, this.state.driftScale, override)
      values.set(field.key, value)
    }

    const output = this.formatFn(values)
    this.callbacks.onData(output)
  }

  /** AT 指令修改参数后可能需要重启定时器 */
  setInterval(ms: number): string {
    this.state.interval = ms
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = setInterval(() => this.tick(), this.state.interval)
    }
    return 'OK'
  }

  setNoiseScale(scale: number): string {
    this.state.noiseScale = scale
    return 'OK'
  }

  setDriftScale(scale: number): string {
    this.state.driftScale = scale
    return 'OK'
  }

  setFieldOverride(key: string, value: number): string {
    const field = this.config.fields.find(f => f.key === key)
    if (!field) return 'ERROR:FIELD_NOT_FOUND'
    this.state.fieldOverrides.set(key, value)
    return 'OK'
  }

  clearFieldOverride(key: string): string {
    this.state.fieldOverrides.delete(key)
    return 'OK'
  }

  pauseOutput(): string {
    this.state.stopped = true
    return 'OK'
  }

  resumeOutput(): string {
    this.state.stopped = false
    return 'OK'
  }

  /** 切换场景：重置引擎状态并重新开始 */
  switchScenario(newConfig: ScenarioConfig): void {
    this.stop()
    this.config = newConfig
    this.formatFn = getFormatFn(newConfig.format)
    this.state = {
      interval: newConfig.interval,
      noiseScale: 1.0,
      driftScale: 1.0,
      stopped: false,
      fieldOverrides: new Map()
    }
    this.startTime = Date.now()
    this.start()
  }

  getInfo(): string {
    const parts = [
      `SCENE:${this.config.name}`,
      `RATE:${this.state.interval}`,
      `NOISE:${this.state.noiseScale}`,
      `DRIFT:${this.state.driftScale}`,
      `FIELDS:${this.config.fields.length}`,
    ]
    return parts.join(',')
  }

  getConfig(): ScenarioConfig {
    return this.config
  }

  getState(): EngineState {
    return this.state
  }
}