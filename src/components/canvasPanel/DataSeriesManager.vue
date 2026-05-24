<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useDataSeriesStore } from '../../store/dataSeriesStore'
import { useDataSourceFromPlaybackStore } from '@/runtime/source/useDataSourceFromPlaybackStore'

const props = withDefaults(defineProps<{
  visible?: boolean
}>(), {
  visible: false
})

const emit = defineEmits<{
  close: []
  playback: [seriesId: string]
}>()

const dataSeriesStore = useDataSeriesStore()
const ds = useDataSourceFromPlaybackStore()

const isSaving = ref(false)

const drawerVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => {
    if (!value) emit('close')
  }
})

// TODO(Task 21): 录制 API 落地后，realtime 模式应能保存完整 buffer，而不止 window 内数据
const currentDataPoints = computed(() => ds.visibleData)
const currentFields = computed(() => ds.fields)

const canSaveCurrentData = computed(() => currentDataPoints.value.length > 0 && currentFields.value.length > 0)

onMounted(() => {
  dataSeriesStore.loadSeriesList()
})

function formatTime(ms: number) {
  const date = new Date(ms)
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getDefaultSeriesName() {
  const date = new Date()
  const dateText = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`
  return `${ds.mode === 'realtime' ? '实时数据' : '回放片段'} ${dateText}`
}

async function handleSaveCurrentData() {
  if (!canSaveCurrentData.value) {
    ElMessage.warning('当前还没有可保存的数据')
    return
  }

  try {
    const result = await ElMessageBox.prompt('保存后可在 Playback 模式中选择并回放这段数据', '保存当前数据', {
      inputValue: getDefaultSeriesName(),
      inputPlaceholder: '请输入数据名称',
      confirmButtonText: '保存',
      cancelButtonText: '取消',
      inputValidator: (value) => Boolean(value.trim()),
      inputErrorMessage: '名称不能为空'
    })

    const name = result.value.trim()
    const points = currentDataPoints.value.map(point => ({
      timestamp: point.timestamp,
      values: { ...point.values }
    }))
    const fields = [...currentFields.value]

    isSaving.value = true
    await dataSeriesStore.saveSeries(name, points, fields)
    ElMessage.success(`已保存 ${points.length.toLocaleString()} 个数据点`)
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error('保存数据失败')
    }
  } finally {
    isSaving.value = false
  }
}

function handlePlayback(seriesId: string) {
  emit('playback', seriesId)
}

async function handleExport(seriesId: string) {
  try {
    const ndjson = await dataSeriesStore.exportSeries(seriesId)
    const blob = new Blob([ndjson], { type: 'application/x-ndjson' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `data-${seriesId}.wssd`
    a.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    ElMessage.error('导出数据失败')
  }
}

async function handleDelete(seriesId: string) {
  const series = dataSeriesStore.seriesList.find(s => s.id === seriesId)
  if (!series) return

  try {
    await ElMessageBox.confirm(`确定删除“${series.name}”吗？删除后不可恢复。`, '删除历史数据', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await dataSeriesStore.deleteSeries(seriesId)
    ElMessage.success('已删除')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error('删除数据失败')
    }
  }
}

function handleClose() {
  emit('close')
}
</script>

<template>
  <el-drawer
    v-model="drawerVisible"
    title="历史数据"
    direction="rtl"
    size="420px"
    @close="handleClose"
  >
    <div class="series-manager">
      <div class="manager-header">
        <div>
          <div class="header-title">保存当前数据</div>
          <div class="header-subtitle">
            当前可保存 {{ currentDataPoints.length.toLocaleString() }} 点 · {{ currentFields.length }} 字段
          </div>
        </div>
        <el-button
          type="primary"
          :loading="isSaving"
          :disabled="!canSaveCurrentData"
          @click="handleSaveCurrentData"
        >
          保存
        </el-button>
      </div>
      
      <div class="series-list">
        <div
          v-for="series in dataSeriesStore.seriesList"
          :key="series.id"
          class="series-item"
        >
          <div class="series-name">{{ series.name }}</div>
          <div class="series-info">
            {{ formatTime(series.startTime) }} ~ {{ formatTime(series.endTime) }} ·
            {{ series.pointCount.toLocaleString() }} 点 ·
            {{ formatSize(series.sizeBytes) }}
          </div>
          <div class="series-fields">
            {{ series.fields.join('、') }}
          </div>
          <div class="series-actions">
            <el-button size="small" type="primary" @click="handlePlayback(series.id)">
              回放
            </el-button>
            <el-button size="small" @click="handleExport(series.id)">
              导出
            </el-button>
            <el-button size="small" type="danger" plain @click="handleDelete(series.id)">
              删除
            </el-button>
          </div>
        </div>
        
        <div v-if="dataSeriesStore.seriesList.length === 0" class="empty-state">
          <el-empty description="暂无保存的历史数据">
            <el-button type="primary" :disabled="!canSaveCurrentData" @click="handleSaveCurrentData">
              保存当前数据
            </el-button>
          </el-empty>
        </div>
      </div>
    </div>
  </el-drawer>
</template>

<style scoped lang="less">
.series-manager {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.manager-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  background: var(--el-fill-color-extra-light);
}

.header-title {
  color: var(--el-text-color-primary);
  font-size: 14px;
  font-weight: 600;
}

.header-subtitle {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.series-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px 0 0;
}

.series-item {
  padding: 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  margin-bottom: 12px;
  background: var(--el-bg-color-overlay);
}

.series-name {
  margin-bottom: 4px;
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-weight: 600;
}

.series-info,
.series-fields {
  overflow: hidden;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.series-fields {
  margin-bottom: 10px;
}

.series-actions {
  display: flex;
  gap: 8px;
}

.empty-state {
  padding: 40px 0;
}
</style>
