#!/usr/bin/env node
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