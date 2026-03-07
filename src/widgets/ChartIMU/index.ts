import { defineAsyncComponent } from 'vue'
import type { WidgetDefinition } from '../types'

const ChartIMU = defineAsyncComponent(() => import('./ChartIMU.vue'))

export const chartIMUWidget: WidgetDefinition = {
  name: '3D姿态',
  component: ChartIMU,
  defaultWidth: 8,
  defaultHeight: 6,
  defaultConfig: {
    modelType: 'arrow'
  }
}

export default ChartIMU
