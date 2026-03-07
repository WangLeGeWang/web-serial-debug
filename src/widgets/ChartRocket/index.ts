import { defineAsyncComponent } from 'vue'
import type { WidgetDefinition } from '../types'

const ChartRocket = defineAsyncComponent(() => import('./ChartRocket.vue'))

export const chartRocketWidget: WidgetDefinition = {
  name: '水火箭',
  component: ChartRocket,
  defaultWidth: 12,
  defaultHeight: 8,
  defaultConfig: {}
}

export default ChartRocket
