export type PipelineNodeType = 'tank' | 'valve' | 'sensor' | 'engine'

export type DisplayFieldType = 'realtime' | 'static' | 'mapping' | 'expression'

export type FieldStatus = 'normal' | 'warning' | 'critical'

export interface DisplayFieldThreshold {
  mode: 'greater' | 'less' | 'range' | 'equal'
  warning?: number
  critical?: number
  min?: number
  max?: number
  equal?: string | number
}

export interface DisplayField {
  id: string
  type: DisplayFieldType
  label: string
  key?: string
  text?: string
  unit?: string
  precision?: number
  template?: string
  expression?: string
  map?: Record<string, string>
  threshold?: DisplayFieldThreshold
}

export interface PipelineHandle {
  id: string
  type: 'target' | 'source'
  position: 'top' | 'bottom' | 'left' | 'right'
}

export interface PipelineAction {
  label: string
  value: string
}

export interface PipelineNodeData {
  label: string
  subtype: string
  displayFields: DisplayField[]
  handles: PipelineHandle[]
  actions?: PipelineAction[]
}

export interface ResolvedDisplayField {
  id: string
  label: string
  rawValue: unknown
  value: string
  text: string
  status: FieldStatus
}

export interface PipelineConfig {
  nodes: any[]
  edges: any[]
}
