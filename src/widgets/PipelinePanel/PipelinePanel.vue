<template>
  <div class="pipeline-panel">
    <div class="toolbar" v-if="!readonly">
      <el-button-group size="small">
        <el-button @click="onAddNode('fuel')">燃料罐</el-button>
        <el-button @click="onAddNode('oxidizer')">氧化剂罐</el-button>
        <el-button @click="onAddNode('pressurant')">增压气罐</el-button>
        <el-button @click="onAddNode('engine')">推进器</el-button>
      </el-button-group>
      <el-button-group size="small" style="margin-left: 12px">
        <el-button @click="onAddNode('valve')">阀门</el-button>
        <el-button @click="onAddNode('check_valve')">单向阀</el-button>
        <el-button @click="onAddNode('regulator')">调压阀</el-button>
      </el-button-group>
      <el-button-group size="small" style="margin-left: 12px">
        <el-button @click="onAddNode('pressure')">压力传感器</el-button>
        <el-button @click="onAddNode('temperature')">温度传感器</el-button>
        <el-button @click="onAddNode('flow')">流量传感器</el-button>
      </el-button-group>
      <el-button-group size="small" style="margin-left: 12px">
        <el-button type="primary" @click="showNodeConfig">添加组件</el-button>
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

    <NodeConfigDialog v-model="nodeConfigVisible" :edit-data="editingNode" @confirm="onNodeConfigConfirm" />

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
      <template #node-fuel="nodeProps">
        <FuelTank v-bind="nodeProps" @update="updateComponentValue" />
      </template>

      <template #node-oxidizer="nodeProps">
        <OxidizerTank v-bind="nodeProps" @update="updateComponentValue" />
      </template>

      <template #node-pressurant="nodeProps">
        <PressurantTank v-bind="nodeProps" @update="updateComponentValue" />
      </template>

      <template #node-engine="nodeProps">
        <Engine v-bind="nodeProps" @update="updateComponentValue" />
      </template>

      <template #node-valve="nodeProps">
        <Valve v-bind="nodeProps" @update="updateComponentValue" />
      </template>

      <template #node-check_valve="nodeProps">
        <CheckValve v-bind="nodeProps" />
      </template>

      <template #node-regulator="nodeProps">
        <Regulator v-bind="nodeProps" @update="updateComponentValue" />
      </template>

      <template #node-pressure="nodeProps">
        <div class="custom-node sensor pressure" :class="{ selected: nodeProps.selected }">
          <NodeResizer :min-width="60" :min-height="60" />
          <div class="label">{{ nodeProps.data.label || '压力传感器' }}</div>
          <div class="value">{{ nodeProps.data.value || 'N/A' }} MPa</div>
        </div>
      </template>

      <template #node-temperature="nodeProps">
        <div class="custom-node sensor temperature" :class="{ selected: nodeProps.selected }">
          <NodeResizer :min-width="60" :min-height="60" />
          <div class="label">{{ nodeProps.data.label || '温度传感器' }}</div>
          <div class="value">{{ nodeProps.data.value || 'N/A' }} ℃</div>
        </div>
      </template>

      <template #node-flow="nodeProps">
        <div class="custom-node sensor flow" :class="{ selected: nodeProps.selected }">
          <NodeResizer :min-width="60" :min-height="60" />
          <div class="label">{{ nodeProps.data.label || '流量传感器' }}</div>
          <div class="value">{{ nodeProps.data.value || 'N/A' }} kg/s</div>
        </div>
      </template>
      <template #node-custom="nodeProps">
        <CustomNode v-bind="nodeProps" @update="updateComponentValue" />
      </template>
      <Background pattern-color="#aaa" :gap="20" />
      <Controls v-if="!readonly" />
      <MiniMap v-if="!readonly" />
    </VueFlow>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { ElButton, ElButtonGroup, ElDialog, ElForm, ElFormItem, ElSelect, ElOption, ElColorPicker, ElInputNumber } from 'element-plus'
