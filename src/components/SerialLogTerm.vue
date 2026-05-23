<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { SerialHelper } from '../utils/SerialHelper'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { WebglAddon } from '@xterm/addon-webgl';

import { useDark } from '@vueuse/core'
import 'xterm/css/xterm.css'

import { EventCenter, EventNames } from '../utils/EventCenter'
import { useWorkspaceConfig } from '../utils/useWorkspaceConfig'
import type { DisplayConfig } from './types'

const eventCenter = EventCenter.getInstance()

const defaultDisplayConfig: DisplayConfig = {
  showTime: true,
  showMs: false,
  showHex: true,
  showText: true,
  showNewline: true,
  autoScroll: false,
  timeOut: 5
}

const { config: logOptions } = useWorkspaceConfig<DisplayConfig>('display', defaultDisplayConfig)
const isDark = useDark()

const serialHelper = SerialHelper.getInstance()
let logBufferAll: string[] = []
let logBuffer = new Uint8Array()
let timeoutId: number | null = null
let timeoutDelt: number = 0
let terminal: Terminal | null = null
let fitAddon: FitAddon | null = null
const receivedBytes = ref(0)
const formattedReceivedBytes = computed(() => {
  if (receivedBytes.value < 1024) return `${receivedBytes.value} B`
  if (receivedBytes.value < 1024 * 1024) return `${(receivedBytes.value / 1024).toFixed(1)} KB`
  return `${(receivedBytes.value / 1024 / 1024).toFixed(1)} MB`
})

const clearLog = () => {
  if (terminal) {
    terminal.clear()
  }
  logBufferAll = []
  receivedBytes.value = 0
}

const handleTerminalData = (data: string) => {
  eventCenter.emit(EventNames.SERIAL_SEND, new TextEncoder().encode(data))
}

const getTerimalTheme = (val: boolean) => {
  return val ? {
      background: '#1e1e1e',
      foreground: '#d4d4d4',
      selectionBackground: '#3a3a3a',
    } : {
      background: '#ffffff',
      foreground: '#000000',
      selectionBackground: '#d4d4d4',
    }
}

const initTerminal = () => {
  terminal = new Terminal({
    cursorBlink: true,
    convertEol: true,
    fontFamily: 'Consolas,Liberation Mono,Menlo,Courier,monospace',
    fontSize: 14,
    theme: getTerimalTheme(isDark.value),
    scrollback: 10000
  })
  
  const searchAddon = new SearchAddon();
  terminal.loadAddon(searchAddon);

  fitAddon = new FitAddon()
  terminal.loadAddon(fitAddon)

  terminal.loadAddon(new WebLinksAddon());

  terminal.loadAddon(new WebglAddon());

  terminal.onData(handleTerminalData)
  
  const terminalElement = document.getElementById('terminal')
  if (terminalElement) {
    terminal.open(terminalElement)
    // 显示欢迎信息 https://patorjk.com/software/taag/#p=display&f=Big&t=Serial%20Tool
    const logo = `
\x1b[36m  ____  _    _  _____   _______          _ 
 |  _ \\| |  | |/ ____| |__   __|        | |
 | |_) | |  | | (___      | | ___   ___ | |
 |  _ <| |  | |\\___ \\     | |/ _ \\ / _ \\| |
 | |_) | |__| |____) |    | | (_) | (_) | |
 |____/ \\____/|_____/     |_|\\___/ \\___/|_|
\x1b[0m
\x1b[35m === BUS Studio ===\x1b[0m
\x1b[32m 版本: v4.1.0\x1b[0m

`
    terminal.write(logo)
  }

  setTimeout(() => {
      fitAddon?.fit()
  }, 120)
}

const toggleOption = (option: string) => {
  if (option in logOptions.value) {
    (logOptions.value as any)[option] = !(logOptions.value as any)[option]
  }
}

const processSerialData = (data: Uint8Array) => {
  logBuffer = new Uint8Array([...logBuffer, ...data])
  receivedBytes.value += data.length
  
  if (logOptions.value.timeOut == 0) {
    processSerialDataHanlde()
    return
  }

  if (timeoutId) {
    clearTimeout(timeoutId)
  }
  if (timeoutDelt == 0) {
    timeoutDelt = Date.now()
  } else {
    const delt = Date.now() - timeoutDelt
    if (delt >= logOptions.value.timeOut) {
      timeoutDelt = 0
      processSerialDataHanlde()
      return
    }
  }

  timeoutId = window.setTimeout(() => {
    timeoutDelt = 0
    processSerialDataHanlde()
  }, logOptions.value.timeOut)
}

