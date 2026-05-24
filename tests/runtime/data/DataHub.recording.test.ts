import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('DataHub recording', () => {
  beforeEach(() => {
    ;(globalThis as any).indexedDB = new IDBFactory()
    vi.resetModules()
  })

  it('startRecording → append → stopRecording 产生可查询 series', async () => {
    const { initDataHub, getDataHub } = await import('@/runtime/data/DataHub')
    initDataHub({ origin: 'me', bufferCapacity: 1000 })
    const hub = getDataHub()
    const id = hub.startRecording('ns-rec', 'test')
    expect(id).toBeTruthy()
    for (let t = 0; t < 5; t++) {
      hub.append({ namespace: 'ns-rec', timestamp: t * 1000, values: { a: t } })
    }
    const series = await hub.stopRecording(id)
    expect(series.pointCount).toBe(5)
    expect(series.namespace).toBe('ns-rec')
    expect(series.fields).toEqual(['a'])

    const list = await hub.listSeries('ns-rec')
    expect(list.find(s => s.id === series.id)).toBeTruthy()

    const points = await hub.queryHistory({
      namespace: 'ns-rec', timeRange: [0, 4000]
    })
    expect(points.length).toBe(5)
  })

  it('未 startRecording 时 stop 抛错', async () => {
    const { initDataHub, getDataHub } = await import('@/runtime/data/DataHub')
    initDataHub({ origin: 'me', bufferCapacity: 1000 })
    const hub = getDataHub()
    await expect(hub.stopRecording('nonexistent')).rejects.toThrow()
  })

  it('chunk 拆分正确：10001 个点全量可查 (覆盖 chunk 切片 + 末尾尾巴)', async () => {
    const { initDataHub, getDataHub } = await import('@/runtime/data/DataHub')
    initDataHub({ origin: 'me', bufferCapacity: 20000 })
    const hub = getDataHub()
    const id = hub.startRecording('ns-chunk', 'big')
    const N = 10001
    for (let t = 0; t < N; t++) {
      hub.append({ namespace: 'ns-chunk', timestamp: t, values: { v: t } })
    }
    const series = await hub.stopRecording(id)
    expect(series.pointCount).toBe(N)

    const points = await hub.queryHistory({
      namespace: 'ns-chunk', timeRange: [0, N - 1]
    })
    expect(points.length).toBe(N)
    expect(points[0].timestamp).toBe(0)
    expect(points[N - 1].timestamp).toBe(N - 1)
    expect(points[N - 1].values.v).toBe(N - 1)
  })

  it('非数字字段被过滤：只录 number，series.fields 不含 string/boolean', async () => {
    const { initDataHub, getDataHub } = await import('@/runtime/data/DataHub')
    initDataHub({ origin: 'me', bufferCapacity: 1000 })
    const hub = getDataHub()
    const id = hub.startRecording('ns-filter')
    hub.append({
      namespace: 'ns-filter',
      timestamp: 100,
      values: { a: 1, s: 'str', b: true }
    })
    const series = await hub.stopRecording(id)
    expect(series.fields).toEqual(['a'])
    expect(series.pointCount).toBe(1)

    const points = await hub.queryHistory({
      namespace: 'ns-filter', timeRange: [0, 200]
    })
    expect(points.length).toBe(1)
    expect(points[0].values).toEqual({ a: 1 })
    expect('s' in points[0].values).toBe(false)
    expect('b' in points[0].values).toBe(false)
  })

  it('多 namespace 隔离：并发录制只录各自 ns 的点', async () => {
    const { initDataHub, getDataHub } = await import('@/runtime/data/DataHub')
    initDataHub({ origin: 'me', bufferCapacity: 1000 })
    const hub = getDataHub()
    const idA = hub.startRecording('ns-A', 'a')
    const idB = hub.startRecording('ns-B', 'b')

    hub.append({ namespace: 'ns-A', timestamp: 1, values: { x: 10 } })
    hub.append({ namespace: 'ns-A', timestamp: 2, values: { x: 20 } })
    hub.append({ namespace: 'ns-B', timestamp: 3, values: { y: 30 } })

    const sA = await hub.stopRecording(idA)
    const sB = await hub.stopRecording(idB)

    expect(sA.pointCount).toBe(2)
    expect(sA.namespace).toBe('ns-A')
    expect(sA.fields).toEqual(['x'])

    expect(sB.pointCount).toBe(1)
    expect(sB.namespace).toBe('ns-B')
    expect(sB.fields).toEqual(['y'])

    const ptsA = await hub.queryHistory({ namespace: 'ns-A', timeRange: [0, 10] })
    const ptsB = await hub.queryHistory({ namespace: 'ns-B', timeRange: [0, 10] })
    expect(ptsA.map(p => p.values.x)).toEqual([10, 20])
    expect(ptsB.map(p => p.values.y)).toEqual([30])
  })
})
