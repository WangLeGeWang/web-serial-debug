import { describe, it, expect } from 'vitest'
import { axesBuilder } from '@/widgets/EChartsTimeSeries/builders/axesBuilder'
import { DEFAULT_GRAPH_CONFIG, type GraphConfig } from '@/widgets/EChartsTimeSeries/graphConfig'
import { grafanaDarkTheme } from '@/widgets/EChartsTimeSeries/chartTheme'
import { overrideBuilder } from '@/widgets/EChartsTimeSeries/builders/overrideBuilder'

describe('axesBuilder', () => {
  it('单左轴配置', () => {
    const merged = overrideBuilder(DEFAULT_GRAPH_CONFIG, ['temp'], grafanaDarkTheme)
    const data = [{ timestamp: 1000, values: { temp: 25 } }]
    const result = axesBuilder(DEFAULT_GRAPH_CONFIG, merged, data, grafanaDarkTheme)
    expect(result.yAxis).toHaveLength(1)
    expect(result.yAxis[0].position).toBe('left')
    expect(result.yAxis[0].type).toBe('value')
  })

  it('双 Y 轴（左+右）', () => {
    const config: GraphConfig = {
      ...DEFAULT_GRAPH_CONFIG,
      axes: [
        { side: 'left', scale: 'linear', unit: '°C' },
        { side: 'right', scale: 'linear', unit: '%' }
      ]
    }
    const merged = overrideBuilder(config, ['temp', 'humidity'], grafanaDarkTheme)
    const data = [{ timestamp: 1000, values: { temp: 25, humidity: 60 } }]
    const result = axesBuilder(config, merged, data, grafanaDarkTheme)
    expect(result.yAxis).toHaveLength(2)
    expect(result.yAxis[0].position).toBe('left')
    expect(result.yAxis[1].position).toBe('right')
    expect(result.yAxis[1].splitLine.show).toBe(false)
  })

  it('log scale', () => {
    const config: GraphConfig = {
      ...DEFAULT_GRAPH_CONFIG,
      axes: [{ side: 'left', scale: 'log', unit: 'none' }]
    }
    const merged = overrideBuilder(config, ['signal'], grafanaDarkTheme)
    const data = [{ timestamp: 1000, values: { signal: 100 } }]
    const result = axesBuilder(config, merged, data, grafanaDarkTheme)
    expect(result.yAxis[0].type).toBe('log')
  })

  it('hard min/max 直接设置', () => {
    const config: GraphConfig = {
      ...DEFAULT_GRAPH_CONFIG,
      axes: [{ side: 'left', scale: 'linear', unit: 'none', hardMin: 0, hardMax: 100 }]
    }
    const merged = overrideBuilder(config, ['temp'], grafanaDarkTheme)
    const data = [{ timestamp: 1000, values: { temp: 50 } }]
    const result = axesBuilder(config, merged, data, grafanaDarkTheme)
    expect(result.yAxis[0].min).toBe(0)
    expect(result.yAxis[0].max).toBe(100)
  })

  it('soft min/max 与数据范围比较', () => {
    const config: GraphConfig = {
      ...DEFAULT_GRAPH_CONFIG,
      axes: [{ side: 'left', scale: 'linear', unit: 'none', softMin: 0, softMax: 100 }]
    }
    const merged = overrideBuilder(config, ['temp'], grafanaDarkTheme)
    // 数据范围 20~80，softMax=100 大于 dataMax=80，使用 100
    const data = Array.from({ length: 5 }, (_, i) => ({ timestamp: 1000 + i * 100, values: { temp: 20 + i * 15 } }))
    const result = axesBuilder(config, merged, data, grafanaDarkTheme)
    expect(result.yAxis[0].min).toBe(0)
    expect(result.yAxis[0].max).toBe(100)
  })

  it('softMax 小于 dataMax 时使用 dataMax', () => {
    const config: GraphConfig = {
      ...DEFAULT_GRAPH_CONFIG,
      axes: [{ side: 'left', scale: 'linear', unit: 'none', softMax: 50 }]
    }
    const merged = overrideBuilder(config, ['temp'], grafanaDarkTheme)
    // 数据范围 20~80，softMax=50 小于 dataMax=80，使用 80
    const data = Array.from({ length: 5 }, (_, i) => ({ timestamp: 1000 + i * 100, values: { temp: 20 + i * 15 } }))
    const result = axesBuilder(config, merged, data, grafanaDarkTheme)
    expect(result.yAxis[0].max).toBe(80)
  })

  it('grid 有右轴时 right 增加到 60', () => {
    const config: GraphConfig = {
      ...DEFAULT_GRAPH_CONFIG,
      axes: [
        { side: 'left', scale: 'linear', unit: '°C' },
        { side: 'right', scale: 'linear', unit: '%' }
      ]
    }
    const merged = overrideBuilder(config, ['temp', 'humidity'], grafanaDarkTheme)
    const data = [{ timestamp: 1000, values: { temp: 25, humidity: 60 } }]
    const result = axesBuilder(config, merged, data, grafanaDarkTheme)
    expect(result.grid.right).toBe(60)
  })

  it('单位格式化 axisLabel.formatter', () => {
    const config: GraphConfig = {
      ...DEFAULT_GRAPH_CONFIG,
      axes: [{ side: 'left', scale: 'linear', unit: '°C', decimals: 1 }]
    }
    const merged = overrideBuilder(config, ['temp'], grafanaDarkTheme)
    const data = [{ timestamp: 1000, values: { temp: 23.5 } }]
    const result = axesBuilder(config, merged, data, grafanaDarkTheme)
    expect(result.yAxis[0].axisLabel.formatter(23.5)).toBe('23.5°C')
  })
})