import { describe, it, expect } from 'vitest'
import { displayBuilder } from '@/widgets/EChartsTimeSeries/builders/displayBuilder'
import { DEFAULT_GRAPH_CONFIG, type GraphConfig } from '@/widgets/EChartsTimeSeries/graphConfig'
import { type MergedSeriesConfig } from '@/widgets/EChartsTimeSeries/graphConfig'
import { grafanaDarkTheme } from '@/widgets/EChartsTimeSeries/chartTheme'
import { overrideBuilder } from '@/widgets/EChartsTimeSeries/builders/overrideBuilder'

const makeMergedConfigs = (fields: string[], config: GraphConfig = DEFAULT_GRAPH_CONFIG) =>
  overrideBuilder(config, fields, grafanaDarkTheme)

const makeData = (fields: string[], count: number) =>
  Array.from({ length: count }, (_, i) => ({
    timestamp: 1000 + i * 100,
    values: Object.fromEntries(fields.map(f => [f, Math.sin(i * 0.1) * 10 + 20]))
  }))

describe('displayBuilder', () => {
  it('生成 line series', () => {
    const fields = ['temperature']
    const merged = makeMergedConfigs(fields)
    const data = makeData(fields, 10)
    const result = displayBuilder(merged, DEFAULT_GRAPH_CONFIG, data, grafanaDarkTheme)
    expect(result.series).toHaveLength(1)
    expect(result.series[0].type).toBe('line')
    expect(result.series[0].name).toBe('temperature')
  })

  it('生成 bar series 当 mode=bar', () => {
    const config: GraphConfig = { ...DEFAULT_GRAPH_CONFIG, display: { ...DEFAULT_GRAPH_CONFIG.display, mode: 'bar' } }
    const merged = overrideBuilder(config, ['pressure'], grafanaDarkTheme)
    const data = makeData(['pressure'], 10)
    const result = displayBuilder(merged, config, data, grafanaDarkTheme)
    expect(result.series[0].type).toBe('bar')
  })

  it('生成 points series 当 mode=points', () => {
    const config: GraphConfig = { ...DEFAULT_GRAPH_CONFIG, display: { ...DEFAULT_GRAPH_CONFIG.display, mode: 'points' } }
    const merged = overrideBuilder(config, ['voltage'], grafanaDarkTheme)
    const data = makeData(['voltage'], 10)
    const result = displayBuilder(merged, config, data, grafanaDarkTheme)
    expect(result.series[0].type).toBe('line')
    expect(result.series[0].showSymbol).toBe(true)
    expect((result.series[0] as any).lineStyle.width).toBe(0)
  })

  it('smooth interpolation', () => {
    const config: GraphConfig = { ...DEFAULT_GRAPH_CONFIG, display: { ...DEFAULT_GRAPH_CONFIG.display, interpolation: 'smooth' } }
    const merged = overrideBuilder(config, ['temp'], grafanaDarkTheme)
    const data = makeData(['temp'], 10)
    const result = displayBuilder(merged, config, data, grafanaDarkTheme)
    expect(result.series[0].smooth).toBe(true)
  })

  it('stepBefore interpolation', () => {
    const config: GraphConfig = { ...DEFAULT_GRAPH_CONFIG, display: { ...DEFAULT_GRAPH_CONFIG.display, interpolation: 'stepBefore' } }
    const merged = overrideBuilder(config, ['temp'], grafanaDarkTheme)
    const data = makeData(['temp'], 10)
    const result = displayBuilder(merged, config, data, grafanaDarkTheme)
    expect(result.series[0].step).toBe('start')
  })

  it('nullHandling asZero 将 null 替换为 0', () => {
    const config: GraphConfig = { ...DEFAULT_GRAPH_CONFIG, display: { ...DEFAULT_GRAPH_CONFIG.display, nullHandling: 'asZero' } }
    const merged = overrideBuilder(config, ['temp'], grafanaDarkTheme)
    const data = [{ timestamp: 1000, values: { temp: null as any } }, { timestamp: 1100, values: { temp: 5 } }]
    const result = displayBuilder(merged, config, data, grafanaDarkTheme)
    const seriesData = (result.series[0] as any).data as [number, number | null][]
    expect(seriesData[0][1]).toBe(0)
    expect(seriesData[1][1]).toBe(5)
  })

  it('nullHandling connected 设置 connectNulls', () => {
    const config: GraphConfig = { ...DEFAULT_GRAPH_CONFIG, display: { ...DEFAULT_GRAPH_CONFIG.display, nullHandling: 'connected' } }
    const merged = overrideBuilder(config, ['temp'], grafanaDarkTheme)
    const data = makeData(['temp'], 10)
    const result = displayBuilder(merged, config, data, grafanaDarkTheme)
    expect(result.series[0].connectNulls).toBe(true)
  })

  it('stacking normal', () => {
    const config: GraphConfig = { ...DEFAULT_GRAPH_CONFIG, display: { ...DEFAULT_GRAPH_CONFIG.display, stackMode: 'normal' } }
    const merged = overrideBuilder(config, ['a', 'b'], grafanaDarkTheme)
    const data = makeData(['a', 'b'], 10)
    const result = displayBuilder(merged, config, data, grafanaDarkTheme)
    expect(result.series[0].stack).toBe('total')
    expect(result.series[1].stack).toBe('total')
  })

  it('thresholds 生成 markLine', () => {
    const config: GraphConfig = {
      ...DEFAULT_GRAPH_CONFIG,
      display: {
        ...DEFAULT_GRAPH_CONFIG.display,
        thresholds: [{ value: 30, color: '#7eb26d', label: 'OK' }]
      }
    }
    const merged = overrideBuilder(config, ['temp'], grafanaDarkTheme)
    const data = makeData(['temp'], 10)
    const result = displayBuilder(merged, config, data, grafanaDarkTheme)
    expect(result.markLine).toBeDefined()
    expect(result.markLine!.data).toHaveLength(1)
  })

  it('多个 thresholds 生成 markLine + markArea', () => {
    const config: GraphConfig = {
      ...DEFAULT_GRAPH_CONFIG,
      display: {
        ...DEFAULT_GRAPH_CONFIG.display,
        thresholds: [
          { value: 30, color: 'green' },
          { value: 60, color: 'yellow' },
          { value: 90, color: 'red' }
        ]
      }
    }
    const merged = overrideBuilder(config, ['temp'], grafanaDarkTheme)
    const data = makeData(['temp'], 10)
    const result = displayBuilder(merged, config, data, grafanaDarkTheme)
    expect(result.markLine!.data).toHaveLength(3)
    expect(result.markArea).toBeDefined()
  })

  it('gradient fill 设置 LinearGradient areaStyle', () => {
    const config: GraphConfig = { ...DEFAULT_GRAPH_CONFIG, display: { ...DEFAULT_GRAPH_CONFIG.display, gradientFill: true } }
    const merged = overrideBuilder(config, ['temp'], grafanaDarkTheme)
    const data = makeData(['temp'], 10)
    const result = displayBuilder(merged, config, data, grafanaDarkTheme)
    expect(result.series[0].areaStyle).toBeDefined()
  })
})