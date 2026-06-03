export * from './ChartPanel'
export * from './ChartIMU'
export * from './PipelinePanel'
export * from './Sim'
export * from './ChartRocket'
export * from './EChartsTimeSeries'
export * from './DataTable'

import { chartPanelWidget, default as ChartPanel, default as CanvasChartPanel } from './ChartPanel'
import { chartIMUWidget, default as ChartIMU } from './ChartIMU'
import { pipelineWidget, default as PipelinePanel } from './PipelinePanel'
import { simWidget, default as Sim } from './Sim'
import { chartRocketWidget, default as ChartRocket } from './ChartRocket'
import { echartsWidget, default as EChartsTimeSeries } from './EChartsTimeSeries'
import { dataTableWidget, default as DataTable } from './DataTable'
import type { WidgetDefinition } from './types'

export const widgetRegistry: Record<string, WidgetDefinition> = {
  chart:          chartPanelWidget,
  '3d':           chartIMUWidget,
  pipeline:       pipelineWidget,
  sim:            simWidget,
  rocket:         chartRocketWidget,
  'echarts-chart': echartsWidget,
  table:          dataTableWidget,
}

export const widgetComponents = {
  chart:          ChartPanel,
  '3d':           ChartIMU,
  pipeline:       PipelinePanel,
  sim:            Sim,
  rocket:         ChartRocket,
  'echarts-chart': EChartsTimeSeries,
  table:          DataTable,
}