import { NamespaceStore } from './NamespaceStore'
import type {
  DataFrame, DataQuery, DataPoint, NamespaceOrigin, HistoryQuery, RecordingId, FieldState
} from './types'
import type { HubTransport } from '@/runtime/transport/HubTransport'
import { dataSeriesStorage, type DataSeries, CHUNK_SIZE } from '@/utils/DataSeriesStorage'
import { lttb } from '@/utils/lttb'

interface RecordingState {
  id: RecordingId
  namespace: string
  name: string
  startTime: number
  pointCount: number
  fields: Set<string>
  chunkIndex: number
  buf: DataPoint[]
  firstTimestamp: number | null
  lastTimestamp: number
  pendingChunks: Promise<void>[]
  hasError: boolean
}

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
  private readonly transports = new Set<HubTransport>()
  private readonly transportById = new Map<string, HubTransport>()
  private readonly recordings = new Map<RecordingId, RecordingState>()

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

    for (const r of this.recordings.values()) {
      if (r.namespace !== frame.namespace) continue
      const numeric: Record<string, number> = {}
      for (const [k, v] of Object.entries(frame.values)) {
        if (typeof v === 'number') {
          numeric[k] = v
          r.fields.add(k)
        }
      }
      if (Object.keys(numeric).length === 0) continue
      r.buf.push({ timestamp: frame.timestamp, values: numeric })
      r.pointCount++
      if (r.firstTimestamp === null) r.firstTimestamp = frame.timestamp
      r.lastTimestamp = frame.timestamp
      if (r.buf.length >= CHUNK_SIZE) {
        const chunk = { seriesId: r.id, chunkIndex: r.chunkIndex++, points: r.buf }
        r.buf = []
        const recording = r
        r.pendingChunks.push(
          dataSeriesStorage.saveChunk(chunk).catch(err => {
            recording.hasError = true
            console.error(`[DataHub] saveChunk failed for recording ${recording.id} (ns=${recording.namespace}, chunkIndex=${chunk.chunkIndex})`, err)
          })
        )
      }
    }

    if (source === 'local') {
      for (const t of this.transports) {
        try { t.send(frame) } catch { /* swallow */ }
      }
    }

    for (const sub of this.subscribers) {
      if ((sub.query.namespace as any) === '*' || sub.query.namespace === frame.namespace) sub.cb(frame)
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

  /** 返回指定 namespace 下所有字段的完整状态（包含 value / min / max / avg 等） */
  getFieldStates(query: DataQuery): FieldState[] {
    const s = this.namespaces.get(query.namespace)
    if (!s) return []
    const result: FieldState[] = []
    s.fields.forEach((f) => {
      if (query.fields && !query.fields.includes(f.key)) return
      result.push(f)
    })
    return result
  }

  getRealtimeWindow(query: DataQuery, windowMs: number): DataPoint[] {
    const s = this.namespaces.get(query.namespace)
    if (!s) return []
    return s.buffer.windowByTime(windowMs)
  }

  startRecording(namespace: string, name = 'untitled'): RecordingId {
    const id: RecordingId = `rec-${crypto.randomUUID()}`
    if (this.recordings.has(id)) {
      throw new Error(`[DataHub.startRecording] recording id collision: ${id}`)
    }
    this.recordings.set(id, {
      id, namespace, name, startTime: Date.now(),
      pointCount: 0, fields: new Set(), chunkIndex: 0, buf: [],
      firstTimestamp: null, lastTimestamp: 0, pendingChunks: [], hasError: false
    })
    return id
  }

  async stopRecording(id: RecordingId): Promise<DataSeries> {
    const r = this.recordings.get(id)
    if (!r) throw new Error('recording not found: ' + id)
    this.recordings.delete(id)
    await Promise.allSettled(r.pendingChunks)
    if (r.buf.length > 0) {
      try {
        await dataSeriesStorage.saveChunk({
          seriesId: r.id, chunkIndex: r.chunkIndex, points: r.buf
        })
      } catch (err) {
        r.hasError = true
        console.error(`[DataHub] saveChunk failed for tail chunk of recording ${r.id} (ns=${r.namespace}, chunkIndex=${r.chunkIndex})`, err)
      }
    }
    const series: DataSeries = {
      id: r.id,
      namespace: r.namespace,
      name: r.name,
      startTime: r.firstTimestamp ?? r.startTime,
      endTime: r.lastTimestamp || (r.firstTimestamp ?? r.startTime),
      pointCount: r.pointCount,
      fields: Array.from(r.fields),
      createdAt: r.startTime,
      sizeBytes: 0
    }
    await dataSeriesStorage.saveSeries(series)
    if (r.hasError) {
      console.warn(`[DataHub] recording ${r.id} completed with chunk save errors; series.pointCount (${r.pointCount}) may be inconsistent with persisted data`)
    }
    return series
  }

  async listSeries(namespace?: string): Promise<DataSeries[]> {
    return dataSeriesStorage.listSeries(namespace)
  }

  async queryHistory(query: HistoryQuery): Promise<DataPoint[]> {
    if (query.timeRange[0] > query.timeRange[1]) {
      throw new Error(`[DataHub.queryHistory] invalid timeRange: start ${query.timeRange[0]} > end ${query.timeRange[1]}`)
    }
    const origin = this.namespaceOrigin.get(query.namespace) ?? 'local'
    if (origin === 'local') {
      const raw = await dataSeriesStorage.queryByRange(query.namespace, query.timeRange)
      return query.maxPoints && raw.length > query.maxPoints
        ? lttb(raw, query.maxPoints)
        : raw
    }
    const t = this.transportById.get(origin)
    if (t?.queryHistory) return t.queryHistory(query)
    console.warn('[DataHub] no transport for namespace', query.namespace)
    return []
  }

  attachTransport(t: HubTransport): void {
    this.transports.add(t)
    this.transportById.set(t.id, t)
    t.onFrame((frame) => {
      if (frame.origin === this.origin) return
      this.append({ ...frame, source: 'remote' })
    })
  }

  detachTransport(t: HubTransport): void {
    this.transports.delete(t)
    this.transportById.delete(t.id)
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
    this.transports.clear()
    this.transportById.clear()
    for (const r of this.recordings.values()) {
      console.warn(`[DataHub] dispose: dropping in-flight recording ${r.id} (ns=${r.namespace}, ${r.pointCount} points, ${r.pendingChunks.length} pending chunks)`)
      Promise.allSettled(r.pendingChunks).catch(() => {})
    }
    this.recordings.clear()
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
