import type { DataPoint } from '@/runtime/data/types'
import { getPlatform } from './Platform'

export interface DataSeries {
  id: string
  namespace: string
  name: string
  startTime: number
  endTime: number
  pointCount: number
  fields: string[]
  fieldTypes?: Record<string, 'number' | 'string' | 'boolean' | 'other'>
  createdAt: number
  sizeBytes: number
}

export interface DataChunk {
  seriesId: string
  chunkIndex: number
  points: DataPoint[]
}

const DB_NAME = 'wssd_data_series'
const DB_VERSION = 2

class IndexedDBStorage {
  private db: IDBDatabase | null = null
  private initPromise: Promise<void> | null = null

  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise
    
    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        const tx = (event.target as IDBOpenDBRequest).transaction!
        let seriesStore: IDBObjectStore
        if (!db.objectStoreNames.contains('series')) {
          seriesStore = db.createObjectStore('series', { keyPath: 'id' })
        } else {
          seriesStore = tx.objectStore('series')
        }
        if (!db.objectStoreNames.contains('chunks')) {
          const chunkStore = db.createObjectStore('chunks', { keyPath: ['seriesId', 'chunkIndex'] })
          chunkStore.createIndex('seriesId', 'seriesId', { unique: false })
        }
        if (event.oldVersion < 2) {
          seriesStore.openCursor().onsuccess = (e) => {
            const cursor = (e.target as IDBRequest).result
            if (cursor) {
              if (!cursor.value.namespace) {
                cursor.value.namespace = 'legacy'
                cursor.update(cursor.value)
              }
              cursor.continue()
            }
          }
          if (!seriesStore.indexNames.contains('namespace')) {
            seriesStore.createIndex('namespace', 'namespace', { unique: false })
          }
        }
      }
    })
    
    return this.initPromise
  }

  async saveSeries(series: DataSeries): Promise<void> {
    if (!this.db) await this.init()
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['series'], 'readwrite')
      const store = tx.objectStore('series')
      store.put(series)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async listSeries(namespace?: string): Promise<DataSeries[]> {
    if (!this.db) await this.init()
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['series'], 'readonly')
      const store = tx.objectStore('series')
      let request: IDBRequest
      if (namespace) {
        request = store.index('namespace').getAll(namespace)
      } else {
        request = store.getAll()
      }
      request.onsuccess = () => resolve(request.result as DataSeries[])
      request.onerror = () => reject(request.error)
    })
  }

  async getSeries(id: string): Promise<DataSeries | undefined> {
    if (!this.db) await this.init()
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['series'], 'readonly')
      const store = tx.objectStore('series')
      const request = store.get(id)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async saveChunk(chunk: DataChunk): Promise<void> {
    if (!this.db) await this.init()
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['chunks'], 'readwrite')
      const store = tx.objectStore('chunks')
      store.put(chunk)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async loadChunk(seriesId: string, chunkIndex: number): Promise<DataPoint[]> {
    if (!this.db) await this.init()
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['chunks'], 'readonly')
      const store = tx.objectStore('chunks')
      const request = store.get([seriesId, chunkIndex])
      request.onsuccess = () => resolve(request.result?.points || [])
      request.onerror = () => reject(request.error)
    })
  }

  async queryByRange(namespace: string, range: [number, number]): Promise<DataPoint[]> {
    const series = await this.listSeries(namespace)
    const candidates = series.filter(s => s.endTime >= range[0] && s.startTime <= range[1])
    const result: DataPoint[] = []
    for (const s of candidates) {
      const total = Math.ceil(s.pointCount / 10000)
      for (let i = 0; i < total; i++) {
        const points = await this.loadChunk(s.id, i)
        for (const p of points) {
          if (p.timestamp >= range[0] && p.timestamp <= range[1]) result.push(p)
        }
      }
    }
    result.sort((a, b) => a.timestamp - b.timestamp)
    return result
  }

  async deleteSeries(seriesId: string): Promise<void> {
    if (!this.db) await this.init()
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['series', 'chunks'], 'readwrite')
      tx.objectStore('series').delete(seriesId)
      const chunkStore = tx.objectStore('chunks')
      const index = chunkStore.index('seriesId')
      index.openCursor(IDBKeyRange.only(seriesId)).onsuccess = (e) => {
        const cursor = (e.target as IDBRequest).result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        }
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async exportToNDJSON(seriesId: string): Promise<string> {
    const series = await this.getSeries(seriesId)
    if (!series) throw new Error('Series not found')
    
    const chunks: DataPoint[] = []
    const totalChunks = Math.ceil(series.pointCount / 10000)
    
    for (let i = 0; i < totalChunks; i++) {
      const chunkPoints = await this.loadChunk(seriesId, i)
      chunks.push(...chunkPoints)
    }

    const meta = {
      type: 'meta',
      version: 1,
      name: series.name,
      startTime: series.startTime,
      endTime: series.endTime,
      fields: series.fields,
      pointCount: series.pointCount
    }

    let ndjson = JSON.stringify(meta) + '\n'
    for (const point of chunks) {
      ndjson += JSON.stringify({ t: point.timestamp, v: point.values }) + '\n'
    }
    
    return ndjson
  }
}

class WssdFileStorage {
  async saveSeries(_series: DataSeries): Promise<void> {
    console.warn('WssdFileStorage.saveSeries: Not implemented for browser platform')
  }

  async listSeries(_namespace?: string): Promise<DataSeries[]> {
    console.warn('WssdFileStorage.listSeries: Not implemented for browser platform')
    return []
  }

  async getSeries(_id: string): Promise<DataSeries | undefined> {
    console.warn('WssdFileStorage.getSeries: Not implemented for browser platform')
    return undefined
  }

  async saveChunk(_chunk: DataChunk): Promise<void> {
    console.warn('WssdFileStorage.saveChunk: Not implemented for browser platform')
  }

  async loadChunk(_seriesId: string, _chunkIndex: number): Promise<DataPoint[]> {
    console.warn('WssdFileStorage.loadChunk: Not implemented for browser platform')
    return []
  }

  async queryByRange(_namespace: string, _range: [number, number]): Promise<DataPoint[]> {
    console.warn('WssdFileStorage.queryByRange: Not implemented for browser platform')
    return []
  }

  async deleteSeries(_seriesId: string): Promise<void> {
    console.warn('WssdFileStorage.deleteSeries: Not implemented for browser platform')
  }

  async exportToNDJSON(_seriesId: string): Promise<string> {
    console.warn('WssdFileStorage.exportToNDJSON: Not implemented for browser platform')
    return ''
  }
}

export const dataSeriesStorage = getPlatform() === 'desktop'
  ? new WssdFileStorage()
  : new IndexedDBStorage()
