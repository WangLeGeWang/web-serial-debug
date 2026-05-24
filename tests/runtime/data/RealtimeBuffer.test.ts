import { describe, it, expect } from 'vitest'
import { RealtimeBuffer } from '@/runtime/data/RealtimeBuffer'

describe('RealtimeBuffer', () => {
  it('pushPoint + toArray 返回插入顺序', () => {
    const b = new RealtimeBuffer(10)
    b.pushPoint({ timestamp: 1, values: { a: 1 } })
    b.pushPoint({ timestamp: 2, values: { a: 2 } })
    expect(b.toArray().map(p => p.timestamp)).toEqual([1, 2])
  })

  it('windowByTime(ms) 返回 (latest-ms..latest] 范围', () => {
    const b = new RealtimeBuffer(10)
    for (let t = 1; t <= 5; t++) b.pushPoint({ timestamp: t * 1000, values: { a: t } })
    const w = b.windowByTime(2500)
    expect(w.map(p => p.timestamp)).toEqual([3000, 4000, 5000])
  })

  it('since(ts) 返回 ts 之后（含等于）的点', () => {
    const b = new RealtimeBuffer(10)
    for (let t = 1; t <= 5; t++) b.pushPoint({ timestamp: t, values: { a: t } })
    expect(b.since(3).map(p => p.timestamp)).toEqual([3, 4, 5])
  })

  it('容量溢出时丢弃最老点', () => {
    const b = new RealtimeBuffer(3)
    for (let t = 1; t <= 5; t++) b.pushPoint({ timestamp: t, values: { a: t } })
    expect(b.toArray().map(p => p.timestamp)).toEqual([3, 4, 5])
  })

  it('空 buffer windowByTime 返回 []', () => {
    expect(new RealtimeBuffer(3).windowByTime(1000)).toEqual([])
  })
})
