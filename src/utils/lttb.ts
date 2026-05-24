import type { DataPoint } from '@/runtime/data/types'

export function lttb(data: DataPoint[], threshold: number): DataPoint[] {
  if (data.length <= threshold) return data

  const result: DataPoint[] = [data[0]]
  const n = data.length
  let lastSelected = 0

  for (let i = 0; i < threshold - 2; i++) {
    const a = lastSelected
    let maxArea = -1
    let maxAreaPoint = 0

    const next = Math.min(Math.floor(i + threshold / 2), n - 1)
    for (let j = i + 1; j <= next; j++) {
      const area = triangleArea(
        data[a].timestamp, getFirstNumericValue(data[a].values),
        data[i].timestamp, getFirstNumericValue(data[i].values),
        data[j].timestamp, getFirstNumericValue(data[j].values)
      )
      if (area > maxArea) {
        maxArea = area
        maxAreaPoint = j
      }
    }

    result.push(data[maxAreaPoint])
    lastSelected = maxAreaPoint
  }

  result.push(data[n - 1])
  return result
}

function getFirstNumericValue(values: Record<string, any>): number {
  for (const key in values) {
    const val = values[key]
    if (typeof val === 'number') {
      return val
    }
  }
  return 0
}

function triangleArea(
  x1: number, y1: number,
  x2: number, y2: number,
  x3: number, y3: number
): number {
  return Math.abs((x1 - x3) * (y2 - y1) - (x1 - x2) * (y3 - y1)) / 2
}
