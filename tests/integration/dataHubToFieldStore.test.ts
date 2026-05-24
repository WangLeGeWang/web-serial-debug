import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { initDataHub, getDataHub } from '@/runtime/data/DataHub'
import { useFieldStore } from '@/store/fieldStore'
import { EventCenter, EventNames } from '@/utils/EventCenter'

describe('DataHub → EventCenter → fieldStore 端到端链路', () => {
  let store: ReturnType<typeof useFieldStore>
  let unbind: (() => void) | null = null

  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    EventCenter.getInstance().off(EventNames.DATA_UPDATE)

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
    EventCenter.getInstance().off(EventNames.DATA_UPDATE)
  })

  it('DataHub.append (currentNs) → 经 emit 触达 fieldStore', () => {
    getDataHub().append({
      namespace: 'ns-x',
      timestamp: 1,
      values: { pitch: 12.5, brand_new: 7 }
    })

    expect(store.fields.find(f => f.key === 'pitch')?.value).toBe(12.5)
    expect(store.fields.find(f => f.key === 'brand_new')?.value).toBe(7)
  })

  it('其它 namespace 不污染 fieldStore', () => {
    const before = store.fields.find(f => f.key === 'pitch')?.value

    getDataHub().append({
      namespace: 'ns-other',
      timestamp: 1,
      values: { pitch: 99 }
    })

    expect(store.fields.find(f => f.key === 'pitch')?.value).toBe(before)
  })
})
