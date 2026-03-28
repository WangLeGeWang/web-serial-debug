<script setup lang="ts">
import { onMounted } from 'vue'
import { useDataSeriesStore } from '@/store/dataSeriesStore'
import { usePlaybackStore } from '@/store/playbackStore'
import { setDataSourceProvider, createRealtimeProvider } from '@/utils/RealtimeProvider'
import { createPlaybackProviderFromSeries } from '@/utils/PlaybackProvider'
import { PlaybackController } from '@/utils/PlaybackController'

const emit = defineEmits<{
  close: []
}>()

const dataSeriesStore = useDataSeriesStore()
const playbackStore = usePlaybackStore()

onMounted(() => {
  dataSeriesStore.loadSeriesList()
})

function formatTime(ms: number) {
  const date = new Date(ms)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function handlePlayback(seriesId: string) {
  const series = dataSeriesStore.seriesList.find(s => s.id === seriesId)
  if (!series) return

  playbackStore.setActiveSeries(series)
  
  const provider = await createPlaybackProviderFromSeries(series, playbackStore.windowDuration)
  setDataSourceProvider(provider)
  
  const controller = new PlaybackController({
    startTime: series.startTime,
    endTime: series.endTime,
    windowDuration: playbackStore.windowDuration,
    onTick: (time) => {
      playbackStore.currentTime = time
    }
  })
  
  playbackStore.setPlaying(true)
  controller.play()
  
  emit('close')
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
    console.error('Export failed:', error)
  }
}

function handleDelete(seriesId: string) {
  dataSeriesStore.deleteSeries(seriesId)
}

function handleClose() {
  emit('close')
}
</script>

<template>
  <el-drawer
    title="历史数据系列"
    direction="rtl"
    size="400px"
    @close="handleClose"
  >
    <div class="series-manager">
      <div class="manager-header">
        <el-button type="primary" @click="$emit('close')">
          + 保存当前数据
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
          <div class="series-actions">
            <el-button size="small" type="primary" @click="handlePlayback(series.id)">
              回放
            </el-button>
            <el-button size="small" @click="handleExport(series.id)">
              导出
            </el-button>
            <el-button size="small" type="danger" @click="handleDelete(series.id)">
              删除
            </el-button>
          </div>
        </div>
        
        <div v-if="dataSeriesStore.seriesList.length === 0" class="empty-state">
          <el-empty description="暂无保存的历史数据">
            <el-button type="primary" @click="$emit('close')">
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
  padding: 16px;
  border-bottom: 1px solid var(--el-border-color);
}
.series-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}
.series-item {
  padding: 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  margin-bottom: 12px;
}
.series-name {
  font-weight: bold;
  margin-bottom: 4px;
}
.series-info {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
}
.series-actions {
  display: flex;
  gap: 8px;
}
.empty-state {
  padding: 40px 0;
}
</style>
