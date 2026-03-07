import { defineAsyncComponent } from 'vue'
import type { WidgetDefinition } from '../types'

const PipelinePanel = defineAsyncComponent(() => import('./PipelinePanel.vue'))

export const pipelineWidget: WidgetDefinition = {
  name: '流程图',
  component: PipelinePanel,
  defaultWidth: 12,
  defaultHeight: 8,
  defaultConfig: {}
}

export default PipelinePanel