import { VueFlow, useVueFlow, type GraphNode } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import { NodeResizer } from '@vue-flow/node-resizer'
import { EventCenter, EventNames } from '../../utils/EventCenter'
// import { NodeToolbar } from '@vue-flow/node-toolbar'
import NodeConfigDialog from './pipeline/NodeConfigDialog.vue'
import CustomNode from './pipeline/nodes/CustomNode.vue'

import FuelTank from './pipeline/nodes/FuelTank.vue'
import OxidizerTank from './pipeline/nodes/OxidizerTank.vue'
import PressurantTank from './pipeline/nodes/PressurantTank.vue'
import Engine from './pipeline/nodes/Engine.vue'
import Valve from './pipeline/nodes/Valve.vue'
import CheckValve from './pipeline/nodes/CheckValve.vue'
import Regulator from './pipeline/nodes/Regulator.vue'

import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/node-resizer/dist/style.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'

interface Props {
  readonly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false
})

const {
  nodes,
  edges,
  addNodes,
  setNodes,
  addEdges,
  setEdges,
  project,
  // @ts-ignore
  elements,
} = useVueFlow()

// 组件配置对话框
const nodeConfigVisible = ref(false)
const editingNode = ref(null)

// 连接线编辑相关状态
const selectedEdge = ref(null as GraphNode | null)
const edgeDialogVisible = ref(false)
const edgeForm = reactive({
  style: 'default',
  color: '#333',
  width: 10
})

const edgeStyles = [
  { label: '实线', value: 'default' },
  { label: '虚线', value: 'dashed' },
  { label: '点线', value: 'dotted' }
]

// 编辑连接线
function onEditEdge() {
  if (!selectedEdge.value) return
  const edge = selectedEdge.value
  // @ts-ignore
  edgeForm.style = edge.style?.type || 'default'
  // @ts-ignore
  edgeForm.color = edge.style?.stroke || '#333'
  // @ts-ignore
  edgeForm.width = edge.style?.strokeWidth || 2
  edgeDialogVisible.value = true
}

// 更新连接线样式
function updateEdgeStyle() {
  if (!selectedEdge.value) return
  const edge = selectedEdge.value
  const style = {
    stroke: edgeForm.color,
    strokeWidth: edgeForm.width,
    strokeDasharray: edgeForm.style === 'dashed' ? '5 5' : edgeForm.style === 'dotted' ? '2 2' : undefined
  }
  // @ts-ignore
  Object.assign(edge.style, style)
  // updateEdge(edge.id, { ...edge, style })
  edgeDialogVisible.value = false
  saveState()
}

// 连接线点击事件
function onEdgeClick({ edge }: any) {
  selectedEdge.value = edge
}

// 状态管理
const selectedNode = ref(null)
const copiedNode = ref(null)
const canUndo = ref(false)
const canRedo = ref(false)
const history = reactive({
  past: [],
  future: [],
})

