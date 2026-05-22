import { ElMessage } from 'element-plus'
import { authorizedDevices, type Device } from '../types'
import type { IDevice, DeviceInfo } from '../types'

export class BluetoothDeviceImpl implements IDevice {
  id: string
  title: string
  type: string = 'bluetooth'
  port: BluetoothDevice
  gatt: BluetoothRemoteGATTServer | null = null
  txCharacteristic: BluetoothRemoteGATTCharacteristic | null = null
  rxCharacteristic: BluetoothRemoteGATTCharacteristic | null = null

  private static STANDARD_UART_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e'
  private static STANDARD_UART_TX = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'
  private static STANDARD_UART_RX = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'

  constructor(port: BluetoothDevice) {
    this.port = port
    this.id = BluetoothDeviceImpl.getDeviceId(port)
    this.title = BluetoothDeviceImpl.getDeviceTitle(port)
  }

  static getDeviceTitle(port: BluetoothDevice): string {
    return port.name || '未知蓝牙设备'
  }

  static getDeviceId(port: BluetoothDevice): string {
    return `bluetooth_${port.id}`
  }

  static async init(): Promise<void> {
  }

  static async request(): Promise<Device | null> {
    try {
      if (!navigator.bluetooth) {
        ElMessage.error('浏览器不支持Web Bluetooth API')
        return null
      }

      console.log('[Bluetooth] Requesting device with UART service...')
      const port = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        // filters: [ 
        //   { namePrefix: '' } 
        // ],
        optionalServices: [BluetoothDeviceImpl.STANDARD_UART_SERVICE]
      })
      console.log('[Bluetooth] Device selected:', port.name, port.id)
      const device = new BluetoothDeviceImpl(port)
      return device as unknown as Device
    } catch (error: any) {
      if (error.name !== 'NotFoundError' && error.message !== "User cancelled the requestDevice() chooser.") {
        ElMessage.error('蓝牙设备请求失败：' + error)
        console.error('[Bluetooth] Request error:', error)
      }
    }
    return null
  }

  async connect(): Promise<{
    writer: WritableStreamDefaultWriter,
    reader: ReadableStreamDefaultReader
  } | null> {
    try {
      if (!this.port.gatt) {
        ElMessage.error('该蓝牙设备不支持GATT连接')
        console.error('[Bluetooth] Device does not support GATT:', this.port)
        return null
      }

      console.log('[Bluetooth] Connecting to GATT server...')
      this.gatt = await this.port.gatt.connect()
      console.log('[Bluetooth] GATT connected:', this.gatt.connected)

      console.log('[Bluetooth] Getting UART service...')
      const service = await this.gatt.getPrimaryService(BluetoothDeviceImpl.STANDARD_UART_SERVICE)
      console.log('[Bluetooth] Service found:', service.uuid)

      console.log('[Bluetooth] Getting TX characteristic...')
      this.txCharacteristic = await service.getCharacteristic(BluetoothDeviceImpl.STANDARD_UART_TX)
      console.log('[Bluetooth] TX found:', this.txCharacteristic.uuid)

      console.log('[Bluetooth] Getting RX characteristic...')
      this.rxCharacteristic = await service.getCharacteristic(BluetoothDeviceImpl.STANDARD_UART_RX)
      console.log('[Bluetooth] RX found:', this.rxCharacteristic.uuid)

      console.log('[Bluetooth] Starting notifications...')
      await this.rxCharacteristic.startNotifications()
      console.log('[Bluetooth] Notifications started')

      ElMessage.success('蓝牙服务配置完成')

      const txChar = this.txCharacteristic
      const rxChar = this.rxCharacteristic

      const readable = new ReadableStream({
        start(controller) {
          console.log('[Bluetooth] ReadableStream started')
          rxChar.addEventListener('characteristicvaluechanged', (event: Event) => {
            const target = event.target as unknown as BluetoothRemoteGATTCharacteristic
            const data = target.value
            if (data) {
              console.log('[Bluetooth] Data received:', new Uint8Array(data.buffer))
              controller.enqueue(new Uint8Array(data.buffer))
            }
          })
        },
        cancel() {
          console.log('[Bluetooth] ReadableStream cancelled')
          rxChar.stopNotifications().catch(console.error)
        }
      })

      const writable = new WritableStream({
        async write(chunk) {
          console.log('[Bluetooth] Writing data:', chunk)
          if (txChar) {
            await txChar.writeValue(chunk)
          }
        }
      })

      const writer = writable.getWriter()
      const reader = readable.getReader()

      return { writer, reader }
    } catch (error: any) {
      if (error.name !== 'NotFoundError') {
        ElMessage.error('蓝牙连接失败：' + error)
        console.error('[Bluetooth] Connect error:', error)
      }
    }
    return null
  }

  async disconnect(): Promise<void> {
    try {
      if (this.gatt?.connected) {
        this.gatt.disconnect()
        this.gatt = null
        this.txCharacteristic = null
        this.rxCharacteristic = null
        ElMessage.success('蓝牙已断开')
      }
    } catch (error) {
      ElMessage.error('蓝牙断开失败：' + error)
      console.error(error)
    }
  }

  getInfo(): DeviceInfo {
    return {
      productName: this.port.name
    }
  }

  async request(): Promise<IDevice | null> {
    return BluetoothDeviceImpl.request()
  }
}

export const init = () => BluetoothDeviceImpl.init()
export const request = () => BluetoothDeviceImpl.request()
