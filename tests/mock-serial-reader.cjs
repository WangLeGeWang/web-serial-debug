const fs = require('node:fs')
const path = process.argv[2] || '/tmp/ttyV0'
const ms = Number(process.argv[3] || 3000)
console.log(`[reader] open ${path}, read for ${ms}ms`)
const fd = fs.openSync(path, 'r+')
const stream = fs.createReadStream(null, { fd, autoClose: false })
stream.on('data', (chunk) => {
  process.stdout.write('[reader] <- ' + chunk.toString())
})
setTimeout(() => {
  console.log('[reader] done')
  try { fs.closeSync(fd) } catch {}
  process.exit(0)
}, ms)
