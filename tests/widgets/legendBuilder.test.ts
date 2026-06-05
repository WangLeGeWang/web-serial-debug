import { describe, it, expect } from 'vitest'
import { legendBuilder } from '@/widgets/EChartsTimeSeries/builders/legendBuilder'
import { DEFAULT_GRAPH_CONFIG, type GraphConfig } from '@/widgets/EChartsTimeSeries/graphConfig'
import { grafanaDarkTheme } from '@/widgets/EChartsTimeSeries/chartTheme'
import { overrideBuilder } from '@/widgets/EChartsTimeSeries/builders/overrideBuilder'

describe('legendBuilder', () => {
  const makeData = (fields: string[], count: number) =>
    Array.from({ length: count }, (_, i) => ({
      timestamp: 1000 + i * 100,
      values: Object.fromEntries(fields.map(f => [f, i * 2 + 10]))
    }))

  it('计算 series 统计值', () => {
    const fields = ['temp']
    const merged = overrideBuilder(DEFAULT_GRAPH_CONFIG, fields, grafanaDarkTheme)
    const data = makeData(fields, 5)
    const result = legendBuilder(DEFAULT_GRAPH_CONFIG, data, merged, grafanaDarkTheme)
    expect(result.legendStats).toHaveLength(1)
    expect(result.legendStats[0].alias).toBe('temp')
    expect(result.legendStats[0].min).toBe(10)
    expect(result.legendStats[0].max).toBe(18)
    expect(result.legendStats[0].last).toBe(18)
    expect(result.legendStats[0].mean).toBe(14)
    expect(result.legendStats[0].sum).toBe(70)
  })

  it('ECharts legend 隐藏', () => {
    const fields = ['temp']
    const merged = overrideBuilder(DEFAULT_GRAPH_CONFIG, fields, grafanaDarkTheme)
    const data = makeData(fields, 5)
    const result = legendBuilder(DEFAULT_GRAPH_CONFIG, data, merged, grafanaDarkTheme)
    expect(result.legend.show).toBe(false)
  })

  it('hidden placement 也隐藏 legend', () => {
    const config: GraphConfig = { ...DEFAULT_GRAPH_CONFIG, legend: { ...DEFAULT_GRAPH_CONFIG.legend, placement: 'hidden' } }
    const merged = overrideBuilder(config, ['temp'], grafanaDarkTheme)
    const data = makeData(['temp'], 5)
    const result = legendBuilder(config, data, merged, grafanaDarkTheme)
    expect(result.legend.show).toBe(false)
  })

  it('legendFormatter 包含统计值', () => {
    const fields = ['temp']
    const merged = overrideBuilder(DEFAULT_GRAPH_CONFIG, fields, grafanaDarkTheme)
    const data = makeData(fields, 5)
    const result = legendBuilder(DEFAULT_GRAPH_CONFIG, data, merged, grafanaDarkTheme)
    const formatted = result.legendFormatter('temp')
    expect(formatted).toContain('temp')
    expect(formatted).toContain('last')
  })

  it('排序: desc by max', () => {
    const config: GraphConfig = { ...DEFAULT_GRAPH_CONFIG, legend: { ...DEFAULT_GRAPH_CONFIG.legend, sortBy: 'max', sortDirection: 'desc' } }
    const merged = overrideBuilder(config, ['a', 'b'], grafanaDarkTheme)
    const data = [
      { timestamp: 1000, values: { a: 10, b: 20 } },
      { timestamp: 1100, values: { a: 30, b: 50 } }
    ]
    const result = legendBuilder(config, data, merged, grafanaDarkTheme)
    // b max=50 > a max=30, desc 排序 b 先
    expect(result.legendStats[0].alias).toBe('b')
  })

  it('空数据统计值为 null', () => {
    const merged = overrideBuilder(DEFAULT_GRAPH_CONFIG, ['temp'], grafanaDarkTheme)
    const data: any[] = []
    const result = legendBuilder(DEFAULT_GRAPH_CONFIG, data, merged, grafanaDarkTheme)
    expect(result.legendStats[0].last).toBeNull()
  })
})