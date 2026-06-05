<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CanvasPanel from '../components/canvasPanel/CanvasPanel.vue'
import PlaybackControl from '../components/canvasPanel/PlaybackControl.vue'
import DataSeriesManager from '../components/canvasPanel/DataSeriesManager.vue'
import { useDashboardStore } from '../store/dashboardStore'
import { WorkspaceManagerInst } from '../utils/ProfileManager'

const route = useRoute()
const router = useRouter()
const dashboardStore = useDashboardStore()
const workspaceManager = WorkspaceManagerInst

const showManager = ref(false)
const isRenaming = ref(false)
const newName = ref('')

const startRename = () => {
  if (!currentDashboard.value) return
  if (!currentDashboard.value.editable) return
  newName.value = currentDashboard.value.name
  isRenaming.value = true
}

const confirmRename = () => {
  if (newName.value.trim() && currentDashboard.value) {
    dashboardStore.renameDashboard(currentDashboard.value.id, newName.value.trim())
  }
  isRenaming.value = false
}

const cancelRename = () => {
  isRenaming.value = false
}

const dashboardId = computed(() => {
  const id = route.params.id
  return typeof id === 'string' ? id : ''
})

const dashboardMode = computed(() => {
  return route.query.mode === 'edit' ? 'edit' : 'view'
})

const currentDashboard = computed(() => {
  return dashboardStore.dashboards.find(d => d.id === dashboardId.value)
})

const pageTitle = computed(() => {
  const name = currentDashboard.value?.name || '画布'
  const modeLabel = dashboardMode.value === 'edit' ? '编辑' : '查看'
 
  return `${name} - ${modeLabel} - BUS Studio`
})

const handleBack = () => {
  router.push({ name: 'workbench' })
}

const handleModeChange = (val: string | number | boolean) => {
  const mode = val === 'edit' ? 'edit' : 'view'
  router.replace({ query: { ...route.query, mode } })
}

onMounted(() => {
  document.title = pageTitle.value
  setTimeout(() => {
    window.dispatchEvent(new Event('resize'))
  }, 200)
})

// 在 setup 阶段立即恢复 workspace — 确保子组件 CanvasPanel mount 时 workspace 已正确
const workspaceIdFromUrl = typeof route.query.workspace === 'string' ? route.query.workspace : null
if (workspaceIdFromUrl) {
  const exists = workspaceManager.workspacesRef.value.some(w => w.id === workspaceIdFromUrl)
  if (exists) {
    workspaceManager.setActiveWorkspace(workspaceIdFromUrl)
  }
}
</script>

<template>
  <div class="canvas-page">
    <div class="canvas-page-header">
      <el-button text @click="handleBack">
        <el-icon><arrow-left /></el-icon> 返回
      </el-button>
      <span v-if="!isRenaming" class="canvas-page-title" @dblclick="startRename">{{ currentDashboard?.name || '画布' }}</span>
      <el-input v-else v-model="newName" size="small" class="rename-input" @keyup.enter="confirmRename" @blur="confirmRename" @keyup.escape="cancelRename" />
      <PlaybackControl @open-manager="showManager = true" />
      <el-radio-group v-if="currentDashboard" :model-value="dashboardMode" size="small" @change="handleModeChange">
        <el-radio-button label="view">查看</el-radio-button>
        <el-radio-button label="edit">编辑</el-radio-button>
      </el-radio-group>
    </div>
    <div class="canvas-page-content">
      <CanvasPanel :dashboard-id="dashboardId" :mode="dashboardMode" />
    </div>
    <DataSeriesManager
      :visible="showManager"
      @close="showManager = false"
    />
  </div>
</template>

<style scoped lang="less">
.canvas-page {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
}

.canvas-page-header {
  padding: 8px 12px;
  border-bottom: 1px solid var(--el-border-color);
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--el-bg-color-overlay);
  flex-shrink: 0;
}

.canvas-page-title {
  font-size: 14px;
  font-weight: 600;
  flex: 1;
  cursor: default;
  user-select: none;
}

.rename-input {
  flex: 1;
  max-width: 200px;
}

.canvas-page-content {
  flex: 1;
  overflow: hidden;
  width: 100%;
  position: relative;
}
</style>