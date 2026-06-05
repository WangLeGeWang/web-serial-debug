# bus-mock-serial 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 创建一个 Node.js 虚拟串口工具，支持 socat 虚拟串口 + WebSocket 双模式输出、AT 指令动态控制、IMU/遥测数据场景，用于 BUS Studio 开发调试和自动化测试。

**架构：** 单进程 Node.js CLI 工具，DataEngine 定时生成数据，经 AtCommandHandler 可动态调整参数，输出到 SerialBridge（socat 虚拟串口）或 WsServer（WebSocket）。AT 指令从同一通道接收并响应。

**技术栈：** Node.js + TypeScript + commander + ws + yaml

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `tools/bus-mock-serial/package.json` | 项目配置、依赖声明、bin 入口 |
| `tools/bus-mock-serial/tsconfig.json` | TypeScript 编译配置（ESM，Node 目标） |
| `tools/bus-mock-serial/src/scenarios/types.ts` | 场景配置类型定义（FieldConfig, ScenarioConfig） |
| `tools/bus-mock-serial/src/utils/noise.ts` | 噪声/漂移算法（gaussianNoise, applyDrift） |
| `tools/bus-mock-serial/src/utils/format.ts` | 数据格式化（formatCSV, formatJSON, formatHEX） |
| `tools/bus-mock-serial/src/scenarios/imu.ts` | IMU 场景默认配置对象 |
| `tools/bus-mock-serial/src/scenarios/telemetry.ts` | 遥测场景默认配置对象 |
| `tools/bus-mock-serial/src/core/DataEngine.ts` | 数据生成引擎（定时生成、参数管理） |
| `tools/bus-mock-serial/src/core/AtCommandHandler.ts` | AT 指令解析与响应处理 |
| `tools/bus-mock-serial/src/core/WsServer.ts` | WebSocket 服务端 |
| `tools/bus-mock-serial/src/core/SerialBridge.ts` | socat 虚拟串口管理 |
| `tools/bus-mock-serial/src/cli.ts` | CLI 入口，参数解析，组件组装 |
| `tools/bus-mock-serial/config/imu.yaml` | IMU YAML 配置文件 |
| `tools/bus-mock-serial/config/telemetry.yaml` | 遥测 YAML 配置文件 |

---

### 任务 1：项目脚手架

**文件：**
- 创建：`tools/bus-mock-serial/package.json`
- 创建：`tools/bus-mock-serial/tsconfig.json`

- [ ] **步骤 1：创建 package.json**

```json
{
  "name": "bus-mock-serial",
  "version": "1.0.0",
  "description": "Virtual serial port tool for BUS Studio development and testing",
  "type": "module",
  "bin": {
    "bus-mock-serial": "./dist/cli.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node dist/cli.js"
  },
  "dependencies": {
    "commander": "^12.1.0",
    "ws": "^8.18.0",
    "yaml": "^2.7.0"
  },
  "devDependencies": {
    "@types/ws": "^8.18.0",
    "@types/node": "^22.15.0",
    "typescript": "~5.7.2"
  }
}
```

- [ ] **步骤 2：创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **步骤 3：安装依赖**

运行：`cd tools/bus-mock-serial && npm install`
预期：依赖安装成功

- [ ] **步骤 4：创建 src 目录结构**

运行：`mkdir -p tools/bus-mock-serial/src/core tools/bus-mock-serial/src/scenarios tools/bus-mock-serial/src/utils tools/bus-mock-serial/config`

- [ ] **步骤 5：Commit**

```bash
git add tools/bus-mock-serial/package.json tools/bus-mock-serial/tsconfig.json tools/bus-mock-serial/node_modules tools/bus-mock-serial/package-lock.json
git commit -m "feat(mock-serial): init project scaffold with dependencies"
```

注意：node_modules 应在 .gitignore 中，仅提交 package.json 和 package-lock.json。

---

### 任务 2：场景类型定义 + 噪声/漂移算法

