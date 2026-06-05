import { describe, it, expect } from 'vitest'
import { formatUnitValue, formatUnitValueAuto, UNIT_OPTIONS } from '@/widgets/EChartsTimeSeries/unitFormatter'

describe('formatUnitValue', () => {
  it('格式化无单位数值', () => {
    expect(formatUnitValue(23.456, 'none')).toBe('23.46')
    expect(formatUnitValue(100, 'none', 0)).toBe('100')
  })

  it('格式化温度 °C', () => {
    expect(formatUnitValue(23.5, '°C')).toBe('23.5°C')
    expect(formatUnitValue(0, '°C', 2)).toBe('0.00°C')
  })

  it('格式化电压 mV', () => {
    expect(formatUnitValue(0.005, 'mV')).toBe('5.0 mV')
    expect(formatUnitValue(1.5, 'V')).toBe('1.50 V')
  })

  it('格式化百分比', () => {
    expect(formatUnitValue(45, '%')).toBe('45.0%')
  })

  it('格式化速度 m/s', () => {
    expect(formatUnitValue(1.23, 'm/s')).toBe('1.23 m/s')
  })

  it('未识别的单位拼接显示', () => {
    expect(formatUnitValue(100, 'foo')).toBe('100.00 foo')
  })

  it('整数无单位不显示小数', () => {
    expect(formatUnitValue(5, 'none')).toBe('5')
  })
})

describe('formatUnitValueAuto', () => {
  it('小值不换算', () => {
    expect(formatUnitValueAuto(0.005, 'V')).toBe('5.0 mV')
  })

  it('大值自动换算', () => {
    expect(formatUnitValueAuto(1.5, 'mA')).toBe('1.50 A')
  })

  it('0值不换算', () => {
    expect(formatUnitValueAuto(0, 'mA')).toBe('0.0 mA')
  })

  it('none不换算', () => {
    expect(formatUnitValueAuto(100, 'none')).toBe('100')
  })
})

describe('UNIT_OPTIONS', () => {
  it('包含分组结构', () => {
    expect(UNIT_OPTIONS.length).toBeGreaterThan(5)
    expect(UNIT_OPTIONS[0].label).toBe('无')
    expect(UNIT_OPTIONS[0].options[0].value).toBe('none')
  })

  it('电流组包含 mA/A/kA', () => {
    const currentGroup = UNIT_OPTIONS.find(g => g.label === '电流')
    expect(currentGroup).toBeDefined()
    expect(currentGroup!.options.map(o => o.value)).toContain('mA')
    expect(currentGroup!.options.map(o => o.value)).toContain('A')
  })
})