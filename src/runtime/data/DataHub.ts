import { NamespaceStore } from './NamespaceStore'
import { EventCenter, EventNames } from '@/utils/EventCenter'
import type {
  DataFrame, DataQuery, DataPoint, NamespaceOrigin
} from './types'

export interface DataHubOptions {
  origin: string
  bufferCapacity?: number
}

type Subscriber = { query: DataQuery; cb: (f: DataFrame) => void }

export class DataHub {
  private readonly origin: string
  private readonly bufferCapacity: number
  private localSeq = 0
  private currentWorkspaceNamespace: string | null = null
  private readonly namespaces = new Map<string, NamespaceStore>()
  private readonly subscribers = new Set<Subscriber>()
  private readonly namespaceOrigin = new Map<string, NamespaceOrigin>()

  constructor(opts: DataHubOptions) {
    this.origin = opts.origin
    this.bufferCapacity = opts.bufferCapacity ?? 50000
  }

  setCurrentWorkspaceNamespace(ns: string | null): void {
    this.currentWorkspaceNamespace = ns
  }

  getCurrentWorkspaceNamespace(): string | null {
    return this.currentWorkspaceNamespace
  }

  private getOrCreate(namespace: string): NamespaceStore {
    let s = this.namespaces.get(namespace)
    if (!s) {
      s = new NamespaceStore(namespace, this.bufferCapacity)
      this.namespaces.set(namespace, s)
    }
    return s
  }

  append(input: {
    namespace: string
    timestamp: number
    values: Record<string, any>
    source?: 'local' | 'remote'
    origin?: string
    seq?: number
  }): void {
    if (!input.namespace) throw new Error('DataHub.append: namespace required')
    if (!input.values || typeof input.values !== 'object') {
      throw new Error('DataHub.append: values must be object')
    }

    const source = input.source ?? 'local'
    const frame: DataFrame = {
      namespace: input.namespace,
      timestamp: input.timestamp,
      values: input.values,
      source,
      origin: source === 'local' ? this.origin : (input.origin ?? 'unknown'),
      seq: source === 'local' ? ++this.localSeq : (input.seq ?? 0)
    }

    if (!this.namespaceOrigin.has(frame.namespace)) {
      this.namespaceOrigin.set(frame.namespace, source === 'local' ? 'local' : frame.origin)
    }

    this.getOrCreate(frame.namespace).apply(frame)

    for (const sub of this.subscribers) {
      if ((sub.query.namespace as any) === '*' || sub.query.namespace === frame.namespace) sub.cb(frame)
    }

    // 兼容旧 EventCenter 订阅者：仅当 frame.namespace === currentWorkspaceNamespace 时
    // emit 本帧的增量 values（不是累积快照）。新代码请走 DataHub.subscribe / getLatest。
    if (this.currentWorkspaceNamespace && frame.namespace === this.currentWorkspaceNamespace) {
      EventCenter.getInstance().emit(EventNames.DATA_UPDATE, frame.values)
    }
  }

  subscribe(query: DataQuery, cb: (frame: DataFrame) => void): () => void {
    const sub: Subscriber = { query, cb }
    this.subscribers.add(sub)
    return () => { this.subscribers.delete(sub) }
  }

  subscribeAll(cb: (frame: DataFrame) => void): () => void {
    const sub: Subscriber = { query: { namespace: '*' } as any, cb }
    this.subscribers.add(sub)
    return () => { this.subscribers.delete(sub) }
  }

  /**
   * 订阅 currentWorkspaceNamespace 的帧。当 currentWorkspaceNamespace 在订阅期间
   * 发生变化时，回调会自动只收到新 ns 的帧（不需要 resubscribe）。
   */
  subscribeCurrent(cb: (frame: DataFrame) => void): () => void {
    return this.subscribeAll((frame) => {
      if (this.currentWorkspaceNamespace && frame.namespace === this.currentWorkspaceNamespace) {
        cb(frame)
      }
    })
  }

  getLatest(query: DataQuery): Record<string, any> {
    const s = this.namespaces.get(query.namespace)
    if (!s) return {}
    const out: Record<string, any> = {}
    s.fields.forEach((f, key) => {
      if (query.fields && !query.fields.includes(key)) return
      out[key] = f.value
    })
    return out
  }

  getRealtimeWindow(query: DataQuery, windowMs: number): DataPoint[] {
    const s = this.namespaces.get(query.namespace)
    if (!s) return []
    return s.buffer.windowByTime(windowMs)
  }

  getNamespaceOrigin(ns: string): NamespaceOrigin | undefined {
    return this.namespaceOrigin.get(ns)
  }

  listNamespaceOrigins(): ReadonlyMap<string, NamespaceOrigin> {
    return new Map(this.namespaceOrigin)
  }

  dispose(): void {
    this.subscribers.clear()
    this.namespaces.clear()
    this.namespaceOrigin.clear()
  }
}

let _instance: DataHub | null = null

export function initDataHub(opts: DataHubOptions): DataHub {
  if (_instance) _instance.dispose()
  _instance = new DataHub(opts)
  return _instance
}

export function getDataHub(): DataHub {
  if (!_instance) throw new Error('DataHub not initialized. Call initDataHub() first.')
  return _instance
}