// 默认演示模板
const defaultDemo = [
  {
    id: 'pressurant-1',
    type: 'pressurant',
    position: { x: 100, y: 40 },
    data: { label: '氦气瓶', pressure: '30.0', temperature: '25.0', dataKey: 'he_pressure' }
  },
  {
    id: 'pressure-1',
    type: 'pressure',
    position: { x: 100, y: 150 },
    data: { label: 'P1 - 氦气出口', value: '30.0', unit: 'MPa', dataKey: 'he_pressure' }
  },
  {
    id: 'regulator-1',
    type: 'regulator',
    position: { x: 100, y: 260 },
    data: { label: '主调压阀', setpoint: '2.0', dataKey: 'regulator_setpoint' }
  },
  {
    id: 'pressure-2',
    type: 'pressure',
    position: { x: 100, y: 350 },
    data: { label: 'P2 - 调压后压力', value: '2.0', unit: 'MPa', dataKey: 'main_pressure' }
  },
  {
    id: 'oxidizer-1',
    type: 'oxidizer',
    position: { x: 300, y: 100 },
    data: { label: '液氧罐', pressure: '1.8', temperature: '-183.0', level: '95', dataKey: 'lox_tank' }
  },
  {
    id: 'temperature-1',
    type: 'temperature',
    position: { x: 300, y: 230 },
    data: { label: 'T1 - 液氧温度', value: '-183.0', unit: '℃', dataKey: 'lox_temperature' }
  },
  {
    id: 'check_valve-1',
    type: 'check_valve',
    position: { x: 300, y: 360 },
    data: { label: '单向阀1' }
  },
  {
    id: 'valve-1',
    type: 'valve',
    position: { x: 300, y: 420 },
    data: { label: '氧化剂阀', dataKey: 'lox_valve_state' }
  },
  {
    id: 'flow-1',
    type: 'flow',
    position: { x: 300, y: 520 },
    data: { label: 'F1 - 氧化剂流量', value: '0.0', unit: 'kg/s', dataKey: 'lox_flow' }
  },
  {
    id: 'fuel-1',
    type: 'fuel',
    position: { x: 500, y: 100 },
    data: { label: '煤油罐', pressure: '1.8', temperature: '15.0', level: '95', dataKey: 'rp1_tank' }
  },
  {
    id: 'temperature-2',
    type: 'temperature',
    position: { x: 500, y: 230 },
    data: { label: 'T2 - 煤油温度', value: '15.0', unit: '℃', dataKey: 'rp1_temperature' }
  },
  {
    id: 'check_valve-2',
    type: 'check_valve',
    position: { x: 500, y: 360 },
    data: { label: '单向阀2' }
  },
  {
    id: 'valve-2',
    type: 'valve',
    position: { x: 500, y: 420 },
    data: { label: '燃料阀', dataKey: 'rp1_valve_state' }
  },
  {
    id: 'flow-2',
    type: 'flow',
    position: { x: 500, y: 520 },
    data: { label: 'F2 - 燃料流量', value: '0.0', unit: 'kg/s', dataKey: 'rp1_flow' }
  },
  {
    id: 'engine-1',
    type: 'engine',
    position: { x: 325, y: 660 },
    data: { label: '主发动机', thrust: '0.0', chamber_pressure: '0.0', mixture_ratio: '2.5', dataKey: 'engine' }
  }
]

// 默认连接
const defaultEdges = [
  { id: 'e1-2', source: 'pressurant-1', target: 'pressure-1', style: { strokeWidth: 5 } },
  { id: 'e2-3', source: 'pressure-1', target: 'regulator-1', style: { strokeWidth: 5 } },
  { id: 'e3-4', source: 'regulator-1', target: 'pressure-2', style: { strokeWidth: 5 } },
  { id: 'e4-5', source: 'pressure-2', target: 'oxidizer-1', style: { strokeWidth: 5 } },
  { id: 'e4-6', source: 'pressure-2', target: 'fuel-1', style: { strokeWidth: 5 } },
  { id: 'e5-7', source: 'oxidizer-1', target: 'temperature-1', style: { strokeWidth: 5 } },
  { id: 'e7-8', source: 'temperature-1', target: 'check_valve-1', style: { strokeWidth: 5 } },
  { id: 'e8-9', source: 'check_valve-1', target: 'valve-1', style: { strokeWidth: 5 } },
  { id: 'e9-10', source: 'valve-1', target: 'flow-1', style: { strokeWidth: 5 } },
  { id: 'e10-15', source: 'flow-1', target: 'engine-1', style: { strokeWidth: 5 } },
  { id: 'e6-11', source: 'fuel-1', target: 'temperature-2', style: { strokeWidth: 5 } },
  { id: 'e11-12', source: 'temperature-2', target: 'check_valve-2', style: { strokeWidth: 5 } },
  { id: 'e12-13', source: 'check_valve-2', target: 'valve-2', style: { strokeWidth: 5 } },
  { id: 'e13-14', source: 'valve-2', target: 'flow-2', style: { strokeWidth: 5 } },
  { id: 'e14-15', source: 'flow-2', target: 'engine-1', style: { strokeWidth: 5 } }
]

