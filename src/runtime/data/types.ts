export type DataValue = number | string | boolean

export interface DataFrame {
  namespace: string
  timestamp: number
  values: Record<string, DataValue>
  source: 'local' | 'remote'
  origin: string
  seq: number
}

export interface DataQuery {
  namespace: string
  fields?: string[]
}

export interface HistoryQuery extends DataQuery {
  timeRange: [number, number]
  maxPoints?: number
}

export interface DataPoint {
  timestamp: number
  values: Record<string, number>
}

export type FieldDataType = 'number' | 'string' | 'boolean' | 'object'

export interface FieldState {
  key: string
  value: DataValue | null
  dataType: FieldDataType
  avg: number | null
  avgSum: number | null
  min: number | null
  max: number | null
  lastUpdate: number
  updateCount: number
}

export type RecordingId = string
export type TransportId = string
export type NamespaceOrigin = 'local' | TransportId