const processSerialDataHanlde = () => {
  const message = serialHelper.formatLogMessage(logBuffer, logOptions.value)
  if (terminal) {
    requestAnimationFrame(() => {
      if (terminal) {
        terminal.write(message)
        if (logOptions.value.autoScroll) {
          terminal.scrollToBottom()
        }
      }
    })
    logBufferAll.push(message)
  }
  logBuffer = new Uint8Array()
}

watch(isDark, (newValue) => {
  if (terminal) {
    terminal.options.theme = getTerimalTheme(newValue)
  }
})

const handleResize = () => {
  setTimeout(() => {
      fitAddon?.fit()
  }, 120)
}

const termWriteHandle = (data: Uint8Array) => {
  if (terminal) {
    let str = serialHelper.uint8ArrayToString(data)
    terminal.write(str)
  }
}

onMounted(() => {
  initTerminal()

  eventCenter.on(EventNames.SERIAL_DATA, processSerialData)
  eventCenter.on(EventNames.TERM_WRITE, termWriteHandle)
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  eventCenter.off(EventNames.SERIAL_DATA, processSerialData)
  eventCenter.off(EventNames.TERM_WRITE, termWriteHandle)
  window.removeEventListener('resize', handleResize)
  
  if (timeoutId) {
    clearTimeout(timeoutId)
  }

  if (terminal) {
    terminal.dispose()
  }
})

const exportLog = () => {
  if (!terminal) return
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = `serial-log-${timestamp}.txt`
  const content = logBufferAll.join('\n')
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="serial-log">
    <div class="terminal-container">
      <div class="terminal-floating-actions">
        <el-button
          class="floating-button auto-scroll-button"
          :class="{ active: logOptions.autoScroll }"
          size="small"
          @click="toggleOption('autoScroll')"
        >
          自动滚动
        </el-button>
        <el-button
          class="floating-button clear-button"
          size="small"
          @click="clearLog"
        >
          清空
        </el-button>
        <el-popover trigger="click" placement="bottom-end" width="240" popper-class="terminal-options-popover">
          <template #reference>
            <el-button class="floating-button more-button" :icon="'MoreFilled'" size="small" />
          </template>
          <div class="terminal-options-panel">
            <div class="options-section">
              <div class="options-title">显示选项</div>
              <el-checkbox v-model="logOptions.showTime">时间</el-checkbox>
              <el-checkbox v-model="logOptions.showMs">毫秒</el-checkbox>
              <el-checkbox v-model="logOptions.showHex">HEX</el-checkbox>
              <el-checkbox v-model="logOptions.showText">TEXT</el-checkbox>
              <el-checkbox v-model="logOptions.showNewline">换行</el-checkbox>
            </div>
            <div class="options-section">
              <div class="options-title">分包超时</div>
              <el-input-number
                v-model="logOptions.timeOut"
                :min="0"
                :max="3000"
                :step="5"
                size="small"
              >
                <template #suffix>
                  <span>ms</span>
                </template>
              </el-input-number>
            </div>
            <div class="options-section">
              <div class="options-title">操作</div>
              <el-button class="export-button" size="small" @click="exportLog">导出日志</el-button>
            </div>
          </div>
        </el-popover>
      </div>
      <div id="terminal"></div>
      <div class="terminal-floating-status">
        接收 {{ formattedReceivedBytes }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.serial-log {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.serial-log :deep(.el-card__body) {
  flex: 1;
  overflow: hidden;
}

.terminal-container {
  position: relative;
  height: 100%;
  overflow: hidden;
}

#terminal, :deep(.terminal) {
  height: 100%;
}

.terminal-floating-actions {
  position: absolute;
  top: 10px;
  right: 12px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: color-mix(in srgb, var(--el-bg-color-overlay) 82%, transparent);
  box-shadow: var(--el-box-shadow-lighter);
  backdrop-filter: blur(10px);
}

.terminal-floating-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.floating-button {
  height: 26px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: var(--el-text-color-regular);
}

.floating-button:hover,
.floating-button.active {
  border-color: var(--el-color-primary-light-5);
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.clear-button:hover {
  border-color: var(--el-color-danger-light-5);
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

.more-button {
  width: 26px;
  padding: 0;
}

.terminal-floating-status {
  position: absolute;
  right: 12px;
  bottom: 10px;
  z-index: 10;
  padding: 4px 9px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 999px;
  background: color-mix(in srgb, var(--el-bg-color-overlay) 78%, transparent);
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 18px;
  box-shadow: var(--el-box-shadow-lighter);
  backdrop-filter: blur(10px);
  pointer-events: none;
}

.terminal-options-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.options-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.options-title {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-weight: 600;
}

.export-button {
  align-self: flex-start;
}
</style>
