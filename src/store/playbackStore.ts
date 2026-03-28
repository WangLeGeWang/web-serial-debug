import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { PlaybackSpeed, PlaybackDirection, LoopMode } from '@/utils/PlaybackController'
import type { DataSeries } from '@/utils/DataSeriesStorage'

export const usePlaybackStore = defineStore('playback', () => {
  const isActive = ref(false)
  const isPlaying = ref(false)
  const currentTime = ref(0)
  const speed = ref<PlaybackSpeed>(1)
  const direction = ref<PlaybackDirection>(1)
  const loopMode = ref<LoopMode>('none')
  const activeSeries = ref<DataSeries | null>(null)
  const windowDuration = ref(30000)

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

  function setActiveSeries(series: DataSeries | null) {
    activeSeries.value = series
    isActive.value = series !== null
    if (series) {
      currentTime.value = series.startTime
    } else {
      currentTime.value = 0
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
  }

  function seekToTime(time: number) {
    if (!activeSeries.value) return
    const clamped = Math.max(activeSeries.value.startTime, Math.min(activeSeries.value.endTime, time))
    currentTime.value = clamped
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
  }

  function stepForward(ms: number = 5000) {
    seekToTime(currentTime.value + ms)
  }

  function stepBackward(ms: number = 5000) {
    seekToTime(currentTime.value - ms)
  }

  function goToStart() {
    if (activeSeries.value) {
      currentTime.value = activeSeries.value.startTime
    }
  }

  function goToEnd() {
    if (activeSeries.value) {
      currentTime.value = activeSeries.value.endTime
    }
  }

  return {
    isActive,
    isPlaying,
    currentTime,
    speed,
    direction,
    loopMode,
    activeSeries,
    windowDuration,
    currentTimeFormatted,
    totalDuration,
    totalDurationFormatted,
    progress,
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
