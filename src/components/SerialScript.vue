<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { defaultKeymap, indentWithTab } from '@codemirror/commands'
import { javascript } from '@codemirror/lang-javascript'
import { oneDark, oneDarkHighlightStyle } from '@codemirror/theme-one-dark'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { ScriptManager } from '../utils/ScriptManager'
import { useDark } from '@vueuse/core'
import { WorkspaceManagerInst } from '../utils/ProfileManager'

const props = withDefaults(defineProps<{
  embedded?: boolean
  editorHeight?: string
}>(), {
  embedded: false,
  editorHeight: '520px'
})

const scriptManager = ScriptManager.getInstance()
const workspaceManager = WorkspaceManagerInst

const currentScript = ref(scriptManager.getScript())
const editor = ref<EditorView | null>(null)
const editorContainer = ref<HTMLElement | null>(null)
const isDark = useDark()
const testInput = ref('pitch:1.20,roll:3.40,yaw:5.60\n')
const testLogs = ref<string[]>([])
const isTesting = ref(false)

const statusType = computed(() => currentScript.value.isRunning ? 'success' : 'info')
const statusText = computed(() => currentScript.value.isRunning ? '运行中' : '未运行')

const addTestLog = (message: string) => {
  const time = new Date().toLocaleTimeString()
  testLogs.value.unshift(`${time} ${message}`)
  testLogs.value = testLogs.value.slice(0, 20)
}

const bytesToHex = (data: Uint8Array) => Array.from(data).map(item => item.toString(16).padStart(2, '0')).join(' ')

const editorSetValue = (content: string) => {
  if (editor.value) {
    editor.value.dispatch({
      changes: { from: 0, to: editor.value.state.doc.length, insert: content }
    })
  }
}

const refreshScript = () => {
  currentScript.value = { ...scriptManager.getScript() }
}

const runScript = async () => {
  if (currentScript.value.isRunning) {
    scriptManager.stopScript()
    addTestLog('脚本已停止')
  } else {
    await scriptManager.runScript()
    addTestLog(scriptManager.getScript().isRunning ? '脚本启动成功' : '脚本启动失败')
  }
  refreshScript()
}

const runReceiveTest = async () => {
  isTesting.value = true
  try {
    await scriptManager.runScript()
    const runtimer = await scriptManager.getRuntimer()
    refreshScript()
    if (!runtimer.DataReceiverInterface) {
      addTestLog('未找到 DataReceiver 或 onDataReceived 方法')
      return
    }
    const input = new TextEncoder().encode(testInput.value)
    const result = await runtimer.DataReceiverInterface(input)
    if (result instanceof Uint8Array) {
      addTestLog(`接收测试完成，输出 HEX：${bytesToHex(result)}`)
    } else {
      addTestLog(`接收测试完成，输出：${String(result)}`)
    }
  } catch (error) {
    addTestLog(`接收测试失败：${error instanceof Error ? error.message : String(error)}`)
  } finally {
    isTesting.value = false
  }
}

const clearTestLogs = () => {
  testLogs.value = []
}

const createEditor = async () => {
  await nextTick()
  if (editor.value) {
    editor.value.destroy()
    editor.value = null
  }
  if (editorContainer.value) {
    const startState = EditorState.create({
      doc: currentScript.value.code,
      extensions: [
        keymap.of(defaultKeymap),
        keymap.of([indentWithTab]),
        syntaxHighlighting(isDark.value ? oneDarkHighlightStyle : defaultHighlightStyle),
        javascript(),
        isDark.value ? oneDark : [],
        lineNumbers(),
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            currentScript.value.code = update.state.doc.toString()
            scriptManager.updateScript({ code: currentScript.value.code })
          }
        })
      ]
    })

    editor.value = new EditorView({
      state: startState,
      parent: editorContainer.value
    })
  }
}

onMounted(() => {
  createEditor()
  workspaceManager.onWorkspaceChange(() => {
    refreshScript()
    editorSetValue(currentScript.value.code)
  })
})

onUnmounted(() => {
  if (editor.value) {
    editor.value.destroy()
    editor.value = null
  }
})

watch(isDark, () => {
  createEditor()
})
</script>

