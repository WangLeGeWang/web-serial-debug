import { describe, it, expect, beforeEach } from 'vitest'
import {
  WorkspaceManager,
  ensureWorkspaceNamespace,
  type Workspace
} from '@/utils/ProfileManager'

const STORAGE_PREFIX = 'wssd.'
const WORKSPACES_KEY = STORAGE_PREFIX + 'workspaces'
const ACTIVE_WORKSPACE_KEY = STORAGE_PREFIX + 'activeWorkspaceId'

function resetSingleton(): void {
  ;(WorkspaceManager as any).instance = undefined
}

function makeBareWorkspace(id: string, withNamespace?: string): Workspace {
  const ws: Workspace = {
    id,
    name: id,
    deviceId: null,
    deviceType: null,
    config: {},
    createdAt: 1,
    updatedAt: 1
  }
  if (withNamespace !== undefined) {
    ws.config.namespace = withNamespace
  }
  return ws
}

describe('Workspace namespace', () => {
  beforeEach(() => {
    localStorage.clear()
    resetSingleton()
  })

  describe('ensureWorkspaceNamespace', () => {
    it('缺 namespace 时用 ws.id 回填，返回 true', () => {
      const ws = makeBareWorkspace('workspace_alpha_1')
      const changed = ensureWorkspaceNamespace(ws)
      expect(changed).toBe(true)
      expect(ws.config.namespace).toBe('workspace_alpha_1')
    })

    it('已有 namespace 时幂等，不覆盖，返回 false', () => {
      const ws = makeBareWorkspace('workspace_beta_2', 'custom-ns')
      const changed = ensureWorkspaceNamespace(ws)
      expect(changed).toBe(false)
      expect(ws.config.namespace).toBe('custom-ns')
    })

    it('config 缺失时也能补齐（防御性）', () => {
      const ws = makeBareWorkspace('workspace_gamma_3')
      ;(ws as any).config = undefined
      const changed = ensureWorkspaceNamespace(ws)
      expect(changed).toBe(true)
      expect(ws.config.namespace).toBe('workspace_gamma_3')
    })
  })

  describe('createWorkspace', () => {
    it('新建 workspace 默认 namespace = workspace.id', () => {
      const mgr = WorkspaceManager.getInstance()
      const ws = mgr.createWorkspace('测试空间')
      expect(ws.config.namespace).toBe(ws.id)
    })
  })

  describe('loadAll backfill', () => {
    it('对持久化中缺 namespace 的 workspace 自动回填并持久化', () => {
      const seeded: Workspace[] = [
        makeBareWorkspace('ws_old_a'),
        makeBareWorkspace('ws_old_b', 'already-set')
      ]
      localStorage.setItem(WORKSPACES_KEY, JSON.stringify(seeded))
      localStorage.setItem(ACTIVE_WORKSPACE_KEY, JSON.stringify('ws_old_a'))

      const mgr = WorkspaceManager.getInstance()
      const list = mgr.workspacesRef.value
      const a = list.find(w => w.id === 'ws_old_a')!
      const b = list.find(w => w.id === 'ws_old_b')!
      expect(a.config.namespace).toBe('ws_old_a')
      expect(b.config.namespace).toBe('already-set')

      const persisted = JSON.parse(localStorage.getItem(WORKSPACES_KEY)!) as Workspace[]
      const pa = persisted.find(w => w.id === 'ws_old_a')!
      expect(pa.config.namespace).toBe('ws_old_a')
    })
  })
})
