import { RealtimeBuffer } from './RealtimeBuffer'
import type { DataFrame, FieldState, FieldDataType, DataPoint, RecordingId } from './types'

function detectType(v: unknown): FieldDataType {
  if (typeof v === 'number') return 'number'
  if (typeof v === 'string') return 'string'
  if (typeof v === 'boolean') return 'boolean'
  return 'object'
}

export class NamespaceStore {
  readonly fields: Map<string, FieldState> = new Map()
  readonly buffer: RealtimeBuffer
  recordingId: RecordingId | null = null

  constructor(readonly namespace: string, bufferCapacity: number) {
    this.buffer = new RealtimeBuffer(bufferCapacity)
  }

  apply(frame: DataFrame): void {
    const numericValues: Record<string, number> = {}

    for (const [key, value] of Object.entries(frame.values)) {
      let f = this.fields.get(key)
      if (!f) {
        f = {
          key, value: null, dataType: detectType(value),
          avg: null, avgSum: null, min: null, max: null,
          lastUpdate: 0, updateCount: 0
        }
        this.fields.set(key, f)
      }
      f.value = value
      f.lastUpdate = frame.timestamp
      f.updateCount += 1

      if (typeof value === 'number') {
        f.dataType = 'number'
        f.avgSum = (f.avgSum ?? 0) + value
        f.avg = Math.round((f.avgSum / f.updateCount) * 1000) / 1000
        if (f.min === null || value < f.min) f.min = value
        if (f.max === null || value > f.max) f.max = value
        numericValues[key] = value
      }
    }

    if (Object.keys(numericValues).length > 0) {
      const point: DataPoint = { timestamp: frame.timestamp, values: numericValues }
      this.buffer.pushPoint(point)
    }
  }

  clear(): void {
    this.fields.clear()
    this.buffer.clear()
    this.recordingId = null
  }
}
