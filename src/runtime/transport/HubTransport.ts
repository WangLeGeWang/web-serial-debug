import type { DataFrame, HistoryQuery, DataPoint } from '@/runtime/data/types'

export interface HubTransport {
  readonly id: string
  start(): Promise<void>
  stop(): Promise<void>
  send(frame: DataFrame): void
  onFrame(cb: (frame: DataFrame) => void): void
  queryHistory?(query: HistoryQuery): Promise<DataPoint[]>
}
