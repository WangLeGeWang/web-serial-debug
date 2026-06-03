import { defineAsyncComponent } from 'vue'
import type { WidgetDefinition, ConfigSchemaField } from '../types'

const Sim = defineAsyncComponent(() => import('./Sim.vue'))

export const simConfigSchema: ConfigSchemaField[] = [
  {
    key: 'timeScale',
    label: '时间缩放',
    type: 'number',
    min: 0.1,
    max: 10,
    step: 0.1
  },
  {
    key: 'showTrail',
    label: '显示轨迹',
    type: 'switch'
  }
]

export const simWidget: WidgetDefinition = {
  name: '模拟发射',
  component: Sim,
  defaultWidth: 12,
  defaultHeight: 8,
  resizable: true,
  defaultConfig: {},
  configSchema: simConfigSchema,
}

export default Sim