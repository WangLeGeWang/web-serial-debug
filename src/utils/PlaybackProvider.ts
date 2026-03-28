import { ref, computed, watch } from 'vue'
import type { DataPoint, DataSourceProvider } from './DataSourceProvider'
import { dataSeriesStorage } from './DataSeriesStorage'
import type { DataSeries } from './DataSeriesStorage'

const CHUNK_SIZE = 10000
const PREFETCH_THRESHOLD = 0.2

export interface PlaybackProviderOptions {
  seriesData?: DataPoint[]
  seriesId?: string
  fields: string[]
  startTime: number
  endTime: number
  windowDuration?: number
}

export function createPlaybackProvider(options: PlaybackProviderOptions): DataSourceProvider {
  const { seriesData = [], seriesId, fields, startTime, endTime, windowDuration = 30000 } = options
  const currentTime = ref(startTime)
  const allData = ref<DataPoint[]>(seriesData)
  const loadedChunks = ref<Map<number, DataPoint[]>>(new Map())
  const isLoading = ref(false)

  async function loadChunk(chunkIndex: number): Promise<DataPoint[]> {
    if (loadedChunks.value.has(chunkIndex)) {
      return loadedChunks.value.get(chunkIndex)!
    }
    if (!seriesId) return []

    isLoading.value = true
    try {
      const points = await dataSeriesStorage.loadChunk(seriesId, chunkIndex)
      loadedChunks.value.set(chunkIndex, points)
      return points
    } finally {
      isLoading.value = false
    }
  }

  async function ensureChunksForTime(time: number): Promise<void> {
    if (!seriesId || allData.value.length > 0) return

    const totalChunks = Math.ceil((endTime - startTime) / CHUNK_SIZE / (endTime - startTime) * 10000) || 1
    const currentChunk = Math.floor((time - startTime) / CHUNK_SIZE)

    await Promise.all([
      loadChunk(currentChunk),
      currentChunk > 0 ? loadChunk(currentChunk - 1) : Promise.resolve([]),
      currentChunk < totalChunks - 1 ? loadChunk(currentChunk + 1) : Promise.resolve([])
    ])
  }

  const timeRange = computed(() => {
    return [currentTime.value - windowDuration, currentTime.value] as [number, number]
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
    get mode() { return 'playback' }
  }

  return provider
}

export async function createPlaybackProviderFromSeries(
  series: DataSeries,
  windowDuration: number = 30000
): Promise<DataSourceProvider> {
  const currentTime = ref(series.startTime)
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
    return [currentTime.value - windowDuration, currentTime.value] as [number, number]
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

  return {
    get visibleData() { return visibleData.value },
    get fields() { return series.fields },
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
