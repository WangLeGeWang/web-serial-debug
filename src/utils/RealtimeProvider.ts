import { ref, computed } from 'vue'
import type { DataPoint, DataSourceProvider } from './DataSourceProvider'

const MAX_POINTS = 50000
const WINDOW_DURATION = 30000

const dataPoints = ref<DataPoint[]>([])
const fields = ref<string[]>([])
const isRealtime = ref(true)

const latestTime = computed(() => {
  if (dataPoints.value.length === 0) return Date.now()
  return dataPoints.value[dataPoints.value.length - 1].timestamp
})

const timeRange = computed(() => {
  const latest = latestTime.value
  return [latest - WINDOW_DURATION, latest] as [number, number]
})

const visibleData = computed(() => {
  if (!timeRange.value || dataPoints.value.length === 0) return []
  const [start, end] = timeRange.value
  return dataPoints.value.filter(point =>
    point.timestamp >= start && point.timestamp <= end
  )
})

export function createRealtimeProvider(): DataSourceProvider {
  return {
    get visibleData() { return visibleData.value },
    get fields() { return fields.value },
    get timeRange() { return timeRange.value },
    get mode() { return isRealtime.value ? 'realtime' : 'playback' }
  }
}

export const realtimeProvider = {
  dataPoints,
  fields,
  isRealtime,
  addDataPoint(timestamp: number, values: Record<string, any>) {
    Object.keys(values).forEach(field => {
      if (!fields.value.includes(field)) {
        fields.value.push(field)
      }
    })
    dataPoints.value.push({ timestamp, values })
    if (dataPoints.value.length > MAX_POINTS) {
      dataPoints.value = dataPoints.value.slice(-MAX_POINTS)
    }
  },
  setTimeRange(range: [number, number]) {
    isRealtime.value = false
  },
  toggleRealtime(value: boolean) {
    isRealtime.value = value
  },
  clearData() {
    dataPoints.value = []
    fields.value = []
    isRealtime.value = true
  }
}
