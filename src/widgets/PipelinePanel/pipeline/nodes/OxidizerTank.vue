<template>
  <div class="custom-node tank oxidizer" :class="{ selected: props.selected }">
    <NodeResizer :min-width="80" :min-height="100" />
    <template v-if="handles.length > 0">
      <Handle
        v-for="handle in handles"
        :key="handle.id"
        :id="handle.id"
        :type="handle.type"
        :position="handle.position"
        class="handle"
      />
    </template>
    <template v-else>
      <Handle id="pressurant" type="target" :position='"top" as any' class="handle" />
      <Handle id="output" type="source" :position='"bottom" as any' class="handle" />
    </template>
    <NodeToolbar>
      <el-button size="small" @click="updateValue('FILL')">加注</el-button>
      <el-button size="small" @click="updateValue('DRAIN')">排空</el-button>
      <el-button size="small" @click="updateValue('VENT')">排气</el-button>
    </NodeToolbar>
    <div class="label">{{ props.data?.label || '氧化剂罐' }}</div>
    <div class="status">
      <div>压力: {{ props.data?.pressure || 'N/A' }} MPa</div>
      <div>温度: {{ props.data?.temperature || 'N/A' }} ℃</div>
      <div>液位: {{ props.data?.level || 'N/A' }} %</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NodeResizer } from '@vue-flow/node-resizer'
import { NodeToolbar } from '@vue-flow/node-toolbar'
import { Handle } from '@vue-flow/core'
import { ElButton } from 'element-plus'
import './style.css'

interface HandleConfig {
  id: string
  type: 'target' | 'source'
  position: 'top' | 'bottom' | 'left' | 'right'
}

const props = defineProps<{
  id: string
  selected: boolean
  data: {
    label?: string
    pressure?: string
    temperature?: string
    level?: string
    handles?: HandleConfig[]
  }
}>()

const handles = computed(() => props.data?.handles || [])

const emit = defineEmits<{
  (e: 'update', value: string): void
}>()

function updateValue(value: string) {
  emit('update', value)
}
</script>

<style scoped></style>
