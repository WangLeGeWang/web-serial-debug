import { ref, computed, watch } from 'vue'
import type { DataPoint, DataSourceProvider } from './DataSourceProvider'
import { dataSeriesStorage } from './DataSeriesStorage'
import type { DataSeries } from './DataSeriesStorage'

const CHUNK_SIZE = 10000

export interface PlaybackProviderOptions {
  seriesData?: DataPoint[]
  seriesId?: string
  fields: string[]
  startTime: number
  endTime: number
  windowDuration?: number
}

export function createPlaybackProvider(options: PlaybackProviderOptions): DataSourceProvider {
  const { seriesData = [], fields, startTime, endTime, windowDuration = 30000 } = options
  const currentTime = ref(startTime)
  const timeWindow = ref(windowDuration)
  const allData = ref<DataPoint[]>(seriesData)
  const timeRange = computed(() => {
    return [currentTime.value - timeWindow.value, currentTime.value] as [number, number]
  })

  const visibleData = computed(() => {
    const [start, end] = timeRange.value
    if (allData.value.length > 0) {
      return allData.value.filter(point =>
        point.timestamp >= start && point.timestamp <= end
      )
    }
    return []
  })

  const provider: DataSourceProvider = {
    get visibleData() { return visibleData.value },
    get fields() { return fields },
    get timeRange() { return timeRange.value },
    get mode() { return 'playback' as const },
    setCurrentTime(time: number) {
      currentTime.value = Math.min(Math.max(time, startTime), endTime)
    },
    setWindowDuration(duration: number) {
      timeWindow.value = duration
    }
  }

  return provider
}

export async function createPlaybackProviderFromSeries(
  series: DataSeries,
  windowDuration: number = 10000
): Promise<DataSourceProvider> {
  const currentTime = ref(series.startTime)
  const timeWindow = ref(windowDuration)
  const loadedChunks = new Map<number, DataPoint[]>()
  const allData: DataPoint[] = []

  const totalChunks = Math.ceil(series.pointCount / CHUNK_SIZE)
  const currentChunkIndex = ref(0)

  async function loadChunk(index: number): Promise<DataPoint[]> {
    if (loadedChunks.has(index)) return loadedChunks.get(index)!
    const points = await dataSeriesStorage.loadChunk(series.id, index)
    loadedChunks.set(index, points)
    allData.push(...points)
    return points
  }

  const timeRange = computed(() => {
    return [currentTime.value - timeWindow.value, currentTime.value] as [number, number]
  })

  const visibleData = computed(() => {
    const [start, end] = timeRange.value
    return allData.filter(p => p.timestamp >= start && p.timestamp <= end)
  })

  watch(currentTime, async (newTime) => {
    const chunkIndex = Math.floor((newTime - series.startTime) / CHUNK_SIZE)
    if (chunkIndex !== currentChunkIndex.value) {
      currentChunkIndex.value = chunkIndex
      await loadChunk(chunkIndex)

      if (chunkIndex > 0 && !loadedChunks.has(chunkIndex - 1)) {
        loadChunk(chunkIndex - 1)
      }
      if (chunkIndex < totalChunks - 1 && !loadedChunks.has(chunkIndex + 1)) {
        loadChunk(chunkIndex + 1)
      }
    }
  }, { immediate: true })

  const provider: DataSourceProvider = {
    get visibleData() { return visibleData.value },
    get fields() { return series.fields },
    get timeRange() { return timeRange.value },
    get mode() { return 'playback' as const },
    setCurrentTime(time: number) {
      currentTime.value = Math.min(Math.max(time, series.startTime), series.endTime)
    },
    setWindowDuration(duration: number) {
      timeWindow.value = duration
    }
  }

  return provider
}

export const playbackProvider = {
  currentTime: ref(0),
  setCurrentTime(t: number) {
    this.currentTime.value = t
  }
}
