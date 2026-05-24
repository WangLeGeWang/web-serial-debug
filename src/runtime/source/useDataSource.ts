import { onBeforeUnmount } from 'vue'
import { createDataSource, type DataSourceMode, type DataSourceProvider } from './DataSourceProvider'
import type { DataQuery } from '@/runtime/data/types'

export function useDataSource(
  query: DataQuery,
  mode: DataSourceMode = 'realtime'
): DataSourceProvider {
  const ds = createDataSource(query, mode)
  onBeforeUnmount(() => ds.destroy())
  return ds
}
