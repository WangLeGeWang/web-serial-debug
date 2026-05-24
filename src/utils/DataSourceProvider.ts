import { shallowRef } from 'vue'

export interface DataPoint {
  timestamp: number
  values: Record<string, number>
}

export interface DataSourceProvider {
  readonly visibleData: DataPoint[]
  readonly fields: string[]
  readonly timeRange: [number, number] | null
  readonly mode: 'realtime' | 'playback'
  setCurrentTime?: (time: number) => void
  setWindowDuration?: (duration: number) => void
  destroy?: () => void
}

let currentProvider: DataSourceProvider | null = null
const currentProviderRef = shallowRef<DataSourceProvider | null>(null)

export const dataSourceProvider: DataSourceProvider = {
  get visibleData() {
    return currentProviderRef.value?.visibleData || []
  },
  get fields() {
    return currentProviderRef.value?.fields || []
  },
  get timeRange() {
    return currentProviderRef.value?.timeRange || null
  },
  get mode() {
    return currentProviderRef.value?.mode || 'realtime'
  },
  setCurrentTime(time: number) {
    currentProviderRef.value?.setCurrentTime?.(time)
  },
  setWindowDuration(duration: number) {
    currentProviderRef.value?.setWindowDuration?.(duration)
  },
  destroy() {
    currentProviderRef.value?.destroy?.()
  }
}

export function setDataSourceProvider(provider: DataSourceProvider) {
  if (currentProvider && currentProvider !== provider) {
    currentProvider.destroy?.()
  }
  currentProvider = provider
  currentProviderRef.value = provider
}

export function useDataSource() {
  return dataSourceProvider
}
