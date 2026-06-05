// tools/bus-mock-serial/src/utils/format.ts

import type { FieldConfig } from '../scenarios/types.js'

/**
 * CSV 格式: "pitch:0.13,roll:0.00,yaw:0.07\n"
 * 与 BUS Studio 默认脚本兼容
 */
export function formatCSV(values: Map<string, number>): string {
  const parts: string[] = []
  for (const [key, value] of values) {
    parts.push(`${key}:${value.toFixed(2)}`)
  }
  return parts.join(',') + '\n'
}

/**
 * JSON 格式: {"pitch":0.13,"roll":0.00}\n
 */
export function formatJSON(values: Map<string, number>): string {
  const obj: Record<string, number> = {}
  for (const [key, value] of values) {
    obj[key] = Number(value.toFixed(4))
  }
  return JSON.stringify(obj) + '\n'
}

/**
 * HEX 格式: 二进制帧
 * 帧结构: [0xAA, 0x55] + fieldCount(1byte) + float32值们(N*4bytes) + checksum(1byte)
 * checksum = XOR 所有字节（不含帧头）
 */
export function formatHEX(values: Map<string, number>): Buffer {
  const fieldCount = values.size
  const payloadLen = 1 + fieldCount * 4  // fieldCount + values
  const buf = Buffer.alloc(2 + payloadLen + 1)  // header + payload + checksum

  buf[0] = 0xAA  // 帧头1
  buf[1] = 0x55  // 帧头2
  buf[2] = fieldCount

  let offset = 3
  for (const [, value] of values) {
    buf.writeFloatLE(value, offset)
    offset += 4
  }

  // XOR 校验和（从 fieldCount 到最后一个 value 字节）
  let checksum = 0
  for (let i = 2; i < offset; i++) {
    checksum ^= buf[i]
  }
  buf[offset] = checksum

  return buf
}

export type FormatFn = (values: Map<string, number>) => string | Buffer

export function getFormatFn(format: 'csv' | 'json' | 'hex'): FormatFn {
  switch (format) {
    case 'csv': return formatCSV
    case 'json': return formatJSON
    case 'hex': return formatHEX
  }
}