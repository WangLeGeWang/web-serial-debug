<template>
  <div class="pipeline-panel">
    <div class="toolbar" v-if="!readonly">
      <el-button-group size="small">
        <el-button @click="onAddNode('tank')">罐</el-button>
        <el-button @click="onAddNode('valve')">阀</el-button>
        <el-button @click="onAddNode('sensor')">传感器</el-button>
        <el-button @click="onAddNode('engine')">发动机</el-button>
      </el-button-group>
      <el-button-group size="small" style="margin-left: 12px">
        <el-button type="primary" @click="showNodeConfig()">添加组件</el-button>
      </el-button-group>
      <el-button-group size="small" style="margin-left: 12px">
        <el-button @click="onCopy" :disabled="!selectedNode">复制</el-button>
        <el-button @click="onPaste" :disabled="!copiedNode">粘贴</el-button>
        <el-button @click="onUndo" :disabled="!canUndo">撤销</el-button>
        <el-button @click="onRedo" :disabled="!canRedo">重做</el-button>
      </el-button-group>
      <el-button-group size="small" style="margin-left: 12px">
        <el-button @click="onEditEdge" :disabled="!selectedEdge">编辑连接线</el-button>
      </el-button-group>
    </div>

    <NodeConfigDialog
      v-model="nodeConfigVisible"
      :edit-data="editingNode"
      :initial-type="initialNodeType"
      @confirm="onNodeConfigConfirm"
    />

    <el-dialog v-model="edgeDialogVisible" title="编辑连接线样式" width="400px">
      <el-form :model="edgeForm">
        <el-form-item label="线型">
          <el-select v-model="edgeForm.style">
            <el-option v-for="style in edgeStyles" :key="style.value" :label="style.label" :value="style.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="颜色">
          <el-color-picker v-model="edgeForm.color" />
        </el-form-item>
        <el-form-item label="粗细">
          <el-input-number v-model="edgeForm.width" :min="1" :max="10" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="edgeDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="updateEdgeStyle">确定</el-button>
      </template>
    </el-dialog>

    <VueFlow
      v-model="elements"
      :default-viewport="{ zoom: 1 }"
      :min-zoom="0.2"
      :max-zoom="4"
      class="pipeline-canvas"
      @nodeClick="onNodeClick"
      @nodeDoubleClick="onNodeDoubleClick"
      @paneClick="onPaneClick"
      @edgeClick="onEdgeClick"
    >
      <template #node-tank="nodeProps">
        <TankNode v-bind="nodeProps" :latest-data="latestData" @update="value => updateComponentValue(nodeProps.id, value)" />
      </template>
      <template #node-valve="nodeProps">
        <ValveNode v-bind="nodeProps" :latest-data="latestData" @update="value => updateComponentValue(nodeProps.id, value)" />
      </template>
      <template #node-sensor="nodeProps">
        <SensorNode v-bind="nodeProps" :latest-data="latestData" @update="value => updateComponentValue(nodeProps.id, value)" />
      </template>
      <template #node-engine="nodeProps">
        <EngineNode v-bind="nodeProps" :latest-data="latestData" @update="value => updateComponentValue(nodeProps.id, value)" />
      </template>
      <Background pattern-color="#aaa" :gap="20" />
      <Controls v-if="!readonly" />
      <MiniMap v-if="!readonly" />
    </VueFlow>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { ElButton, ElButtonGroup, ElColorPicker, ElDialog, ElForm, ElFormItem, ElInputNumber, ElOption, ElSelect } from 'element-plus'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import { useDataSourceFromPlaybackStore } from '@/runtime/source/useDataSourceFromPlaybackStore'
import NodeConfigDialog from './pipeline/NodeConfigDialog.vue'
import TankNode from './pipeline/nodes/TankNode.vue'
import ValveNode from './pipeline/nodes/ValveNode.vue'
import SensorNode from './pipeline/nodes/SensorNode.vue'
import EngineNode from './pipeline/nodes/EngineNode.vue'
import { createDefaultDemo, demoRealtimeData, getDefaultNodeData } from './pipeline/defaults'
import type { PipelineNodeType } from './pipeline/types'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/node-resizer/dist/style.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'

interface Props {
  readonly?: boolean
}

withDefaults(defineProps<Props>(), {
  readonly: false
})

const vueFlow = useVueFlow() as ReturnType<typeof useVueFlow> & { elements: any }
const {
  nodes,
  edges,
  addNodes,
  setNodes,
  addEdges,
  setEdges,
  project,
  elements
} = vueFlow

const nodeConfigVisible = ref(false)
const editingNode = ref<any>(null)
const initialNodeType = ref<PipelineNodeType>('tank')
const selectedNode = ref<any>(null)
const copiedNode = ref<any>(null)
const selectedEdge = ref<any>(null)
const edgeDialogVisible = ref(false)
const canUndo = ref(false)
const canRedo = ref(false)
const latestData = ref<Record<string, unknown>>({ ...demoRealtimeData })
const hasExternalConfig = ref(false)

const history = reactive<{ past: Array<{ nodes: any[]; edges: any[] }>; future: Array<{ nodes: any[]; edges: any[] }> }>({
  past: [],
  future: []
})

const edgeForm = reactive({
  style: 'default',
  color: '#333',
  width: 4
})

const edgeStyles = [
  { label: '实线', value: 'default' },
  { label: '虚线', value: 'dashed' },
  { label: '点线', value: 'dotted' }
]

function snapshot() {
  return {
    nodes: JSON.parse(JSON.stringify(nodes.value)),
    edges: JSON.parse(JSON.stringify(edges.value))
  }
}

