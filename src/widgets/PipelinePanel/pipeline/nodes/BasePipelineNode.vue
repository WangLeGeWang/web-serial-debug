<template>
  <div class="base-pipeline-node" :class="[{ selected }, nodeClass]">
    <NodeResizer :min-width="minWidth" :min-height="minHeight" />
    <Handle
      v-for="handle in data.handles || []"
      :key="handle.id"
      :id="handle.id"
      :type="handle.type"
      :position="handle.position as any"
      class="handle"
    />
    <NodeToolbar v-if="data.actions?.length">
      <el-button
        v-for="action in data.actions"
        :key="action.value"
        size="small"
        @click="emit('update', action.value)"
      >
        {{ action.label }}
      </el-button>
    </NodeToolbar>
    <div class="pipeline-node-title">{{ data.label || fallbackLabel }}</div>
    <div class="pipeline-node-fields">
      <div
        v-for="field in resolvedFields"
        :key="field.id"
        class="pipeline-node-field"
        :class="`is-${field.status}`"
      >
        {{ field.text }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Handle } from '@vue-flow/core'
import { NodeResizer } from '@vue-flow/node-resizer'
import { NodeToolbar } from '@vue-flow/node-toolbar'
import { ElButton } from 'element-plus'
import type { PipelineNodeData } from '../types'
import { resolveDisplayField } from '../fieldFormat'
import './style.css'

const props = withDefaults(defineProps<{
  selected: boolean
  data: PipelineNodeData
  latestData: Record<string, unknown>
  nodeClass?: string
  fallbackLabel?: string
  minWidth?: number
  minHeight?: number
}>(), {
  nodeClass: '',
  fallbackLabel: '组件',
  minWidth: 90,
  minHeight: 70
})

const emit = defineEmits<{
  (e: 'update', value: string): void
}>()

const resolvedFields = computed(() => {
  return (props.data.displayFields || []).map(field => resolveDisplayField(field, props.latestData || {}))
})
</script>
