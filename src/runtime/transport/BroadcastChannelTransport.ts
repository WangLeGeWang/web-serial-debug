import type { HubTransport } from './HubTransport'
import type { DataFrame } from '@/runtime/data/types'

export class BroadcastChannelTransport implements HubTransport {
  readonly id: string
  private channel: BroadcastChannel | null = null
  private cb: ((f: DataFrame) => void) | null = null
  private listener: ((e: MessageEvent) => void) | null = null

  constructor(private readonly channelName = 'wssd-hub') {
    this.id = 'broadcast:' + channelName
  }

  async start(): Promise<void> {
    if (typeof BroadcastChannel === 'undefined') return
    this.channel = new BroadcastChannel(this.channelName)
    this.listener = (e: MessageEvent) => {
      if (this.cb && e.data && typeof e.data === 'object') this.cb(e.data as DataFrame)
    }
    this.channel.addEventListener('message', this.listener)
  }

  async stop(): Promise<void> {
    if (this.channel && this.listener) {
      this.channel.removeEventListener('message', this.listener)
    }
    this.channel?.close()
    this.channel = null
    this.listener = null
    this.cb = null
  }

  send(frame: DataFrame): void {
    this.channel?.postMessage(frame)
  }

  onFrame(cb: (f: DataFrame) => void): void {
    this.cb = cb
  }
}
