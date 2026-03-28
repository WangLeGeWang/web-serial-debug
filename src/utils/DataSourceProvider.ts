import { ref, computed, shallowRef, triggerRef } from 'vue'

export interface DataPoint {
  timestamp: number
  values: Record<string, any>
}

export interface DataSourceProvider {
  readonly visibleData: DataPoint[]
  readonly fields: string[]
  readonly timeRange: [number, number] | null
  readonly mode: 'realtime' | 'playback'
}

const currentProvider = shallowRef<DataSourceProvider | null>(null)

export function useDataSource(): DataSourceProvider {
  return currentProvider.value!
}

export function setDataSourceProvider(provider: DataSourceProvider): void {
  currentProvider.value = provider
  triggerRef(currentProvider)
}
