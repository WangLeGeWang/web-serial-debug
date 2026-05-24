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
  readonly namespaceOrigin = new Map<string, NamespaceOrigin>()

  constructor(opts: DataHubOptions) {
    this.origin = opts.origin
    this.bufferCapacity = opts.bufferCapacity ?? 50000
  }

  setCurrentWorkspaceNamespace(ns: string | null): void {
    this.currentWorkspaceNamespace = ns
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
      if (sub.query.namespace === frame.namespace) sub.cb(frame)
    }

    if (this.currentWorkspaceNamespace && frame.namespace === this.currentWorkspaceNamespace) {
      EventCenter.getInstance().emit(EventNames.DATA_UPDATE, frame.values)
    }
  }

  subscribe(query: DataQuery, cb: (frame: DataFrame) => void): () => void {
    const sub: Subscriber = { query, cb }
    this.subscribers.add(sub)
    return () => { this.subscribers.delete(sub) }
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
}

let _instance: DataHub | null = null

export function initDataHub(opts: DataHubOptions): DataHub {
  _instance = new DataHub(opts)
  return _instance
}

export function getDataHub(): DataHub {
  if (!_instance) throw new Error('DataHub not initialized. Call initDataHub() first.')
  return _instance
}
