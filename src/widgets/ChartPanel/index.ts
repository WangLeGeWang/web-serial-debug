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
    key: 'legendWidthPercent',
    label: '图例占比',
    type: 'select',
    options: [
      { label: '15%', value: 15 },
      { label: '20%', value: 20 },
      { label: '25%', value: 25 },
      { label: '30%', value: 30 },
      { label: '35%', value: 35 },
    ],
    condition: { key: 'legendPlacement', value: 'right' }
  },
  {
    key: 'legendColumns',
    label: '图例列',
    type: 'multiSelect',
    options: [
      { label: '当前值', value: 0 },
      { label: '最小值', value: 1 },
      { label: '最大值', value: 2 },
      { label: '平均值', value: 3 },
    ],
  },
  {
    key: 'lineWidth',
    label: '线宽',
    type: 'number',
    min: 0.5,
    max: 5,
    step: 0.5
  },
  {
    key: 'showPoints',
    label: '显示数据点',
    type: 'switch'
  },
  {
    key: 'smooth',
    label: '平滑曲线',
    type: 'switch'
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
    legendWidthPercent: 25,
    legendColumns: [0, 1, 2, 3],
    lineWidth: 1.5,
    showPoints: true,
    smooth: false,
    yRangeMode: 'auto',
    yRangeMin: 0,
    yRangeMax: 100,
  },
  configSchema: chartConfigSchema,
}

export default ChartPanel