import { describe, it, expect } from 'vitest'
import { overrideBuilder } from '@/widgets/EChartsTimeSeries/builders/overrideBuilder'
import { DEFAULT_GRAPH_CONFIG, type GraphConfig } from '@/widgets/EChartsTimeSeries/graphConfig'
import { grafanaDarkTheme } from '@/widgets/EChartsTimeSeries/chartTheme'

describe('overrideBuilder', () => {
  it('无 override 时返回 base config + theme 颜色', () => {
    const fields = ['temperature', 'humidity']
    const result = overrideBuilder(DEFAULT_GRAPH_CONFIG, fields, grafanaDarkTheme)
    expect(result).toHaveLength(2)
    expect(result[0].alias).toBe('temperature')
    expect(result[0].color).toBe(grafanaDarkTheme.colors[0])
    expect(result[0].yAxis).toBe(0)
    expect(result[0].unit).toBe('none')
    expect(result[1].alias).toBe('humidity')
    expect(result[1].color).toBe(grafanaDarkTheme.colors[1])
  })

  it('override 颜色覆盖 theme 颜色', () => {
    const config: GraphConfig = {
      ...DEFAULT_GRAPH_CONFIG,
      overrides: [{ alias: 'temperature', color: '#ff0000' }]
    }
    const result = overrideBuilder(config, ['temperature', 'humidity'], grafanaDarkTheme)
    expect(result[0].color).toBe('#ff0000')
    expect(result[1].color).toBe(grafanaDarkTheme.colors[1])
  })

  it('override yAxis 改变轴归属', () => {
    const config: GraphConfig = {
      ...DEFAULT_GRAPH_CONFIG,
      axes: [
        { side: 'left', scale: 'linear', unit: '°C' },
        { side: 'right', scale: 'linear', unit: '%' }
      ],
      overrides: [{ alias: 'humidity', yAxis: 1 }]
    }
    const result = overrideBuilder(config, ['temperature', 'humidity'], grafanaDarkTheme)
    expect(result[0].yAxis).toBe(0)
    expect(result[0].unit).toBe('°C')
    expect(result[1].yAxis).toBe(1)
    expect(result[1].unit).toBe('%')
  })

  it('override display 属性部分覆盖', () => {
    const config: GraphConfig = {
      ...DEFAULT_GRAPH_CONFIG,
      overrides: [{ alias: 'temperature', lineWidth: 3, lineStyle: 'dashed' }]
    }
    const result = overrideBuilder(config, ['temperature'], grafanaDarkTheme)
    expect(result[0].lineWidth).toBe(3)
    expect(result[0].lineStyle).toBe('dashed')
    // 其他属性保留 base
    expect(result[0].mode).toBe('line')
    expect(result[0].interpolation).toBe('linear')
  })

  it('override unit 独立覆盖轴单位', () => {
    const config: GraphConfig = {
      ...DEFAULT_GRAPH_CONFIG,
      axes: [{ side: 'left', scale: 'linear', unit: 'V' }],
      overrides: [{ alias: 'sensor1', unit: 'mV' }]
    }
    const result = overrideBuilder(config, ['sensor1'], grafanaDarkTheme)
    expect(result[0].unit).toBe('mV')
  })

  it('空 fields 返回空数组', () => {
    const result = overrideBuilder(DEFAULT_GRAPH_CONFIG, [], grafanaDarkTheme)
    expect(result).toHaveLength(0)
  })

  it('颜色索引循环使用 theme.colors', () => {
    const fields = Array.from({ length: 12 }, (_, i) => `field${i}`)
    const result = overrideBuilder(DEFAULT_GRAPH_CONFIG, fields, grafanaDarkTheme)
    expect(result[10].color).toBe(grafanaDarkTheme.colors[0])  // 第11个用第1个颜色
  })
})