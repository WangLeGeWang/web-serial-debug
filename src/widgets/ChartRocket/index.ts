import { defineAsyncComponent } from 'vue'
import type { WidgetDefinition, ConfigSchemaField } from '../types'

const ChartRocket = defineAsyncComponent(() => import('./ChartRocket.vue'))

export const rocketConfigSchema: ConfigSchemaField[] = [
  {
    key: 'showTrajectory',
    label: '显示轨迹',
    type: 'switch'
  },
  {
    key: 'cameraMode',
    label: '相机模式',
    type: 'select',
    options: [
      { label: '跟随', value: 'follow' },
      { label: '固定', value: 'fixed' },
      { label: '自由', value: 'free' }
    ]
  }
]

export const chartRocketWidget: WidgetDefinition = {
  name: '水火箭',
  component: ChartRocket,
  defaultWidth: 12,
  defaultHeight: 8,
  resizable: true,
  defaultConfig: {},
  configSchema: rocketConfigSchema,
}

export default ChartRocket