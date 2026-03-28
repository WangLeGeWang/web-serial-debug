import { ref, computed } from 'vue'
import type { DataPoint, DataSourceProvider } from './DataSourceProvider'

export interface PlaybackProviderOptions {
  seriesData: DataPoint[]
  fields: string[]
  startTime: number
  endTime: number
  windowDuration?: number
}

export function createPlaybackProvider(options: PlaybackProviderOptions): DataSourceProvider {
  const { seriesData, fields, startTime, endTime, windowDuration = 30000 } = options
  const currentTime = ref(startTime)

  const timeRange = computed(() => {
    return [currentTime.value - windowDuration, currentTime.value] as [number, number]
  })

  const visibleData = computed(() => {
    const [start, end] = timeRange.value
    return seriesData.filter(point =>
      point.timestamp >= start && point.timestamp <= end
    )
  })

  return {
    get visibleData() { return visibleData.value },
    get fields() { return fields },
    get timeRange() { return timeRange.value },
    get mode() { return 'playback' }
  }
}

export const playbackProvider = {
  currentTime: ref(0),
  setCurrentTime(t: number) {
    this.currentTime.value = t
  }
}
