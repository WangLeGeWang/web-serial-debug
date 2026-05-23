<script setup lang="ts">
import MarkdownPanel from '../components/MarkdownPanel.vue'
</script>

<template>
  <MarkdownPanel class="help-page" />
</template>

<style scoped>
.help-page {
  min-height: 100vh;
  background-color: var(--el-bg-color-overlay);
}
</style>
