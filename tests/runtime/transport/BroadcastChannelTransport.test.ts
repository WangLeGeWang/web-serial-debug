import { describe, it, expect, beforeEach } from 'vitest'
import { BroadcastChannelTransport } from '@/runtime/transport/BroadcastChannelTransport'

class FakeChannel {
  static channels: FakeChannel[] = []
  listeners: ((e: { data: any }) => void)[] = []
  constructor(public name: string) { FakeChannel.channels.push(this) }
  postMessage(msg: any) {
    for (const c of FakeChannel.channels) {
      if (c !== this && c.name === this.name) {
        c.listeners.forEach(l => l({ data: msg }))
      }
    }
  }
  addEventListener(_t: string, cb: any) { this.listeners.push(cb) }
  removeEventListener(_t: string, cb: any) {
    const idx = this.listeners.indexOf(cb)
    if (idx >= 0) this.listeners.splice(idx, 1)
  }
  close() {}
}

beforeEach(() => {
  ;(globalThis as any).BroadcastChannel = FakeChannel
  FakeChannel.channels = []
})

describe('BroadcastChannelTransport', () => {
  it('send 后另一端 onFrame 收到', async () => {
    const a = new BroadcastChannelTransport('wssd-hub')
    const b = new BroadcastChannelTransport('wssd-hub')
    await a.start(); await b.start()
    const received: any[] = []
    b.onFrame(f => received.push(f))
    a.send({ namespace: 'ns', timestamp: 1, values: { x: 1 }, source: 'local', origin: 'a', seq: 1 })
    expect(received.length).toBe(1)
    expect(received[0].origin).toBe('a')
  })

  it('stop 后不再收消息', async () => {
    const a = new BroadcastChannelTransport('wssd-hub')
    const b = new BroadcastChannelTransport('wssd-hub')
    await a.start(); await b.start()
    const got: any[] = []
    b.onFrame(f => got.push(f))
    await b.stop()
    a.send({ namespace: 'ns', timestamp: 1, values: { x: 1 }, source: 'local', origin: 'a', seq: 1 })
    expect(got.length).toBe(0)
  })
})