**文件：**
- 创建：`tools/bus-mock-serial/src/scenarios/types.ts`
- 创建：`tools/bus-mock-serial/src/utils/noise.ts`

- [ ] **步骤 1：编写 types.ts — 场景配置类型**

```typescript
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
```

- [ ] **步骤 2：编写 noise.ts — 噪声/漂移算法**

```typescript
// tools/bus-mock-serial/src/utils/noise.ts

/** Box-Muller 变换生成高斯随机数 */
export function gaussianRandom(): number {
  const u1 = Math.random()
  const u2 = Math.random()
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2)
}

/**
 * 计算字段当前值
 * value = base + drift * elapsedSecs * driftScale + gaussianNoise * noise * noiseScale
 * 如果有 override 值，直接返回 override
 */
export function computeFieldValue(
  field: { base: number; noise?: number; drift?: number; range?: [number, number] },
  elapsedSecs: number,
  noiseScale: number,
  driftScale: number,
  override?: number
): number {
  if (override !== undefined) {
    return override
  }

  let value = field.base

  // 漂移
  if (field.drift !== undefined) {
    value += field.drift * elapsedSecs * driftScale
  }

  // 噪声
  if (field.noise !== undefined && field.noise > 0) {
    value += gaussianRandom() * field.noise * noiseScale
  }

  // 范围限制
  if (field.range) {
    value = Math.max(field.range[0], Math.min(field.range[1], value))
  }

  return value
}
```

- [ ] **步骤 3：编译验证**

运行：`cd tools/bus-mock-serial && npx tsc --noEmit`
预期：编译通过，无错误

- [ ] **步骤 4：Commit**

```bash
git add tools/bus-mock-serial/src/scenarios/types.ts tools/bus-mock-serial/src/utils/noise.ts
git commit -m "feat(mock-serial): add scenario types and noise/drift algorithms"
```

---

### 任务 3：数据格式化

**文件：**
- 创建：`tools/bus-mock-serial/src/utils/format.ts`

- [ ] **步骤 1：编写 format.ts — CSV/JSON/HEX 格式化**

```typescript
// tools/bus-mock-serial/src/utils/format.ts

import type { FieldConfig } from '../scenarios/types.js'

/**
 * CSV 格式: "pitch:0.13,roll:0.00,yaw:0.07\n"
 * 与 BUS Studio 默认脚本兼容
 */
export function formatCSV(values: Map<string, number>): string {
  const parts: string[] = []
  for (const [key, value] of values) {
    parts.push(`${key}:${value.toFixed(2)}`)
  }
  return parts.join(',') + '\n'
}

/**
 * JSON 格式: {"pitch":0.13,"roll":0.00}\n
 */
export function formatJSON(values: Map<string, number>): string {
  const obj: Record<string, number> = {}
  for (const [key, value] of values) {
    obj[key] = Number(value.toFixed(4))
  }
  return JSON.stringify(obj) + '\n'
}

/**
 * HEX 格式: 二进制帧
 * 帧结构: [0xAA, 0x55] + fieldCount(1byte) + float32值们(N*4bytes) + checksum(1byte)
 * checksum = XOR 所有字节（不含帧头）
 */
export function formatHEX(values: Map<string, number>): Buffer {
  const fieldCount = values.size
  const payloadLen = 1 + fieldCount * 4  // fieldCount + values
  const buf = Buffer.alloc(2 + payloadLen + 1)  // header + payload + checksum

  buf[0] = 0xAA  // 帧头1
  buf[1] = 0x55  // 帧头2
  buf[2] = fieldCount

  let offset = 3
  for (const [, value] of values) {
    buf.writeFloatLE(value, offset)
    offset += 4
  }

  // XOR 校验和（从 fieldCount 到最后一个 value 字节）
  let checksum = 0
  for (let i = 2; i < offset; i++) {
    checksum ^= buf[i]
  }
  buf[offset] = checksum

  return buf
}

export type FormatFn = (values: Map<string, number>) => string | Buffer

export function getFormatFn(format: 'csv' | 'json' | 'hex'): FormatFn {
  switch (format) {
    case 'csv': return formatCSV
    case 'json': return formatJSON
    case 'hex': return formatHEX
  }
}
```

