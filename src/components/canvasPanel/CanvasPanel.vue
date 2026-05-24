<script setup lang="ts">
import { ref, watch, computed, nextTick, onMounted, onUnmounted } from 'vue'
import PlaybackControl from './PlaybackControl.vue'
import DataSeriesManager from './DataSeriesManager.vue'
import DashboardManager from './DashboardManager.vue'
import CanvasWidgetWrapper from './CanvasWidgetWrapper.vue'
import CanvasItemConfigDialog from './CanvasItemConfigDialog.vue'
import { useDark } from '@vueuse/core'
import { GridLayout, GridItem } from 'grid-layout-plus'
import { realtimeProvider } from '@/utils/RealtimeProvider'
import { useDashboardStore, type Dashboard } from '@/store/dashboardStore'
import { EventCenter, EventNames } from '@/utils/EventCenter'
import { ProfileManagerInst } from '@/utils/ProfileManager'
import type { CanvasConfig } from '../types'

const showManager = ref(false)
const playbackControlRef = ref<{ selectSeries: (seriesId: string) => Promise<void> } | null>(null)

const profileManager = ProfileManagerInst
const dashboardStore = useDashboardStore()
const eventCenter = EventCenter.getInstance()
const isDark = useDark()
const canvasMode = ref<'view' | 'edit'>('view')

const isEditing = computed(() => canvasMode.value === 'edit')

const canvasConfig = computed(() => {
  const profile = profileManager.activeProfile
  return profile?.config?.canvas as CanvasConfig & {
    dashboards?: SavedDashboard[]
    activeDashboardId?: string
  } | undefined
})

