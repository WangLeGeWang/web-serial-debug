import { ElMessage } from 'element-plus'
import { authorizedDevices, type Device } from '../types'
import type { IDevice, DeviceInfo } from '../types'
import * as DAPjs from 'dapjs'

const STLINK_VENDOR_ID = 0x0483
const STLINK_PRODUCT_IDS = [
  0x3744, // ST-Link/V2
  0x3745, // ST-Link/V2-1
  0x3746, // ST-Link/V2-1 (Nucleo)
  0x3747, // ST-Link/V3
  0x3748, // ST-Link/V3E
  0x3749, // ST-Link/V3S
  0x3752, // ST-Link/V3 (2.1)
  0x3753, // ST-Link/V3 (2.1)
  0x3754, // ST-Link/V3 (2.1)
]

interface DAPDevice {
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  readMem32: (address: number, size: number) => Promise<Uint8Array>
  writeMem32: (address: number, data: Uint8Array) => Promise<void>
  readDP: (address: number) => Promise<number>
  writeDP: (address: number, data: number) => Promise<void>
  readAP: (address: number) => Promise<number>
  writeAP: (address: number, data: number) => Promise<void>
  reset: () => Promise<void>
  halt: () => Promise<void>
  resume: () => Promise<void>
  isHalted: () => Promise<boolean>
  getIDCode: () => Promise<number>
}

export class WebSTLinkDevice implements IDevice {
  id: string
  title: string
  type: string = 'webstlink'
  port: USBDevice
  dap: DAPDevice | null = null

  constructor(port: USBDevice) {
    this.port = port
    this.id = WebSTLinkDevice.getDeviceId(port)
    this.title = WebSTLinkDevice.getDeviceTitle(port)
  }

  static getDeviceTitle(port: USBDevice): string {
    const productName = port.productName || 'ST-Link'
    const serial = port.serialNumber ? ` (${port.serialNumber})` : ''
    return `${productName}${serial}`
  }

  static getDeviceId(port: USBDevice): string {
    return `webstlink_${port.serialNumber || 'nostream'}`
  }

  static getDeviceFilters(): USBDeviceFilter[] {
    return STLINK_PRODUCT_IDS.map(productId => ({
      vendorId: STLINK_VENDOR_ID,
      productId
    }))
  }

  static async init(): Promise<void> {
    if (navigator.usb) {
      const devices = await navigator.usb.getDevices()
      devices.forEach((port) => {
        if (STLINK_PRODUCT_IDS.includes(port.productId)) {
          const id = WebSTLinkDevice.getDeviceId(port)
          const device = authorizedDevices.value.find(d => d.id === id)
          if (!device) {
            authorizedDevices.value.push(new WebSTLinkDevice(port) as unknown as Device)
          }
        }
      })
    }
  }

  static async request(): Promise<Device | null> {
    try {
      if (!navigator.usb) {
        ElMessage.error('浏览器不支持WebUSB API')
        return null
      }

      const port = await navigator.usb.requestDevice({
        filters: WebSTLinkDevice.getDeviceFilters()
      })
      const device = new WebSTLinkDevice(port)
      return device as unknown as Device
    } catch (error: any) {
      if (error.message !== "Failed to execute 'requestDevice' on 'USB': No device selected.") {
        ElMessage.error('ST-Link设备请求失败：' + error)
      }
      console.error(error)
    }
    return null
  }

  async connect(): Promise<{
    writer: WritableStreamDefaultWriter,
    reader: ReadableStreamDefaultReader
  } | null> {
    try {
      if (!this.dap) {
        const transport = new DAPjs.WebUSB(this.port)
        this.dap = new DAPjs.DAPLink(transport) as unknown as DAPDevice
        await this.dap.connect()
        ElMessage.success('ST-Link连接成功')
      }

      const { readable, writable } = new TransformStream()
      const writer = writable.getWriter()
      const reader = readable.getReader()

      return { writer, reader }
    } catch (error) {
      ElMessage.error('ST-Link连接失败：' + error)
      console.error(error)
    }
    return null
  }

  async disconnect(): Promise<void> {
    try {
      if (this.dap) {
        await this.dap.disconnect()
        this.dap = null
        ElMessage.success('ST-Link已断开')
      }
    } catch (error) {
      ElMessage.error('ST-Link断开失败：' + error)
      console.error(error)
    }
  }

  getInfo(): DeviceInfo {
    return {
      manufacturer: this.port.manufacturerName || undefined,
      productName: this.port.productName || undefined,
      serialNumber: this.port.serialNumber || undefined,
      vendorId: this.port.vendorId,
      productId: this.port.productId
    }
  }

  async request(): Promise<IDevice | null> {
    return WebSTLinkDevice.request()
  }

  async readMemory(address: number, size: number): Promise<Uint8Array | null> {
    if (!this.dap) {
      ElMessage.warning('请先连接ST-Link')
      return null
    }
    try {
      return await this.dap.readMem32(address, size)
    } catch (error) {
      ElMessage.error('读取内存失败：' + error)
      console.error(error)
      return null
    }
  }

  async writeMemory(address: number, data: Uint8Array): Promise<boolean> {
    if (!this.dap) {
      ElMessage.warning('请先连接ST-Link')
      return false
    }
    try {
      await this.dap.writeMem32(address, data)
      return true
    } catch (error) {
      ElMessage.error('写入内存失败：' + error)
      console.error(error)
      return false
    }
  }

  async readRegister(reg: number): Promise<number | null> {
    if (!this.dap) {
      ElMessage.warning('请先连接ST-Link')
      return null
    }
    try {
      return await this.dap.readDP(reg)
    } catch (error) {
      ElMessage.error('读取寄存器失败：' + error)
      console.error(error)
      return null
    }
  }

  async reset(): Promise<boolean> {
    if (!this.dap) {
      ElMessage.warning('请先连接ST-Link')
      return false
    }
    try {
      await this.dap.reset()
      return true
    } catch (error) {
      ElMessage.error('复位失败：' + error)
      console.error(error)
      return false
    }
  }

  async halt(): Promise<boolean> {
    if (!this.dap) {
      ElMessage.warning('请先连接ST-Link')
      return false
    }
    try {
      await this.dap.halt()
      return true
    } catch (error) {
      ElMessage.error('暂停失败：' + error)
      console.error(error)
      return false
    }
  }

  async resume(): Promise<boolean> {
    if (!this.dap) {
      ElMessage.warning('请先连接ST-Link')
      return false
    }
    try {
      await this.dap.resume()
      return true
    } catch (error) {
      ElMessage.error('恢复运行失败：' + error)
      console.error(error)
      return false
    }
  }

  async isHalted(): Promise<boolean> {
    if (!this.dap) {
      return false
    }
    try {
      return await this.dap.isHalted()
    } catch (error) {
      return false
    }
  }

  async getIDCode(): Promise<number | null> {
    if (!this.dap) {
      ElMessage.warning('请先连接ST-Link')
      return null
    }
    try {
      return await this.dap.getIDCode()
    } catch (error) {
      ElMessage.error('获取芯片ID失败：' + error)
      console.error(error)
      return null
    }
  }
}

export const init = () => WebSTLinkDevice.init()
export const request = () => WebSTLinkDevice.request()
