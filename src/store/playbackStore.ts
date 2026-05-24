import { defineStore } from 'pinia'
import { ref, computed, onScopeDispose } from 'vue'
import type { PlaybackSpeed, PlaybackDirection, LoopMode } from '@/utils/PlaybackController'
import type { DataSeries } from '@/utils/DataSeriesStorage'
import type { DataQuery } from '@/runtime/data/types'
import type { DataSourceMode } from '@/runtime/source/DataSourceProvider'
import { WorkspaceManagerInst } from '@/utils/ProfileManager'

const DEFAULT_NAMESPACE = 'default'

function resolveActiveNamespace(): string {
  const ws = WorkspaceManagerInst.activeWorkspace
  const ns = ws?.config?.namespace
  return typeof ns === 'string' && ns.length > 0 ? ns : DEFAULT_NAMESPACE
}

export const usePlaybackStore = defineStore('playback', () => {
  const mode = ref<DataSourceMode>('realtime')
  const isPlaying = ref(false)
  const currentTime = ref(0)
  const speed = ref<PlaybackSpeed>(1)
  const direction = ref<PlaybackDirection>(1)
  const loopMode = ref<LoopMode>('none')
  const activeSeries = ref<DataSeries | null>(null)
  const windowDuration = ref(30000)
  const activeQuery = ref<DataQuery>({ namespace: resolveActiveNamespace() })
  const historyTimeRange = ref<[number, number] | null>(null)

  const unsubscribeWorkspace = WorkspaceManagerInst.onWorkspaceChange(() => {
    activeQuery.value = { ...activeQuery.value, namespace: resolveActiveNamespace() }
  })
  onScopeDispose(() => {
    unsubscribeWorkspace()
  })

  const isActive = computed(() => mode.value !== 'realtime')

  const currentTimeFormatted = computed(() => {
    if (!activeSeries.value) return '00:00'
    const ms = currentTime.value - activeSeries.value.startTime
    const totalSeconds = Math.floor(Math.max(0, ms) / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  })

  const totalDuration = computed(() => {
    if (!activeSeries.value) return 0
    return activeSeries.value.endTime - activeSeries.value.startTime
  })

  const totalDurationFormatted = computed(() => {
    const ms = totalDuration.value
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  })

  const progress = computed(() => {
    if (!activeSeries.value || totalDuration.value === 0) return 0
    const p = (currentTime.value - activeSeries.value.startTime) / totalDuration.value
    return Math.max(0, Math.min(1, p))
  })

  function setMode(m: DataSourceMode) {
    mode.value = m
  }

  function setQuery(q: DataQuery) {
    activeQuery.value = { ...q }
  }

  function setHistoryTimeRange(range: [number, number] | null) {
    if (mode.value === 'realtime' && range !== null) return
    historyTimeRange.value = range
  }

  function setActiveSeries(series: DataSeries | null) {
    activeSeries.value = series
    if (series) {
      mode.value = 'history'
      currentTime.value = series.startTime
      historyTimeRange.value = [series.startTime - windowDuration.value, series.startTime]
    } else {
      mode.value = 'realtime'
      currentTime.value = 0
      historyTimeRange.value = null
    }
  }

  function togglePlay() {
    isPlaying.value = !isPlaying.value
  }

  function setPlaying(playing: boolean) {
    isPlaying.value = playing
  }

  function seek(progressPercent: number) {
    if (!activeSeries.value) return
    const clamped = Math.max(0, Math.min(1, progressPercent))
    const targetTime = activeSeries.value.startTime + totalDuration.value * clamped
    currentTime.value = targetTime
    historyTimeRange.value = [targetTime - windowDuration.value, targetTime]
  }

  function seekToTime(time: number) {
    if (!activeSeries.value) return
    const clamped = Math.max(activeSeries.value.startTime, Math.min(activeSeries.value.endTime, time))
    currentTime.value = clamped
    historyTimeRange.value = [clamped - windowDuration.value, clamped]
  }

  function setSpeed(s: PlaybackSpeed) {
    speed.value = s
  }

  function setDirection(d: PlaybackDirection) {
    direction.value = d
  }

  function setLoopMode(m: LoopMode) {
    loopMode.value = m
  }

  function setWindowDuration(duration: number) {
    windowDuration.value = duration
    if (mode.value !== 'realtime' && activeSeries.value) {
      historyTimeRange.value = [currentTime.value - duration, currentTime.value]
    }
  }

  function stepForward(ms: number = 5000) {
    seekToTime(currentTime.value + ms)
  }

  function stepBackward(ms: number = 5000) {
    seekToTime(currentTime.value - ms)
  }

  function goToStart() {
    if (activeSeries.value) {
      seekToTime(activeSeries.value.startTime)
    }
  }

  function goToEnd() {
    if (activeSeries.value) {
      seekToTime(activeSeries.value.endTime)
    }
  }

  return {
    mode,
    isActive,
    isPlaying,
    currentTime,
    speed,
    direction,
    loopMode,
    activeSeries,
    windowDuration,
    activeQuery,
    historyTimeRange,
    currentTimeFormatted,
    totalDuration,
    totalDurationFormatted,
    progress,
    setMode,
    setQuery,
    setHistoryTimeRange,
    setActiveSeries,
    togglePlay,
    setPlaying,
    seek,
    seekToTime,
    setSpeed,
    setDirection,
    setLoopMode,
    setWindowDuration,
    stepForward,
    stepBackward,
    goToStart,
    goToEnd
  }
})
