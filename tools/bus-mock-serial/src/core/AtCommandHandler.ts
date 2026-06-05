// tools/bus-mock-serial/src/core/AtCommandHandler.ts

import type { DataEngine } from './DataEngine.js'
import type { ScenarioConfig } from '../scenarios/types.js'
import { imuScenario } from '../scenarios/imu.js'
import { telemetryScenario } from '../scenarios/telemetry.js'

const BUILTIN_SCENARIOS: Record<string, ScenarioConfig> = {
  imu: imuScenario,
  telemetry: telemetryScenario,
}

export class AtCommandHandler {
  private engine: DataEngine
  private customScenarios: Record<string, ScenarioConfig> = {}

  constructor(engine: DataEngine) {
    this.engine = engine
  }

  /** 注册外部加载的自定义场景 */
  registerScenario(name: string, config: ScenarioConfig): void {
    this.customScenarios[name] = config
  }

  /**
   * 解析并执行 AT 指令
   * @param line 完整的 AT 指令行（不含尾部换行）
   * @returns 响应字符串
   */
  handle(line: string): string {
    const trimmed = line.trim()

    if (trimmed === 'AT') {
      return 'OK'
    }

    if (trimmed === 'AT+STOP') {
      return this.engine.pauseOutput()
    }

    if (trimmed === 'AT+START') {
      return this.engine.resumeOutput()
    }

    if (trimmed === 'AT+INFO?') {
      return this.engine.getInfo()
    }

    // AT+SCENE=<name>
    const sceneMatch = trimmed.match(/^AT\+SCENE=(.+)$/)
    if (sceneMatch) {
      const name = sceneMatch[1]
      const scenario = BUILTIN_SCENARIOS[name] ?? this.customScenarios[name]
      if (!scenario) return 'ERROR:NOT_FOUND'
      this.engine.switchScenario(scenario)
      return 'OK'
    }

    // AT+RATE=<ms>
    const rateMatch = trimmed.match(/^AT\+RATE=(\d+)$/)
    if (rateMatch) {
      const ms = parseInt(rateMatch[1], 10)
      if (ms < 10) return 'ERROR:RATE_TOO_LOW'
      return this.engine.setInterval(ms)
    }

    // AT+NOISE=<0-1>
    const noiseMatch = trimmed.match(/^AT\+NOISE=(\d*\.?\d+)$/)
    if (noiseMatch) {
      const scale = parseFloat(noiseMatch[1])
      if (scale < 0 || scale > 1) return 'ERROR:INVALID_RANGE'
      return this.engine.setNoiseScale(scale)
    }

    // AT+DRIFT=<0-1>
    const driftMatch = trimmed.match(/^AT\+DRIFT=(\d*\.?\d+)$/)
    if (driftMatch) {
      const scale = parseFloat(driftMatch[1])
      if (scale < 0 || scale > 1) return 'ERROR:INVALID_RANGE'
      return this.engine.setDriftScale(scale)
    }

    // AT+FIELD=<key>,<value>
    const fieldMatch = trimmed.match(/^AT\+FIELD=(\w+),(\d*\.?\d+)$/)
    if (fieldMatch) {
      const key = fieldMatch[1]
      const value = parseFloat(fieldMatch[2])
      return this.engine.setFieldOverride(key, value)
    }

    return 'ERROR:UNKNOWN_COMMAND'
  }

  /** 从缓冲区中提取完整的 AT 指令行 */
  static extractLines(buffer: string): string[] {
    return buffer.split('\n').filter(line => line.trim().startsWith('AT'))
  }
}