import { describe, it, expect } from 'vitest'
import { RingBuffer } from '@/runtime/data/RingBuffer'

describe('RingBuffer', () => {
  it('未达容量时 toArray 返回完整序列', () => {
    const rb = new RingBuffer<number>(4)
    rb.push(1); rb.push(2); rb.push(3)
    expect(rb.size).toBe(3)
    expect(rb.toArray()).toEqual([1, 2, 3])
  })

  it('超过容量按 FIFO 丢弃最老元素', () => {
    const rb = new RingBuffer<number>(3)
    ;[1, 2, 3, 4, 5].forEach(v => rb.push(v))
    expect(rb.size).toBe(3)
    expect(rb.toArray()).toEqual([3, 4, 5])
  })

  it('clear 后 size 归零', () => {
    const rb = new RingBuffer<number>(2)
    rb.push(1); rb.clear()
    expect(rb.size).toBe(0)
    expect(rb.toArray()).toEqual([])
  })

  it('peekLast 返回最近写入元素', () => {
    const rb = new RingBuffer<number>(3)
    rb.push(1); rb.push(2)
    expect(rb.peekLast()).toBe(2)
    expect(new RingBuffer<number>(3).peekLast()).toBeUndefined()
  })

  it('forEach 按 FIFO 顺序遍历', () => {
    const rb = new RingBuffer<number>(3)
    ;[1, 2, 3, 4].forEach(v => rb.push(v))
    const out: number[] = []
    rb.forEach(v => out.push(v))
    expect(out).toEqual([2, 3, 4])
  })
})
