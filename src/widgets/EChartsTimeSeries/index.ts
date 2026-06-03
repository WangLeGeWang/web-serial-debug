import { defineAsyncComponent } from 'vue'
import type { WidgetDefinition, ConfigSchemaField } from '../types'

const EChartsTimeSeries = defineAsyncComponent(() => import('./EChartsTimeSeries.vue'))

export const echartsConfigSchema: ConfigSchemaField[] = [
  {
    key: 'fields',
    label: '绑定字段',
    type: 'dynamicFields'
  },
  {
    key: 'maxPoints',
    label: '最大点数',
    type: 'number',
    min: 100,
    max: 50000,
    step: 100
  },
  {
    key: 'refreshRate',
    label: '刷新间隔',
    type: 'number',
    min: 16,
    max: 5000,
    step: 10
  },
  {
    key: 'sampling',
    label: '采样方式',
    type: 'select',
    options: [
      { label: 'LTTB', value: 'lttb' },
      { label: '平均值', value: 'average' },
      { label: '最大值', value: 'max' },
      { label: '最小值', value: 'min' },
      { label: '不采样', value: 'none' }
    ]
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
    key: 'showArea',
    label: '面积填充',
    type: 'switch'
  },
  {
    key: 'showSymbol',
    label: '显示点',
    type: 'switch'
  },
  {
    key: 'smooth',
    label: '平滑曲线',
    type: 'switch'
  }
]

export const echartsWidget: WidgetDefinition = {
  name: '高级图表',
  component: EChartsTimeSeries,
  defaultWidth: 10,
  defaultHeight: 7,
  resizable: true,
  defaultConfig: {},
  configSchema: echartsConfigSchema,
}

export default EChartsTimeSeries