- [ ] **步骤 2：编译验证**

运行：`cd tools/bus-mock-serial && npx tsc --noEmit`
预期：编译通过

- [ ] **步骤 3：Commit**

```bash
git add tools/bus-mock-serial/src/utils/format.ts
git commit -m "feat(mock-serial): add data formatters (CSV/JSON/HEX)"
```

---

### 任务 4：IMU + 遥测场景默认配置

**文件：**
- 创建：`tools/bus-mock-serial/src/scenarios/imu.ts`
- 创建：`tools/bus-mock-serial/src/scenarios/telemetry.ts`
- 创建：`tools/bus-mock-serial/config/imu.yaml`
- 创建：`tools/bus-mock-serial/config/telemetry.yaml`

- [ ] **步骤 1：编写 imu.ts — IMU 场景默认配置对象**

```typescript
// tools/bus-mock-serial/src/scenarios/imu.ts

import type { ScenarioConfig } from './types.js'

export const imuScenario: ScenarioConfig = {
  name: 'imu',
  description: 'IMU 传感器模拟',
  interval: 50,
  format: 'csv',
  fields: [
    { key: 'pitch', base: 0, range: [-90, 90], noise: 0.02, drift: 0.001 },
    { key: 'roll', base: 0, range: [-180, 180], noise: 0.02 },
    { key: 'yaw', base: 0, range: [0, 360], noise: 0.01 },
    { key: 'ax', base: 0, noise: 0.5 },
    { key: 'ay', base: 0, noise: 0.5 },
    { key: 'az', base: 9.8, noise: 0.3 },
  ]
}
```

- [ ] **步骤 2：编写 telemetry.ts — 遥测场景默认配置对象**

```typescript
// tools/bus-mock-serial/src/scenarios/telemetry.ts

import type { ScenarioConfig } from './types.js'

export const telemetryScenario: ScenarioConfig = {
  name: 'telemetry',
  description: '火箭遥测模拟',
  interval: 100,
  format: 'json',
  fields: [
    { key: 'altitude', base: 0, range: [0, 10000], noise: 1.0, drift: 0.5 },
    { key: 'velocity', base: 0, range: [0, 500], noise: 2.0 },
    { key: 'temperature', base: 25, range: [-40, 80], noise: 0.1 },
    { key: 'pressure', base: 101325, range: [0, 101325], noise: 10 },
    { key: 'gps_lat', base: 39.9, noise: 0.0001 },
    { key: 'gps_lon', base: 116.4, noise: 0.0001 },
    { key: 'battery', base: 100, range: [0, 100], drift: -0.01 },
  ]
}
```

- [ ] **步骤 3：编写 config/imu.yaml**

```yaml
name: imu
description: "IMU 传感器模拟"
interval: 50
format: csv
fields:
  - key: pitch
    base: 0
    range: [-90, 90]
    noise: 0.02
    drift: 0.001
  - key: roll
    base: 0
    range: [-180, 180]
    noise: 0.02
  - key: yaw
    base: 0
    range: [0, 360]
    noise: 0.01
  - key: ax
    base: 0
    noise: 0.5
  - key: ay
    base: 0
    noise: 0.5
  - key: az
    base: 9.8
    noise: 0.3
```

- [ ] **步骤 4：编写 config/telemetry.yaml**

