export interface WidgetConfig {
  id: string
  type: string
  title: string
  x: number
  y: number
  w: number
  h: number
  readonly: boolean
  config: Record<string, any>
}

export interface WidgetExposed {
  getConfig: () => Record<string, any>
  setConfig: (config: Record<string, any>) => void
}

export interface WidgetDefinition {
  name: string
  component: any
  defaultWidth: number
  defaultHeight: number
  defaultConfig: Record<string, any>
}

export const WIDGET_TYPES = {
  CHART: 'chart',
  TABLE: 'table',
  IMU_3D: 'imu3d',
  PIPELINE: 'pipeline',
  SIM: 'sim',
  ROCKET: 'rocket'
} as const

export type WidgetType = typeof WIDGET_TYPES[keyof typeof WIDGET_TYPES]
