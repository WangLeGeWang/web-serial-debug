import WebSocket from 'ws'

const ws = new WebSocket('ws://localhost:8080')

let received = 0

ws.on('open', () => {
  console.log('✅ Connected to ws://localhost:8080')
})

ws.on('message', (data) => {
  received++
  if (received <= 3) {
    console.log(`📩 Message ${received}: ${data.toString().trim()}`)
  }
  if (received === 3) {
    // Test AT command
    ws.send('AT\n')
  }
  if (received === 4) {
    // AT response should be "OK"
    console.log(`📩 AT response: ${data.toString().trim()}`)
  }
  if (received >= 4) {
    console.log('✅ All tests passed!')
    ws.close()
    process.exit(0)
  }
})

ws.on('error', (err) => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})

ws.on('close', () => {
  console.log('Connection closed')
})

setTimeout(() => {
  console.error(`❌ Timeout after 5s - received ${received} messages`)
  ws.close()
  process.exit(1)
}, 5000)