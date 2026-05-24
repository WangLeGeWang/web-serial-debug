import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePlaybackStore } from '@/store/playbackStore'
import { WorkspaceManagerInst } from '@/utils/ProfileManager'

describe('playbackStore mode/activeQuery/historyTimeRange', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('默认 mode 为 realtime，isActive 派生为 false', () => {
    const store = usePlaybackStore()
    expect(store.mode).toBe('realtime')
    expect(store.isActive).toBe(false)
  })

  it('setMode 切换后 isActive 反映非 realtime', () => {
    const store = usePlaybackStore()
    store.setMode('history')
    expect(store.mode).toBe('history')
    expect(store.isActive).toBe(true)
    store.setMode('playback')
    expect(store.isActive).toBe(true)
    store.setMode('realtime')
    expect(store.isActive).toBe(false)
  })

  it('activeQuery 初始 namespace 取自 WorkspaceManager.activeWorkspace.config.namespace', () => {
    const store = usePlaybackStore()
    const ws = WorkspaceManagerInst.activeWorkspace
    expect(store.activeQuery.namespace).toBe(ws!.config.namespace)
  })

  it('WorkspaceManager 切换 activeWorkspace 后 activeQuery.namespace 同步', () => {
    const store = usePlaybackStore()
    const prevId = WorkspaceManagerInst.activeWorkspace?.id ?? null
    const newWs = WorkspaceManagerInst.createWorkspace('TestWS_' + Date.now())
    WorkspaceManagerInst.setActiveWorkspace(newWs.id)
    expect(store.activeQuery.namespace).toBe(newWs.config.namespace)
    if (prevId) WorkspaceManagerInst.setActiveWorkspace(prevId)
    WorkspaceManagerInst.deleteWorkspace(newWs.id)
  })

  it('setQuery 覆盖 activeQuery', () => {
    const store = usePlaybackStore()
    store.setQuery({ namespace: 'custom-ns', fields: ['a', 'b'] })
    expect(store.activeQuery).toEqual({ namespace: 'custom-ns', fields: ['a', 'b'] })
  })

  it('setHistoryTimeRange 在 history 模式下保存 range，传 null 可清空', () => {
    const store = usePlaybackStore()
    store.setMode('history')
    store.setHistoryTimeRange([1000, 2000])
    expect(store.historyTimeRange).toEqual([1000, 2000])
    store.setHistoryTimeRange(null)
    expect(store.historyTimeRange).toBeNull()
  })

  it('setActiveSeries(series) 将 mode 设为 history 并初始化 historyTimeRange', () => {
    const store = usePlaybackStore()
    const series = {
      id: 's1', name: 'S1',
      startTime: 10_000, endTime: 60_000,
      pointCount: 100, fields: ['a'],
      createdAt: 0, sizeBytes: 0
    }
    store.setActiveSeries(series as any)
    expect(store.mode).toBe('history')
    expect(store.activeSeries).toEqual(series)
    expect(store.currentTime).toBe(10_000)
    expect(store.historyTimeRange).toEqual([10_000 - store.windowDuration, 10_000])
  })

  it('setActiveSeries(null) 恢复 realtime 并清空 historyTimeRange', () => {
    const store = usePlaybackStore()
    const series = {
      id: 's1', name: 'S1',
      startTime: 10_000, endTime: 60_000,
      pointCount: 100, fields: ['a'],
      createdAt: 0, sizeBytes: 0
    }
    store.setActiveSeries(series as any)
    store.setActiveSeries(null)
    expect(store.mode).toBe('realtime')
    expect(store.historyTimeRange).toBeNull()
  })

  it('seekToTime 在 history 模式下更新 historyTimeRange', () => {
    const store = usePlaybackStore()
    const series = {
      id: 's1', name: 'S1',
      startTime: 10_000, endTime: 60_000,
      pointCount: 100, fields: ['a'],
      createdAt: 0, sizeBytes: 0
    }
    store.setActiveSeries(series as any)
    store.seekToTime(30_000)
    expect(store.currentTime).toBe(30_000)
    expect(store.historyTimeRange).toEqual([30_000 - store.windowDuration, 30_000])
  })

  it('setHistoryTimeRange 在 realtime 模式下被拒绝，但允许传 null 清空', () => {
    const store = usePlaybackStore()
    expect(store.mode).toBe('realtime')
    store.setHistoryTimeRange([1000, 2000])
    expect(store.historyTimeRange).toBeNull()
    store.setMode('history')
    store.setHistoryTimeRange([3000, 4000])
    expect(store.historyTimeRange).toEqual([3000, 4000])
    store.setHistoryTimeRange(null)
    expect(store.historyTimeRange).toBeNull()
  })

  it('setWindowDuration 在 realtime 模式下不更新 historyTimeRange', () => {
    const store = usePlaybackStore()
    expect(store.mode).toBe('realtime')
    store.setWindowDuration(5000)
    expect(store.windowDuration).toBe(5000)
    expect(store.historyTimeRange).toBeNull()
  })

  it('setActiveSeries 使用 trailing window 公式 [start - windowDuration, start]', () => {
    const store = usePlaybackStore()
    const series = {
      id: 's2', name: 'S2',
      startTime: 100_000, endTime: 200_000,
      pointCount: 100, fields: ['a'],
      createdAt: 0, sizeBytes: 0
    }
    store.setActiveSeries(series as any)
    expect(store.historyTimeRange).toEqual([100_000 - store.windowDuration, 100_000])
  })
})
