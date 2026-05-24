import { watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useDataSource } from '@/runtime/source/useDataSource'
import type { DataSourceMode, DataSourceProvider } from '@/runtime/source/DataSourceProvider'
import { usePlaybackStore } from '@/store/playbackStore'

export interface UseDataSourceFromPlaybackStoreOptions {
  forceMode?: DataSourceMode
  includeTimeRange?: boolean
}

export function useDataSourceFromPlaybackStore(
  opts: UseDataSourceFromPlaybackStoreOptions = {}
): DataSourceProvider {
  const includeTimeRange = opts.includeTimeRange !== false
  const playbackStore = usePlaybackStore()
  const { activeQuery, mode: storeMode, historyTimeRange, windowDuration } = storeToRefs(playbackStore)

  const initialMode = opts.forceMode ?? storeMode.value
  const ds = useDataSource(activeQuery.value, initialMode)
  ds.setWindowDuration(windowDuration.value)
  if (includeTimeRange && historyTimeRange.value) {
    ds.setTimeRange(historyTimeRange.value)
  }

  if (!opts.forceMode) {
    watch(storeMode, (m) => ds.setMode(m))
  }
  watch(activeQuery, (q) => ds.setQuery(q))
  if (includeTimeRange) {
    watch(historyTimeRange, (r) => { if (r) ds.setTimeRange(r) })
  }
  watch(windowDuration, (ms) => ds.setWindowDuration(ms))

  return ds
}
