export * from './ChartPanel'
export * from './ChartIMU'
export * from './PipelinePanel'
export * from './Sim'
export * from './ChartRocket'

export { default as WidgetWrapper } from './WidgetWrapper/WidgetWrapper.vue'
export { default as Widget } from './Widget/Widget.vue'

import { chartPanelWidget, default as ChartPanel } from './ChartPanel'
import { chartIMUWidget, default as ChartIMU } from './ChartIMU'
import { pipelineWidget, default as PipelinePanel } from './PipelinePanel'
import { simWidget, default as Sim } from './Sim'
import { chartRocketWidget, default as ChartRocket } from './ChartRocket'
import type { WidgetDefinition } from './types'

export const widgetRegistry: Record<string, WidgetDefinition> = {
  chart: chartPanelWidget,
  imu3d: chartIMUWidget,
  pipeline: pipelineWidget,
  sim: simWidget,
  rocket: chartRocketWidget
}

export const widgetComponents = {
  chart: ChartPanel,
  imu3d: ChartIMU,
  pipeline: PipelinePanel,
  sim: Sim,
  rocket: ChartRocket
}
