<script setup lang="ts">
import { SerialHelper } from '../utils/SerialHelper'
import { ElMessage } from 'element-plus'
import { ref, watch, onMounted } from 'vue'
import { useDebounceFn } from '@vueuse/core'

import { EventCenter, EventNames } from '../utils/EventCenter'
import { WorkspaceManagerInst } from '../utils/ProfileManager'
import { useQuickSendStore } from '../store/quickSendStore'
import SerialQuickSend from './SerialQuickSend.vue'
import type { SendConfig } from './types'

const eventCenter = EventCenter.getInstance()
const workspaceManager = WorkspaceManagerInst
const quickSendStore = useQuickSendStore()
const quickSendDialogVisible = ref(false)

const defaultSendConfig: SendConfig = {
  isHexSend: false,
  addCRLF: false,
  addCRLFType: '\n',
  autoSend: false,
  autoSendInterval: 1000,
  addChecksum: false,
  content: '',
  history: [],
  historyMaxLength: 100
}

const sendConfig = ref<SendConfig>({ ...defaultSendConfig })

const loadFromProfile = () => {
  const workspace = workspaceManager.activeWorkspace
  if (workspace?.config?.send) {
    sendConfig.value = { ...workspace.config.send as SendConfig }
  }
}

const saveToProfile = useDebounceFn(() => {
  const workspace = workspaceManager.activeWorkspace
  if (workspace) {
    workspaceManager.updateWorkspace(workspace.id, {
      config: {
        ...workspace.config,
        send: { ...sendConfig.value }
      }
    })
  }
}, 300)

let lastWorkspaceId: string | null = null

onMounted(() => {
  loadFromProfile()
  quickSendStore.loadFromProfile()
  lastWorkspaceId = workspaceManager.activeWorkspaceIdRef.value || null
  
  workspaceManager.onWorkspaceChange(() => {
    if (workspaceManager.activeWorkspaceIdRef.value !== lastWorkspaceId) {
      lastWorkspaceId = workspaceManager.activeWorkspaceIdRef.value
      loadFromProfile()
    }
  })
})

watch(sendConfig, () => {
  saveToProfile()
}, { deep: true })

let autoSendTimer: number | null = null
const serialHelper = SerialHelper.getInstance()

const sendData = () => {
  try {
    let content = sendConfig.value.content
    if (sendConfig.value.addCRLF) {
      content += sendConfig.value.addCRLFType
    }

    let data = serialHelper.stringToUint8Array(content, sendConfig.value.isHexSend)
    if (sendConfig.value.addChecksum) {
      data = serialHelper.appendChecksum(data)
    }
    eventCenter.emit(EventNames.SERIAL_SEND, data)
    
    if (content && !sendConfig.value.history.includes(sendConfig.value.content)) {
      sendConfig.value.history.unshift(sendConfig.value.content)
      if (sendConfig.value.history.length > sendConfig.value.historyMaxLength) {
        sendConfig.value.history.pop()
      }
    }
  } catch (error) {
    console.error('发送数据时出错:', error)
    ElMessage.error('发送数据时出错' + error)
    eventCenter.emit(EventNames.SERIAL_ERROR, { message: error instanceof Error ? error.message : '发送数据时出错' })
    return false
  }
  return true
}

const toggleAutoSend = () => {
  if (sendConfig.value.autoSend) {
    autoSendTimer = window.setInterval(() => {
      if (!sendData()) {
        if (autoSendTimer) {
          clearInterval(autoSendTimer)
          autoSendTimer = null
        }
        sendConfig.value.autoSend = false
      }
    }, sendConfig.value.autoSendInterval)
  } else if (autoSendTimer) {
    clearInterval(autoSendTimer)
    autoSendTimer = null
  }
}

const handleIntervalChange = (value: number) => {
  sendConfig.value.autoSendInterval = value
  if (sendConfig.value.autoSend && autoSendTimer) {
    clearInterval(autoSendTimer)
    autoSendTimer = window.setInterval(sendData, value)
  }
}

let historyIndex = -1

