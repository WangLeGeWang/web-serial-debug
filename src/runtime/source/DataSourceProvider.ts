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

/**
 * DataSourceProvider 注意事项：
 * - realtime 模式不再本地累积 points，window 数据直接从 DataHub.getRealtimeWindow 取，
 *   避免与 NamespaceStore.buffer 双重维护造成内存炸弹。订阅回调仅 ++ frameCounter 触发 computed。
 * - DataPoint.values 仅含数值字段（与 NamespaceStore/RealtimeBuffer 一致），
 *   非数值字段（string/boolean）请通过 DataHub.getLatest(query) 获取。
 */
export function createDataSource(
  initialQuery: DataQuery,
  initialMode: DataSourceMode = 'realtime'
): DataSourceProvider {
  let query: DataQuery = { ...initialQuery }
  const mode = ref<DataSourceMode>(initialMode)
  const windowMs = ref<number>(DEFAULT_WINDOW_MS)
  const timeRange = ref<[number, number] | null>(null)
  let unsub: (() => void) | null = null

  const historyPoints = ref<DataPoint[]>([])
  const fieldArr = ref<string[]>([])
  const frameCounter = ref(0)
  const destroyed = ref(false)
  let lastVisible: DataPoint[] = []

  function trackField(k: string): void {
    if (!fieldArr.value.includes(k)) fieldArr.value.push(k)
  }

  function onFrame(frame: DataFrame): void {
    for (const [k, v] of Object.entries(frame.values)) {
      if (typeof v === 'number') trackField(k)
    }
    frameCounter.value++
  }

  function reset(): void {
    historyPoints.value = []
    fieldArr.value = []
    frameCounter.value = 0
  }

  function startRealtime(): void {
    reset()
    unsub = getDataHub().subscribe(query, onFrame)
  }

  function startHistory(): void {
    reset()
    if (!timeRange.value) return
    getDataHub().queryHistory({ ...query, timeRange: timeRange.value })
      .then((res) => {
        historyPoints.value = res
        const seen: string[] = []
        res.forEach((p) => Object.keys(p.values).forEach((k) => {
          if (!seen.includes(k)) seen.push(k)
        }))
        fieldArr.value = seen
      })
      .catch(() => { historyPoints.value = [] })
  }

  function teardown(): void {
    if (unsub) { unsub(); unsub = null }
  }

  function init(): void {
    teardown()
    if (mode.value === 'realtime') startRealtime()
    else if (mode.value === 'history') startHistory()
    // 'playback' 在 Task 14 / PlaybackController 对接时实现
  }

  init()

  const visible = computed<DataPoint[]>(() => {
    if (mode.value !== 'realtime') return historyPoints.value
    // 依赖 frameCounter 触发重算；窗口数据由 DataHub 维护，避免重复累积。
    // destroy 后冻结为最后一次值，对齐"unsub 后不再接收新帧"的语义。
    void frameCounter.value
    if (destroyed.value) return lastVisible
    lastVisible = getDataHub().getRealtimeWindow(query, windowMs.value)
    return lastVisible
  })

  const tr = computed<[number, number] | null>(() => {
    if (mode.value === 'realtime') {
      void frameCounter.value
      const w = getDataHub().getRealtimeWindow(query, windowMs.value)
      if (w.length === 0) return null
      const last = w[w.length - 1].timestamp
      return [last - windowMs.value, last]
    }
    return timeRange.value
  })

  return {
    get mode() { return mode.value },
    get visibleData() { return visible.value },
    get fields() { return fieldArr.value },
    get timeRange() { return tr.value },
    setQuery(q) { query = { ...q }; init() },
    setMode(m) { mode.value = m; init() },
    setTimeRange(r) { timeRange.value = r; if (mode.value === 'history') init() },
    setWindowDuration(ms) { windowMs.value = ms },
    destroy() { teardown(); destroyed.value = true }
  }
}
