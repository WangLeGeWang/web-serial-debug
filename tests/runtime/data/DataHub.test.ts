import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DataHub, initDataHub, getDataHub } from '@/runtime/data/DataHub'
import type { HubTransport } from '@/runtime/transport/HubTransport'

describe('DataHub basic', () => {
  let hub: DataHub
  beforeEach(() => { hub = new DataHub({ origin: 'test', bufferCapacity: 100 }) })

  it('append(local) 自动补 origin/seq', () => {
    let captured: any
    hub.subscribe({ namespace: 'ns' }, f => { captured = f })
    hub.append({ namespace: 'ns', timestamp: 1, values: { a: 1 } })
    expect(captured.origin).toBe('test')
    expect(captured.seq).toBe(1)
    expect(captured.source).toBe('local')
  })

  it('append(remote) 必须显式提供 origin/seq', () => {
    let captured: any
    hub.subscribe({ namespace: 'ns' }, f => { captured = f })
    hub.append({
      namespace: 'ns', timestamp: 1, values: { a: 1 },
      source: 'remote', origin: 'other', seq: 7
    })
    expect(captured.source).toBe('remote')
    expect(captured.origin).toBe('other')
    expect(captured.seq).toBe(7)
  })

  it('subscribe 按 namespace 过滤', () => {
    const a = vi.fn(); const b = vi.fn()
    hub.subscribe({ namespace: 'ns-a' }, a)
    hub.subscribe({ namespace: 'ns-b' }, b)
    hub.append({ namespace: 'ns-a', timestamp: 1, values: { x: 1 } })
    expect(a).toHaveBeenCalledOnce()
    expect(b).not.toHaveBeenCalled()
  })

  it('unsubscribe 返回值生效', () => {
    const cb = vi.fn()
    const off = hub.subscribe({ namespace: 'ns' }, cb)
    off()
    hub.append({ namespace: 'ns', timestamp: 1, values: { a: 1 } })
    expect(cb).not.toHaveBeenCalled()
  })

  it('getLatest 返回 namespace 当前字段值', () => {
    hub.append({ namespace: 'ns', timestamp: 1, values: { a: 1, b: 2 } })
    hub.append({ namespace: 'ns', timestamp: 2, values: { a: 3 } })
    expect(hub.getLatest({ namespace: 'ns' })).toEqual({ a: 3, b: 2 })
  })

  it('getRealtimeWindow 按 ms 截取', () => {
    for (let t = 1; t <= 5; t++) {
      hub.append({ namespace: 'ns', timestamp: t * 1000, values: { a: t } })
    }
    const w = hub.getRealtimeWindow({ namespace: 'ns' }, 2500)
    expect(w.map(p => p.timestamp)).toEqual([3000, 4000, 5000])
  })

  it('校验 namespace 与 values', () => {
    expect(() => hub.append({ namespace: '', timestamp: 1, values: { a: 1 } } as any))
      .toThrow(/namespace/)
    expect(() => hub.append({ namespace: 'ns', timestamp: 1, values: null as any }))
      .toThrow(/values/)
  })

  it('initDataHub 替换单例时清理旧实例', () => {
    const old = initDataHub({ origin: 'old', bufferCapacity: 10 })
    const cb = vi.fn()
    old.subscribe({ namespace: 'ns' }, cb)
    old.append({ namespace: 'ns', timestamp: 1, values: { a: 1 } })
    expect(cb).toHaveBeenCalledOnce()

    const fresh = initDataHub({ origin: 'new', bufferCapacity: 10 })
    expect(fresh).not.toBe(old)
    expect(getDataHub()).toBe(fresh)
    // 旧实例 subscribers 已清空，再 append 不应触发旧 cb
    old.append({ namespace: 'ns', timestamp: 2, values: { a: 2 } })
    expect(cb).toHaveBeenCalledOnce()
  })

  it('getCurrentWorkspaceNamespace 反映 setter 设置', () => {
    expect(hub.getCurrentWorkspaceNamespace()).toBeNull()
    hub.setCurrentWorkspaceNamespace('ns-a')
    expect(hub.getCurrentWorkspaceNamespace()).toBe('ns-a')
    hub.setCurrentWorkspaceNamespace(null)
    expect(hub.getCurrentWorkspaceNamespace()).toBeNull()
  })

  it('subscribeAll 接收所有 namespace 的帧', () => {
    const cb = vi.fn()
    const off = hub.subscribeAll(cb)
    hub.append({ namespace: 'ns-a', timestamp: 1, values: { a: 1 } })
    hub.append({ namespace: 'ns-b', timestamp: 2, values: { b: 2 } })
    expect(cb).toHaveBeenCalledTimes(2)
    off()
    hub.append({ namespace: 'ns-a', timestamp: 3, values: { a: 3 } })
    expect(cb).toHaveBeenCalledTimes(2)
  })

  it('subscribeCurrent 只收 currentWorkspaceNamespace 的帧，切换后自动跟随新 ns', () => {
    const cb = vi.fn()
    const off = hub.subscribeCurrent(cb)

    // 未设置 currentWorkspaceNamespace 时不触发
    hub.append({ namespace: 'ns-a', timestamp: 1, values: { a: 1 } })
    expect(cb).not.toHaveBeenCalled()

    // 设为 ns-a：只触发 ns-a
    hub.setCurrentWorkspaceNamespace('ns-a')
    hub.append({ namespace: 'ns-a', timestamp: 2, values: { a: 2 } })
    hub.append({ namespace: 'ns-b', timestamp: 3, values: { b: 3 } })
    expect(cb).toHaveBeenCalledTimes(1)
    expect(cb).toHaveBeenLastCalledWith(expect.objectContaining({ namespace: 'ns-a', values: { a: 2 } }))

    // 切换到 ns-b：自动只跟随 ns-b，不需要重订
    hub.setCurrentWorkspaceNamespace('ns-b')
    hub.append({ namespace: 'ns-a', timestamp: 4, values: { a: 4 } })
    hub.append({ namespace: 'ns-b', timestamp: 5, values: { b: 5 } })
    expect(cb).toHaveBeenCalledTimes(2)
    expect(cb).toHaveBeenLastCalledWith(expect.objectContaining({ namespace: 'ns-b', values: { b: 5 } }))

    off()
    hub.append({ namespace: 'ns-b', timestamp: 6, values: { b: 6 } })
    expect(cb).toHaveBeenCalledTimes(2)
  })
})

