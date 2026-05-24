import { ref, computed } from 'vue'
import { getDataHub } from '@/runtime/data/DataHub'
import type { DataQuery, DataPoint, DataFrame } from '@/runtime/data/types'

export type DataSourceMode = 'realtime' | 'history' | 'playback'

export interface DataSourceProvider {
  readonly mode: DataSourceMode
  readonly visibleData: DataPoint[]
  readonly fields: string[]
  readonly timeRange: [number, number] | null
  setQuery(q: DataQuery): void
  setMode(mode: DataSourceMode): void
  setTimeRange(range: [number, number]): void
  setWindowDuration(ms: number): void
  destroy(): void
}

const DEFAULT_WINDOW_MS = 30_000

export function createDataSource(
  initialQuery: DataQuery,
  initialMode: DataSourceMode = 'realtime'
): DataSourceProvider {
  let query: DataQuery = { ...initialQuery }
  let mode: DataSourceMode = initialMode
  let windowMs = DEFAULT_WINDOW_MS
  let timeRange: [number, number] | null = null
  let unsub: (() => void) | null = null

  const points = ref<DataPoint[]>([])
  const fieldSet = ref<Set<string>>(new Set())

  function applyFrame(frame: DataFrame): void {
    const numeric: Record<string, number> = {}
    for (const [k, v] of Object.entries(frame.values)) {
      if (typeof v === 'number') {
        numeric[k] = v
        fieldSet.value.add(k)
      }
    }
    if (Object.keys(numeric).length === 0) return
    points.value.push({ timestamp: frame.timestamp, values: numeric })
  }

  function reset(): void {
    points.value = []
    fieldSet.value = new Set()
  }

  function startRealtime(): void {
    reset()
    unsub = getDataHub().subscribe(query, applyFrame)
  }

  function startHistory(): void {
    reset()
    if (!timeRange) return
    getDataHub().queryHistory({ ...query, timeRange })
      .then((res) => {
        points.value = res
        const fs = new Set<string>()
        res.forEach((p) => Object.keys(p.values).forEach((k) => fs.add(k)))
        fieldSet.value = fs
      })
      .catch(() => { points.value = [] })
  }

  function teardown(): void {
    if (unsub) { unsub(); unsub = null }
  }

  function init(): void {
    teardown()
    if (mode === 'realtime') startRealtime()
    else if (mode === 'history') startHistory()
    // 'playback' 在 Task 14 / PlaybackController 对接时实现
  }

  init()

  const visible = computed<DataPoint[]>(() => {
    if (mode !== 'realtime') return points.value
    if (points.value.length === 0) return []
    const last = points.value[points.value.length - 1].timestamp
    const from = last - windowMs
    return points.value.filter((p) => p.timestamp >= from)
  })

  const fieldList = computed<string[]>(() => Array.from(fieldSet.value))

  const tr = computed<[number, number] | null>(() => {
    if (mode === 'realtime') {
      if (points.value.length === 0) return null
      const last = points.value[points.value.length - 1].timestamp
      return [last - windowMs, last]
    }
    return timeRange
  })

  return {
    get mode() { return mode },
    get visibleData() { return visible.value },
    get fields() { return fieldList.value },
    get timeRange() { return tr.value },
    setQuery(q) { query = { ...q }; init() },
    setMode(m) { mode = m; init() },
    setTimeRange(r) { timeRange = r; if (mode === 'history') init() },
    setWindowDuration(ms) { windowMs = ms },
    destroy() { teardown() }
  }
}
