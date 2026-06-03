import { defineAsyncComponent } from 'vue'
import type { WidgetDefinition, ConfigSchemaField } from '../types'

const ChartPanel = defineAsyncComponent(() => import('./ChartPanel.vue'))
const CanvasChartPanel = defineAsyncComponent(() => import('./CanvasChartPanel.vue'))

export const chartConfigSchema: ConfigSchemaField[] = [
  {
    key: 'selectedChartId',
    label: '选择图表',
    type: 'select',
    options: []
  },
  {
    key: 'fields',
    label: '绑定字段',
    type: 'dynamicFields'
  },
  {
    key: 'legendPlacement',
    label: '图例位置',
    type: 'select',
    options: [
      { label: '右侧', value: 'right' },
      { label: '底部', value: 'bottom' },
      { label: '无', value: 'none' }
    ]
  },
  {
    key: 'yRangeMode',
    label: 'Y轴范围',
    type: 'select',
    options: [
      { label: '自动', value: 'auto' },
      { label: '固定', value: 'fixed' }
    ]
  },
  {
    key: 'yRangeMin',
    label: 'Y轴最小值',
    type: 'number',
    min: -999999,
    max: 999999,
    condition: { key: 'yRangeMode', value: 'fixed' }
  },
  {
    key: 'yRangeMax',
    label: 'Y轴最大值',
    type: 'number',
    min: -999999,
    max: 999999,
    condition: { key: 'yRangeMode', value: 'fixed' }
  }
]

export const chartPanelWidget: WidgetDefinition = {
  name: 'uPlot图表',
  component: ChartPanel,
  canvasComponent: CanvasChartPanel,
  defaultWidth: 8,
  defaultHeight: 6,
  resizable: true,
  defaultConfig: {
    charts: [],
    selectedChartId: null,
    fields: [],
    legendPlacement: 'right',
    yRangeMode: 'auto',
    yRangeMin: 0,
    yRangeMax: 100,
  },
  configSchema: chartConfigSchema,
}

export default ChartPanel