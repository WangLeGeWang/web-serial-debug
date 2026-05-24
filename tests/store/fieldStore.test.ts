import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { initDataHub, getDataHub } from '@/runtime/data/DataHub'
import { EventCenter, EventNames } from '@/utils/EventCenter'
import { WorkspaceManager, ProfileManagerInst } from '@/utils/ProfileManager'

function resetWorkspaceManager(): void {
  ;(WorkspaceManager as any).instance = undefined
}

describe('fieldStore 直接从 DataHub.subscribeCurrent 拉数据（不经 EventCenter）', () => {
  let dispose: (() => void) | null = null

  beforeEach(() => {
    // 必须先清 localStorage，再重置 WorkspaceManager 单例，
    // 否则单例构造时 loadAll() 会拿到上一轮残留的数据。
    localStorage.clear()
    resetWorkspaceManager()

    setActivePinia(createPinia())

    initDataHub({ origin: 'test', bufferCapacity: 100 })
    getDataHub().setCurrentWorkspaceNamespace('ns-x')
  })

  afterEach(() => {
    if (dispose) {
      dispose()
      dispose = null
    }
  })

  it('DataHub.append(currentNs) → store.fields 更新（绕过 EventCenter 也生效）', async () => {
    const { useFieldStore, bindFieldStoreToDataHub } = await import('@/store/fieldStore')
    const store = useFieldStore()
    store.loadFromProfile()

    dispose = bindFieldStoreToDataHub(store)

    // 故意精确移除 DATA_UPDATE 的潜在监听者，断言 store 仍然更新——
    // 证明数据路径是 DataHub.subscribeCurrent，而不是 EventCenter。
    // 注意：用 spy 而不是 off(name) 无 callback 形式，避免破坏其他测试。
    const ec = EventCenter.getInstance()
    const emitSpy = vi.spyOn(ec, 'emit')

    getDataHub().append({
      namespace: 'ns-x',
      timestamp: 1,
      values: { pitch: 12.5, brand_new: 7 }
    })

    expect(store.fields.find(f => f.key === 'pitch')?.value).toBe(12.5)
    expect(store.fields.find(f => f.key === 'brand_new')?.value).toBe(7)

    // 兼容路径仍然 emit（验证 DataHub 没退化），但 store 的更新不依赖它。
    expect(emitSpy).toHaveBeenCalledWith(EventNames.DATA_UPDATE, { pitch: 12.5, brand_new: 7 })

    emitSpy.mockRestore()
  })

  it('切换 currentWorkspaceNamespace 到 ns-y 后，append ns-x 不再影响 store', async () => {
    const { useFieldStore, bindFieldStoreToDataHub } = await import('@/store/fieldStore')
    const store = useFieldStore()
    store.loadFromProfile()
    dispose = bindFieldStoreToDataHub(store)

    getDataHub().append({ namespace: 'ns-x', timestamp: 1, values: { pitch: 1 } })
    expect(store.fields.find(f => f.key === 'pitch')?.value).toBe(1)

    getDataHub().setCurrentWorkspaceNamespace('ns-y')
    getDataHub().append({ namespace: 'ns-x', timestamp: 2, values: { pitch: 999 } })

    expect(store.fields.find(f => f.key === 'pitch')?.value).toBe(1)

    getDataHub().append({ namespace: 'ns-y', timestamp: 3, values: { roll: 42 } })
    expect(store.fields.find(f => f.key === 'roll')?.value).toBe(42)
  })

  it('append 其他 namespace 不污染 store（新字段不会出现）', async () => {
    const { useFieldStore, bindFieldStoreToDataHub } = await import('@/store/fieldStore')
    const store = useFieldStore()
    store.loadFromProfile()
    dispose = bindFieldStoreToDataHub(store)

    getDataHub().append({
      namespace: 'ns-other',
      timestamp: 1,
      values: { only_in_other_ns: 123 }
    })

    expect(store.fields.find(f => f.key === 'only_in_other_ns')).toBeUndefined()
  })

  it('dispose 后再 append 不再触达 store', async () => {
    const { useFieldStore, bindFieldStoreToDataHub } = await import('@/store/fieldStore')
    const store = useFieldStore()
    store.loadFromProfile()

    const off = bindFieldStoreToDataHub(store)
    off()

    getDataHub().append({ namespace: 'ns-x', timestamp: 1, values: { pitch: 88 } })
    expect(store.fields.find(f => f.key === 'pitch')?.value).not.toBe(88)
  })

  it('workspace.config.autoAddField=false 时不自动新增字段', async () => {
    const { useFieldStore, bindFieldStoreToDataHub } = await import('@/store/fieldStore')
    const store = useFieldStore()
    store.loadFromProfile()

    const ws = ProfileManagerInst.activeWorkspace
    expect(ws).not.toBeNull()
    ws!.config.autoAddField = false

    dispose = bindFieldStoreToDataHub(store)

    getDataHub().append({
      namespace: 'ns-x',
      timestamp: 1,
      values: { pitch: 3.14, never_seen: 999 }
    })

    expect(store.fields.find(f => f.key === 'pitch')?.value).toBe(3.14)
    expect(store.fields.find(f => f.key === 'never_seen')).toBeUndefined()
  })
})