function saveState() {
  history.past.push(snapshot())
  history.future = []
  updateUndoRedoState()
}

function updateUndoRedoState() {
  canUndo.value = history.past.length > 0
  canRedo.value = history.future.length > 0
}

function onAddNode(type: PipelineNodeType) {
  saveState()
  const position = project({ x: 120 + Math.random() * 120, y: 120 + Math.random() * 120 })
  addNodes([{
    id: `${type}-${Date.now()}`,
    type,
    position,
    data: getDefaultNodeData(type)
  }])
}

function showNodeConfig(type: PipelineNodeType = 'tank') {
  editingNode.value = null
  initialNodeType.value = type
  nodeConfigVisible.value = true
}

function onNodeConfigConfirm(config: any) {
  saveState()
  if (config.id) {
    const node = nodes.value.find((item: any) => item.id === config.id)
    if (node) {
      node.type = config.type
      node.data = config.data
    }
    editingNode.value = null
    return
  }

  const position = project({ x: 120 + Math.random() * 180, y: 120 + Math.random() * 180 })
  addNodes([{
    id: `${config.type}-${Date.now()}`,
    type: config.type,
    position,
    data: config.data
  }])
}

function updateComponentValue(nodeId: string, value: string) {
  const node = nodes.value.find((item: any) => item.id === nodeId)
  const key = node?.data?.displayFields?.find((field: any) => field.type === 'mapping' || field.key)?.key
  if (key) {
    latestData.value = { ...latestData.value, [key]: value }
  }
}

function onNodeClick({ node }: any) {
  selectedNode.value = node
}

function onNodeDoubleClick({ node }: any) {
  editingNode.value = JSON.parse(JSON.stringify(node))
  initialNodeType.value = node.type
  nodeConfigVisible.value = true
}

function onPaneClick() {
  selectedNode.value = null
  selectedEdge.value = null
}

function onEdgeClick({ edge }: any) {
  selectedEdge.value = edge
}

function onEditEdge() {
  if (!selectedEdge.value) return
  const edge = selectedEdge.value
  edgeForm.style = edge.style?.strokeDasharray === '5 5' ? 'dashed' : edge.style?.strokeDasharray === '2 2' ? 'dotted' : 'default'
  edgeForm.color = edge.style?.stroke || '#333'
  edgeForm.width = edge.style?.strokeWidth || 4
  edgeDialogVisible.value = true
}

function updateEdgeStyle() {
  if (!selectedEdge.value) return
  saveState()
  selectedEdge.value.style = {
    ...(selectedEdge.value.style || {}),
    stroke: edgeForm.color,
    strokeWidth: edgeForm.width,
    strokeDasharray: edgeForm.style === 'dashed' ? '5 5' : edgeForm.style === 'dotted' ? '2 2' : undefined
  }
  edgeDialogVisible.value = false
}

function onCopy() {
  if (!selectedNode.value) return
  copiedNode.value = JSON.parse(JSON.stringify(selectedNode.value))
}

function onPaste() {
  if (!copiedNode.value) return
  saveState()
  addNodes([{
    ...copiedNode.value,
    id: `${copiedNode.value.type}-${Date.now()}`,
    position: {
      x: copiedNode.value.position.x + 50,
      y: copiedNode.value.position.y + 50
    }
  }])
}

function onUndo() {
  if (!history.past.length) return
  history.future.unshift(snapshot())
  const previous = history.past.pop()
  if (previous) {
    setNodes(previous.nodes)
    setEdges(previous.edges)
  }
  updateUndoRedoState()
}

function onRedo() {
  if (!history.future.length) return
  history.past.push(snapshot())
  const next = history.future.shift()
  if (next) {
    setNodes(next.nodes)
    setEdges(next.edges)
  }
  updateUndoRedoState()
}

function getConfig() {
  return snapshot()
}

function setConfig(config: Record<string, any>) {
  hasExternalConfig.value = true
  setNodes(config.nodes || [])
  setEdges(config.edges || [])
  history.past = []
  history.future = []
  updateUndoRedoState()
}

const ds = useDataSourceFromPlaybackStore()

watch(() => ds.visibleData[ds.visibleData.length - 1], (latest) => {
  if (latest) {
    latestData.value = { ...latestData.value, ...latest.values }
  }
})

function handleKeydown(e: KeyboardEvent) {
  if (!(e.metaKey || e.ctrlKey)) return
  if (e.key === 'c' && selectedNode.value) onCopy()
  if (e.key === 'v' && copiedNode.value) onPaste()
  if (e.key === 'z' && !e.shiftKey && canUndo.value) onUndo()
  if (e.key === 'z' && e.shiftKey && canRedo.value) onRedo()
}

onMounted(() => {
  if (!hasExternalConfig.value && nodes.value.length === 0) {
    const demo = createDefaultDemo()
    setNodes(demo.nodes)
    addEdges(demo.edges)
  }
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

defineExpose({
  getConfig,
  setConfig
})
</script>

<style scoped>
.pipeline-panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.toolbar {
  padding: 10px;
  border-bottom: 1px solid var(--el-border-color);
  background: var(--el-bg-color-overlay);
}

.pipeline-canvas {
  flex: 1;
  background-color: var(--el-bg-color);
}

:deep(.vue-flow__minimap) {
  background-color: var(--el-bg-color);
}

:deep(.vue-flow__minimap-mask) {
  fill: var(--el-fill-color-light);
}

:deep(.vue-flow__minimap-node) {
  fill: var(--el-color-primary-light-9);
  stroke: var(--el-color-primary);
}
</style>
