interface SerialPortInfo {
  usbVendorId?: number
  usbProductId?: number
}

interface SerialPort {
  open(options: SerialOptions): Promise<void>
  close(): Promise<void>
  readable: ReadableStream
  writable: WritableStream
  getInfo(): SerialPortInfo
}

interface SerialOptions {
  baudRate: number
  dataBits?: number
  stopBits?: number
  parity?: string
  bufferSize?: number
  flowControl?: string
}

interface Navigator {
  serial: {
    requestPort(options?: any): Promise<SerialPort>
    getPorts(): Promise<SerialPort[]>
  }
  usb: {
    requestDevice(options: any): Promise<USBDevice>
    getDevices(): Promise<USBDevice[]>
  }
  bluetooth: {
    requestDevice(options: any): Promise<BluetoothDevice>
    getDevices(): Promise<BluetoothDevice[]>
  }
}

interface USBDevice {
  serialNumber?: string
  productName?: string
  manufacturerName?: string
}

interface BluetoothRemoteGATTCharacteristic {
  uuid: string
  properties: {
    broadcast: boolean
    read: boolean
    writeWithoutResponse: boolean
    write: boolean
    notify: boolean
    indicate: boolean
    authenticatedSignedWrites: boolean
    reliableWrite: boolean
    writableAuxiliaries: boolean
  }
  value?: DataView
  addEventListener(type: 'characteristicvaluechanged', listener: (event: Event) => void): void
  removeEventListener(type: 'characteristicvaluechanged', listener: (event: Event) => void): void
  startNotifications(): Promise<void>
  stopNotifications(): Promise<void>
  writeValue(value: BufferSource): Promise<void>
  readValue(): Promise<DataView>
}

interface BluetoothRemoteGATTService {
  uuid: string
  device: BluetoothDevice
  getCharacteristic(characteristic: string | number): Promise<BluetoothRemoteGATTCharacteristic>
  getCharacteristics(characteristic?: string | number): Promise<BluetoothRemoteGATTCharacteristic[]>
  getPrimaryService(service: string | number): Promise<BluetoothRemoteGATTService>
  getPrimaryServices(service?: string | number): Promise<BluetoothRemoteGATTService[]>
}

interface BluetoothRemoteGATTServer {
  device: BluetoothDevice
  connected: boolean
  connect(): Promise<BluetoothRemoteGATTServer>
  disconnect(): Promise<void>
  getPrimaryService(service: string | number): Promise<BluetoothRemoteGATTService>
  getPrimaryServices(service?: string | number): Promise<BluetoothRemoteGATTService[]>
}

interface BluetoothDevice {
  id: string
  name?: string
  gatt?: BluetoothRemoteGATTServer
  watchingAdvertisements: boolean
  addEventListener(type: 'advertisementreceived', listener: (event: Event) => void): void
  removeEventListener(type: 'advertisementreceived', listener: (event: Event) => void): void
}

interface LogOptions {
  showTime: boolean
  showMs: boolean
  showHex: boolean
  showText: boolean
  showNewline: boolean
  autoScroll: boolean
  timeOut: number
}