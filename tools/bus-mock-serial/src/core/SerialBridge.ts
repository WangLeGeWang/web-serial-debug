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