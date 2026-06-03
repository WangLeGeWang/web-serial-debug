import { defineAsyncComponent } from 'vue'
import type { WidgetDefinition, ConfigSchemaField } from '../types'

const PipelinePanel = defineAsyncComponent(() => import('./PipelinePanel.vue'))

export const pipelineConfigSchema: ConfigSchemaField[] = [
  {
    key: 'showMinimap',
    label: '显示小地图',
    type: 'switch'
  }
]

export const pipelineWidget: WidgetDefinition = {
  name: '流程图',
  component: PipelinePanel,
  defaultWidth: 12,
  defaultHeight: 8,
  resizable: true,
  defaultConfig: {},
  configSchema: pipelineConfigSchema,
}

export default PipelinePanel