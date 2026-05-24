export interface WidgetDefinition {
  name: string
  component: any
  defaultWidth: number
  defaultHeight: number
  defaultConfig: Record<string, any>
}
