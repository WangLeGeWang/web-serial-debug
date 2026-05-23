<template>
  <BasePipelineNode
    :selected="selected"
    :data="data"
    :latest-data="latestData"
    :node-class="`pipeline-node-sensor subtype-${data.subtype || 'custom'}`"
    fallback-label="传感器"
    :min-width="100"
    :min-height="80"
    @update="value => emit('update', value)"
  />
</template>

<script setup lang="ts">
import BasePipelineNode from './BasePipelineNode.vue'
import type { PipelineNodeData } from '../types'

defineProps<{
  id: string
  selected: boolean
  data: PipelineNodeData
  latestData: Record<string, unknown>
}>()

const emit = defineEmits<{
  (e: 'update', value: string): void
}>()
</script>
