import type { GraphConfig, MergedSeriesConfig } from '../graphConfig'
import type { ChartTheme } from '../chartTheme'
import { formatUnitValueAuto } from '../unitFormatter'

interface DataPoint {
  timestamp: number
  values: Record<string, number | null>
}

interface SeriesStat {
  alias: string
  last: number | null
  min: number | null
  max: number | null
  mean: number | null
  sum: number | null
}

interface LegendResult {
  legend: { show: boolean }
  legendStats: SeriesStat[]
  legendFormatter: (alias: string) => string
  tooltipFormatter: (params: any) => string
}

function computeSeriesStats(
  mergedConfigs: MergedSeriesConfig[],
  data: DataPoint[]
): SeriesStat[] {
  return mergedConfigs.map(mc => {
    const values = data.map(d => d.values[mc.alias])
    const numericValues = values.filter((v): v is number => v !== null && v !== undefined)

    if (numericValues.length === 0) {
      return { alias: mc.alias, last: null, min: null, max: null, mean: null, sum: null }
    }

    // last = last non-null value in data order
    const lastNonNull = values.reduce<number | null>((acc, v) => {
      if (v !== null && v !== undefined) return v
      return acc
    }, null)

    const sum = numericValues.reduce((a, b) => a + b, 0)
    const min = numericValues.reduce((a, b) => (a < b ? a : b), numericValues[0])
    const max = numericValues.reduce((a, b) => (a > b ? a : b), numericValues[0])
    const mean = sum / numericValues.length

    return { alias: mc.alias, last: lastNonNull, min, max, mean, sum }
  })
}

function sortStats(stats: SeriesStat[], config: GraphConfig): SeriesStat[] {
  const { sortBy, sortDirection } = config.legend
  if (sortDirection === 'none' || sortBy === 'none') return stats

  const sorted = [...stats]
  sorted.sort((a, b) => {
    const av = a[sortBy] ?? 0
    const bv = b[sortBy] ?? 0
    return sortDirection === 'desc' ? bv - av : av - bv
  })
  return sorted
}

export function legendBuilder(
  config: GraphConfig,
  data: DataPoint[],
  mergedConfigs: MergedSeriesConfig[],
  theme: ChartTheme
): LegendResult {
  const legendStats = sortStats(computeSeriesStats(mergedConfigs, data), config)

  const statsMap = new Map(legendStats.map(s => [s.alias, s]))
  const mergedMap = new Map(mergedConfigs.map(m => [m.alias, m]))

  const legendFormatter = (alias: string): string => {
    const stat = statsMap.get(alias)
    const merged = mergedMap.get(alias)
    if (!stat || !merged) return alias

    const parts: string[] = [alias]
    for (const calc of config.legend.calc) {
      const value = stat[calc]
      const formatted = value !== null ? formatUnitValueAuto(value, merged.unit) : 'null'
      parts.push(`${calc}: ${formatted}`)
    }
    return parts.join('  ')
  }

  const tooltipFormatter = (params: any): string => {
    if (!Array.isArray(params)) params = [params]
    const lines: string[] = []
    for (const p of params) {
      const merged = mergedMap.get(p.seriesName)
      const unit = merged?.unit ?? 'none'
      const value = p.value[1] ?? p.value
      const formatted = typeof value === 'number' ? formatUnitValueAuto(value, unit) : String(value)
      lines.push(`${p.seriesName}: ${formatted}`)
    }
    return lines.join('\n')
  }

  return {
    legend: { show: false },
    legendStats,
    legendFormatter,
    tooltipFormatter
  }
}