```yaml
name: telemetry
description: "火箭遥测模拟"
interval: 100
format: json
fields:
  - key: altitude
    base: 0
    range: [0, 10000]
    noise: 1.0
    drift: 0.5
  - key: velocity
    base: 0
    range: [0, 500]
    noise: 2.0
  - key: temperature
    base: 25
    range: [-40, 80]
    noise: 0.1
  - key: pressure
    base: 101325
    range: [0, 101325]
    noise: 10
  - key: gps_lat
    base: 39.9
    noise: 0.0001
  - key: gps_lon
    base: 116.4
    noise: 0.0001
  - key: battery
    base: 100
    range: [0, 100]
    drift: -0.01
```

- [ ] **步骤 5：编译验证**

运行：`cd tools/bus-mock-serial && npx tsc --noEmit`
预期：编译通过

- [ ] **步骤 6：Commit**

```bash
git add tools/bus-mock-serial/src/scenarios/imu.ts tools/bus-mock-serial/src/scenarios/telemetry.ts tools/bus-mock-serial/config/imu.yaml tools/bus-mock-serial/config/telemetry.yaml
git commit -m "feat(mock-serial): add IMU and telemetry scenario configs"
```

---

### 任务 5：DataEngine — 数据生成引擎

**文件：**
- 创建：`tools/bus-mock-serial/src/core/DataEngine.ts`

- [ ] **步骤 1：编写 DataEngine.ts**

```typescript
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
```

- [ ] **步骤 2：编译验证**

运行：`cd tools/bus-mock-serial && npx tsc --noEmit`
预期：编译通过

- [ ] **步骤 3：Commit**

```bash
git add tools/bus-mock-serial/src/core/DataEngine.ts
git commit -m "feat(mock-serial): add DataEngine with tick generation and AT control"
```

---

### 任务 6：AtCommandHandler — AT 指令解析与响应

**文件：**
- 创建：`tools/bus-mock-serial/src/core/AtCommandHandler.ts`

- [ ] **步骤 1：编写 AtCommandHandler.ts**

```typescript
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
```

- [ ] **步骤 2：编译验证**

运行：`cd tools/bus-mock-serial && npx tsc --noEmit`
预期：编译通过

- [ ] **步骤 3：Commit**

```bash
git add tools/bus-mock-serial/src/core/AtCommandHandler.ts
git commit -m "feat(mock-serial): add AT command handler with parse and execute"
```

---

### 任务 7：WsServer — WebSocket 服务端

**文件：**
- 创建：`tools/bus-mock-serial/src/core/WsServer.ts`

- [ ] **步骤 1：编写 WsServer.ts**

```typescript
// tools/bus-mock-serial/src/core/WsServer.ts

import { WebSocketServer, WebSocket } from 'ws'
import type { DataEngine, DataOutput } from './DataEngine.js'
import { AtCommandHandler } from './AtCommandHandler.js'

export class WsServer {
  private wss: WebSocketServer | null = null
  private engine: DataEngine
  private atHandler: AtCommandHandler
  private clients: Set<WebSocket> = new Set()
  private port: number

  constructor(port: number, engine: DataEngine, atHandler: AtCommandHandler) {
    this.port = port
    this.engine = engine
    this.atHandler = atHandler
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.wss = new WebSocketServer({ port: this.port })

      this.wss.on('connection', (ws) => {
        this.clients.add(ws)
        console.log(`[WS] Client connected (${this.clients.size} total)`)

        ws.on('message', (data) => {
          const text = data instanceof Buffer ? data.toString('utf-8') : String(data)
          const lines = AtCommandHandler.extractLines(text)
          for (const line of lines) {
            const response = this.atHandler.handle(line)
            ws.send(response + '\n')
          }
        })

        ws.on('close', () => {
          this.clients.delete(ws)
          console.log(`[WS] Client disconnected (${this.clients.size} total)`)
        })

        ws.on('error', (err) => {
          console.error('[WS] Client error:', err.message)
          this.clients.delete(ws)
        })
      })

      this.wss.on('listening', () => {
        console.log(`[WS] WebSocket server listening on ws://localhost:${this.port}`)
        resolve()
      })
    })
  }

  /** DataEngine 回调：将数据推送到所有连接的客户端 */
  broadcast(data: DataOutput): void {
    const payload = typeof data === 'string' ? data : data.toString('hex') + '\n'
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        if (typeof data === 'string') {
          client.send(data)
        } else {
          client.send(data)
        }
      }
    }
  }

  stop(): void {
    for (const client of this.clients) {
      client.close()
    }
    this.clients.clear()
    if (this.wss) {
      this.wss.close()
      this.wss = null
    }
    console.log('[WS] Server stopped')
  }
}
```

- [ ] **步骤 2：编译验证**

运行：`cd tools/bus-mock-serial && npx tsc --noEmit`
预期：编译通过

- [ ] **步骤 3：Commit**

```bash
git add tools/bus-mock-serial/src/core/WsServer.ts
git commit -m "feat(mock-serial): add WebSocket server with AT command support"
```

---

### 任务 8：SerialBridge — socat 虚拟串口管理

**文件：**
- 创建：`tools/bus-mock-serial/src/core/SerialBridge.ts`

- [ ] **步骤 1：编写 SerialBridge.ts**

```typescript
// tools/bus-mock-serial/src/core/SerialBridge.ts

