import { defineAsyncComponent } from 'vue'
import type { WidgetDefinition } from '../types'

const Sim = defineAsyncComponent(() => import('./Sim.vue'))

export const simWidget: WidgetDefinition = {
  name: '模拟发射',
  component: Sim,
  defaultWidth: 12,
  defaultHeight: 8,
  defaultConfig: {}
}

export default Sim
