import { defineAsyncComponent } from 'vue'
import type { WidgetDefinition, ConfigSchemaField } from '../types'

const DataTable = defineAsyncComponent(() => import('../../components/DataTable.vue'))
const CanvasDataTable = defineAsyncComponent(() => import('./CanvasDataTable.vue'))

export const dataTableConfigSchema: ConfigSchemaField[] = [
  {
    key: 'columns',
    label: '显示列',
    type: 'dynamicFields'
  },
  {
    key: 'pageSize',
    label: '每页条数',
    type: 'number',
    min: 5,
    max: 100
  }
]

export const dataTableWidget: WidgetDefinition = {
  name: '数据表',
  component: DataTable,
  canvasComponent: CanvasDataTable,
  defaultWidth: 8,
  defaultHeight: 6,
  resizable: true,
  defaultConfig: {},
  configSchema: dataTableConfigSchema,
}

export default DataTable