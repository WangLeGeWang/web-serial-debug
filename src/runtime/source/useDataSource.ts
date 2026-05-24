import { getCurrentInstance, onBeforeUnmount } from 'vue'
import { createDataSource, type DataSourceMode, type DataSourceProvider } from './DataSourceProvider'
import type { DataQuery } from '@/runtime/data/types'

export function useDataSource(
  query: DataQuery,
  mode: DataSourceMode = 'realtime'
): DataSourceProvider {
  const ds = createDataSource(query, mode)
  if (getCurrentInstance()) {
    onBeforeUnmount(() => ds.destroy())
  } else {
    console.warn(
      '[useDataSource] 必须在组件 setup() 内调用，或调用方需自行执行 ds.destroy() 释放订阅。'
    )
  }
  return ds
}
