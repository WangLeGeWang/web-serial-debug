export interface ConfigSchemaField {
  key: string
  label: string
  type: 'select' | 'multiSelect' | 'switch' | 'number' | 'dynamicFields'
  options?: { label: string; value: any }[]
  min?: number
  max?: number
  step?: number
  condition?: { key: string; value: any }
}

export interface WidgetDefinition {
  name: string
  component: any
  canvasComponent?: any
  defaultWidth: number
  defaultHeight: number
  resizable?: boolean
  defaultConfig: Record<string, any>
  configSchema?: ConfigSchemaField[]
}