import { spawn, ChildProcess } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import type { DataEngine, DataOutput } from './DataEngine.js'
import { AtCommandHandler } from './AtCommandHandler.js'

export class SerialBridge {
  private socatProcess: ChildProcess | null = null
  private readFd: number | null = null
  private writeFd: number | null = null
  private readBuffer: string = ''
  private engine: DataEngine
  private atHandler: AtCommandHandler
  private port0: string
  private port1: string

  constructor(engine: DataEngine, atHandler: AtCommandHandler, portPrefix = '/tmp/ttyV') {
    this.engine = engine
    this.atHandler = atHandler
    this.port0 = `${portPrefix}0`
    this.port1 = `${portPrefix}1`
  }

  /** 启动 socat 创建虚拟串口对 */
  async start(): Promise<void> {
    // 清理可能残留的旧链接
    this.cleanupLinks()

    console.log('[Serial] Creating virtual serial port pair...')

    this.socatProcess = spawn('socat', [
      '-d', '-d',
      `pty,link=${this.port0},raw,echo=0`,
      `pty,link=${this.port1},raw,echo=0`,
    ], {
      stdio: ['ignore', 'pipe', 'pipe']
    })

    // 等待 socat 就绪（PTY 链接文件出现）
    await this.waitForLinks()

    console.log(`[Serial] Virtual ports created: ${this.port0} (BUS Studio) <-> ${this.port1} (mock tool)`)

    // 打开 port1 的读写端
    this.writeFd = fs.openSync(this.port1, 'w')
    this.readFd = fs.openSync(this.port1, 'r+')

    // 监听 socat stderr 获取连接信息
    this.socatProcess.stderr?.on('data', (data: Buffer) => {
      const msg = data.toString().trim()
      if (msg.includes('starting data transfer')) {
        console.log('[Serial] Data transfer started')
      }
    })

    this.socatProcess.on('exit', (code) => {
      console.log(`[Serial] socat exited (code ${code})`)
    })

    // 开始从 port1 读取 BUS Studio 发来的 AT 指令
    this.startReading()
  }

  /** DataEngine 回调：将数据写入虚拟串口 */
  write(data: DataOutput): void {
    if (this.writeFd === null) return
    const buf = typeof data === 'string' ? Buffer.from(data) : data
    fs.writeSync(this.writeFd, buf)
  }

  /** 从串口读取端读取 AT 指令 */
  private startReading(): void {
    if (this.readFd === null) return

    const readLoop = () => {
      const buf = Buffer.alloc(256)
      try {
        const bytesRead = fs.readSync(this.readFd!, buf, 0, 256, null)
        if (bytesRead > 0) {
          this.readBuffer += buf.toString('utf-8', 0, bytesRead)
          this.processReadBuffer()
        }
      } catch {
        // 串口未就绪或已关闭
      }
      if (this.readFd !== null) {
        setTimeout(readLoop, 50)
      }
    }
    readLoop()
  }

