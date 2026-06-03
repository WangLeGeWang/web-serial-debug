<script setup lang="ts">
import { computed } from 'vue'
import { widgetRegistry } from '@/widgets'

interface Props {
  type: string
  config?: Record<string, any>
  readonly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  config: () => ({}),
  readonly: true
})

const widgetComponent = computed(() => {
  const def = widgetRegistry[props.type]
  if (!def) return null
  return def.canvasComponent ?? def.component
})
</script>

<template>
  <div class="canvas-widget-wrapper">
    <component
      v-if="widgetComponent"
      :is="widgetComponent"
      :readonly="props.readonly"
      v-bind="config"
    />
    <div v-else class="unknown-widget">
      <el-empty description="未知组件类型" />
    </div>
  </div>
</template>

<style scoped lang="less">
.canvas-widget-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: transparent;
  border-radius: 0;
  overflow: hidden;
}

.unknown-widget {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>