export interface UnitScale {
  id: string
  factor: number
  decimals?: number
}

export interface UnitFamily {
  id: string
  label: string
  scales: UnitScale[]
}

export const UNIT_FAMILIES: UnitFamily[] = [
  { id: 'none', label: '无', scales: [{ id: 'none', factor: 1, decimals: 2 }] },
  { id: 'temperature', label: '温度', scales: [
    { id: '°C', factor: 1, decimals: 1 },
    { id: '°F', factor: 1.8, decimals: 1 },
    { id: 'K', factor: 1, decimals: 1 }
  ]},
  { id: 'velocity', label: '速度', scales: [
    { id: 'm/s', factor: 1, decimals: 2 },
    { id: 'km/h', factor: 0.2778, decimals: 1 }
  ]},
  { id: 'pressure', label: '压力', scales: [
    { id: 'Pa', factor: 1, decimals: 0 },
    { id: 'kPa', factor: 1000, decimals: 2 },
    { id: 'bar', factor: 100000, decimals: 3 }
  ]},
  { id: 'voltage', label: '电压', scales: [
    { id: 'mV', factor: 0.001, decimals: 1 },
    { id: 'V', factor: 1, decimals: 2 },
    { id: 'kV', factor: 1000, decimals: 1 }
  ]},
  { id: 'current', label: '电流', scales: [
    { id: 'μA', factor: 0.000001, decimals: 1 },
    { id: 'mA', factor: 0.001, decimals: 1 },
    { id: 'A', factor: 1, decimals: 2 },
    { id: 'kA', factor: 1000, decimals: 1 }
  ]},
  { id: 'percent', label: '百分比', scales: [{ id: '%', factor: 1, decimals: 1 }] },
  { id: 'frequency', label: '频率', scales: [
    { id: 'Hz', factor: 1, decimals: 1 },
    { id: 'kHz', factor: 1000, decimals: 2 },
    { id: 'MHz', factor: 1000000, decimals: 2 }
  ]},
  { id: 'angle', label: '角度', scales: [
    { id: '°', factor: 1, decimals: 1 },
    { id: 'rad', factor: 0.01745, decimals: 3 }
  ]},
  { id: 'length', label: '长度', scales: [
    { id: 'mm', factor: 0.001, decimals: 1 },
    { id: 'cm', factor: 0.01, decimals: 2 },
    { id: 'm', factor: 1, decimals: 2 },
    { id: 'km', factor: 1000, decimals: 1 }
  ]},
  { id: 'mass', label: '质量', scales: [
    { id: 'g', factor: 1, decimals: 1 },
    { id: 'kg', factor: 1000, decimals: 2 }
  ]},
  { id: 'force', label: '力', scales: [
    { id: 'N', factor: 1, decimals: 1 },
    { id: 'kN', factor: 1000, decimals: 2 }
  ]},
  { id: 'time', label: '时间', scales: [
    { id: 'ms', factor: 0.001, decimals: 1 },
    { id: 's', factor: 1, decimals: 2 },
    { id: 'min', factor: 60, decimals: 1 },
    { id: 'h', factor: 3600, decimals: 1 }
  ]},
  { id: 'data', label: '数据量', scales: [
    { id: 'B', factor: 1, decimals: 0 },
    { id: 'KB', factor: 1024, decimals: 1 },
    { id: 'MB', factor: 1048576, decimals: 2 }
  ]},
  { id: 'acceleration', label: '加速度', scales: [
    { id: 'm/s²', factor: 1, decimals: 2 },
    { id: 'g', factor: 9.80665, decimals: 3 }
  ]},
  { id: 'power', label: '功率', scales: [
    { id: 'mW', factor: 0.001, decimals: 1 },
    { id: 'W', factor: 1, decimals: 2 },
    { id: 'kW', factor: 1000, decimals: 1 }
  ]}
]

function findScale(unitId: string): UnitScale | null {
  for (const family of UNIT_FAMILIES) {
    for (const scale of family.scales) {
      if (scale.id === unitId) return scale
    }
  }
  return null
}

function findFamily(unitId: string): UnitFamily | null {
  for (const family of UNIT_FAMILIES) {
    if (family.scales.some(s => s.id === unitId)) return family
  }
  return null
}

export function formatUnitValue(value: number, unitId: string, decimals?: number): string {
  if (unitId === 'none') {
    const d = decimals ?? 2
    return Number.isInteger(value) && d === 2 ? `${value}` : value.toFixed(d)
  }

  const scale = findScale(unitId)
  if (!scale) {
    const d = decimals ?? 2
    return `${value.toFixed(d)} ${unitId}`
  }

  const d = decimals ?? scale.decimals ?? 2

  // 紧凑单位（无空格）：°C、°F、K、%、°
  const compactUnits = ['°C', '°F', 'K', '%', '°']

  // 温度特殊转换
  if (unitId === '°F') return `${(value * 1.8 + 32).toFixed(d)}°F`
  if (unitId === 'K') return `${(value + 273.15).toFixed(d)} K`

  const displayValue = value / scale.factor
  const sep = compactUnits.includes(unitId) ? '' : ' '
  return `${displayValue.toFixed(d)}${sep}${unitId}`
}

export function formatUnitValueAuto(value: number, unitId: string): string {
  if (unitId === 'none' || value === 0) return formatUnitValue(value, unitId)

  const family = findFamily(unitId)
  if (!family) return formatUnitValue(value, unitId)

  const absVal = Math.abs(value)
  let bestScale = family.scales[0]
  for (const scale of family.scales) {
    const displayVal = absVal / scale.factor
    if (displayVal >= 0.1 && displayVal < 1000) {
      bestScale = scale
      break
    }
  }

  return formatUnitValue(value, bestScale.id)
}

export const UNIT_OPTIONS = UNIT_FAMILIES.map(f => ({
  label: f.label,
  options: f.scales.map(s => ({
    label: s.id === 'none' ? '无单位' : s.id,
    value: s.id
  }))
}))