interface CanvasItem {
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

interface SavedCanvasItem {
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

interface SavedDashboard {
  id: string
  name: string
  items: SavedCanvasItem[]
}

interface ComponentConfig {
  width: number
  height: number
  resizable: boolean
  title: string
}

const componentConfigs = {
  'chart': {
    width: 8,
    height: 6,
    resizable: true,
    title: 'uPlot图表'
  },
  'echarts-chart': {
    width: 10,
    height: 7,
    resizable: true,
    title: '高级图表'
  },
  'table': {
    width: 8,
    height: 6,
    resizable: true,
    title: '数据表'
  },
  '3d': {
    width: 8,
    height: 6,
    resizable: true,
    title: '3D视图'
  },
  'pipeline': {
    width: 12,
    height: 8,
    resizable: true,
    title: '流程图'
  },
  'sim': {
    width: 12,
    height: 8,
    resizable: true,
    title: '模拟发射'
  },
  'rocket': {
    width: 12,
    height: 8,
    resizable: true,
    title: '水火箭'
  },
  'row': {
    width: 24,
    height: 0.6,
    resizable: false,
    title: '行'
  }
} as Record<string, ComponentConfig>

const items = ref<CanvasItem[]>([])
let ignoreWatch = false

const getDefaultTitle = (type: string) => {
  return componentConfigs[type]?.title || '未命名'
}

const cloneItems = (sourceItems: CanvasItem[]) => {
  return sourceItems.map(item => ({
    ...item,
    config: { ...(item.config || {}) }
  }))
}

const loadItemFromConfig = (item: any): CanvasItem => {
  const x = typeof item.x === 'number' ? Math.floor(item.x / 50) : 0
  const y = typeof item.y === 'number' ? Math.floor(item.y / 50) : 0
  const w = typeof item.width === 'number' ? Math.ceil(item.width / 50) : 4
  const h = item.type === 'row'
    ? componentConfigs.row.height
    : typeof item.height === 'number' ? Math.ceil(item.height / 50) : 4

  return {
    id: item.id,
    type: item.type,
    x,
    y,
    w,
    h,
    i: item.id?.toString() || Math.random().toString(),
    title: item.title || getDefaultTitle(item.type),
    resizable: componentConfigs[item.type]?.resizable,
    titleHidden: Boolean(item.titleHidden),
    config: item.config || {}
  }
}

const saveItemToConfig = (item: CanvasItem): SavedCanvasItem => ({
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

const normalizeDashboards = () => {
  const config = canvasConfig.value
  if (config?.dashboards && Array.isArray(config.dashboards) && config.dashboards.length > 0) {
    return config.dashboards.map(dashboard => ({
      id: dashboard.id,
      name: dashboard.name,
      items: Array.isArray(dashboard.items) ? dashboard.items.map(loadItemFromConfig) : []
    }))
  }

  const legacyItems = Array.isArray(config?.items) ? config.items : []
  return [{
    id: 'default',
    name: '默认看板',
    items: legacyItems.map(loadItemFromConfig)
  }]
}

const persistDashboardsToProfile = () => {
  if (ignoreWatch) return
  const profile = profileManager.activeProfile
  if (!profile) return

  const dashboards = dashboardStore.dashboards.map((dashboard: Dashboard) => ({
    id: dashboard.id,
    name: dashboard.name,
    items: dashboard.items.map(saveItemToConfig)
  }))

  profileManager.updateProfile(profile.id, {
    config: {
      ...profile.config,
      canvas: {
        dashboards,
        activeDashboardId: dashboardStore.activeDashboardId,
        items: dashboardStore.activeDashboard?.items.map(saveItemToConfig) || []
      }
    }
  })
}

const syncItemsFromActiveDashboard = () => {
  items.value = cloneItems(dashboardStore.activeDashboard?.items || [])
  nextTick(handleResize)
}

const handleDataSeriesPlayback = async (seriesId: string) => {
  await playbackControlRef.value?.selectSeries(seriesId)
  showManager.value = false
}

const loadDashboardsFromProfile = () => {
  ignoreWatch = true
  const dashboards = normalizeDashboards()
  dashboardStore.setDashboards(dashboards as Dashboard[], canvasConfig.value?.activeDashboardId)
  syncItemsFromActiveDashboard()
  nextTick(() => { ignoreWatch = false })
}

const saveLayout = () => {
  dashboardStore.updateDashboardItems(dashboardStore.activeDashboardId, cloneItems(items.value))
  persistDashboardsToProfile()
}

const addComponent = (type: string) => {
  if (!isEditing.value) return
  const id = Date.now()
  const config = componentConfigs[type]
  const newItem: CanvasItem = {
    id,
    type,
    x: 0,
    y: 0,
    w: config.width,
    h: config.height,
    i: id.toString(),
    title: config.title,
    resizable: config.resizable,
    titleHidden: false,
    config: {}
  }
  items.value.push(newItem)
  saveLayout()
}

const onLayoutChange = () => {
  if (isEditing.value) {
    saveLayout()
  }
}

const removeItem = (id: number) => {
  if (!isEditing.value) return
  const index = items.value.findIndex(item => item.id === id)
  if (index !== -1) {
    items.value.splice(index, 1)
    saveLayout()
  }
}

const handleResize = () => {
  window.dispatchEvent(new CustomEvent('resize'))
}

const toggleTitleHidden = (item: CanvasItem, value: boolean) => {
  item.titleHidden = value
  saveLayout()
}

const configDialogVisible = ref(false)
const configItem = ref<{
  id: number
  type: string
  title: string
  titleHidden?: boolean
  config?: Record<string, any>
} | null>(null)

const openConfigDialog = (item: CanvasItem) => {
  if (!isEditing.value) return
  configItem.value = {
    id: item.id,
    type: item.type,
    title: item.title || '',
    titleHidden: Boolean(item.titleHidden),
    config: item.config || {}
  }
  configDialogVisible.value = true
}

const saveItemConfig = (updatedItem: any) => {
  const index = items.value.findIndex(i => i.id === updatedItem.id)
  if (index !== -1) {
    items.value[index] = {
      ...items.value[index],
      title: updatedItem.title,
      titleHidden: Boolean(updatedItem.titleHidden),
      config: updatedItem.config
    }
    saveLayout()
  }
}

const handleDataUpdate = (data: any) => {
  const timestamp = Date.now()
  const values: Record<string, number> = {}
  Object.entries(data).forEach(([key, value]) => {
    if (typeof value === 'number') {
      values[key] = value
    }
  })
  realtimeProvider.addDataPoint(timestamp, values)
}

watch(() => profileManager.activeProfile, () => {
  loadDashboardsFromProfile()
})

watch(() => dashboardStore.activeDashboardId, () => {
  if (ignoreWatch) return
  syncItemsFromActiveDashboard()
  persistDashboardsToProfile()
})

watch(() => dashboardStore.dashboards, () => {
  persistDashboardsToProfile()
}, { deep: true })

onMounted(() => {
  loadDashboardsFromProfile()
  eventCenter.on(EventNames.DATA_UPDATE, handleDataUpdate)
})

onUnmounted(() => {
  eventCenter.off(EventNames.DATA_UPDATE, handleDataUpdate)
})
</script>

<template>
  <div class="canvas-panel">
    <div class="toolbar">
      <div class="toolbar-left">
        <el-button-group v-if="isEditing" class="tool-group">
          <el-button type="primary" size="small" @click="addComponent('row')">添加行</el-button>
          <el-button type="primary" size="small" @click="addComponent('chart')">uPlot图表</el-button>
          <el-button type="primary" size="small" @click="addComponent('echarts-chart')">高级图表</el-button>
          <el-button type="primary" size="small" @click="addComponent('table')">数据表</el-button>
          <el-button type="primary" size="small" @click="addComponent('3d')">3D姿态</el-button>
          <el-button type="primary" size="small" @click="addComponent('pipeline')">流程图</el-button>
          <el-button type="primary" size="small" @click="addComponent('sim')">模拟发射</el-button>
          <el-button type="primary" size="small" @click="addComponent('rocket')">水火箭</el-button>
        </el-button-group>
      </div>
      <div class="toolbar-right">
        <PlaybackControl ref="playbackControlRef" @open-manager="showManager = true" />
        <el-radio-group v-model="canvasMode" size="small">
          <el-radio-button label="view">查看</el-radio-button>
          <el-radio-button label="edit">编辑</el-radio-button>
        </el-radio-group>
        <DashboardManager />
      </div>
    </div>
    <div class="canvas-container" :class="{ 'dark': isDark, 'view-mode': !isEditing }">
      <grid-layout
        v-model:layout="items"
        :col-num="24"
        :row-height="50"
        :is-draggable="isEditing"
        :is-resizable="isEditing"
        :vertical-compact="true"
        :use-css-transforms="true"
        :margin="[10, 10]"
        @layout-updated="onLayoutChange"
      >
        <grid-item
          v-for="item in items"
          :key="item.i"
          :x="item.x"
          :y="item.y"
          :w="item.w"
          :h="item.h"
          :i="item.i"
          class="canvas-item"
          :class="{ 'row-item': item.type === 'row', 'title-hidden': item.titleHidden }"
          :drag-allow-from="'.item-header'"
          :drag-ignore-from="'.item-content, button, a, input, textarea, .el-dropdown, .el-select, .el-switch'"
          :is-draggable="isEditing"
          :is-resizable="isEditing && item.resizable"
          :resizable="isEditing && item.resizable"
          @resize="handleResize"
        >
          <div class="item-header">
            <span class="item-title">{{ item.title }}</span>
            <el-dropdown v-if="isEditing" trigger="click">
              <el-button class="menu-btn" text>
                <el-icon><more /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item @click="openConfigDialog(item)">
                    <el-icon><setting /></el-icon>配置
                  </el-dropdown-item>
                  <el-dropdown-item @click.stop>
                    <div class="dropdown-switch-item" @click.stop>
                      <span>隐藏标题</span>
                      <el-switch
                        :model-value="Boolean(item.titleHidden)"
                        size="small"
                        @click.stop
                        @change="(value: string | number | boolean) => toggleTitleHidden(item, Boolean(value))"
                      />
                    </div>
                  </el-dropdown-item>
                  <el-dropdown-item @click="removeItem(item.id)" divided>
                    <el-icon><delete /></el-icon>删除
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
          <div v-if="item.type !== 'row'" class="item-content">
            <CanvasWidgetWrapper :type="item.type" :config="item.config" />
          </div>
        </grid-item>
      </grid-layout>
    </div>

    <CanvasItemConfigDialog
      v-model:visible="configDialogVisible"
      :item="configItem"
      @save="saveItemConfig"
    />

    <DataSeriesManager
      :visible="showManager"
      @close="showManager = false"
      @playback="handleDataSeriesPlayback"
    />
  </div>
</template>

<style scoped lang="less">
.canvas-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
}

.toolbar {
  padding: 10px 12px;
  border-bottom: 1px solid var(--el-border-color);
  background: var(--el-bg-color-overlay);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar-left {
  flex: 1;
  min-width: 320px;
}

.toolbar-right {
  flex: 0 1 auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.tool-group {
  display: flex;
  gap: 8px;
}

.canvas-container {
  flex: 1;
  position: relative;
  overflow: auto;
  padding: 0;
}

.canvas-item {
  background: var(--el-bg-color-overlay);
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 2px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.canvas-item.title-hidden {
  .item-header {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 2;
    opacity: 0;
    background: var(--el-bg-color-overlay);
  }

  .item-content {
    height: 100%;
  }
}

.canvas-item.title-hidden:hover {
  .item-header {
    opacity: 1;
  }
}

:deep(.vgl-item) {
  transition: 0s ease;
}
:deep(.vgl-item--placeholder) {
  background-color: #444;
  border: 1px solid black;
}

.item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  border-radius: 2px 2px 0 0;
  cursor: move;
  height: 30px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
  transition: background-color .1s ease-in-out, opacity .1s ease-in-out;
}

.row-item .item-header {
  border-bottom: 0;
  border-radius: 2px;
}

.view-mode .item-header {
  cursor: default;
}

.item-header:hover {
  background-color: #f5f5f5;
}

:deep(.dark) {
  .canvas-item {
    background: #181b1f;
    border: 1px solid rgba(204, 204, 220, 0.16);
    box-shadow: none;
  }
  .item-header:hover {
    background-color: rgba(204, 204, 220, 0.06);
  }
}

.item-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  flex: 1;
  text-align: left;
  margin-right: 24px;
  cursor: pointer;
  letter-spacing: .01em;
}

.view-mode .item-title {
  cursor: default;
}

.menu-btn {
  padding: 2px;
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
}

.dropdown-switch-item {
  width: 140px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.item-content {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.time-range-control {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
}
</style>
