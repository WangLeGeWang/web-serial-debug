import { type IDevice, type DeviceInfo } from '../types'
import { desktopApi } from '../../utils/desktopApi'

type ReadResult = { done: boolean; value: Uint8Array }

export class DesktopSerialDevice implements IDevice {
  id: string
  title: string
  type: string = 'desktop-serial'
  port: any = null

  private portName: string = ''
  private baudRate: number = 115200
  private dataBits: number = 8
  private stopBits: string = '1'
  private parity: string = 'none'
  private flowControl: string = 'none'

  private inboundQueue: Uint8Array[] = []
  private pendingResolve: ((r: ReadResult) => void) | null = null
  private closed = false

  constructor(portName: string, baudRate: number = 115200) {
    this.portName = portName
    this.baudRate = baudRate
    this.id = `desktop-serial-${portName}`
    this.title = `串口 (${portName})`
  }

  static async getAvailablePorts(): Promise<string[]> {
    try {
      return await desktopApi.getSerialPorts()
    } catch {
      return []
    }
  }

  async init(): Promise<void> {
    await desktopApi.openSerial(
      {
        portName: this.portName,
        baudRate: this.baudRate,
        dataBits: this.dataBits,
        stopBits: String(this.stopBits),
        parity: this.parity,
        flowControl: this.flowControl,
      },
      (bytes) => this.handleIncoming(bytes),
    )
    this.closed = false
  }

  async request(): Promise<IDevice | null> {
    return this
  }

  async connect(config?: any): Promise<{
    writer: WritableStreamDefaultWriter
    reader: ReadableStreamDefaultReader
  } | null> {
    try {
      if (config?.baudRate) this.baudRate = config.baudRate
      if (config?.dataBits) this.dataBits = config.dataBits
      if (config?.stopBits) this.stopBits = String(config.stopBits)
      if (config?.parity) this.parity = config.parity
      if (config?.flowControl) this.flowControl = config.flowControl

      await this.init()

      const writer = {
        write: (chunk: Uint8Array) => desktopApi.writeSerial(chunk),
        close: () => desktopApi.closeSerial(),
        abort: () => desktopApi.closeSerial(),
        closed: Promise.resolve(),
        ready: Promise.resolve(),
        releaseLock: () => {},
      } as unknown as WritableStreamDefaultWriter

      const reader = {
        read: () =>
          new Promise<ReadResult>((resolve) => {
            if (this.closed) {
              resolve({ done: true, value: new Uint8Array() })
              return
            }
            const next = this.inboundQueue.shift()
            if (next) {
              resolve({ done: false, value: next })
            } else {
              this.pendingResolve = resolve
            }
          }),
        cancel: () => this.disconnect(),
        closed: Promise.resolve(),
        releaseLock: () => {},
      } as unknown as ReadableStreamDefaultReader

      return { writer, reader }
    } catch (error) {
      console.error('连接桌面串口失败:', error)
      return null
    }
  }

  async disconnect(): Promise<void> {
    this.closed = true
    try {
      await desktopApi.closeSerial()
    } catch {
      // 忽略关闭异常
    }
    if (this.pendingResolve) {
      this.pendingResolve({ done: true, value: new Uint8Array() })
      this.pendingResolve = null
    }
    this.inboundQueue = []
  }

  getInfo(): DeviceInfo {
    return { productName: this.portName }
  }

  private handleIncoming(bytes: Uint8Array) {
    if (this.pendingResolve) {
      const resolve = this.pendingResolve
      this.pendingResolve = null
      resolve({ done: false, value: bytes })
    } else {
      this.inboundQueue.push(bytes)
    }
  }
}

export const init = () => {}
export const request = () => Promise.resolve<DesktopSerialDevice | null>(null)
