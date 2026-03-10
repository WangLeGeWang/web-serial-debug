import { type IDevice, type DeviceInfo } from '../types'

declare global {
  interface Window {
    initSerial: (portName: string, baudRate: number, dataBits: number, stopBits: number, parity: string, flowControl: string) => Promise<void>
    writeSerial: (data: string) => Promise<void>
    readSerial: (callbackName: string) => void
    getSerialPorts: () => Promise<string[]>
    getVersionInfo: () => Promise<{ buildTime: string; version: string }>
  }
}

export class DesktopSerialDevice implements IDevice {
  id: string
  title: string
  type: string = 'desktop-serial'
  port: any = null
  private portName: string = ''
  private baudRate: number = 115200
  private dataBits: number = 8
  private stopBits: number = 1
  private parity: string = 'none'
  private flowControl: string = 'none'
  private onDataCallback: ((data: Uint8Array) => void) | null = null

  constructor(portName: string, baudRate: number = 115200) {
    this.portName = portName
    this.baudRate = baudRate
    this.id = `desktop-serial-${portName}`
    this.title = `串口 (${portName})`
  }

  static async getAvailablePorts(): Promise<string[]> {
    try {
      return await window.getSerialPorts()
    } catch {
      return []
    }
  }

  async init(): Promise<void> {
    try {
      await window.initSerial(this.portName, this.baudRate, this.dataBits, this.stopBits, this.parity, this.flowControl)
    } catch (error) {
      throw new Error(`初始化串口失败: ${error}`)
    }
  }

  async request(): Promise<IDevice | null> {
    return this
  }

  async connect(config?: any): Promise<{
    writer: WritableStreamDefaultWriter
    reader: ReadableStreamDefaultReader
  } | null> {
    try {
      if (config?.baudRate) {
        this.baudRate = config.baudRate
      }
      if (config?.dataBits) {
        this.dataBits = config.dataBits
      }
      if (config?.stopBits) {
        this.stopBits = config.stopBits
      }
      if (config?.parity) {
        this.parity = config.parity
      }
      if (config?.flowControl) {
        this.flowControl = config.flowControl
      }
      await this.init()

      const callbackName = `__desktopSerialCallback_${this.id.replace(/[^a-zA-Z0-9]/g, '_')}`
      const globalCallback = (data: string) => {
        if (this.onDataCallback) {
          const bytes = new TextEncoder().encode(data)
          this.onDataCallback(bytes)
        }
      }
      ;(window as any)[callbackName] = globalCallback

      const writer = {
        write: (chunk: Uint8Array) => {
          const str = new TextDecoder().decode(chunk)
          return window.writeSerial(str)
        },
        close: () => Promise.resolve(),
        abort: () => Promise.resolve(),
        closed: Promise.resolve(),
        ready: Promise.resolve(),
        releaseLock: () => {}
      }

      window.readSerial(callbackName)

      const reader = {
        read: () => new Promise<{ done: boolean; value: Uint8Array }>((resolve) => {
          this.onDataCallback = (data: Uint8Array) => {
            resolve({ done: false, value: data })
          }
        }),
        cancel: () => Promise.resolve(),
        closed: Promise.resolve(),
        releaseLock: () => {}
      }

      return { writer, reader }
    } catch (error) {
      console.error('连接桌面串口失败:', error)
      return null
    }
  }

  async disconnect(): Promise<void> {
    this.onDataCallback = null
    const callbackName = `__desktopSerialCallback_${this.id.replace(/[^a-zA-Z0-9]/g, '_')}`
    delete (window as any)[callbackName]
  }

  getInfo(): DeviceInfo {
    return {
      productName: this.portName
    }
  }
}

export const init = () => {}
export const request = () => Promise.resolve<DesktopSerialDevice | null>(null)
