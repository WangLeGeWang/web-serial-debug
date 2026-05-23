<template>
  <BasePipelineNode
    :selected="selected"
    :data="data"
    :latest-data="latestData"
    :node-class="`pipeline-node-valve subtype-${data.subtype || 'custom'} ${isOpen ? 'is-open' : ''}`"
    fallback-label="阀"
    :min-width="100"
    :min-height="60"
    @update="value => emit('update', value)"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import BasePipelineNode from './BasePipelineNode.vue'
import type { PipelineNodeData } from '../types'

const props = defineProps<{
  id: string
  selected: boolean
  data: PipelineNodeData
  latestData: Record<string, unknown>
}>()

const emit = defineEmits<{
  (e: 'update', value: string): void
}>()

const isOpen = computed(() => {
  const field = props.data.displayFields?.find(item => item.type === 'mapping' || item.key)
  if (!field?.key) return false
  return String(props.latestData[field.key]) === '1'
})
</script>
