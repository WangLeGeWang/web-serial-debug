// tools/bus-mock-serial/src/core/WsServer.ts

import { WebSocketServer, WebSocket } from 'ws'
import type { DataEngine, DataOutput } from './DataEngine.js'
import { AtCommandHandler } from './AtCommandHandler.js'

export class WsServer {
  private wss: WebSocketServer | null = null
  private engine: DataEngine
  private atHandler: AtCommandHandler
  private clients: Set<WebSocket> = new Set()
  private port: number

  constructor(port: number, engine: DataEngine, atHandler: AtCommandHandler) {
    this.port = port
    this.engine = engine
    this.atHandler = atHandler
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.wss = new WebSocketServer({ port: this.port })

      this.wss.on('error', (err: Error) => {
        if ((err as any).code === 'EADDRINUSE') {
          reject(new Error(`Port ${this.port} is already in use. Use --ws-port to specify a different port.`))
        } else {
          reject(err)
        }
      })

      this.wss.on('connection', (ws) => {
        this.clients.add(ws)
        console.log(`[WS] Client connected (${this.clients.size} total)`)

        ws.on('message', (data) => {
          const text = data instanceof Buffer ? data.toString('utf-8') : String(data)
          const lines = AtCommandHandler.extractLines(text)
          for (const line of lines) {
            const response = this.atHandler.handle(line)
            ws.send(response + '\n')
          }
        })

        ws.on('close', () => {
          this.clients.delete(ws)
          console.log(`[WS] Client disconnected (${this.clients.size} total)`)
        })

        ws.on('error', (err) => {
          console.error('[WS] Client error:', err.message)
          this.clients.delete(ws)
        })
      })

      this.wss.on('listening', () => {
        console.log(`[WS] WebSocket server listening on ws://localhost:${this.port}`)
        resolve()
      })
    })
  }

  /** DataEngine 回调：将数据推送到所有连接的客户端 */
  broadcast(data: DataOutput): void {
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        if (typeof data === 'string') {
          client.send(data)
        } else {
          client.send(data)
        }
      }
    }
  }

  stop(): void {
    for (const client of this.clients) {
      client.close()
    }
    this.clients.clear()
    if (this.wss) {
      this.wss.close()
      this.wss = null
    }
    console.log('[WS] Server stopped')
  }
}