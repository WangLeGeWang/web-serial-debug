#!/usr/bin/env node
/**
 * Mock 串口数据发送器（CommonJS，避免与 ESM package 冲突）
 * 用法：node test/mock-serial-sender.cjs [device] [intervalMs]
 * 默认：写入 /tmp/ttyV1（socat 创建的另一端），每 500ms 一行 JSON
 *
 * 启动 socat：
 *   socat -d -d pty,raw,echo=0,link=/tmp/ttyV0 pty,raw,echo=0,link=/tmp/ttyV1
 * 然后 Tauri 应用打开 /tmp/ttyV0 即可收到本脚本写入的数据。
 */

const fs = require('node:fs')

const device = process.argv[2] || '/tmp/ttyV1'
const intervalMs = Number(process.argv[3] || 500)

console.log(`[mock-serial] writing to ${device} every ${intervalMs}ms ...`)

let fd
try {
  fd = fs.openSync(device, 'r+')
} catch (e) {
  console.error(`[mock-serial] open ${device} failed:`, e.message)
  console.error('请确认已运行 socat：')
  console.error('  socat -d -d pty,raw,echo=0,link=/tmp/ttyV0 pty,raw,echo=0,link=/tmp/ttyV1')
  process.exit(1)
}

let seq = 0
const timer = setInterval(() => {
  const t = Date.now() / 1000
  const payload =
    JSON.stringify({
      seq: seq++,
      ts: t.toFixed(3),
      ax: +(Math.sin(t) * 9.8).toFixed(3),
      ay: +(Math.cos(t) * 9.8).toFixed(3),
      az: +(Math.sin(t * 0.5) * 9.8).toFixed(3),
      temp: +(25 + Math.sin(t / 10) * 2).toFixed(2),
    }) + '\n'
  try {
    fs.writeSync(fd, payload)
  } catch (e) {
    console.error('[mock-serial] write error:', e.message)
    clearInterval(timer)
    process.exit(1)
  }
}, intervalMs)

process.on('SIGINT', () => {
  clearInterval(timer)
  try { fs.closeSync(fd) } catch {}
  console.log('\n[mock-serial] stopped.')
  process.exit(0)
})
