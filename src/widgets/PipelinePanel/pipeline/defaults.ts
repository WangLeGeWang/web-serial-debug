import type { DisplayField, PipelineHandle, PipelineNodeData, PipelineNodeType } from './types'

export const nodeTypeOptions: Array<{ label: string; value: PipelineNodeType }> = [
  { label: '罐', value: 'tank' },
  { label: '阀', value: 'valve' },
  { label: '传感器', value: 'sensor' },
  { label: '发动机', value: 'engine' }
]

export const subtypeOptions: Record<PipelineNodeType, Array<{ label: string; value: string }>> = {
  tank: [
    { label: '燃料罐', value: 'fuel' },
    { label: '氧化剂罐', value: 'oxidizer' },
    { label: '增压气罐', value: 'pressurant' },
    { label: '自定义罐', value: 'custom' }
  ],
  valve: [
    { label: '普通阀', value: 'normal' },
    { label: '单向阀', value: 'check' },
    { label: '调压阀', value: 'regulator' },
    { label: '自定义阀', value: 'custom' }
  ],
  sensor: [
    { label: '压力传感器', value: 'pressure' },
    { label: '温度传感器', value: 'temperature' },
    { label: '流量传感器', value: 'flow' },
    { label: '自定义传感器', value: 'custom' }
  ],
  engine: [
    { label: '主发动机', value: 'main' },
    { label: '自定义发动机', value: 'custom' }
  ]
}

const labels: Record<PipelineNodeType, string> = {
  tank: '罐',
  valve: '阀',
  sensor: '传感器',
  engine: '发动机'
}