  private processReadBuffer(): void {
    const lines = this.readBuffer.split('\n')
    // 保留最后一个不完整的行
    this.readBuffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('AT')) continue

      const response = this.atHandler.handle(trimmed)
      // AT 响应回传到同一串口
      this.write(response + '\n')
    }
  }

  private cleanupLinks(): void {
    try { fs.unlinkSync(this.port0) } catch {}
    try { fs.unlinkSync(this.port1) } catch {}
  }

  private async waitForLinks(): Promise<void> {
    const maxWait = 3000
    const checkInterval = 100
    let waited = 0

    while (waited < maxWait) {
      if (fs.existsSync(this.port0) && fs.existsSync(this.port1)) {
        return
      }
      await new Promise(r => setTimeout(r, checkInterval))
      waited += checkInterval
    }

    throw new Error(`Virtual serial ports not created after ${maxWait}ms. Is socat installed?`)
  }

  stop(): void {
    if (this.readFd !== null) {
      fs.closeSync(this.readFd)
      this.readFd = null
    }
    if (this.writeFd !== null) {
      fs.closeSync(this.writeFd)
      this.writeFd = null
    }
    if (this.socatProcess) {
      this.socatProcess.kill('SIGTERM')
      this.socatProcess = null
    }
    this.cleanupLinks()
    console.log('[Serial] Bridge stopped, ports cleaned up')
  }
}
```

- [ ] **步骤 2：编译验证**

运行：`cd tools/bus-mock-serial && npx tsc --noEmit`
预期：编译通过

- [ ] **步骤 3：Commit**

```bash
git add tools/bus-mock-serial/src/core/SerialBridge.ts
git commit -m "feat(mock-serial): add socat virtual serial bridge with AT read/write"
```

---

### 任务 9：CLI 入口 — 参数解析与组件组装

**文件：**
- 创建：`tools/bus-mock-serial/src/cli.ts`

- [ ] **步骤 1：编写 cli.ts**

```typescript
// tools/bus-mock-serial/src/cli.ts

import { Command } from 'commander'
import * as fs from 'fs'
import * as path from 'path'
import { parse } from 'yaml'
import { DataEngine, type DataOutput } from './core/DataEngine.js'
import { AtCommandHandler } from './core/AtCommandHandler.js'
import { WsServer } from './core/WsServer.js'
import { SerialBridge } from './core/SerialBridge.js'
import { imuScenario } from './scenarios/imu.js'
import { telemetryScenario } from './scenarios/telemetry.js'
import type { ScenarioConfig } from './scenarios/types.js'

const BUILTIN_SCENARIOS: Record<string, ScenarioConfig> = {
  imu: imuScenario,
  telemetry: telemetryScenario,
}

function loadScenario(nameOrPath: string): ScenarioConfig {
  // 先检查是否是内置场景名
  if (BUILTIN_SCENARIOS[nameOrPath]) {
    return BUILTIN_SCENARIOS[nameOrPath]
  }

  // 再检查是否是 YAML 文件路径
  const resolved = path.resolve(nameOrPath)
  if (fs.existsSync(resolved)) {
    const content = fs.readFileSync(resolved, 'utf-8')
    const parsed = parse(content) as ScenarioConfig
    if (!parsed.name || !parsed.fields) {
      throw new Error(`Invalid scenario config: missing 'name' or 'fields'`)
    }
    return parsed
  }

  // 最后检查 config/ 目录下的 YAML 文件
  const configDir = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'config')
  const yamlPath = path.join(configDir, `${nameOrPath}.yaml`)
  if (fs.existsSync(yamlPath)) {
    const content = fs.readFileSync(yamlPath, 'utf-8')
    return parse(content) as ScenarioConfig
  }

  throw new Error(`Scenario '${nameOrPath}' not found. Available: ${Object.keys(BUILTIN_SCENARIOS).join(', ')}`)
}

