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

  /**
   * 返回 [latest.timestamp - windowMs, latest.timestamp] 范围内的点。
   * 锚点为缓冲区中最新一帧的 timestamp，不是 Date.now()，
   * 因此回放/暂停场景下不会因 wall-clock 推进而错位。
   */
  windowByTime(windowMs: number): DataPoint[] {
    const last = this.buf.peekLast()
    if (!last) return []
    const from = last.timestamp - windowMs
    return this.buf.toArray().filter(p => p.timestamp >= from && p.timestamp <= last.timestamp)
  }
}
