<script setup lang="ts">
import { ref, watch, computed, nextTick, onMounted } from 'vue'
import CanvasWidgetWrapper from './CanvasWidgetWrapper.vue'
import CanvasItemConfigSidebar from './CanvasItemConfigSidebar.vue'
import { useDark } from '@vueuse/core'
import { GridLayout, GridItem } from 'grid-layout-plus'
import { useDashboardStore, normalizeDashboards, saveItemToConfig, COMPONENT_CONFIGS, type Dashboard, type CanvasItem } from '@/store/dashboardStore'
import { ProfileManagerInst } from '@/utils/ProfileManager'
import type { CanvasConfig } from '../types'

interface Props {
  mode?: 'view' | 'edit'
  dashboardId?: string
  embedded?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'view',
  dashboardId: '',
  embedded: false
})

const profileManager = ProfileManagerInst
const dashboardStore = useDashboardStore()
const isDark = useDark()

const effectiveMode = computed(() => {
  if (props.mode === 'edit') {
    const targetId = props.dashboardId || dashboardStore.activeDashboardId
    const dashboard = dashboardStore.dashboards.find(d => d.id === targetId)
    return dashboard?.editable ? 'edit' : 'view'
  }
  return 'view'
})

const isEditing = computed(() => effectiveMode.value === 'edit')

const currentDashboardId = computed(() => props.dashboardId || dashboardStore.activeDashboardId)

const currentDashboard = computed(() => {
  return dashboardStore.dashboards.find(d => d.id === currentDashboardId.value)
})

const isEmbedded = computed(() => props.embedded)

const canvasConfig = computed(() => {
  const profile = profileManager.activeProfile
  return profile?.config?.canvas as CanvasConfig & {
    dashboards?: any[]
    activeDashboardId?: string
  } | undefined
})

const items = ref<CanvasItem[]>([])
let ignoreWatch = false

const cloneItems = (sourceItems: CanvasItem[]) => {
  return sourceItems.map(item => ({
    ...item,
    config: { ...(item.config || {}) }
  }))
}

