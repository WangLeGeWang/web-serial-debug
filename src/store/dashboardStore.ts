import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { widgetRegistry } from '@/widgets'

export interface CanvasItem {
  id: number
  type: string
  x: number
  y: number
  w: number
  h: number
  i: string
  title?: string
  resizable?: boolean
  titleHidden?: boolean
  config?: Record<string, any>
}

export interface Dashboard {
  id: string
  name: string
  items: CanvasItem[]
  showInTab: boolean
  deletable: boolean
  editable: boolean
}

export interface SavedCanvasItem {
  id: number
  type: string
  x: number
  y: number
  width: number
  height: number
  title?: string
  titleHidden?: boolean
  config?: Record<string, any>
}

export interface SavedDashboard {
  id: string
  name: string
  items: SavedCanvasItem[]
  showInTab?: boolean
  deletable?: boolean
  editable?: boolean
}

interface ComponentConfig {
  width: number
  height: number
  resizable: boolean
  title: string
}

// row 是布局概念，不属于 widget，单独定义
const ROW_CONFIG: ComponentConfig = { width: 24, height: 0.6, resizable: false, title: '行' }

// 从 widgetRegistry 派生 COMPONENT_CONFIGS，row 作为特殊布局项单独保留
export const COMPONENT_CONFIGS: Record<string, ComponentConfig> = computed(() => {
  const configs: Record<string, ComponentConfig> = { row: ROW_CONFIG }
  for (const [key, def] of Object.entries(widgetRegistry)) {
    configs[key] = {
      width: def.defaultWidth,
      height: def.defaultHeight,
      resizable: def.resizable ?? true,
      title: def.name,
    }
  }
  return configs
}).value

export const loadItemFromConfig = (item: any): CanvasItem => {
  const x = typeof item.x === 'number' ? Math.floor(item.x / 50) : 0
  const y = typeof item.y === 'number' ? Math.floor(item.y / 50) : 0
  const w = typeof item.width === 'number' ? Math.ceil(item.width / 50) : 4
  const h = item.type === 'row'
    ? ROW_CONFIG.height
    : typeof item.height === 'number' ? Math.ceil(item.height / 50) : 4
  const widgetDef = widgetRegistry[item.type]
  return {
    id: item.id,
    type: item.type,
    x,
    y,
    w,
    h,
    i: item.id?.toString() || Math.random().toString(),
    title: item.title || widgetDef?.name || COMPONENT_CONFIGS[item.type]?.title || '未命名',
    resizable: widgetDef?.resizable ?? COMPONENT_CONFIGS[item.type]?.resizable,
    titleHidden: Boolean(item.titleHidden),
    config: item.config || {}
  }
}

export const normalizeDashboards = (canvasConfig: any): Dashboard[] => {
  if (canvasConfig?.dashboards && Array.isArray(canvasConfig.dashboards) && canvasConfig.dashboards.length > 0) {
    return canvasConfig.dashboards.map((dashboard: SavedDashboard) => ({
      id: dashboard.id,
      name: dashboard.name,
      items: Array.isArray(dashboard.items) ? dashboard.items.map(loadItemFromConfig) : [],
      showInTab: dashboard.showInTab ?? false,
      deletable: dashboard.deletable ?? true,
      editable: dashboard.editable ?? true
    }))
  }
  const legacyItems = Array.isArray(canvasConfig?.items) ? canvasConfig.items : []
  return [{
    id: 'default',
    name: '默认看板',
    items: legacyItems.map(loadItemFromConfig),
    showInTab: false,
    deletable: true,
    editable: true
  }]
}

export const saveItemToConfig = (item: CanvasItem): SavedCanvasItem => ({
  id: item.id,
  type: item.type,
  x: item.x * 50,
  y: item.y * 50,
  width: item.w * 50,
  height: item.h * 50,
  title: item.title,
  titleHidden: Boolean(item.titleHidden),
  config: item.config
})

const createDefaultDashboard = (): Dashboard => ({
  id: 'default',
  name: '默认看板',
  items: [],
  showInTab: false,
  deletable: true,
  editable: true
})

const FIXED_DASHBOARDS: Dashboard[] = [
  {
    id: 'fixed-3d',
    name: '姿态',
    items: [{
      id: 1,
      type: '3d',
      x: 0,
      y: 0,
      w: 24,
      h: 12,
      i: '1',
      title: '3D视图',
      resizable: true,
      titleHidden: false,
      config: {}
    }],
    showInTab: true,
    deletable: false,
    editable: false
  },
  {
    id: 'fixed-chart',
    name: '可视化',
    items: [{
      id: 2,
      type: 'chart',
      x: 0,
      y: 0,
      w: 24,
      h: 12,
      i: '2',
      title: 'uPlot图表',
      resizable: true,
      titleHidden: false,
      config: {}
    }],
    showInTab: true,
    deletable: false,
    editable: false
  },
  {
    id: 'fixed-pipeline',
    name: '流程图',
    items: [{
      id: 3,
      type: 'pipeline',
      x: 0,
      y: 0,
      w: 24,
      h: 12,
      i: '3',
      title: '流程图',
      resizable: true,
      titleHidden: false,
      config: {}
    }],
    showInTab: true,
    deletable: false,
    editable: false
  },
  {
    id: 'fixed-sim',
    name: '模拟发射',
    items: [{
      id: 4,
      type: 'sim',
      x: 0,
      y: 0,
      w: 24,
      h: 12,
      i: '4',
      title: '模拟发射',
      resizable: true,
      titleHidden: false,
      config: {}
    }],
    showInTab: true,
    deletable: false,
    editable: false
  },
  {
    id: 'fixed-rocket',
    name: '水火箭',
    items: [{
      id: 5,
      type: 'rocket',
      x: 0,
      y: 0,
      w: 24,
      h: 12,
      i: '5',
      title: '水火箭',
      resizable: true,
      titleHidden: false,
      config: {}
    }],
    showInTab: true,
    deletable: false,
    editable: false
  }
]

