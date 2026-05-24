import { invoke, Channel, isTauri as tauriIsTauri } from '@tauri-apps/api/core'

export const isTauriRuntime = (): boolean => {
  try {
    return tauriIsTauri()
  } catch {
    return false
  }
}

export interface OpenSerialOptions {
  portName: string
  baudRate: number
  dataBits?: number
  stopBits?: string
  parity?: string
  flowControl?: string
}

export interface DataPointInput {
  measurement: string
  tags?: Record<string, string>
  fields: Record<string, number | string | boolean>
}

export interface QueryRange {
  measurement: string
  start: string
  end: string
}

export interface QueryRecord {
  time: string
  field: string
  value: unknown
}

export interface VersionInfo {
  version: string
  buildTime: string
}

export const desktopApi = {
  getSerialPorts: () => invoke<string[]>('get_serial_ports'),

  openSerial: (options: OpenSerialOptions, onData: (bytes: Uint8Array) => void) => {
    const channel = new Channel<number[]>()
    channel.onmessage = (msg) => onData(new Uint8Array(msg))
    return invoke<void>('open_serial', { options, onData: channel })
  },

  writeSerial: (data: Uint8Array) =>
    invoke<void>('write_serial', { data: Array.from(data) }),

  closeSerial: () => invoke<void>('close_serial'),

  saveDataPoint: (point: DataPointInput) =>
    invoke<void>('save_data_point', { point }),

  queryData: (range: QueryRange) =>
    invoke<QueryRecord[]>('query_data', { range }),

  getVersionInfo: () => invoke<VersionInfo>('get_version_info'),
}
