import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { initDataHub, getDataHub } from '@/runtime/data/DataHub'
import { WorkspaceManager } from '@/utils/ProfileManager'
import { realtimeProvider } from '@/utils/RealtimeProvider'
import { bindRealtimeProviderToDataHub } from '@/components/canvasPanel/realtimeBinding'

function resetWorkspaceManager(): void {
  ;(WorkspaceManager as any).instance = undefined
}

describe('bindRealtimeProviderToDataHub', () => {
  let unbind: (() => void) | null = null

  beforeEach(() => {
    localStorage.clear()
    resetWorkspaceManager()
    realtimeProvider.clearData()
    initDataHub({ origin: 'canvas-panel-test', bufferCapacity: 100 })
    getDataHub().setCurrentWorkspaceNamespace('ns-current')
    unbind = bindRealtimeProviderToDataHub()
  })

  afterEach(() => {
    if (unbind) {
      unbind()
      unbind = null
    }
    realtimeProvider.clearData()
  })

  it('DataHub.append(currentNs) 后 realtimeProvider.dataPoints 增长', () => {
    expect(realtimeProvider.dataPoints.value.length).toBe(0)

    getDataHub().append({
      namespace: 'ns-current',
      timestamp: 1000,
      values: { pitch: 10, roll: 20 }
    })

    expect(realtimeProvider.dataPoints.value.length).toBe(1)
    expect(realtimeProvider.dataPoints.value[0].timestamp).toBe(1000)
    expect(realtimeProvider.dataPoints.value[0].values).toEqual({ pitch: 10, roll: 20 })
    expect(realtimeProvider.fields.value).toEqual(expect.arrayContaining(['pitch', 'roll']))
  })

  it('DataHub.append(其他 ns) 不影响 realtimeProvider', () => {
    getDataHub().append({
      namespace: 'ns-other',
      timestamp: 1000,
      values: { yaw: 5 }
    })

    expect(realtimeProvider.dataPoints.value.length).toBe(0)
    expect(realtimeProvider.fields.value).not.toContain('yaw')
  })

  it('unsubscribe 后 append 不再写入', () => {
    if (unbind) {
      unbind()
      unbind = null
    }

    getDataHub().append({
      namespace: 'ns-current',
      timestamp: 2000,
      values: { pitch: 99 }
    })

    expect(realtimeProvider.dataPoints.value.length).toBe(0)
  })
})
