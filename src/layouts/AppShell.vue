<script setup lang="ts">
import AppHeader from '../components/app/AppHeader.vue'
</script>

<template>
  <el-container class="app-container">
    <AppHeader />
    <el-container class="main-container">
      <slot />
    </el-container>
  </el-container>
</template>

<style scoped>
.app-container {
  height: 100vh;
  flex-direction: column;
}

.main-container {
  width: 100%;
  height: calc(100vh - 60px);
  background-color: var(--el-bg-color-overlay);
}
</style>
