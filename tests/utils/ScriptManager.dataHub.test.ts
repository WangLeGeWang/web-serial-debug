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

  it('DataHub.append 抛错时不再吞错，直接 rethrow（避免脏数据降级）', () => {
    const sm = ScriptManager.getInstance()
    sm.setNamespaceProvider(() => 'ns-fallback')

    const hub = getDataHub()
    const appendSpy = vi.spyOn(hub, 'append').mockImplementation(() => {
      throw new Error('boom')
    })
    const emitSpy = vi.spyOn(EventCenter.getInstance(), 'emit')

    expect(() => sm.updateDataTable({ x: 7 })).toThrow('boom')
    expect(appendSpy).toHaveBeenCalledOnce()
    expect(emitSpy).not.toHaveBeenCalled()

    appendSpy.mockRestore()
    emitSpy.mockRestore()
  })

  it('DataHub 真未 init 时 fallback 到 EventCenter', async () => {
    const sm = ScriptManager.getInstance()

    const dhMod = await import('@/runtime/data/DataHub')
    const getHubSpy = vi.spyOn(dhMod, 'getDataHub').mockImplementation(() => {
      throw new Error('DataHub not initialized. Call initDataHub() first.')
    })
    const emitSpy = vi.spyOn(EventCenter.getInstance(), 'emit')

    sm.updateDataTable({ a: 1 })

    expect(emitSpy).toHaveBeenCalledWith(EventNames.DATA_UPDATE, { a: 1 })

    getHubSpy.mockRestore()
    emitSpy.mockRestore()
  })

  it('入参非对象时直接返回，不写 hub 也不 emit', () => {
    const sm = ScriptManager.getInstance()
    const hub = getDataHub()
    const appendSpy = vi.spyOn(hub, 'append')
    const emitSpy = vi.spyOn(EventCenter.getInstance(), 'emit')

    sm.updateDataTable(null as any)
    sm.updateDataTable(undefined as any)
    sm.updateDataTable('foo' as any)

    expect(appendSpy).not.toHaveBeenCalled()
    expect(emitSpy).not.toHaveBeenCalled()

    appendSpy.mockRestore()
    emitSpy.mockRestore()
  })
})
