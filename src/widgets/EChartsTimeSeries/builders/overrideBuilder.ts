import type { GraphConfig, MergedSeriesConfig, SeriesOverride, DisplayConfig } from '../graphConfig'
import type { ChartTheme } from '../chartTheme'

function mergeProps<T>(base: T, override: Partial<T>): T {
  const result = { ...base }
  for (const key of Object.keys(override) as (keyof T)[]) {
    if (override[key] !== undefined) {
      result[key] = override[key]!
    }
  }
  return result
}

export function overrideBuilder(
  config: GraphConfig,
  fields: string[],
  theme: ChartTheme
): MergedSeriesConfig[] {
  return fields.map((alias, index) => {
    const override = config.overrides.find(o => o.alias === alias)
    const baseDisplay: DisplayConfig = { ...config.display }

    // Extract display-related override props
    const displayOverride: Partial<DisplayConfig> = override ? {
      mode: override.mode,
      lineWidth: override.lineWidth,
      lineStyle: override.lineStyle,
      interpolation: override.interpolation,
      showArea: override.showArea,
      areaOpacity: override.areaOpacity,
      gradientFill: override.gradientFill,
      stackMode: override.stackMode,
      showSymbol: override.showSymbol,
      symbolSize: override.symbolSize,
      nullHandling: override.nullHandling
    } : {}

    const mergedDisplay = mergeProps(baseDisplay, displayOverride)
    const color = override?.color ?? theme.colors[index % theme.colors.length]
    const yAxis = override?.yAxis ?? 0
    const unit = override?.unit ?? config.axes[yAxis]?.unit ?? 'none'
    const zorder = override?.zorder ?? index

    return {
      alias,
      color,
      yAxis,
      unit,
      zorder,
      ...mergedDisplay
    }
  })
}