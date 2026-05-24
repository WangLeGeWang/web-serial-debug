import { describe, it, expect, beforeEach } from 'vitest'
import { initDataHub, getDataHub } from '@/runtime/data/DataHub'
import { createDataSource } from '@/runtime/source/DataSourceProvider'

describe('DataSourceProvider realtime', () => {
  beforeEach(() => { initDataHub({ origin: 't', bufferCapacity: 100 }) })

  it('realtime 模式：subscribe 后接收新帧', () => {
    const ds = createDataSource({ namespace: 'ns' }, 'realtime')
    ds.setWindowDuration(10_000)
    for (let t = 1; t <= 3; t++) {
      getDataHub().append({ namespace: 'ns', timestamp: t * 1000, values: { a: t } })
    }
    expect(ds.visibleData.length).toBe(3)
    expect(ds.fields).toContain('a')
    ds.destroy()
  })

  it('destroy 后不再更新', () => {
    const ds = createDataSource({ namespace: 'ns' }, 'realtime')
    ds.destroy()
    getDataHub().append({ namespace: 'ns', timestamp: 1, values: { a: 1 } })
    expect(ds.visibleData.length).toBe(0)
  })

  it('setQuery 切换 namespace 后只收新的', () => {
    const ds = createDataSource({ namespace: 'ns-a' }, 'realtime')
    ds.setWindowDuration(60_000)
    getDataHub().append({ namespace: 'ns-a', timestamp: 1, values: { a: 1 } })
    ds.setQuery({ namespace: 'ns-b' })
    getDataHub().append({ namespace: 'ns-a', timestamp: 2, values: { a: 2 } })
    getDataHub().append({ namespace: 'ns-b', timestamp: 3, values: { b: 9 } })
    const ts = ds.visibleData.map(p => p.timestamp)
    expect(ts).toEqual([3])
    ds.destroy()
  })

  it('mode 默认 realtime，且 mode getter 返回当前模式', () => {
    const ds = createDataSource({ namespace: 'ns' })
    expect(ds.mode).toBe('realtime')
    ds.setMode('history')
    expect(ds.mode).toBe('history')
    ds.destroy()
  })

  it('realtime 模式：windowDuration 控制可见点裁剪', () => {
    const ds = createDataSource({ namespace: 'ns' }, 'realtime')
    ds.setWindowDuration(2_500)
    for (let t = 1; t <= 5; t++) {
      getDataHub().append({ namespace: 'ns', timestamp: t * 1000, values: { a: t } })
    }
    // last=5000, from=2500, 包含 ts ∈ [3000, 4000, 5000]
    const ts = ds.visibleData.map(p => p.timestamp)
    expect(ts).toEqual([3000, 4000, 5000])
    ds.destroy()
  })

  it('realtime 模式：timeRange 反映 [last-window, last]', () => {
    const ds = createDataSource({ namespace: 'ns' }, 'realtime')
    ds.setWindowDuration(5_000)
    getDataHub().append({ namespace: 'ns', timestamp: 10_000, values: { a: 1 } })
    expect(ds.timeRange).toEqual([5_000, 10_000])
    ds.destroy()
  })

  it('setMode 后 visibleData 立刻反映新模式（I3 reactivity）', () => {
    const ds = createDataSource({ namespace: 'ns' }, 'realtime')
    ds.setWindowDuration(60_000)
    for (let t = 1; t <= 3; t++) {
      getDataHub().append({ namespace: 'ns', timestamp: t * 1000, values: { a: t } })
    }
    expect(ds.visibleData.length).toBe(3)
    ds.setMode('history')
    // history 模式且未设 timeRange，stub queryHistory 不会被调用，应为空
    expect(ds.visibleData.length).toBe(0)
    ds.destroy()
  })

  it('新字段到达后 fields 立刻更新（M2 reactivity）', () => {
    const ds = createDataSource({ namespace: 'ns' }, 'realtime')
    ds.setWindowDuration(60_000)
    getDataHub().append({ namespace: 'ns', timestamp: 1, values: { a: 1 } })
    expect(ds.fields).toEqual(['a'])
    getDataHub().append({ namespace: 'ns', timestamp: 2, values: { b: 2 } })
    expect(ds.fields).toContain('a')
    expect(ds.fields).toContain('b')
    ds.destroy()
  })

  it('realtime 模式 visibleData 来自 DataHub.getRealtimeWindow（C2 去重）', () => {
    const ds = createDataSource({ namespace: 'ns' }, 'realtime')
    ds.setWindowDuration(60_000)
    for (let t = 1; t <= 10; t++) {
      getDataHub().append({ namespace: 'ns', timestamp: t * 1000, values: { a: t } })
    }
    const fromHub = getDataHub().getRealtimeWindow({ namespace: 'ns' }, 60_000)
    expect(ds.visibleData.map(p => p.timestamp)).toEqual(fromHub.map(p => p.timestamp))
    ds.destroy()
  })
})
