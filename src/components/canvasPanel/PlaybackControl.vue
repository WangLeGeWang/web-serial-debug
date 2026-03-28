<script setup lang="ts">
import { computed, watch, onMounted, onUnmounted } from 'vue'
import { usePlaybackStore } from '@/store/playbackStore'
import { useDataSeriesStore } from '@/store/dataSeriesStore'
import { setDataSourceProvider, createRealtimeProvider } from '@/utils/RealtimeProvider'
import { createPlaybackProviderFromSeries } from '@/utils/PlaybackProvider'
import { PlaybackController } from '@/utils/PlaybackController'
import type { PlaybackSpeed } from '@/utils/PlaybackController'
import type { DataSeries } from '@/utils/DataSeriesStorage'

const emit = defineEmits<{
  openManager: []
}>()

const playbackStore = usePlaybackStore()
const dataSeriesStore = useDataSeriesStore()

let controller: PlaybackController | null = null

const isRealtime = computed({
  get: () => !playbackStore.isActive,
  set: (val) => {
    if (val) {
      playbackStore.setActiveSeries(null)
      setDataSourceProvider(createRealtimeProvider())
    }
  }
})

const seriesOptions = computed(() => 
  dataSeriesStore.seriesList.map(s => ({
    value: s.id,
    label: s.name
  }))
)

const speedOptions = [
  { value: 0.1, label: '0.1x' },
  { value: 0.5, label: '0.5x' },
  { value: 1, label: '1x' },
  { value: 2, label: '2x' },
  { value: 5, label: '5x' },
  { value: 10, label: '10x' }
]

async function handleSeriesChange(seriesId: string) {
  const series = dataSeriesStore.seriesList.find(s => s.id === seriesId)
  if (!series) return

  playbackStore.setActiveSeries(series)
  
  const provider = await createPlaybackProviderFromSeries(series, playbackStore.windowDuration)
  setDataSourceProvider(provider)
  
  controller = new PlaybackController({
    startTime: series.startTime,
    endTime: series.endTime,
    windowDuration: playbackStore.windowDuration,
    onTick: (time) => {
      playbackStore.currentTime = time
    }
  })
}

function handleSeek(e: number | number[]) {
  const value = Array.isArray(e) ? e[0] : e
  playbackStore.seek(value / 100)
}

function handleSpeedChange(speed: number) {
  playbackStore.setSpeed(speed as PlaybackSpeed)
  if (controller) {
    controller.setSpeed(speed as PlaybackSpeed)
  }
}

function handlePlayPause() {
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
  playbackStore.stepBackward(5000)
  if (controller) {
    controller.seekRelative(-5000)
  }
}

function handleStepForward() {
  playbackStore.stepForward(5000)
  if (controller) {
    controller.seekRelative(5000)
  }
}

function handleGoToStart() {
  playbackStore.goToStart()
  if (controller) {
    controller.seek(playbackStore.activeSeries!.startTime)
  }
}

function handleGoToEnd() {
  playbackStore.goToEnd()
  if (controller) {
    controller.seek(playbackStore.activeSeries!.endTime)
  }
}

function handleSaveCurrent() {
  emit('openManager')
}

function handleKeydown(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
  
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
    case 'Digit6':
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

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  dataSeriesStore.loadSeriesList()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  controller?.destroy()
})

watch(() => playbackStore.isPlaying, (playing) => {
  if (controller && playing) {
    controller.play()
  } else if (controller) {
    controller.pause()
  }
})
</script>

<template>
  <div class="playback-control">
    <div class="control-header">
      <el-switch
        v-model="isRealtime"
        active-text="实时"
        inactive-text="回放"
      />
      <el-select
        v-if="playbackStore.isActive"
        :model-value="playbackStore.activeSeries?.id"
        placeholder="选择历史系列"
        @change="handleSeriesChange"
      >
        <el-option
          v-for="s in seriesOptions"
          :key="s.value"
          :label="s.label"
          :value="s.value"
        />
      </el-select>
      <el-button v-if="playbackStore.isActive" @click="handleSaveCurrent">
        保存当前
      </el-button>
      <el-button @click="$emit('openManager')">
        管理
      </el-button>
    </div>
    <div v-if="playbackStore.isActive" class="control-body">
      <div class="playback-info">
        <span class="series-name">{{ playbackStore.activeSeries?.name }}</span>
      </div>
      <div class="playback-buttons">
        <el-button :icon="'DArrowLeft'" circle @click="handleGoToStart" />
        <el-button @click="handleStepBack">-5s</el-button>
        <el-button 
          :icon="playbackStore.isPlaying ? 'VideoPause' : 'VideoPlay'" 
          circle
          @click="handlePlayPause" 
        />
        <el-button @click="handleStepForward">+5s</el-button>
        <el-button :icon="'DArrowRight'" circle @click="handleGoToEnd" />
      </div>
      <div class="progress-bar">
        <span class="time-text">{{ playbackStore.currentTimeFormatted }}</span>
        <el-slider
          :model-value="playbackStore.progress * 100"
          @input="handleSeek"
        />
        <span class="time-text">{{ playbackStore.totalDurationFormatted }}</span>
        <el-select
          :model-value="playbackStore.speed"
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
    </div>
    <div v-else class="control-empty">
      <span>接收实时数据中...</span>
    </div>
  </div>
</template>

<style scoped lang="less">
.playback-control {
  height: 100px;
  padding: 8px;
  border-top: 1px solid var(--el-border-color);
  background: var(--el-bg-color);
}
.control-header {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 36px;
}
.control-body {
  margin-top: 8px;
}
.playback-info {
  margin-bottom: 8px;
}
.series-name {
  font-weight: bold;
}
.playback-buttons {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 8px;
}
.progress-bar {
  display: flex;
  align-items: center;
  gap: 12px;
}
.time-text {
  min-width: 50px;
  font-size: 12px;
  text-align: center;
}
.control-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  color: var(--el-text-color-secondary);
}
</style>