export const useDashboardStore = defineStore('dashboard', () => {
  const dashboards = ref<Dashboard[]>([createDefaultDashboard()])

  const activeDashboardId = ref('default')

  const activeDashboard = computed(() => {
    return dashboards.value.find(d => d.id === activeDashboardId.value) || dashboards.value[0]
  })

  const visibleDashboards = computed(() =>
    dashboards.value.filter(d => d.showInTab)
  )

  const fixedDashboards = computed(() =>
    dashboards.value.filter(d => !d.deletable)
  )

  const setDashboards = (nextDashboards: Dashboard[], nextActiveDashboardId?: string) => {
    dashboards.value = nextDashboards.length > 0 ? nextDashboards : [createDefaultDashboard()]
    const activeExists = nextActiveDashboardId && dashboards.value.some(d => d.id === nextActiveDashboardId)
    activeDashboardId.value = activeExists ? nextActiveDashboardId : dashboards.value[0].id
  }

  const addDashboard = (name: string) => {
    const id = `dashboard-${Date.now()}`
    dashboards.value.push({
      id,
      name,
      items: [],
      showInTab: false,
      deletable: true,
      editable: true
    })
    activeDashboardId.value = id
    return id
  }

  const removeDashboard = (id: string) => {
    const dashboard = dashboards.value.find(d => d.id === id)
    if (!dashboard || !dashboard.deletable) return false
    if (dashboards.value.length <= 1) return false
    const index = dashboards.value.findIndex(d => d.id === id)
    if (index !== -1) {
      dashboards.value.splice(index, 1)
      if (activeDashboardId.value === id) {
        activeDashboardId.value = dashboards.value[0].id
      }
      return true
    }
    return false
  }

  const setActiveDashboard = (id: string) => {
    if (dashboards.value.some(d => d.id === id)) {
      activeDashboardId.value = id
    }
  }

  const updateDashboardItems = (id: string, items: CanvasItem[]) => {
    const dashboard = dashboards.value.find(d => d.id === id)
    if (dashboard) {
      dashboard.items = items
    }
  }

  const renameDashboard = (id: string, name: string) => {
    const dashboard = dashboards.value.find(d => d.id === id)
    if (dashboard && dashboard.editable) {
      dashboard.name = name
    }
  }

  const initFixedDashboards = () => {
    for (const fixed of FIXED_DASHBOARDS) {
      const existing = dashboards.value.find(d => d.id === fixed.id)
      if (!existing) {
        dashboards.value.push({ ...fixed, items: fixed.items.map(item => ({ ...item, config: { ...(item.config || {}) } })) })
      } else {
        existing.deletable = fixed.deletable
        existing.name = fixed.name
      }
    }
  }

  const toggleShowInTab = (id: string) => {
    const dashboard = dashboards.value.find(d => d.id === id)
    if (dashboard) {
      dashboard.showInTab = !dashboard.showInTab
    }
  }

  const toggleEditable = (id: string) => {
    const dashboard = dashboards.value.find(d => d.id === id)
    if (dashboard) {
      dashboard.editable = !dashboard.editable
    }
  }

  const copyDashboard = (id: string) => {
    const source = dashboards.value.find(d => d.id === id)
    if (!source) return null
    const newId = `dashboard-${Date.now()}`
    const newDashboard: Dashboard = {
      id: newId,
      name: `${source.name}(副本)`,
      items: source.items.map(item => ({ ...item, config: { ...(item.config || {}) } })),
      showInTab: false,
      deletable: true,
      editable: true
    }
    dashboards.value.push(newDashboard)
    activeDashboardId.value = newId
    return newId
  }

  const isFixedDashboard = (id: string) => {
    return id.startsWith('fixed-')
  }

  return {
    dashboards,
    activeDashboardId,
    activeDashboard,
    visibleDashboards,
    fixedDashboards,
    setDashboards,
    addDashboard,
    removeDashboard,
    renameDashboard,
    setActiveDashboard,
    updateDashboardItems,
    initFixedDashboards,
    toggleShowInTab,
    toggleEditable,
    copyDashboard,
    isFixedDashboard
  }
})