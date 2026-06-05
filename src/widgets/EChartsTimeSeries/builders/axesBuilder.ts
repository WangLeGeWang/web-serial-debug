import type { GraphConfig, MergedSeriesConfig, AxisConfig } from '../graphConfig'
import type { ChartTheme } from '../chartTheme'
import { formatUnitValue } from '../unitFormatter'

interface DataPoint { timestamp: number; values: Record<string, number | null> }

interface YAxisOption {
  position: string
  type: string
  min?: number
  max?: number
  splitLine?: { show: boolean }
  axisLine?: { lineStyle: { color: string } }
  axisLabel?: { color: string; formatter: (value: number) => string }
}

interface XAxisOption {
  type: string
  axisLine?: { lineStyle: { color: string } }
  axisLabel?: { color: string; formatter?: string | ((value: number) => string) }
}

interface GridOption {
  left: number
  right: number
  top: number
  bottom: number
}

export interface AxesResult {
  yAxis: YAxisOption[]
  xAxis: XAxisOption
  grid: GridOption
}

function computeAxisDataRanges(
  axisIndex: number,
  mergedConfigs: MergedSeriesConfig[],
  data: DataPoint[]
): { dataMin: number | undefined; dataMax: number | undefined } {
  const aliases = mergedConfigs
    .filter(mc => mc.yAxis === axisIndex)
    .map(mc => mc.alias)

  if (aliases.length === 0 || data.length === 0) {
    return { dataMin: undefined, dataMax: undefined }
  }

  let dataMin: number | undefined = undefined
  let dataMax: number | undefined = undefined

  for (const dp of data) {
    for (const alias of aliases) {
      const val = dp.values[alias]
      if (val === null || val === undefined) continue
      if (dataMin === undefined || val < dataMin) dataMin = val
      if (dataMax === undefined || val > dataMax) dataMax = val
    }
  }

  return { dataMin, dataMax }
}

function resolveAxisBounds(
  axis: AxisConfig,
  axisIndex: number,
  mergedConfigs: MergedSeriesConfig[],
  data: DataPoint[]
): { min?: number; max?: number } {
  const { dataMin, dataMax } = computeAxisDataRanges(axisIndex, mergedConfigs, data)

  let min: number | undefined
  let max: number | undefined

  if (axis.hardMin !== undefined) {
    min = axis.hardMin
  } else if (axis.softMin !== undefined) {
    min = dataMin !== undefined ? Math.min(axis.softMin, dataMin) : axis.softMin
  }

  if (axis.hardMax !== undefined) {
    max = axis.hardMax
  } else if (axis.softMax !== undefined) {
    max = dataMax !== undefined ? Math.max(axis.softMax, dataMax) : axis.softMax
  }

  return { min, max }
}

function formatTimeLabel(value: number): string {
  const date = new Date(value)
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

export function axesBuilder(
  config: GraphConfig,
  mergedConfigs: MergedSeriesConfig[],
  data: DataPoint[],
  theme: ChartTheme
): AxesResult {
  const hasRightAxis = config.axes.some(a => a.side === 'right')

  const yAxis: YAxisOption[] = config.axes.map((axis, index) => {
    const bounds = resolveAxisBounds(axis, index, mergedConfigs, data)

    const yOpt: YAxisOption = {
      position: axis.side,
      type: axis.scale === 'log' ? 'log' : 'value',
      axisLine: { lineStyle: { color: theme.axis } },
      axisLabel: {
        color: theme.mutedText,
        formatter: (value: number) => formatUnitValue(value, axis.unit, axis.decimals)
      }
    }

    if (bounds.min !== undefined) yOpt.min = bounds.min
    if (bounds.max !== undefined) yOpt.max = bounds.max

    if (axis.side === 'right') {
      yOpt.splitLine = { show: false }
    }

    return yOpt
  })

  const grid: GridOption = {
    left: 54,
    right: hasRightAxis ? 60 : 20,
    top: 24,
    bottom: 66
  }

  const xAxis: XAxisOption = {
    type: 'time',
    axisLine: { lineStyle: { color: theme.axis } },
    axisLabel: {
      color: theme.mutedText,
      formatter: formatTimeLabel
    }
  }

  return { yAxis, xAxis, grid }
}