const program = new Command()
  .name('bus-mock-serial')
  .description('Virtual serial port tool for BUS Studio development and testing')
  .version('1.0.0')
  .option('--scenario <name>', 'Scenario name (imu/telemetry) or YAML file path', 'imu')
  .option('--mode <mode>', 'Output mode: serial/ws/both', 'both')
  .option('--baudrate <rate>', 'Serial baud rate (informational only)', '115200')
  .option('--ws-port <port>', 'WebSocket server port', '8080')
  .option('--interval <ms>', 'Override data output interval (ms)')
  .option('--format <fmt>', 'Override data format: csv/json/hex')
  .action(async (opts) => {
    console.log('=== BUS Studio Mock Serial Tool ===')
    console.log()

    // 加载场景配置
    let config: ScenarioConfig
    try {
      config = loadScenario(opts.scenario)
    } catch (e: any) {
      console.error(`Error: ${e.message}`)
      process.exit(1)
    }

    // CLI 参数覆盖场景默认值
    if (opts.interval) config.interval = parseInt(opts.interval, 10)
    if (opts.format) config.format = opts.format as 'csv' | 'json' | 'hex'

    console.log(`Scenario: ${config.name} (${config.description})`)
    console.log(`Format: ${config.format}, Interval: ${config.interval}ms, Fields: ${config.fields.length}`)
    console.log(`Mode: ${opts.mode}`)
    console.log()

    // 创建 DataEngine 和 AtCommandHandler
    const outputs: ((data: DataOutput) => void)[] = []

    const engine = new DataEngine(config, {
      onData: (data) => {
        for (const output of outputs) output(data)
      },
      onResponse: (response) => {
        // AT 响应由 SerialBridge/WsServer 直接回传
      }
    })

    const atHandler = new AtCommandHandler(engine)

    // 注册自定义场景到 AT 指令处理器
    for (const [name, scenario] of Object.entries(BUILTIN_SCENARIOS)) {
      atHandler.registerScenario(name, scenario)
    }

    // 根据模式启动输出通道
    let wsServer: WsServer | null = null
    let serialBridge: SerialBridge | null = null

    if (opts.mode === 'ws' || opts.mode === 'both') {
      wsServer = new WsServer(parseInt(opts.wsPort, 10), engine, atHandler)
      await wsServer.start()
      outputs.push((data) => wsServer!.broadcast(data))
    }

    if (opts.mode === 'serial' || opts.mode === 'both') {
      try {
        serialBridge = new SerialBridge(engine, atHandler)
        await serialBridge.start()
        outputs.push((data) => serialBridge!.write(data))
      } catch (e: any) {
        console.error(`[Serial] Error: ${e.message}`)
        console.error('[Serial] Falling back to WebSocket-only mode')
        serialBridge = null
      }
    }

    if (outputs.length === 0) {
      console.error('Error: No output channel available. Check socat installation or use --mode ws')
      process.exit(1)
    }

    // 启动数据引擎
    engine.start()
    console.log('Data engine started. Press Ctrl+C to stop.')
    console.log()
    console.log('AT Commands available:')
    console.log('  AT              — Heartbeat')
    console.log('  AT+SCENE=<name> — Switch scenario')
    console.log('  AT+RATE=<ms>    — Change output rate')
    console.log('  AT+NOISE=<0-1>  — Set noise scale')
    console.log('  AT+DRIFT=<0-1>  — Set drift scale')
    console.log('  AT+FIELD=<k>,<v> — Fix field value')
    console.log('  AT+STOP         — Stop output')
    console.log('  AT+START        — Resume output')
    console.log('  AT+INFO?        — Query status')

    // 优雅退出
    const cleanup = () => {
      console.log('\nShutting down...')
      engine.destroy()
      wsServer?.stop()
      serialBridge?.stop()
      process.exit(0)
    }

    process.on('SIGINT', cleanup)
    process.on('SIGTERM', cleanup)
  })

