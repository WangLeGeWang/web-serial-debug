<script setup lang="ts">
import { onMounted } from 'vue'
import MarkdownPanel from '../components/MarkdownPanel.vue'

onMounted(() => {
  document.title = '帮助 - BUS Studio'
})
</script>

<template>
  <main class="help-page">
    <MarkdownPanel class="help-page-content" />
  </main>
</template>

<style scoped>
.help-page {
  height: 100vh;
  overflow-y: auto;
  background-color: var(--el-bg-color-overlay);
}

.help-page-content {
  min-height: 100%;
}

.help-page-content.markdown-panel {
  height: auto;
  min-height: 100%;
  overflow: visible;
}
</style>
