<script setup lang="ts">
import { computed, watch, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { usePlaybackStore } from '../../store/playbackStore'
import { useDataSeriesStore } from '../../store/dataSeriesStore'
import { PlaybackController } from '../../utils/PlaybackController'
import type { PlaybackSpeed } from '../../utils/PlaybackController'

const emit = defineEmits<{
  openManager: []
}>()

const playbackStore = usePlaybackStore()
const dataSeriesStore = useDataSeriesStore()

let controller: PlaybackController | null = null

const liveRangeOptions = [
  { value: 10000, label: 'Last 10s' },
  { value: 30000, label: 'Last 30s' },
  { value: 60000, label: 'Last 1m' },
  { value: 300000, label: 'Last 5m' }
]

const speedOptions = [
  { value: 0.1, label: '0.1x' },
  { value: 0.5, label: '0.5x' },
  { value: 1, label: '1x' },
  { value: 2, label: '2x' },
  { value: 5, label: '5x' },
  { value: 10, label: '10x' }
]

const seriesOptions = computed(() =>
  dataSeriesStore.seriesList.map(s => ({
    value: s.id,
    label: s.name
  }))
)

const rangeText = computed(() => `${playbackStore.currentTimeFormatted} / ${playbackStore.totalDurationFormatted}`)
const displayTitle = computed(() => playbackStore.activeSeries?.name || '未选择历史数据')
const liveRangeLabel = computed(() => liveRangeOptions.find(opt => opt.value === playbackStore.windowDuration)?.label || `${Math.round(playbackStore.windowDuration / 1000)}s`)
const pickerTitle = computed(() => {
  if (!playbackStore.isActive) return `Live · ${liveRangeLabel.value}`
  return `History · ${displayTitle.value}`
})
const pickerSubtitle = computed(() => playbackStore.isActive ? `${rangeText.value} · ${playbackStore.speed}x` : '实时数据窗口')

function stopController() {
  controller?.destroy()
  controller = null
}

function switchToLive() {
  stopController()
  playbackStore.setPlaying(false)
  playbackStore.setActiveSeries(null)
}

async function switchToPlayback() {
  if (playbackStore.activeSeries) {
    await handleSeriesChange(playbackStore.activeSeries.id)
    return
  }

  const firstSeries = dataSeriesStore.seriesList[0]
  if (firstSeries) {
    await handleSeriesChange(firstSeries.id)
    return
  }

  ElMessage.info('请先保存或选择历史数据')
  emit('openManager')
}

function handleLiveRangeChange(duration: number) {
  playbackStore.setWindowDuration(duration)
}

async function handleSeriesChange(seriesId: string) {
  const series = dataSeriesStore.seriesList.find(s => s.id === seriesId)
  if (!series) return

  playbackStore.setPlaying(false)
  playbackStore.setActiveSeries(series)

  stopController()
  controller = new PlaybackController({
    startTime: series.startTime,
    endTime: series.endTime,
    windowDuration: playbackStore.windowDuration,
    onTick: (time) => {
      playbackStore.seekToTime(time)
    }
  })
}

function handleSeek(e: number | number[]) {
  const value = Array.isArray(e) ? e[0] : e
  playbackStore.seek(value / 100)
  if (controller) {
    controller.seek(playbackStore.currentTime)
  }
}

function handleSpeedChange(speed: number) {
  playbackStore.setSpeed(speed as PlaybackSpeed)
  if (controller) {
    controller.setSpeed(speed as PlaybackSpeed)
  }
}

function handlePlayPause() {
  if (!playbackStore.isActive) return
  playbackStore.togglePlay()
  if (controller) {
    if (playbackStore.isPlaying) {
      controller.play()
    } else {
      controller.pause()
    }
  }
}

function handleStepBack() {
  if (!playbackStore.isActive) return
  playbackStore.stepBackward(5000)
  if (controller) {
    controller.seek(playbackStore.currentTime)
  }
}

function handleStepForward() {
  if (!playbackStore.isActive) return
  playbackStore.stepForward(5000)
  if (controller) {
    controller.seek(playbackStore.currentTime)
  }
}

function handleGoToStart() {
  if (!playbackStore.isActive) return
  playbackStore.goToStart()
  if (controller) {
    controller.seek(playbackStore.currentTime)
  }
}

function handleGoToEnd() {
  if (!playbackStore.isActive) return
  playbackStore.goToEnd()
  if (controller) {
    controller.seek(playbackStore.currentTime)
  }
}

function handleOpenManager() {
  emit('openManager')
}

function handleKeydown(e: KeyboardEvent) {
  if (!playbackStore.isActive) return
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLButtonElement) return

  switch (e.code) {
    case 'Space':
      e.preventDefault()
      handlePlayPause()
      break
    case 'ArrowLeft':
      e.preventDefault()
      handleStepBack()
      break
    case 'ArrowRight':
      e.preventDefault()
      handleStepForward()
      break
    case 'Home':
      e.preventDefault()
      handleGoToStart()
      break
    case 'End':
      e.preventDefault()
      handleGoToEnd()
      break
    case 'Digit1':
    case 'Digit2':
    case 'Digit3':
    case 'Digit4':
    case 'Digit5':
    case 'Digit6': {
      const speeds: PlaybackSpeed[] = [0.1, 0.5, 1, 2, 5, 10]
      const speedIndex = parseInt(e.key) - 1
      if (speedIndex >= 0 && speedIndex < speeds.length) {
        playbackStore.setSpeed(speeds[speedIndex])
        if (controller) {
          controller.setSpeed(speeds[speedIndex])
        }
      }
      break
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  dataSeriesStore.loadSeriesList()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  stopController()
})

watch(() => playbackStore.isPlaying, (playing) => {
  if (controller && playing) {
    controller.play()
  } else if (controller) {
    controller.pause()
  }
})

defineExpose({
  selectSeries: handleSeriesChange
})
</script>

<template>
  <el-popover placement="bottom-end" trigger="click" width="420" popper-class="time-picker-popover">
    <template #reference>
      <el-button class="time-picker-button" size="small">
        <span class="mode-dot" :class="{ 'is-history': playbackStore.isActive }"></span>
        <span class="picker-text">
          <span class="picker-title">{{ pickerTitle }}</span>
          <span class="picker-subtitle">{{ pickerSubtitle }}</span>
        </span>
        <span class="picker-caret">▾</span>
      </el-button>
    </template>

    <div class="time-picker-panel">
      <div class="panel-section">
        <div class="section-label">数据模式</div>
        <el-button-group class="mode-group" aria-label="数据模式">
          <el-button size="small" :type="!playbackStore.isActive ? 'primary' : 'default'" @click="switchToLive">
            Live
          </el-button>
          <el-button size="small" :type="playbackStore.isActive ? 'primary' : 'default'" @click="switchToPlayback">
            History
          </el-button>
        </el-button-group>
      </div>

      <div v-if="!playbackStore.isActive" class="panel-section">
        <div class="section-label">实时窗口</div>
        <div class="range-grid">
          <el-button
            v-for="opt in liveRangeOptions"
            :key="opt.value"
            size="small"
            :type="playbackStore.windowDuration === opt.value ? 'primary' : 'default'"
            @click="handleLiveRangeChange(opt.value)"
          >
            {{ opt.label }}
          </el-button>
        </div>
      </div>

      <template v-else>
        <div class="panel-section">
          <div class="section-label">历史数据</div>
          <el-select
            :model-value="playbackStore.activeSeries?.id"
            size="small"
            placeholder="选择历史数据"
            class="full-control"
            @change="handleSeriesChange"
          >
            <el-option
              v-for="s in seriesOptions"
              :key="s.value"
              :label="s.label"
              :value="s.value"
            />
          </el-select>
        </div>

        <div class="panel-section">
          <div class="playback-header">
            <div>
              <div class="section-label">回放范围</div>
              <div class="time-readout">{{ rangeText }}</div>
            </div>
            <el-select
              :model-value="playbackStore.speed"
              size="small"
              class="speed-control"
              aria-label="播放速度"
              @change="handleSpeedChange"
            >
              <el-option
                v-for="opt in speedOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </div>
          <el-slider
            class="history-slider"
            :model-value="playbackStore.progress * 100"
            :show-tooltip="false"
            aria-label="回放进度"
            @input="handleSeek"
          />
          <div class="playback-actions" role="group" aria-label="回放控制">
            <el-button size="small" @click="handleGoToStart">|◀</el-button>
            <el-button size="small" @click="handleStepBack">−5s</el-button>
            <el-button size="small" type="primary" @click="handlePlayPause">
              {{ playbackStore.isPlaying ? '暂停' : '播放' }}
            </el-button>
            <el-button size="small" @click="handleStepForward">+5s</el-button>
            <el-button size="small" @click="handleGoToEnd">▶|</el-button>
          </div>
        </div>
      </template>

      <div class="panel-footer">
        <el-button size="small" type="primary" plain @click="handleOpenManager">管理历史数据</el-button>
      </div>
    </div>
  </el-popover>
</template>

<style scoped lang="less">
.time-picker-button {
  width: 160px;
  height: 32px;
  justify-content: flex-start;
  padding: 0 8px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 2px;
  background: var(--el-bg-color-overlay);
}

.mode-dot {
  width: 7px;
  height: 7px;
  flex-shrink: 0;
  margin-right: 7px;
  border-radius: 50%;
  background: #73bf69;
  box-shadow: 0 0 0 3px rgba(115, 191, 105, 0.14);
}

.mode-dot.is-history {
  background: #5794f2;
  box-shadow: 0 0 0 3px rgba(87, 148, 242, 0.14);
}

.picker-text {
  min-width: 0;
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.15;
}

.picker-title,
.picker-subtitle {
  max-width: 176px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.picker-title {
  color: var(--el-text-color-primary);
  font-size: 12px;
  font-weight: 500;
}

.picker-subtitle {
  color: var(--el-text-color-secondary);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.picker-caret {
  flex-shrink: 0;
  margin-left: 6px;
  color: var(--el-text-color-secondary);
  font-size: 10px;
}

.time-picker-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.panel-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-label {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.mode-group,
.full-control {
  width: 100%;
}

.mode-group :deep(.el-button) {
  width: 50%;
}

.range-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.playback-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.time-readout {
  margin-top: 3px;
  color: var(--el-text-color-primary);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.speed-control {
  width: 92px;
  flex-shrink: 0;
}

.history-slider {
  padding: 0 4px;
}

:deep(.el-slider__runway) {
  margin: 12px 0;
}

.playback-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.panel-footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 4px;
  border-top: 1px solid var(--el-border-color-lighter);
}

@media (max-width: 1180px) {
  .time-picker-button {
    width: 130px;
  }

  .picker-title,
  .picker-subtitle {
    max-width: 146px;
  }
}
</style>
