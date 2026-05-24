export class RingBuffer<T> {
  private buf: T[]
  private head = 0
  private count = 0

  constructor(private readonly capacity: number) {
    if (capacity <= 0) throw new Error('RingBuffer capacity must be > 0')
    this.buf = new Array(capacity)
  }

  get size(): number {
    return this.count
  }

  push(item: T): void {
    const tail = (this.head + this.count) % this.capacity
    this.buf[tail] = item
    if (this.count < this.capacity) {
      this.count++
    } else {
      this.head = (this.head + 1) % this.capacity
    }
  }

  clear(): void {
    this.head = 0
    this.count = 0
    this.buf = new Array(this.capacity)
  }

  peekLast(): T | undefined {
    if (this.count === 0) return undefined
    const idx = (this.head + this.count - 1) % this.capacity
    return this.buf[idx]
  }

  forEach(cb: (item: T, index: number) => void): void {
    for (let i = 0; i < this.count; i++) {
      cb(this.buf[(this.head + i) % this.capacity], i)
    }
  }

  toArray(): T[] {
    const out: T[] = new Array(this.count)
    for (let i = 0; i < this.count; i++) {
      out[i] = this.buf[(this.head + i) % this.capacity]
    }
    return out
  }
}
