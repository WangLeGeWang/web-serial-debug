<template>
  <BasePipelineNode
    :selected="selected"
    :data="data"
    :latest-data="latestData"
    :node-class="`pipeline-node-tank subtype-${data.subtype || 'custom'}`"
    fallback-label="罐"
    :min-width="120"
    :min-height="110"
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
