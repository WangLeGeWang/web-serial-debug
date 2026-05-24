import { RingBuffer } from './RingBuffer'
import type { DataPoint } from './types'

export class RealtimeBuffer {
  private buf: RingBuffer<DataPoint>

  constructor(capacity: number) {
    this.buf = new RingBuffer<DataPoint>(capacity)
  }

  pushPoint(point: DataPoint): void {
    this.buf.push(point)
  }

  get size(): number {
    return this.buf.size
  }

  clear(): void {
    this.buf.clear()
  }

  latest(): DataPoint | undefined {
    return this.buf.peekLast()
  }

  toArray(): DataPoint[] {
    return this.buf.toArray()
  }

  since(timestamp: number): DataPoint[] {
    return this.buf.toArray().filter(p => p.timestamp >= timestamp)
  }

  windowByTime(windowMs: number): DataPoint[] {
    const last = this.buf.peekLast()
    if (!last) return []
    const from = last.timestamp - windowMs
    return this.buf.toArray().filter(p => p.timestamp >= from && p.timestamp <= last.timestamp)
  }
}
