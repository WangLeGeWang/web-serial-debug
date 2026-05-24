import { isDesktop } from './Platform'

export interface StorageAdapter {
  get<T>(key: string): T | null
  set<T>(key: string, value: T): void
  remove(key: string): void
  getAllKeys(): string[]
}

class LocalStorageAdapter implements StorageAdapter {
  private prefix = 'wssd.'

  get<T>(key: string): T | null {
    try {
      const value = localStorage.getItem(this.prefix + key)
      return value ? JSON.parse(value) : null
    } catch {
      return null
    }
  }

  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(value))
    } catch (error) {
      console.error('LocalStorage set error:', error)
    }
  }

  remove(key: string): void {
    localStorage.removeItem(this.prefix + key)
  }

  getAllKeys(): string[] {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(this.prefix)) {
        keys.push(key.slice(this.prefix.length))
      }
    }
    return keys
  }
}

class MemoryStorageAdapter implements StorageAdapter {
  private store = new Map<string, any>()

  get<T>(key: string): T | null {
    return this.store.get(key) ?? null
  }

  set<T>(key: string, value: T): void {
    this.store.set(key, value)
  }

  remove(key: string): void {
    this.store.delete(key)
  }

  getAllKeys(): string[] {
    return Array.from(this.store.keys())
  }
}

let storageAdapter: StorageAdapter

export function initStorage(): StorageAdapter {
  // 桌面端（Tauri）与浏览器统一使用 LocalStorage：Tauri WebView 自带且持久化到用户数据目录。
  // 若未来要落盘 JSON 配置文件，可在此切换为 @tauri-apps/plugin-fs 的异步实现。
  void isDesktop
  storageAdapter = new LocalStorageAdapter()
  return storageAdapter
}

export function getStorage(): StorageAdapter {
  if (!storageAdapter) {
    return initStorage()
  }
  return storageAdapter
}

export function getMemoryStorage(): StorageAdapter {
  return new MemoryStorageAdapter()
}
