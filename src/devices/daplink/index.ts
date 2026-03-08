import { ElMessage } from 'element-plus'
import { authorizedDevices, type Device } from '../types'
import type { IDevice, DeviceInfo } from '../types'
import * as DAPjs from 'dapjs'

const DAPLINK_VENDOR_ID = 0x0D28

const DAPLINK_PRODUCT_IDS = [
  0x0204, // DAPLink CMSIS-DAP
  0x0203, // DAPLink (HID)
  0x0213, // DAPLink (K64F)
  0x0214, // DAPLink (NUCLEO)
  0x0215, // DAPLink (STEVAL)
  0x0216, // DAPLink (STML152RBC)
  0x0217, // DAPLink (STML34RBC)
  0x0218, // DAPLink (STML152RBC)
  0x0219, // DAPLink (NUCLEO)
  0x021A, // DAPLink (CHIBIO)
  0x021B, // DAPLink (LBED)
  0x021C, // DAPLink (MTS)
  0x021D, // DAPLink (MDK)
  0x021E, // DAPLink (OPENSDA)
  0x021F, // DAPLink (OPENSDA)
  0x0220, // DAPLink (OPENBLT)
  0x0221, // DAPLink (OPENBLT)
  0x0223, // DAPLink (M48T)
  0x0227, // DAPLink (NCS36510)
  0x022B, // DAPLink (MCU-LINK)
  0x022C, // DAPLink (MCU-LINK)
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

export class DAPLinkDevice implements IDevice {
  id: string
  title: string
  type: string = 'daplink'
  port: USBDevice
  dap: DAPDevice | null = null

  constructor(port: USBDevice) {
    this.port = port
    this.id = DAPLinkDevice.getDeviceId(port)
    this.title = DAPLinkDevice.getDeviceTitle(port)
  }

  static getDeviceTitle(port: USBDevice): string {
    const productName = port.productName || 'DAPLink'
    const manufacturer = port.manufacturerName ? ` (${port.manufacturerName})` : ''
    const serial = port.serialNumber ? ` - ${port.serialNumber}` : ''
    return `${productName}${manufacturer}${serial}`
  }

  static getDeviceId(port: USBDevice): string {
    return `daplink_${port.serialNumber || 'nostream'}`
  }

  static getDeviceFilters(): USBDeviceFilter[] {
    return DAPLINK_PRODUCT_IDS.map(productId => ({
      vendorId: DAPLINK_VENDOR_ID,
      productId
    }))
  }

  static async init(): Promise<void> {
    if (navigator.usb) {
      const devices = await navigator.usb.getDevices()
      devices.forEach((port) => {
        if (DAPLINK_PRODUCT_IDS.includes(port.productId)) {
          const id = DAPLinkDevice.getDeviceId(port)
          const device = authorizedDevices.value.find(d => d.id === id)
          if (!device) {
            authorizedDevices.value.push(new DAPLinkDevice(port) as unknown as Device)
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
        filters: DAPLinkDevice.getDeviceFilters()
      })
      const device = new DAPLinkDevice(port)
      return device as unknown as Device
    } catch (error: any) {
      if (error.message !== "Failed to execute 'requestDevice' on 'USB': No device selected.") {
        ElMessage.error('DAPLink设备请求失败：' + error)
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
        ElMessage.success('DAPLink连接成功')
      }

      const { readable, writable } = new TransformStream()
      const writer = writable.getWriter()
      const reader = readable.getReader()

      return { writer, reader }
    } catch (error) {
      ElMessage.error('DAPLink连接失败：' + error)
      console.error(error)
    }
    return null
  }

  async disconnect(): Promise<void> {
    try {
      if (this.dap) {
        await this.dap.disconnect()
        this.dap = null
        ElMessage.success('DAPLink已断开')
      }
    } catch (error) {
      ElMessage.error('DAPLink断开失败：' + error)
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
    return DAPLinkDevice.request()
  }

  async readMemory(address: number, size: number): Promise<Uint8Array | null> {
    if (!this.dap) {
      ElMessage.warning('请先连接DAPLink')
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
      ElMessage.warning('请先连接DAPLink')
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
      ElMessage.warning('请先连接DAPLink')
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
      ElMessage.warning('请先连接DAPLink')
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
      ElMessage.warning('请先连接DAPLink')
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
      ElMessage.warning('请先连接DAPLink')
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
      ElMessage.warning('请先连接DAPLink')
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

  async flash(data: Uint8Array, address: number): Promise<boolean> {
    if (!this.dap) {
      ElMessage.warning('请先连接DAPLink')
      return false
    }
    try {
      const daplink = this.dap as any
      if (typeof daplink.flash === 'function') {
        await daplink.flash(data, address)
        ElMessage.success('烧录成功')
        return true
      }
      ElMessage.warning('当前固件不支持烧录功能')
      return false
    } catch (error) {
      ElMessage.error('烧录失败：' + error)
      console.error(error)
      return false
    }
  }
}

export const init = () => DAPLinkDevice.init()
export const request = () => DAPLinkDevice.request()
