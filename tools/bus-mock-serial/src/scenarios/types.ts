// tools/bus-mock-serial/src/scenarios/types.ts

export interface FieldConfig {
  key: string
  base: number
  range?: [number, number]  // [min, max] 限制值范围
  noise?: number            // 噪声幅度系数
  drift?: number            // 每秒漂移量
  unit?: string             // 显示单位（仅信息用途）
}

export interface ScenarioConfig {
  name: string
  description: string
  interval: number          // 输出间隔(ms)
  format: 'csv' | 'json' | 'hex'
  fields: FieldConfig[]
}

export interface EngineState {
  interval: number
  noiseScale: number        // 全局噪声缩放系数（1.0 = 默认）
  driftScale: number        // 全局漂移缩放系数
  stopped: boolean
  fieldOverrides: Map<string, number>  // AT+FIELD 固定值
}