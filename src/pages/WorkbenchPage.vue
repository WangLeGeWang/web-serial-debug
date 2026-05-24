<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import SerialLog from '../components/SerialLog.vue'
import PipelinePanel from '../widgets/PipelinePanel/PipelinePanel.vue'
import ChartIMU from '../widgets/ChartIMU/ChartIMU.vue'
import ChartRocket from '../widgets/ChartRocket/ChartRocket.vue'
import Sim from '../widgets/Sim/Sim.vue'
import ChartPanel from '../widgets/ChartPanel/ChartPanel.vue'
import DataTable from '../components/DataTable.vue'
import SerialQuickSend from '../components/SerialQuickSend.vue'
import SerialScripts from '../components/SerialScript.vue'
import CanvasPanel from '../components/canvasPanel/CanvasPanel.vue'
import AppShell from '../layouts/AppShell.vue'
import { useWorkspaceConfig } from '../utils/useWorkspaceConfig'
import { WorkspaceManagerInst } from '../utils/ProfileManager'
import { useDataStore } from '../store/fieldStore'
import type { LayoutConfig } from '../components/types'
// @ts-ignore
import { Splitpanes, Pane } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'

const route = useRoute()
const workspaceManager = WorkspaceManagerInst
const dataStore = useDataStore()

const defaultLayoutConfig: LayoutConfig = {
  splitPaneSize: 100,
  leftActiveTab: '0',
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
          <el-tab-pane label="控制台">
            <SerialLog />
          </el-tab-pane>
          <el-tab-pane label="数据表" lazy>
            <DataTable />
          </el-tab-pane>
          <el-tab-pane label="姿态" lazy>
            <ChartIMU />
          </el-tab-pane>
          <el-tab-pane label="可视化" lazy>
            <ChartPanel />
          </el-tab-pane>
          <el-tab-pane label="流程图">
            <PipelinePanel />
          </el-tab-pane>
          <el-tab-pane label="模拟发射" lazy>
            <Sim />
          </el-tab-pane>
          <el-tab-pane label="水火箭" lazy>
            <ChartRocket />
          </el-tab-pane>
          <el-tab-pane label="画板" lazy>
            <CanvasPanel />
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