<template>
  <div class="serial-script" :class="{ embedded: props.embedded }">
    <div class="script-toolbar">
      <el-input
        size="small"
        v-model="currentScript.name"
        placeholder="脚本名称"
        class="script-name-input"
        @change="scriptManager.updateScript({ name: currentScript.name })"
      />
      <el-tag :type="statusType" size="small">{{ statusText }}</el-tag>
      <el-button
        :type="currentScript.isRunning ? 'success' : 'primary'"
        size="small"
        @click="runScript()"
        class="run-button"
      >
        {{ currentScript.isRunning ? '停止' : '运行' }}
      </el-button>

    </div>

    <div class="editor-container" ref="editorContainer" :style="{ height: props.editorHeight }" />

    <div class="script-test-panel">
      <div class="test-panel-title">脚本测试</div>
      <el-input
        v-model="testInput"
        type="textarea"
        :rows="3"
        placeholder="输入模拟接收数据，例如 pitch:1.20,roll:3.40,yaw:5.60"
      />
      <div class="test-actions">
        <el-button size="small" type="primary" :loading="isTesting" @click="runReceiveTest">
          模拟接收测试
        </el-button>
        <el-button size="small" @click="clearTestLogs">清空日志</el-button>
      </div>
      <div class="test-log-list">
        <div v-if="testLogs.length === 0" class="empty-test-log">暂无测试日志</div>
        <div v-for="log in testLogs" :key="log" class="test-log-item">{{ log }}</div>
      </div>
    </div>

    <div class="script-api-guide">
      <div class="api-guide-title">脚本编写帮助</div>
      <div class="api-guide-grid">
        <div class="api-guide-card">
          <div class="api-name">sendText(text)</div>
          <div class="api-desc">发送文本到当前设备，适合调试 AT 指令、换行协议和普通字符串。</div>
        </div>
        <div class="api-guide-card">
          <div class="api-name">sendHex(hex)</div>
          <div class="api-desc">发送 HEX 字符串或 Uint8Array，适合二进制协议、帧头帧尾和校验包。</div>
        </div>
        <div class="api-guide-card">
          <div class="api-name">sleep(ms)</div>
          <div class="api-desc">等待指定毫秒数，可用于分步骤发送指令或模拟设备响应间隔。</div>
        </div>
        <div class="api-guide-card">
          <div class="api-name">updateDataTable(data)</div>
          <div class="api-desc">把解析后的对象写入数据表，例如 { pitch: 1.2, roll: 3.4 }。</div>
        </div>
        <div class="api-guide-card wide">
          <div class="api-name">DataReceiver(data) / onDataReceived(data)</div>
          <div class="api-desc">处理设备接收数据。参数是 Uint8Array，返回处理后的 Uint8Array；可在上方“模拟接收测试”里验证。</div>
        </div>
        <div class="api-guide-card wide">
          <div class="api-name">DataSender(data) / onDataSend(data)</div>
          <div class="api-desc">处理即将发送的数据。可用于自动补协议头、追加校验位或转换数据格式。</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.serial-script {
  margin: 10px;
  min-width: 300px;
}

.serial-script.embedded {
  margin: 0;
  min-width: 0;
}

.script-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.script-name-input {
  flex: 1;
}

.run-button {
  flex-shrink: 0;
}

.editor-container {
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  overflow: auto;
}

.editor-container :deep(.cm-editor) {
  height: 100%;
}

.editor-container :deep(.cm-scroller) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

.script-test-panel {
  margin-top: 12px;
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
}

.test-panel-title {
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.test-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.test-log-list {
  margin-top: 8px;
  max-height: 120px;
  overflow: auto;
  font-size: 12px;
}

.empty-test-log {
  color: var(--el-text-color-secondary);
}

.test-log-item {
  padding: 4px 0;
  border-bottom: 1px dashed var(--el-border-color-lighter);
  color: var(--el-text-color-regular);
}

.script-api-guide {
  margin-top: 12px;
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-fill-color-blank);
}

.api-guide-title {
  margin-bottom: 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.api-guide-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.api-guide-card {
  padding: 8px;
  border-radius: 5px;
  background: var(--el-fill-color-lighter);
}

.api-guide-card.wide {
  grid-column: span 2;
}

.api-name {
  margin-bottom: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-color-primary);
}

.api-desc {
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-regular);
}
</style>
