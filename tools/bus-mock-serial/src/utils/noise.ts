// tools/bus-mock-serial/src/utils/noise.ts

/** Box-Muller 变换生成高斯随机数 */
export function gaussianRandom(): number {
  const u1 = Math.random()
  const u2 = Math.random()
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2)
}

/**
 * 计算字段当前值
 * value = base + drift * elapsedSecs * driftScale + gaussianNoise * noise * noiseScale
 * 如果有 override 值，直接返回 override
 */
export function computeFieldValue(
  field: { base: number; noise?: number; drift?: number; range?: [number, number] },
  elapsedSecs: number,
  noiseScale: number,
  driftScale: number,
  override?: number
): number {
  if (override !== undefined) {
    return override
  }

  let value = field.base

  // 漂移
  if (field.drift !== undefined) {
    value += field.drift * elapsedSecs * driftScale
  }

  // 噪声
  if (field.noise !== undefined && field.noise > 0) {
    value += gaussianRandom() * field.noise * noiseScale
  }

  // 范围限制
  if (field.range) {
    value = Math.max(field.range[0], Math.min(field.range[1], value))
  }

  return value
}