program.parse()
```

- [ ] **步骤 2：编译并运行验证**

运行：`cd tools/bus-mock-serial && npx tsc`
预期：编译成功，生成 dist/ 目录

运行：`cd tools/bus-mock-serial && node dist/cli.js --scenario imu --mode ws --ws-port 8080`
预期：启动 WebSocket 服务器，输出 IMU 数据

- [ ] **步骤 3：手动验证 WebSocket 模式**

在另一个终端用 wscat 或浏览器连接 ws://localhost:8080：
- 应看到 IMU 数据行持续推送
- 发送 `AT` 应收到 `OK`
- 发送 `AT+INFO?` 应收到状态信息
- 发送 `AT+STOP` 后数据停止
- 发送 `AT+START` 后数据恢复

- [ ] **步骤 4：手动验证 socat 模式（需要 socat）**

运行：`cd tools/bus-mock-serial && node dist/cli.js --scenario imu --mode both`
预期：
- socat 创建 /tmp/ttyV0 和 /tmp/ttyV1
- WebSocket 同时启动
- 用 BUS Studio Tauri 桌面端连接 /tmp/ttyV0

- [ ] **步骤 5：Commit**

```bash
git add tools/bus-mock-serial/src/cli.ts
git commit -m "feat(mock-serial): add CLI entry with commander options and component assembly"
```

---

### 任务 10：项目集成 — BUS Studio 便利脚本

**文件：**
- 修改：`package.json`（主项目的）

- [ ] **步骤 1：在 BUS Studio package.json 中添加便利脚本**

在主项目 `package.json` 的 `scripts` 部分添加：

```json
"mock-serial": "node tools/bus-mock-serial/dist/cli.js",
"mock-serial:build": "cd tools/bus-mock-serial && npm run build"
```

- [ ] **步骤 2：添加 tools/bus-mock-serial 的 .gitignore**

创建 `tools/bus-mock-serial/.gitignore`：

```
node_modules/
dist/
```

- [ ] **步骤 3：验证便利脚本**

运行：`npm run mock-serial:build && npm run mock-serial -- --scenario imu --mode ws --ws-port 8080`
预期：工具启动并输出 IMU 数据

- [ ] **步骤 4：Commit**

```bash
git add package.json tools/bus-mock-serial/.gitignore
git commit -m "feat(mock-serial): add convenience scripts and gitignore"
```

---

## 自检

### 1. 规格覆盖度

| 规格章节 | 对应任务 |
|----------|----------|
| 架构/文件结构 | 任务 1 |
| 数据流 | 任务 5-8（DataEngine → AtCommandHandler → SerialBridge/WsServer） |
| CLI | 任务 9 |
| CLI 参数表 | 任务 9 |
| AT 指令 | 任务 6 |
| 场景配置/YAML | 任务 4 |
| 输出格式 CSV/JSON/HEX | 任务 3 |
| SerialBridge/socat | 任务 8 |
| WsServer | 任务 7 |
| DataEngine | 任务 5 |
| 依赖表 | 任务 1 |
| 项目集成 | 任务 10 |

所有规格需求均有对应任务。

### 2. 占位符扫描

无 TODO/TBD/待定。所有步骤包含完整代码。

### 3. 类型一致性

- `ScenarioConfig` 在任务 2 定义，任务 4-9 全部使用同一类型
- `DataOutput` 在任务 5 定义为 `string | Buffer`，任务 7/8 的 write/broadcast 方法参数一致
- `FieldConfig` 在任务 2 定义，任务 5 的 computeFieldValue 参数与类型一致
- `EngineState` 在任务 2 定义，任务 5 的 DataEngine.state 使用同一类型
- AT 指令处理：AtCommandHandler.handle 返回 string，SerialBridge 和 WsServer 回传 string + '\n'