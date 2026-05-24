import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { DataSeries, DataChunk } from '@/utils/DataSeriesStorage'

describe('DataSeriesStorage namespace', () => {
  beforeEach(() => {
    ;(globalThis as any).indexedDB = new IDBFactory()
    vi.resetModules()
  })

  it('saveSeries 含 namespace 字段并可按 namespace 检索', async () => {
    const { dataSeriesStorage } = await import('@/utils/DataSeriesStorage')
    const series: DataSeries = {
      id: 's1', namespace: 'ns-a', name: 't', startTime: 0, endTime: 10,
      pointCount: 1, fields: ['a'], createdAt: 0, sizeBytes: 0
    }
    await dataSeriesStorage.saveSeries(series)
    const chunk: DataChunk = { seriesId: 's1', chunkIndex: 0, points: [
      { timestamp: 5, values: { a: 1 } }
    ]}
    await dataSeriesStorage.saveChunk(chunk)
    const list = await dataSeriesStorage.listSeries('ns-a')
    expect(list.length).toBe(1)
    const other = await dataSeriesStorage.listSeries('ns-b')
    expect(other.length).toBe(0)
  })

  it('queryByRange 返回 namespace+timeRange 命中的点', async () => {
    const { dataSeriesStorage } = await import('@/utils/DataSeriesStorage')
    await dataSeriesStorage.saveSeries({
      id: 's2', namespace: 'ns-a', name: 't', startTime: 0, endTime: 20,
      pointCount: 2, fields: ['a'], createdAt: 0, sizeBytes: 0
    })
    await dataSeriesStorage.saveChunk({ seriesId: 's2', chunkIndex: 0, points: [
      { timestamp: 5, values: { a: 1 } },
      { timestamp: 15, values: { a: 2 } }
    ]})
    const pts = await dataSeriesStorage.queryByRange('ns-a', [10, 30])
    expect(pts.map(p => p.timestamp)).toEqual([15])
  })
})
