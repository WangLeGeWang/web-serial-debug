import { getDataHub } from '@/runtime/data/DataHub'
import { EventCenter, EventNames } from '@/utils/EventCenter'
import { realtimeProvider } from '@/utils/RealtimeProvider'
import type { DataFrame } from '@/runtime/data/types'

export function bindRealtimeProviderToDataHub(): () => void {
  try {
    const hub = getDataHub()
    return hub.subscribeCurrent((frame: DataFrame) => {
      realtimeProvider.addDataPoint(frame.timestamp, frame.values)
    })
  } catch {
    const ec = EventCenter.getInstance()
    const handler = (values: Record<string, any>) => {
      realtimeProvider.addDataPoint(Date.now(), values)
    }
    ec.on(EventNames.DATA_UPDATE, handler)
    return () => ec.off(EventNames.DATA_UPDATE, handler)
  }
}
