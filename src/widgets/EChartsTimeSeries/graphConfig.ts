// ---- Display 类型 ----
export type LineStyle = 'solid' | 'dashed' | 'dotted'
export type Interpolation = 'linear' | 'smooth' | 'stepBefore' | 'stepAfter'
export type NullHandling = 'connected' | 'asNull' | 'asZero'
export type DisplayMode = 'line' | 'bar' | 'points'
export type StackMode = 'none' | 'normal' | 'percent'

export interface Threshold {
  value: number
  color: string
  label?: string
}

export interface DisplayConfig {
  mode: DisplayMode
  lineWidth: number
  lineStyle: LineStyle
  interpolation: Interpolation
  showArea: boolean
  areaOpacity: number
  gradientFill: boolean
  stackMode: StackMode
  showSymbol: boolean
  symbolSize: number
  nullHandling: NullHandling
  thresholds: Threshold[]
}

// ---- Axes 类型 ----
export type AxisScale = 'linear' | 'log'
export type AxisSide = 'left' | 'right'

export interface AxisConfig {
  side: AxisSide
  scale: AxisScale
  unit: string
  decimals?: number
  softMin?: number
  softMax?: number
  hardMin?: number
  hardMax?: number
  label?: string
}

// ---- Legend 类型 ----
export type LegendPlacement = 'bottom' | 'top' | 'right' | 'table' | 'hidden'
export type LegendCalc = 'last' | 'min' | 'max' | 'mean' | 'sum'
export type LegendSort = 'none' | 'asc' | 'desc'

export interface LegendConfig {
  placement: LegendPlacement
  asTable: boolean
  calc: LegendCalc[]
  sortBy: LegendCalc
  sortDirection: LegendSort
}

// ---- Override ----
export interface SeriesOverride {
  alias: string
  color?: string
  mode?: DisplayMode
  lineWidth?: number
  lineStyle?: LineStyle
  interpolation?: Interpolation
  showArea?: boolean
  areaOpacity?: number
  gradientFill?: boolean
  stackMode?: StackMode
  yAxis?: number
  unit?: string
  showSymbol?: boolean
  symbolSize?: number
  nullHandling?: NullHandling
  zorder?: number
}

// ---- MergedSeriesConfig ----
export interface MergedSeriesConfig extends DisplayConfig {
  alias: string
  color: string
  yAxis: number
  unit: string
  zorder: number
}

// ---- 顶层 GraphConfig ----
export interface GraphConfig {
  display: DisplayConfig
  axes: AxisConfig[]
  legend: LegendConfig
  overrides: SeriesOverride[]
  maxPoints: number
  refreshRate: number
  sampling: 'lttb' | 'average' | 'max' | 'min' | 'none'
}

export const DEFAULT_GRAPH_CONFIG: GraphConfig = {
  display: {
    mode: 'line',
    lineWidth: 1.5,
    lineStyle: 'solid',
    interpolation: 'linear',
    showArea: true,
    areaOpacity: 0.08,
    gradientFill: false,
    stackMode: 'none',
    showSymbol: false,
    symbolSize: 4,
    nullHandling: 'asNull',
    thresholds: []
  },
  axes: [{
    side: 'left',
    scale: 'linear',
    unit: 'none'
  }],
  legend: {
    placement: 'bottom',
    asTable: false,
    calc: ['last', 'min', 'max', 'mean'],
    sortBy: 'none',
    sortDirection: 'none'
  },
  overrides: [],
  maxPoints: 10000,
  refreshRate: 100,
  sampling: 'lttb'
}

/** 将部分配置与默认值合并 */
export function mergeWithDefaults(partial: Partial<GraphConfig>): GraphConfig {
  return {
    display: { ...DEFAULT_GRAPH_CONFIG.display, ...partial.display },
    axes: partial.axes ?? DEFAULT_GRAPH_CONFIG.axes,
    legend: { ...DEFAULT_GRAPH_CONFIG.legend, ...partial.legend },
    overrides: partial.overrides ?? DEFAULT_GRAPH_CONFIG.overrides,
    maxPoints: partial.maxPoints ?? DEFAULT_GRAPH_CONFIG.maxPoints,
    refreshRate: partial.refreshRate ?? DEFAULT_GRAPH_CONFIG.refreshRate,
    sampling: partial.sampling ?? DEFAULT_GRAPH_CONFIG.sampling
  }
}