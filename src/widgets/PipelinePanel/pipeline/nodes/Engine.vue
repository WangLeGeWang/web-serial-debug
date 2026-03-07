<template>
  <div class="custom-node engine" :class="{ selected: props.selected }">
    <NodeResizer :min-width="100" :min-height="120" />
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
      <Handle id="fuel" type="target" :position='"left" as any' class="handle" />
      <Handle id="oxidizer" type="target" :position='"left" as any' class="handle" style="top: 40px" />
      <Handle id="output" type="source" :position='"right" as any' class="handle" />
    </template>

    <NodeToolbar>
      <el-button size="small" @click="updateValue('START')">点火</el-button>
      <el-button size="small" @click="updateValue('SHUTDOWN')">关机</el-button>
      <el-button size="small" @click="updateValue('PURGE')">吹洗</el-button>
    </NodeToolbar>
    <div class="label">{{ props.data?.label || '推进器' }}</div>
    <div class="status">
      <div>推力: {{ props.data?.thrust || 'N/A' }} kN</div>
      <div>室压: {{ props.data?.chamber_pressure || 'N/A' }} MPa</div>
      <div>混比: {{ props.data?.mixture_ratio || 'N/A' }}</div>
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
    thrust?: string
    chamber_pressure?: string
    mixture_ratio?: string
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