// 更新组件数据
function updateComponentValue(value: string) {
  if (selectedNode.value) {
    // @ts-ignore
    selectedNode.value.data = { ...selectedNode.value.data, value }
    // @ts-ignore
    const node = nodes.value.find((n: any) => n.id === selectedNode.value.id)
    if (node) {
      node.data = { ...node.data, value }
    }
    saveState()
  }
}

// 添加节点
function onAddNode(type: string) {
  const position = project({ x: 100, y: 100 })
  const newNode = {
    id: `${type}-${Date.now()}`,
    type,
    position,
    data: { label: '', value: '' },
  }
  addNodes([newNode])
  saveState()
}

// 显示组件配置对话框
function showNodeConfig() {
  nodeConfigVisible.value = true
}

// 处理组件配置确认
function onNodeConfigConfirm(config: any) {
  if (config.id) {
    // 编辑现有节点 - 从 nodes 数组中查找
    // @ts-ignore
    const node = nodes.value.find((n: any) => n.id === config.id)
    if (node) {
      node.data = {
        ...node.data,
        label: config.label,
        dataKey: config.dataKey,
        unit: config.unit,
        pressureKey: config.pressureKey,
        temperatureKey: config.temperatureKey,
        levelKey: config.levelKey,
        positionKey: config.positionKey,
        thrustKey: config.thrustKey,
        chamberPressureKey: config.chamberPressureKey,
        mixtureRatioKey: config.mixtureRatioKey,
        setpointKey: config.setpointKey,
        threshold: config.threshold,
        handles: config.handles
      }
    }
    editingNode.value = null
  } else {
    // 添加新节点
    const position = project({ x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 })
    const newNode = {
      id: `${config.type}-${Date.now()}`,
      type: config.type,
      position,
      data: {
        label: config.label || getDefaultLabel(config.type),
        dataKey: config.dataKey,
        unit: config.unit,
        pressureKey: config.pressureKey,
        temperatureKey: config.temperatureKey,
        levelKey: config.levelKey,
        positionKey: config.positionKey,
        thrustKey: config.thrustKey,
        chamberPressureKey: config.chamberPressureKey,
        mixtureRatioKey: config.mixtureRatioKey,
        setpointKey: config.setpointKey,
        threshold: config.threshold,
        handles: config.handles
      }
    }
    addNodes([newNode])
  }
  saveState()
}

function getDefaultLabel(type: string): string {
  const labels: Record<string, string> = {
    fuel: '燃料罐',
    oxidizer: '氧化剂罐',
    pressurant: '增压气罐',
    valve: '阀门',
    check_valve: '单向阀',
    regulator: '调压阀',
    pressure: '压力传感器',
    temperature: '温度传感器',
    flow: '流量传感器',
    engine: '发动机'
  }
  return labels[type] || '组件'
}

// 节点点击 - 单击选中，双击编辑
function onNodeClick({ node }: any) {
  selectedNode.value = node
}

// 双击节点编辑
function onNodeDoubleClick({ node }: any) {
  editingNode.value = JSON.parse(JSON.stringify(node))
  nodeConfigVisible.value = true
}

// 画布点击
function onPaneClick() {
  selectedNode.value = null
  selectedEdge.value = null
}

// 复制节点
function onCopy() {
  if (selectedNode.value) {
    copiedNode.value = JSON.parse(JSON.stringify(selectedNode.value))
  }
}

// 粘贴节点
function onPaste() {
  if (copiedNode.value) {
    const newNode = {
      // @ts-ignore
      ...copiedNode.value,
      // @ts-ignore
      id: `${copiedNode.value.type}-${Date.now()}`,
      position: {
        // @ts-ignore
        x: copiedNode.value.position.x + 50,
        // @ts-ignore
        y: copiedNode.value.position.y + 50,
      },
    }
    addNodes([newNode])
    saveState()
  }
}

// 保存状态
function saveState() {
  // @ts-ignore
  history.past.push({
    // @ts-ignore
    nodes: JSON.parse(JSON.stringify(nodes)),
    // @ts-ignore
    edges: JSON.parse(JSON.stringify(edges)),
  })
  history.future = []
  updateUndoRedoState()
}

