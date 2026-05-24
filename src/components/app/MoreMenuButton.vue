<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDark, useToggle } from '@vueuse/core'
import { ElMessage } from 'element-plus'
import { isDesktop } from '../../utils/Platform'
import { desktopApi } from '../../utils/desktopApi'

const router = useRouter()
const isDark = useDark({
  initialValue: 'dark',
  storage: localStorage
})
const toggleDark = useToggle(isDark)
const isFullscreen = ref(false)
const desktop = isDesktop()

const syncFullscreenState = () => {
  isFullscreen.value = Boolean(document.fullscreenElement)
}

const toggleFullscreen = async () => {
  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen()
  } else {
    await document.exitFullscreen()
  }
  syncFullscreenState()
}

const openHelpWindow = () => {
  const route = router.resolve({ name: 'help' })
  window.open(route.href, '_blank', 'noopener,noreferrer')
}

const openNewAppWindow = async () => {
  try {
    await desktopApi.openNewWindow()
  } catch (e) {
    ElMessage.error('新建窗口失败：' + e)
  }
}

const handleCommand = (command: string) => {
  if (command === 'theme') {
    toggleDark()
    return
  }
  if (command === 'fullscreen') {
    toggleFullscreen()
    return
  }
  if (command === 'new-window') {
    openNewAppWindow()
    return
  }
  if (command === 'help') {
    openHelpWindow()
  }
}

onMounted(() => {
  document.addEventListener('fullscreenchange', syncFullscreenState)
})

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', syncFullscreenState)
})
</script>

<template>
  <el-dropdown trigger="click" placement="bottom-end" @command="handleCommand">
    <el-button class="more-toggle" :icon="'MoreFilled'" />
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item command="theme" :icon="isDark ? 'Sunny' : 'Moon'">
          {{ isDark ? '浅色模式' : '深色模式' }}
        </el-dropdown-item>
        <el-dropdown-item command="fullscreen" :icon="isFullscreen ? 'Aim' : 'FullScreen'">
          {{ isFullscreen ? '退出全屏' : '进入全屏' }}
        </el-dropdown-item>
        <el-dropdown-item v-if="desktop" command="new-window" icon="CopyDocument">
          新建窗口
        </el-dropdown-item>
        <el-dropdown-item command="help" icon="QuestionFilled">帮助</el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<style scoped>
.more-toggle {
  width: 32px;
  height: 32px;
  padding: 0;
  margin-left: 0;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  box-shadow: none;
  transition: all 0.2s;
}

.more-toggle:hover,
.more-toggle:focus {
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}
</style>
