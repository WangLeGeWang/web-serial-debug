import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  ToolboxComponent,
  MarkLineComponent,
  MarkAreaComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { UniversalTransition } from 'echarts/features'

echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  ToolboxComponent,
  MarkLineComponent,
  MarkAreaComponent,
  CanvasRenderer,
  UniversalTransition
])

export { echarts }
export type { ECharts, EChartsOption, LineSeriesOption } from 'echarts'