// 撤销
function onUndo() {
  if (history.past.length > 0) {
    const current = {
      nodes: nodes,
      edges: edges,
    }
    // @ts-ignore
    history.future.unshift(current)
    const previous = history.past.pop()
    if (previous) {
      // @ts-ignore
      setNodes(previous.nodes)
      // @ts-ignore
      setEdges(previous.edges)
      updateUndoRedoState()
    }
  }
}

// 重做
function onRedo() {
  if (history.future.length > 0) {
    const current = {
      nodes: nodes,
      edges: edges,
    }
    // @ts-ignore
    history.past.push(current)
    const next = history.future.shift()
    if (next) {
      // @ts-ignore
      setNodes(next.nodes)
      // @ts-ignore
      setEdges(next.edges)
      updateUndoRedoState()
    }
  }
}

// 更新撤销重做状态
function updateUndoRedoState() {
  canUndo.value = history.past.length > 0
  canRedo.value = history.future.length > 0
}

const getConfig = () => {
  return {
    nodes: JSON.parse(JSON.stringify(nodes)),
    edges: JSON.parse(JSON.stringify(edges))
  }
}

const setConfig = (config: Record<string, any>) => {
  if (config.nodes) {
    setNodes(config.nodes)
  }
  if (config.edges) {
    setEdges(config.edges)
  }
}

defineExpose({
  getConfig,
  setConfig
})

const eventCenter = EventCenter.getInstance()

// 节点实时值缓存 (dataKey -> value)
const nodeDataValues = ref<Record<string, Record<string, string>>>({})

// 监听实时数据更新
function handleDataUpdate(data: Record<string, number>) {
  // 遍历所有节点，根据 dataKey 匹配更新数值
  // @ts-ignore
  nodes.value.forEach((node: any) => {
    const dataKey = node.data?.dataKey
    if (dataKey && data[dataKey] !== undefined) {
      const numValue = data[dataKey]
      // 格式化数值
      let displayValue = String(numValue)
      if (!isNaN(numValue)) {
        displayValue = numValue.toFixed(2)
      }
      // 更新节点数据
      node.data = { ...node.data, value: displayValue }
      // 缓存值
      if (!nodeDataValues.value[node.id]) {
        nodeDataValues.value[node.id] = {}
      }
      nodeDataValues.value[node.id][dataKey] = displayValue
    }
  })
}

// 初始化默认演示
onMounted(() => {
  // 添加默认节点
  addNodes(defaultDemo)
  // 添加默认连接
  addEdges(defaultEdges)

  // 监听实时数据更新事件
  eventCenter.on(EventNames.DATA_UPDATE, handleDataUpdate)

  // 键盘快捷键
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey) {
      switch (e.key) {
        case 'c':
          if (selectedNode.value) onCopy()
          break
        case 'v':
          if (copiedNode.value) onPaste()
          break
        case 'z':
          if (!e.shiftKey && canUndo.value) onUndo()
          else if (e.shiftKey && canRedo.value) onRedo()
          break
      }
    }
  })
})

// 组件卸载时清理事件监听
onUnmounted(() => {
  eventCenter.off(EventNames.DATA_UPDATE, handleDataUpdate)
  window.removeEventListener('keydown', () => {})
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

.custom-node {
  padding: 10px;
  border-radius: 4px;
  text-align: center;
  background: var(--el-bg-color);
  border: 2px solid var(--el-color-primary);
  position: relative;
  width: 100%;
  height: 100%;
}

.custom-node.selected {
  border-color: var(--el-color-success);
  box-shadow: 0 0 8px var(--el-color-success);
}

.custom-node.sensor {
  border-radius: 30px;
}

.custom-node.sensor.pressure {
  border-color: #409eff;
}

.custom-node.sensor.temperature {
  border-color: #e6a23c;
}

.custom-node.sensor.flow {
  border-color: #67c23a;
}

.custom-node :deep(.vue-flow__resize-control) {
  display: none;
}
.custom-node:hover :deep(.vue-flow__resize-control){
  display: block;
}

</style>