import { describe, it, expect } from 'vitest'
import { NamespaceStore } from '@/runtime/data/NamespaceStore'
import type { DataFrame } from '@/runtime/data/types'

const frame = (over: Partial<DataFrame> = {}): DataFrame => ({
  namespace: 'ns', timestamp: 1, values: { a: 1 },
  source: 'local', origin: 'o', seq: 1, ...over
})

describe('NamespaceStore', () => {
  it('apply 后 fields 更新当前值与统计', () => {
    const ns = new NamespaceStore('ns', 10)
    ns.apply(frame({ timestamp: 10, values: { a: 2 } }))
    ns.apply(frame({ timestamp: 20, values: { a: 4 } }))
    const f = ns.fields.get('a')!
    expect(f.value).toBe(4)
    expect(f.min).toBe(2); expect(f.max).toBe(4); expect(f.avg).toBe(3)
    expect(f.updateCount).toBe(2)
    expect(f.lastUpdate).toBe(20)
  })

  it('非数字字段不更新 min/max/avg', () => {
    const ns = new NamespaceStore('ns', 10)
    ns.apply(frame({ values: { s: 'hi' } }))
    const f = ns.fields.get('s')!
    expect(f.value).toBe('hi')
    expect(f.min).toBeNull(); expect(f.max).toBeNull()
    expect(f.dataType).toBe('string')
  })

  it('apply 同步写入 realtime buffer (只数字字段)', () => {
    const ns = new NamespaceStore('ns', 10)
    ns.apply(frame({ timestamp: 100, values: { a: 1, b: 'x' } }))
    expect(ns.buffer.toArray()).toEqual([{ timestamp: 100, values: { a: 1 } }])
  })

  it('clear() 清空 fields 与 buffer', () => {
    const ns = new NamespaceStore('ns', 10)
    ns.apply(frame())
    ns.clear()
    expect(ns.fields.size).toBe(0)
    expect(ns.buffer.size).toBe(0)
  })
})