const persistDashboardsToProfile = () => {
  if (ignoreWatch) return
  const profile = profileManager.activeProfile
  if (!profile) return

  const dashboards = dashboardStore.dashboards.map((dashboard: Dashboard) => ({
    id: dashboard.id,
    name: dashboard.name,
    items: dashboard.items.map(saveItemToConfig),
    showInTab: dashboard.showInTab,
    deletable: dashboard.deletable,
    editable: dashboard.editable
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

const syncItemsFromCurrentDashboard = () => {
  items.value = cloneItems(currentDashboard.value?.items || [])
  nextTick(handleResize)
}

const loadDashboardsFromProfile = () => {
  ignoreWatch = true
  const dashboards = normalizeDashboards(canvasConfig.value)
  dashboardStore.setDashboards(dashboards, canvasConfig.value?.activeDashboardId)
  dashboardStore.initFixedDashboards()
  syncItemsFromCurrentDashboard()
  nextTick(() => { ignoreWatch = false })
}

const saveLayout = () => {
  dashboardStore.updateDashboardItems(currentDashboardId.value, cloneItems(items.value))
  persistDashboardsToProfile()
}

const addComponent = (type: string) => {
  if (!isEditing.value) return
  const id = Date.now()
  const config = COMPONENT_CONFIGS[type]
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

const duplicateItem = (id: number) => {
  if (!isEditing.value) return
  const source = items.value.find(item => item.id === id)
  if (!source) return
  const newId = Date.now()
  const newItem: CanvasItem = {
    ...source,
    id: newId,
    i: newId.toString(),
    x: source.x + 1,
    y: source.y + 1,
    title: `${source.title}(副本)`,
    config: { ...(source.config || {}) }
  }
  items.value.push(newItem)
  saveLayout()
}

const editingTitleId = ref<number | null>(null)
const editingTitleValue = ref('')

const startEditTitle = (item: CanvasItem) => {
  if (!isEditing.value) return
  editingTitleId.value = item.id
  editingTitleValue.value = item.title || ''
  nextTick(() => {
    const input = document.querySelector<HTMLInputElement>(`.title-input-${item.id}`)
    input?.focus()
    input?.select()
  })
}

const finishEditTitle = () => {
  if (editingTitleId.value === null) return
  const item = items.value.find(i => i.id === editingTitleId.value)
  if (item && editingTitleValue.value.trim()) {
    item.title = editingTitleValue.value.trim()
    saveLayout()
  }
  editingTitleId.value = null
}

const handleResize = () => {
  window.dispatchEvent(new CustomEvent('resize'))
}

const toggleTitleHidden = (item: CanvasItem, value: boolean) => {
  item.titleHidden = value
  saveLayout()
}

const selectedItemId = ref<number | null>(null)

const selectedItem = computed(() => {
  if (!selectedItemId.value) return null
  const item = items.value.find(i => i.id === selectedItemId.value)
  if (!item) return null
  return {
    id: item.id,
    type: item.type,
    title: item.title || '',
    titleHidden: Boolean(item.titleHidden),
    config: item.config || {}
  }
})

const selectItem = (id: number) => {
  if (!isEditing.value) return
  selectedItemId.value = id
}

const handleSidebarUpdate = (updatedItem: any) => {
  const item = items.value.find(i => i.id === updatedItem.id)
  if (item) {
    item.title = updatedItem.title
    item.titleHidden = Boolean(updatedItem.titleHidden)
    // 逐个更新 config 属性，保持原对象引用，触发 Vue 深层响应式
    const newConfig = updatedItem.config || {}
    if (!item.config) item.config = {}
    for (const key of Object.keys(newConfig)) {
      item.config[key] = newConfig[key]
    }
    saveLayout()
  }
}

const handleSidebarDelete = (id: number) => {
  removeItem(id)
  selectedItemId.value = null
}

watch(() => currentDashboardId.value, () => {
  syncItemsFromCurrentDashboard()
}, { immediate: true })

watch(() => profileManager.activeProfile, () => {
  // 独立模式下（CanvasPage），只加载一次，不再随全局 workspace 切换重载
  // 避免其他 tab/workspace 切换导致当前画布数据丢失
  if (isEmbedded.value) return
  if (currentDashboardId.value && !isEmbedded.value) return
  loadDashboardsFromProfile()
})

watch(() => dashboardStore.activeDashboardId, () => {
  if (ignoreWatch) return
  if (!props.dashboardId) {
    syncItemsFromCurrentDashboard()
    persistDashboardsToProfile()
  }
})

watch(() => dashboardStore.dashboards, () => {
  if (isEmbedded.value) return
  persistDashboardsToProfile()
}, { deep: true })

watch(() => currentDashboard.value?.items, () => {
  if (isEmbedded.value) {
    syncItemsFromCurrentDashboard()
  }
}, { deep: true })

onMounted(() => {
  if (!isEmbedded.value) {
    loadDashboardsFromProfile()
  }
})

</script>

<template>
  <div class="canvas-panel">
    <div class="toolbar" v-if="effectiveMode === 'edit'">
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
    </div>
    <div class="canvas-body">
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
            :class="{ 'row-item': item.type === 'row', 'title-hidden': item.titleHidden, 'selected': selectedItemId === item.id }"
            :drag-allow-from="'.item-header'"
            :drag-ignore-from="'.item-content, button, a, input, textarea, .el-dropdown, .el-select, .el-switch, .title-edit-input'"
            :is-draggable="isEditing"
            :is-resizable="isEditing && item.resizable"
            :resizable="isEditing && item.resizable"
            @resize="handleResize"
          >
            <div class="item-header" @click="selectItem(item.id)">
              <span
                v-if="editingTitleId !== item.id"
                class="item-title"
                @dblclick="startEditTitle(item)"
              >{{ item.title }}</span>
              <input
                v-else
                :class="`title-input-${item.id}`"
                class="title-edit-input"
                v-model="editingTitleValue"
                @keyup.enter="finishEditTitle"
                @blur="finishEditTitle"
              />
              <el-dropdown v-if="isEditing" trigger="click">
                <el-button class="menu-btn" text>
                  <el-icon><more /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
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
                    <el-dropdown-item @click="duplicateItem(item.id)">
                      <el-icon><document-copy /></el-icon>复制
                    </el-dropdown-item>
                    <el-dropdown-item @click="removeItem(item.id)" divided>
                      <el-icon><delete /></el-icon>删除
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
            <div v-if="item.type !== 'row'" class="item-content" @click="selectItem(item.id)">
              <CanvasWidgetWrapper :type="item.type" :config="item.config" :readonly="effectiveMode === 'edit'" />
            </div>
          </grid-item>
        </grid-layout>
      </div>

      <CanvasItemConfigSidebar
        v-if="isEditing && selectedItemId !== null"
        :item="selectedItem"
        @update:item="handleSidebarUpdate"
        @delete="handleSidebarDelete"
        @close="selectedItemId = null"
      />
    </div>
  </div>
</template>

<style scoped lang="less">
.canvas-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
}

.canvas-body {
  flex: 1;
  display: flex;
  overflow: hidden;
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

.toolbar-mini {
  padding: 6px 12px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  background: var(--el-bg-color-overlay);
  border-bottom: 1px solid var(--el-border-color);
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

.canvas-item.selected {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 1px var(--el-color-primary);
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

.title-edit-input {
  font-size: 12px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  flex: 1;
  border: 1px solid var(--el-color-primary);
  border-radius: 2px;
  padding: 0 4px;
  height: 20px;
  line-height: 20px;
  background: var(--el-bg-color);
  outline: none;
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