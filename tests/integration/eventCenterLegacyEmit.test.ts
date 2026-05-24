import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { initDataHub, getDataHub } from '@/runtime/data/DataHub'
import { useFieldStore } from '@/store/fieldStore'
import { EventCenter, EventNames } from '@/utils/EventCenter'
import { WorkspaceManager } from '@/utils/ProfileManager'

function resetWorkspaceManager(): void {
  ;(WorkspaceManager as any).instance = undefined
}

// 覆盖 DataHub.append 内部的 legacy EventCenter.emit(DATA_UPDATE) 兼容路径。
// 这条路径用于支撑尚未迁移到 DataHub.subscribe* 的旧组件（CanvasPanel / ChartIMU / ChartPanel / PipelinePanel）。
// 未来 fieldStore 以外的旧消费者全部切到 DataHub 订阅后，本测试可以整体删除。
describe('legacy EventCenter emit 兼容路径', () => {
  let store: ReturnType<typeof useFieldStore>
  let unbind: (() => void) | null = null

  beforeEach(() => {
    localStorage.clear()
    resetWorkspaceManager()
    setActivePinia(createPinia())

    initDataHub({ origin: 'integration-test', bufferCapacity: 100 })
    getDataHub().setCurrentWorkspaceNamespace('ns-x')

    store = useFieldStore()
    store.loadFromProfile()

    const handler = (data: any) => store.handleDataUpdate(data, true)
    EventCenter.getInstance().on(EventNames.DATA_UPDATE, handler)
    unbind = () => EventCenter.getInstance().off(EventNames.DATA_UPDATE, handler)
  })

  afterEach(() => {
    if (unbind) {
      unbind()
      unbind = null
    }
  })

  it('DataHub.append(currentNs) → 经 EventCenter.emit 触达手动订阅者', () => {
    getDataHub().append({
      namespace: 'ns-x',
      timestamp: 1,
      values: { pitch: 12.5, brand_new: 7 }
    })

    expect(store.fields.find(f => f.key === 'pitch')?.value).toBe(12.5)
    expect(store.fields.find(f => f.key === 'brand_new')?.value).toBe(7)
  })

  it('其它 namespace 不触发兼容 emit，不污染手动订阅者', () => {
    const before = store.fields.find(f => f.key === 'pitch')?.value

    getDataHub().append({
      namespace: 'ns-other',
      timestamp: 1,
      values: { pitch: 99 }
    })

    expect(store.fields.find(f => f.key === 'pitch')?.value).toBe(before)
  })
})