export function createDisplayField(type: DisplayField['type'] = 'realtime'): DisplayField {
  return {
    id: `field-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    label: type === 'static' ? '说明' : '字段',
    key: type === 'static' ? undefined : '',
    text: type === 'static' ? '' : undefined,
    unit: '',
    precision: 2,
    template: type === 'static' ? '{label}: {text}' : '{label}: {value} {unit}',
    map: type === 'mapping' ? { '0': '关闭', '1': '开启' } : undefined,
    expression: type === 'expression' ? '' : undefined
  }
}

export function getDefaultHandles(type: PipelineNodeType, subtype?: string): PipelineHandle[] {
  if (type === 'tank') {
    return [
      { id: 'pressurant', type: 'target', position: 'top' },
      { id: 'output', type: 'source', position: 'bottom' }
    ]
  }

  if (type === 'valve') {
    return [
      { id: 'input', type: 'target', position: 'left' },
      { id: 'output', type: 'source', position: 'right' }
    ]
  }

  if (type === 'sensor') {
    return subtype === 'flow'
      ? [
          { id: 'input', type: 'target', position: 'left' },
          { id: 'output', type: 'source', position: 'right' }
        ]
      : [{ id: 'input', type: 'target', position: 'left' }]
  }

  return [
    { id: 'fuel', type: 'target', position: 'left' },
    { id: 'oxidizer', type: 'target', position: 'left' },
    { id: 'output', type: 'source', position: 'right' }
  ]
}

export function getDefaultNodeData(type: PipelineNodeType, subtype?: string): PipelineNodeData {
  const resolvedSubtype = subtype || subtypeOptions[type][0].value
  return {
    label: getDefaultLabel(type, resolvedSubtype),
    subtype: resolvedSubtype,
    displayFields: getDefaultFields(type, resolvedSubtype),
    handles: getDefaultHandles(type, resolvedSubtype),
    actions: type === 'valve'
      ? [
          { label: '开启', value: '1' },
          { label: '关闭', value: '0' }
        ]
      : []
  }
}

export function getDefaultLabel(type: PipelineNodeType, subtype: string) {
  const option = subtypeOptions[type].find(item => item.value === subtype)
  return option?.label || labels[type]
}

export function getDefaultFields(type: PipelineNodeType, subtype: string): DisplayField[] {
  if (type === 'tank') {
    return [
      { id: 'medium', type: 'static', label: '介质', text: subtype === 'oxidizer' ? '液氧' : subtype === 'pressurant' ? '氦气' : '煤油', template: '{label}: {text}' },
      { id: 'pressure', type: 'realtime', label: '压力', key: '', unit: 'MPa', precision: 2, template: '{label}: {value} {unit}' },
      { id: 'temperature', type: 'realtime', label: '温度', key: '', unit: '℃', precision: 1, template: '{label}: {value} {unit}' },
      { id: 'level', type: 'realtime', label: '液位', key: '', unit: '%', precision: 0, template: '{label}: {value} {unit}' }
    ]
  }

  if (type === 'valve') {
    return [
      { id: 'state', type: 'mapping', label: '状态', key: '', map: { '0': '关闭', '1': '开启' }, template: '{label}: {value}' }
    ]
  }

  if (type === 'sensor') {
    const unit = subtype === 'temperature' ? '℃' : subtype === 'flow' ? 'kg/s' : 'MPa'
    return [
      { id: 'value', type: 'realtime', label: '读数', key: '', unit, precision: 2, template: '{label}: {value} {unit}' }
    ]
  }

  return [
    { id: 'chamber_pressure', type: 'realtime', label: '室压', key: '', unit: 'MPa', precision: 2, template: '{label}: {value} {unit}' },
    { id: 'thrust', type: 'realtime', label: '推力', key: '', unit: 'N', precision: 0, template: '{label}: {value} {unit}' }
  ]
}

export function createDefaultDemo() {
  const nodes = [
    {
      id: 'tank-he',
      type: 'tank',
      position: { x: 80, y: 40 },
      data: {
        ...getDefaultNodeData('tank', 'pressurant'),
        label: '氦气瓶',
        displayFields: [
          { id: 'medium', type: 'static', label: '介质', text: '氦气', template: '{label}: {text}' },
          { id: 'pressure', type: 'realtime', label: '压力', key: 'he_pressure', unit: 'MPa', precision: 2, template: '{label}: {value} {unit}', threshold: { mode: 'greater', warning: 28, critical: 32 } }
        ]
      }
    },
    {
      id: 'valve-reg',
      type: 'valve',
      position: { x: 120, y: 210 },
      data: {
        ...getDefaultNodeData('valve', 'regulator'),
        label: '主调压阀',
        displayFields: [
          { id: 'pressure', type: 'realtime', label: '出口压力', key: 'reg_out_pressure', unit: 'MPa', precision: 2, template: '{label}: {value} {unit}' },
          { id: 'target', type: 'static', label: '目标', text: '2.00 MPa', template: '{label}: {text}' }
        ]
      }
    },
    {
      id: 'tank-lox',
      type: 'tank',
      position: { x: 320, y: 90 },
      data: {
        ...getDefaultNodeData('tank', 'oxidizer'),
        label: '氧化剂罐',
        displayFields: [
          { id: 'medium', type: 'static', label: '介质', text: '液氧', template: '{label}: {text}' },
          { id: 'pressure', type: 'realtime', label: '压力', key: 'lox_pressure', unit: 'MPa', precision: 2, template: '{label}: {value} {unit}' },
          { id: 'temperature', type: 'realtime', label: '温度', key: 'lox_temperature', unit: '℃', precision: 1, template: '{label}: {value} {unit}' },
          { id: 'level', type: 'realtime', label: '液位', key: 'lox_level', unit: '%', precision: 0, template: '{label}: {value} {unit}', threshold: { mode: 'less', warning: 30, critical: 15 } }
        ]
      }
    },
    {
      id: 'tank-fuel',
      type: 'tank',
      position: { x: 560, y: 90 },
      data: {
        ...getDefaultNodeData('tank', 'fuel'),
        label: '燃料罐',
        displayFields: [
          { id: 'medium', type: 'static', label: '介质', text: '煤油', template: '{label}: {text}' },
          { id: 'pressure', type: 'realtime', label: '压力', key: 'fuel_pressure', unit: 'MPa', precision: 2, template: '{label}: {value} {unit}' },
          { id: 'temperature', type: 'realtime', label: '温度', key: 'fuel_temperature', unit: '℃', precision: 1, template: '{label}: {value} {unit}' },
          { id: 'level', type: 'realtime', label: '液位', key: 'fuel_level', unit: '%', precision: 0, template: '{label}: {value} {unit}', threshold: { mode: 'less', warning: 30, critical: 15 } }
        ]
      }
    },
    {
      id: 'sensor-lox-pressure',
      type: 'sensor',
      position: { x: 320, y: 300 },
      data: {
        ...getDefaultNodeData('sensor', 'pressure'),
        label: '氧化剂压力',
        displayFields: [{ id: 'value', type: 'realtime', label: '压力', key: 'lox_pressure', unit: 'MPa', precision: 2, template: '{label}: {value} {unit}' }]
      }
    },
    {
      id: 'sensor-fuel-pressure',
      type: 'sensor',
      position: { x: 560, y: 300 },
      data: {
        ...getDefaultNodeData('sensor', 'pressure'),
        label: '燃料压力',
        displayFields: [{ id: 'value', type: 'realtime', label: '压力', key: 'fuel_pressure', unit: 'MPa', precision: 2, template: '{label}: {value} {unit}' }]
      }
    },
    {
      id: 'valve-lox-main',
      type: 'valve',
      position: { x: 320, y: 420 },
      data: {
        ...getDefaultNodeData('valve', 'normal'),
        label: '氧化剂主阀',
        displayFields: [{ id: 'state', type: 'mapping', label: '状态', key: 'lox_valve_state', map: { '0': '关闭', '1': '开启', '2': '故障' }, template: '{label}: {value}' }]
      }
    },
    {
      id: 'valve-fuel-main',
      type: 'valve',
      position: { x: 560, y: 420 },
      data: {
        ...getDefaultNodeData('valve', 'normal'),
        label: '燃料主阀',
        displayFields: [{ id: 'state', type: 'mapping', label: '状态', key: 'fuel_valve_state', map: { '0': '关闭', '1': '开启', '2': '故障' }, template: '{label}: {value}' }]
      }
    },
    {
      id: 'engine-main',
      type: 'engine',
      position: { x: 420, y: 590 },
      data: {
        ...getDefaultNodeData('engine', 'main'),
        label: '主发动机',
        displayFields: [
          { id: 'chamber_pressure', type: 'realtime', label: '室压', key: 'chamber_pressure', unit: 'MPa', precision: 2, template: '{label}: {value} {unit}' },
          { id: 'thrust', type: 'realtime', label: '推力', key: 'thrust', unit: 'N', precision: 0, template: '{label}: {value} {unit}' },
          { id: 'mixture_ratio', type: 'expression', label: '混合比', expression: 'lox_flow / fuel_flow', precision: 2, template: '{label}: {value}' }
        ]
      }
    }
  ]

  const edges = [
    { id: 'e-he-reg', source: 'tank-he', target: 'valve-reg', style: { strokeWidth: 4 } },
    { id: 'e-reg-lox', source: 'valve-reg', target: 'tank-lox', style: { strokeWidth: 4 } },
    { id: 'e-reg-fuel', source: 'valve-reg', target: 'tank-fuel', style: { strokeWidth: 4 } },
    { id: 'e-lox-sensor', source: 'tank-lox', target: 'sensor-lox-pressure', style: { strokeWidth: 4 } },
    { id: 'e-fuel-sensor', source: 'tank-fuel', target: 'sensor-fuel-pressure', style: { strokeWidth: 4 } },
    { id: 'e-lox-valve', source: 'sensor-lox-pressure', target: 'valve-lox-main', style: { strokeWidth: 4 } },
    { id: 'e-fuel-valve', source: 'sensor-fuel-pressure', target: 'valve-fuel-main', style: { strokeWidth: 4 } },
    { id: 'e-lox-engine', source: 'valve-lox-main', target: 'engine-main', style: { strokeWidth: 4 } },
    { id: 'e-fuel-engine', source: 'valve-fuel-main', target: 'engine-main', style: { strokeWidth: 4 } }
  ]

  return { nodes, edges }
}

export const demoRealtimeData: Record<string, number> = {
  he_pressure: 30,
  reg_out_pressure: 2,
  lox_pressure: 1.8,
  lox_temperature: -183,
  lox_level: 92,
  fuel_pressure: 1.75,
  fuel_temperature: 18,
  fuel_level: 88,
  lox_valve_state: 0,
  fuel_valve_state: 0,
  lox_flow: 0,
  fuel_flow: 1,
  chamber_pressure: 0,
  thrust: 0
}