const handleKeyDown = (e: KeyboardEvent) => {
  if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.key === 'Enter') {
    sendData()
    historyIndex = -1
    e.preventDefault()
    return false
  }

  const target = e.target as HTMLTextAreaElement
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    const cursorPosition = target.selectionStart
    const contentBeforeCursor = sendConfig.value.content.slice(0, cursorPosition)
    const isFirstLine = !contentBeforeCursor.includes('\n')
    if (historyIndex == -1 && !isFirstLine) {
      return
    }
  } else {
    historyIndex = -1
  }

  if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (historyIndex === -1 && sendConfig.value.content.trim() && 
        !sendConfig.value.history.includes(sendConfig.value.content)) {
      sendConfig.value.history.unshift(sendConfig.value.content)
      if (sendConfig.value.history.length > sendConfig.value.historyMaxLength) {
        sendConfig.value.history.pop()
      }
    }
    if (sendConfig.value.history.length > 0) {
      historyIndex = Math.min(historyIndex + 1, sendConfig.value.history.length - 1)
      sendConfig.value.content = sendConfig.value.history[historyIndex]
      target.selectionStart = target.selectionEnd = 0
    }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (historyIndex > -1) {
      historyIndex--
      sendConfig.value.content = historyIndex === -1 ? '' : sendConfig.value.history[historyIndex]
      target.selectionStart = target.selectionEnd = 0
    }
  }
}
</script>

<template>
  <div class="serial-send">
    <div class="quick-floating-bar">
      <div class="quick-scroll-list">
        <el-button
          v-for="item in quickSendStore.currentGroup.items"
          :key="item.id"
          class="quick-send-chip"
          size="small"
          @click="quickSendStore.sendData(item)"
        >
          {{ item.name }}
        </el-button>
      </div>
      <el-button
        class="quick-settings-button"
        :icon="'Setting'"
        size="small"
        @click="quickSendDialogVisible = true"
      />
    </div>

    <div class="send-content">
      <el-input
        v-model="sendConfig.content"
        type="textarea"
        :rows="5"
        :placeholder="sendConfig.isHexSend ? '请输入HEX格式数据，如：AA BB CC 11 22' : '请输入要发送的文本'"
        @keydown="handleKeyDown"
      />
    </div>

    <div class="controls">
      <el-switch v-model="sendConfig.isHexSend" active-text="HEX" inactive-text="TEXT" class="me-2" />
      <div class="newline-control me-2">
        <el-checkbox v-model="sendConfig.addCRLF" label="" style="vertical-align: middle;" />
        <el-select v-model="sendConfig.addCRLFType" size="small" style="width: 80px;" @change="sendConfig.addCRLF = true">
          <el-option :value="'\r\n'" label="CRLF" />
          <el-option :value="'\r'" label="CR" />
          <el-option :value="'\n'" label="LF" />
          <el-option :value="'\n\n'" label="LF2" />
        </el-select>
      </div>
      <el-checkbox v-model="sendConfig.addChecksum" label="校验和" class="me-2" />
      <el-checkbox v-model="sendConfig.autoSend" @change="toggleAutoSend" label="自动发送" class="me-2" />
      <el-input-number v-model="sendConfig.autoSendInterval" :step="100" @change="handleIntervalChange" size="small" class="me-2" title="自动发送时间间隔">
        <template #suffix>
          <span>ms</span>
        </template>
      </el-input-number>
      <el-button type="primary" @click="sendData" class="send-button">发送</el-button>
    </div>

    <el-dialog
      v-model="quickSendDialogVisible"
      title="快捷发送设置"
      width="860px"
      destroy-on-close
      append-to-body
    >
      <div class="quick-send-dialog-body">
        <SerialQuickSend />
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>
.serial-send {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 42px 10px 10px;
}

.quick-floating-bar {
  position: absolute;
  top: 6px;
  right: 10px;
  left: 10px;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: color-mix(in srgb, var(--el-bg-color-overlay) 84%, transparent);
  box-shadow: var(--el-box-shadow-lighter);
  backdrop-filter: blur(10px);
}

.quick-scroll-list {
  display: flex;
  flex: 1;
  gap: 4px;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.quick-scroll-list::-webkit-scrollbar {
  display: none;
}

.quick-scroll-list :deep(.el-button + .el-button) {
  margin-left: 0;
}

.quick-send-chip {
  flex: 0 0 auto;
  height: 26px;
  padding: 0 9px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: var(--el-text-color-regular);
}

.quick-send-chip:hover {
  border-color: var(--el-color-primary-light-5);
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.quick-settings-button {
  flex: 0 0 auto;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: var(--el-text-color-regular);
}

.quick-settings-button:hover {
  border-color: var(--el-color-primary-light-5);
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.quick-send-dialog-body {
  height: 70vh;
  overflow: auto;
}

.controls {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 2px;
}

.controls :deep(.el-button + .el-button) {
  margin-left: 0;
}

.send-content {
  min-width: 0;
}

.newline-control {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.send-button {
  min-width: 68px;
}

.me-2 {
  margin-right: 0;
}
</style>
