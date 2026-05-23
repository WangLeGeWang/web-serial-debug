<script setup lang="ts">
import WorkspaceSelector from '../WorkspaceSelector.vue'
import MoreMenuButton from './MoreMenuButton.vue'
</script>

<template>
  <el-header class="app-header">
    <div class="header-content">
      <div class="header-left">
        <h1><a href="https://github.com/qdsang/web-serial-debug" target="_blank">Bus</a></h1>
        <WorkspaceSelector class="header-workspace-selector" />
      </div>
      <div class="header-links">
        <MoreMenuButton />
      </div>
    </div>
  </el-header>
</template>

<style scoped>
.app-header {
  background-color: var(--el-bg-color-overlay);
  padding: 0 20px;
  border-bottom: 1px solid var(--el-border-color-light);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.header-content {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 24px;
}

.header-workspace-selector {
  margin-left: 8px;
}

.header-content h1 {
  color: var(--el-text-color-primary);
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
  background: linear-gradient(120deg, #6366f1 0%, #2dd4bf 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: -0.5px;
}

.header-links {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-links a {
  color: var(--el-text-color-primary);
  text-decoration: none;
}

.header-links a:hover {
  color: var(--el-color-primary);
}
</style>
