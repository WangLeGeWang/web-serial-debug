import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ScriptManager } from '@/utils/ScriptManager'
import { initDataHub, getDataHub } from '@/runtime/data/DataHub'
import { EventCenter, EventNames } from '@/utils/EventCenter'

function resetScriptManager(): void {
  ;(ScriptManager as any).instance = undefined
}

describe('ScriptManager updateDataTable 接入 DataHub', () => {
  beforeEach(() => {
    localStorage.clear()
    resetScriptManager()
    initDataHub({ origin: 'test', bufferCapacity: 100 })
  })

  it('setNamespaceProvider 后 updateDataTable 写入指定 namespace', () => {
    const sm = ScriptManager.getInstance()
    sm.setNamespaceProvider(() => 'ns-test')

    sm.updateDataTable({ pitch: 1.5, roll: -0.2 })

    const latest = getDataHub().getLatest({ namespace: 'ns-test' })
    expect(latest.pitch).toBe(1.5)
    expect(latest.roll).toBe(-0.2)
  })

  it('未 setNamespaceProvider 时写入 namespace=default', () => {
    const sm = ScriptManager.getInstance()

    sm.updateDataTable({ a: 42 })

    const latest = getDataHub().getLatest({ namespace: 'default' })
    expect(latest.a).toBe(42)
  })

  it('DataHub.append 抛错时 fallback 到 EventCenter emit', () => {
    const sm = ScriptManager.getInstance()
    sm.setNamespaceProvider(() => 'ns-fallback')

    const hub = getDataHub()
    const appendSpy = vi.spyOn(hub, 'append').mockImplementation(() => {
      throw new Error('boom')
    })
    const emitSpy = vi.spyOn(EventCenter.getInstance(), 'emit')

    const payload = { x: 7 }
    sm.updateDataTable(payload)

    expect(appendSpy).toHaveBeenCalledOnce()
    expect(emitSpy).toHaveBeenCalledWith(EventNames.DATA_UPDATE, payload)

    appendSpy.mockRestore()
    emitSpy.mockRestore()
  })
})
