import { defineAsyncComponent } from 'vue'
import type { WidgetDefinition } from '../types'

const ChartPanel = defineAsyncComponent(() => import('./ChartPanel.vue'))

export const chartPanelWidget: WidgetDefinition = {
  name: '图表',
  component: ChartPanel,
  defaultWidth: 8,
  defaultHeight: 6,
  defaultConfig: {
    charts: []
  }
}

export default ChartPanel
