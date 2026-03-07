<template>
  <div class="custom-node check-valve" :class="{ selected: props.selected }">
    <NodeResizer :min-width="30" :min-height="20" />
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
      <Handle id="target" type="target" :position='"left" as any' class="handle" />
      <Handle id="source" type="source" :position='"right" as any' class="handle" />
    </template>
    <div class="label">{{ props.data?.label || '单向阀' }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NodeResizer } from '@vue-flow/node-resizer'
import { Handle } from '@vue-flow/core'

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
    handles?: HandleConfig[]
  }
}>()

const handles = computed(() => props.data?.handles || [])
</script>

<style scoped>
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

.custom-node.check-valve {
  border-radius: 15px;
  transform: rotate(45deg);
}

.custom-node.check-valve .label {
  transform: rotate(-45deg);
}

.label {
  font-weight: bold;
  margin-bottom: 8px;
}

.handle {
  width: 10px;
  height: 10px;
  background: var(--el-color-primary);
  border: 2px solid var(--el-bg-color);
  border-radius: 50%;
  transition: all 0.3s;
}

.handle:hover {
  background: var(--el-color-success);
  transform: scale(1.2);
}
</style>
