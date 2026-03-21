<script setup lang="ts">
import { ref, onMounted } from 'vue'
import MarkdownRender, { enableMermaid, enableKatex } from 'markstream-vue'
import { useDark } from '@vueuse/core'
import guideContent from './guide.md?raw'

enableMermaid()
enableKatex()

onMounted(() => {
})

const content = ref(guideContent)
const isDark = useDark()
</script>

<template>
  <div class="markdown-panel" :class="{ dark: isDark }">
    <MarkdownRender :content="content" :is-dark="isDark" />
  </div>
</template>

<style scoped>
.markdown-panel {
  padding: 16px;
  height: 100%;
  overflow-y: auto;
}

.markdown-panel :deep(.ms-prose) {
  max-width: none;
}

.markdown-panel :deep(.bg-gray-900) {
  background-color: var(--el-bg-color) !important;
}

.markdown-panel :deep(.mermaid) {
  background-color: transparent !important;
}
</style>
<style>
.markstream-vue .mermaid-block-header {
  background-color: var(--el-bg-color-overlay) !important;
  padding: 4px 6px;
}
.markstream-vue .bg-gray-900 {
  background-color: var(--el-bg-color-overlay);
}
</style>