describe('DataHub.attachTransport', () => {
  function makeTransport(id: string): HubTransport & { sent: any[]; receive: (f: any) => void } {
    let cb: ((f: any) => void) | null = null
    const sent: any[] = []
    return {
      id,
      start: async () => {},
      stop: async () => {},
      send: (f) => sent.push(f),
      onFrame: (c) => { cb = c },
      receive: (f) => cb?.(f),
      sent
    }
  }

  it('本地 append 广播给所有 transport', () => {
    const hub = new DataHub({ origin: 'me', bufferCapacity: 50 })
    const t1 = makeTransport('t1'); const t2 = makeTransport('t2')
    hub.attachTransport(t1); hub.attachTransport(t2)
    hub.append({ namespace: 'ns', timestamp: 1, values: { a: 1 } })
    expect(t1.sent.length).toBe(1); expect(t2.sent.length).toBe(1)
    expect(t1.sent[0].origin).toBe('me')
  })

  it('remote 帧不广播，避免回环', () => {
    const hub = new DataHub({ origin: 'me', bufferCapacity: 50 })
    const t = makeTransport('t')
    hub.attachTransport(t)
    hub.append({
      namespace: 'ns', timestamp: 1, values: { a: 1 },
      source: 'remote', origin: 'peer', seq: 1
    })
    expect(t.sent.length).toBe(0)
  })

  it('detachTransport 后停止广播', () => {
    const hub = new DataHub({ origin: 'me', bufferCapacity: 50 })
    const t = makeTransport('t')
    hub.attachTransport(t)
    hub.detachTransport(t)
    hub.append({ namespace: 'ns', timestamp: 1, values: { a: 1 } })
    expect(t.sent.length).toBe(0)
  })

  it('transport.onFrame 收帧 → hub append(remote)', () => {
    const hub = new DataHub({ origin: 'me', bufferCapacity: 50 })
    const t = makeTransport('t')
    hub.attachTransport(t)
    t.receive({ namespace: 'ns', timestamp: 1, values: { a: 1 }, source: 'remote', origin: 'peer', seq: 1 })
    expect(hub.getLatest({ namespace: 'ns' })).toEqual({ a: 1 })
  })
})
