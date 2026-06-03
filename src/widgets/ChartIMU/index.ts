import { defineAsyncComponent } from 'vue'
import type { WidgetDefinition, ConfigSchemaField } from '../types'

const ChartIMU = defineAsyncComponent(() => import('./ChartIMU.vue'))

export const chartIMUConfigSchema: ConfigSchemaField[] = [
  {
    key: 'viewMode',
    label: '视图模式',
    type: 'select',
    options: [
      { label: '透视', value: 'perspective' },
      { label: '正交', value: 'orthographic' }
    ]
  },
  {
    key: 'showGrid',
    label: '显示网格',
    type: 'switch'
  },
  {
    key: 'autoRotate',
    label: '自动旋转',
    type: 'switch'
  }
]

export const chartIMUWidget: WidgetDefinition = {
  name: '3D视图',
  component: ChartIMU,
  defaultWidth: 8,
  defaultHeight: 6,
  resizable: true,
  defaultConfig: {
    modelType: 'arrow'
  },
  configSchema: chartIMUConfigSchema,
}

export default ChartIMU