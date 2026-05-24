import { describe, it, expectTypeOf } from 'vitest'
import type {
  DataFrame, DataQuery, HistoryQuery, DataPoint, FieldState
} from '@/runtime/data/types'

describe('runtime/data/types', () => {
  it('DataFrame 字段齐全', () => {
    const f: DataFrame = {
      namespace: 'ns',
      timestamp: 1,
      values: { a: 1, b: 'x', c: true },
      source: 'local',
      origin: 'page-1',
      seq: 1
    }
    expectTypeOf(f.source).toEqualTypeOf<'local' | 'remote'>()
  })

  it('HistoryQuery 继承 DataQuery 且必带 timeRange', () => {
    const q: HistoryQuery = { namespace: 'ns', timeRange: [0, 1] }
    expectTypeOf(q.timeRange).toEqualTypeOf<[number, number]>()
  })

  it('DataPoint.values 限定数字', () => {
    const p: DataPoint = { timestamp: 1, values: { a: 1.2 } }
    expectTypeOf(p.values).toEqualTypeOf<Record<string, number>>()
  })

  it('FieldState 必含 key 与统计字段', () => {
    const s: FieldState = {
      key: 'a', value: 1, dataType: 'number',
      avg: 1, avgSum: 1, min: 1, max: 1,
      lastUpdate: 1, updateCount: 1
    }
    expectTypeOf(s.dataType).toEqualTypeOf<'number' | 'string' | 'boolean' | 'object'>()
  })
})
