<script setup lang="ts">
import { computed, ref, onMounted, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import SerialLog from '../components/SerialLog.vue'
import DataTable from '../components/DataTable.vue'
import SerialQuickSend from '../components/SerialQuickSend.vue'
import SerialScripts from '../components/SerialScript.vue'
import CanvasPanel from '../components/canvasPanel/CanvasPanel.vue'
import CanvasListPage from '../components/canvasPanel/CanvasListPage.vue'
import AppShell from '../layouts/AppShell.vue'
import { useWorkspaceConfig } from '../utils/useWorkspaceConfig'
import { WorkspaceManagerInst, ProfileManagerInst } from '../utils/ProfileManager'
import { useDataStore } from '../store/fieldStore'
import { useDashboardStore, normalizeDashboards, saveItemToConfig, type Dashboard } from '../store/dashboardStore'
import type { LayoutConfig, CanvasConfig } from '../components/types'
// @ts-ignore
import { Splitpanes, Pane } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'

const route = useRoute()
const workspaceManager = WorkspaceManagerInst
const dataStore = useDataStore()
const dashboardStore = useDashboardStore()

dashboardStore.initFixedDashboards()

const visibleDashboards = computed(() => dashboardStore.visibleDashboards)

const defaultLayoutConfig: LayoutConfig = {
  splitPaneSize: 100,
  leftActiveTab: 'console',
  rightActiveTab: '0'
}

const { config: localLayoutConfig } = useWorkspaceConfig<LayoutConfig>('layout', defaultLayoutConfig)
const splitpanesKey = ref(0)
const activeWorkspace = computed(() => workspaceManager.activeWorkspaceRef.value)
const activeWorkspaceName = computed(() => activeWorkspace.value?.name)
const leftPaneSize = computed(() => {
  const size = Number(localLayoutConfig.value.splitPaneSize)
  return Math.min(Math.max(Number.isFinite(size) ? size : defaultLayoutConfig.splitPaneSize, 0), 100)
})
const rightPaneSize = computed(() => 100 - leftPaneSize.value)

watch(activeWorkspaceName, (name) => {
  document.title = name ? `${name} - BUS Studio` : 'BUS Studio'
}, { immediate: true })

const profileManager = ProfileManagerInst

let ignoreWatch = false

const canvasConfig = computed(() => {
  const profile = profileManager.activeProfile
  return profile?.config?.canvas as CanvasConfig & {
    dashboards?: any[]
    activeDashboardId?: string
  } | undefined
})

const loadDashboardsFromProfile = () => {
  ignoreWatch = true
  const dashboards = normalizeDashboards(canvasConfig.value)
  dashboardStore.setDashboards(dashboards, canvasConfig.value?.activeDashboardId)
  dashboardStore.initFixedDashboards()
  nextTick(() => { ignoreWatch = false })
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

watch(() => dashboardStore.dashboards, () => {
  if (ignoreWatch) return
  persistDashboardsToProfile()
}, { deep: true })

watch(() => profileManager.activeProfile, () => {
  loadDashboardsFromProfile()
})

watch(activeWorkspace, () => {
  dataStore.loadFromProfile()
}, { immediate: true })

onMounted(() => {
  const workspaceId = typeof route.query.workspace === 'string' ? route.query.workspace : null
  if (workspaceId) {
    const exists = workspaceManager.workspacesRef.value.some(w => w.id === workspaceId)
    if (exists) {
      workspaceManager.setActiveWorkspace(workspaceId)
    }
  }
  setTimeout(() => {
    splitpanesKey.value++
  }, 100)
})

const handleSplitResize = (options: { size: number}[]) => {
  localLayoutConfig.value.splitPaneSize = options[0].size
}

const handleTabChange = () => {
  handleResize()
}

let resizeTimer: ReturnType<typeof setTimeout>
const handleResize = () => {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => {
    window.dispatchEvent(new CustomEvent('resize', { }))
  }, 100)
}
handleResize()
</script>

<template>
  <AppShell>
    <Splitpanes class="workbench-splitpanes default-theme" :key="splitpanesKey" @resize="handleSplitResize">
      <Pane :size="leftPaneSize" class="w75">
        <el-tabs type="card" class="lv-card lv-tabs" addable v-model="localLayoutConfig.leftActiveTab" @tab-click="handleTabChange">
          <el-tab-pane label="控制台" name="console">
            <SerialLog />
          </el-tab-pane>
          <el-tab-pane label="数据表" name="datatable" lazy>
            <DataTable />
          </el-tab-pane>

          <el-tab-pane
            v-for="db in visibleDashboards"
            :key="db.id"
            :label="db.name"
            :name="`canvas-${db.id}`"
            lazy
          >
            <CanvasPanel :dashboard-id="db.id" mode="view" :embedded="true" />
          </el-tab-pane>

          <el-tab-pane label="画布管理" name="canvas-list" lazy>
            <CanvasListPage />
          </el-tab-pane>
        </el-tabs>
      </Pane>
      <Pane :size="rightPaneSize" class="w25">
        <el-tabs type="card" class="lv-card lv-tabs" v-model="localLayoutConfig.rightActiveTab">
          <el-tab-pane label="快捷发送">
            <SerialQuickSend />
          </el-tab-pane>
          <el-tab-pane label="脚本">
            <SerialScripts />
          </el-tab-pane>
          <el-tab-pane label="设置">
          </el-tab-pane>
        </el-tabs>
      </Pane>
    </Splitpanes>
  </AppShell>
</template>

<style scoped>
.lv-card {
  height: 100%;
}

.lv-card :deep(.el-tab-pane) {
  height: 100%;
}

.workbench-splitpanes {
  background-color: var(--el-bg-color);
}

.workbench-splitpanes:deep(.splitpanes__splitter) {
  background-color: var(--el-border-color) !important;
  border: none;
}

.workbench-splitpanes:deep(.splitpanes__pane) {
  background-color: var(--el-bg-color) !important;
}
.splitpanes--vertical .splitpanes__pane {
  transition: none;
}
</style>
