<script setup lang="ts">
import { computed } from 'vue'
import { useDark } from '@vueuse/core'

interface SeriesStats {
  field: string
  color: string
  min: number
  max: number
  avg: number
  current: number
}

// 图例显示列定义：0=当前值, 1=最小, 2=最大, 3=平均
const ALL_COLUMNS = [
  { index: 0, label: 'Current', rightLabel: 'Now' },
  { index: 1, label: 'Min', rightLabel: 'Min' },
  { index: 2, label: 'Max', rightLabel: 'Max' },
  { index: 3, label: 'Avg', rightLabel: 'Avg' },
]

interface Props {
  data: number[][]
  fields: string[]
  lineColors: string[]
  placement?: 'bottom' | 'right'
  widthPercent?: number
  visibleColumns?: number[]
  hasData?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  placement: 'bottom',
  widthPercent: 25,
  visibleColumns: () => [0, 1, 2, 3],
  hasData: true
})

const isDark = useDark()

const activeColumns = computed(() => {
  return ALL_COLUMNS.filter(c => props.visibleColumns.includes(c.index))
})

const seriesStats = computed<SeriesStats[]>(() => {
  if (props.fields.length === 0) return []

  if (!props.hasData) {
    return props.fields.map((field, i) => ({
      field,
      color: props.lineColors[i % props.lineColors.length],
      min: NaN,
      max: NaN,
      avg: NaN,
      current: NaN
    }))
  }

  return props.fields.map((field, i) => {
    const seriesIdx = i + 1
    const values = props.data[seriesIdx] || []
    const validValues = values.filter(v => v !== null && v !== undefined && !isNaN(v))

    if (validValues.length === 0) {
      return {
        field,
        color: props.lineColors[i % props.lineColors.length],
        min: NaN,
        max: NaN,
        avg: NaN,
        current: NaN
      }
    }

    const min = Math.min(...validValues)
    const max = Math.max(...validValues)
    const avg = validValues.reduce((s, v) => s + v, 0) / validValues.length
    const current = validValues[validValues.length - 1]

    return {
      field,
      color: props.lineColors[i % props.lineColors.length],
      min,
      max,
      avg,
      current
    }
  })
})

const formatValue = (v: number): string => {
  if (isNaN(v)) return '-'
  if (Number.isInteger(v)) return v.toString()
  const abs = Math.abs(v)
  if (abs >= 1000) return v.toFixed(1)
  if (abs >= 1) return v.toFixed(2)
  return v.toFixed(4)
}

const getStatValue = (stat: SeriesStats, colIndex: number): number => {
  switch (colIndex) {
    case 0: return stat.current
    case 1: return stat.min
    case 2: return stat.max
    case 3: return stat.avg
    default: return NaN
  }
}
</script>

<template>
  <div
    class="chart-legend"
    :class="[
      `chart-legend--${placement}`,
      isDark ? 'chart-legend--dark' : 'chart-legend--light'
    ]"
    :style="placement === 'right' ? { width: widthPercent + '%' } : {}"
  >
    <template v-if="placement === 'bottom'">
      <table class="legend-table">
        <thead>
          <tr>
            <th class="legend-table__color-col"></th>
            <th class="legend-table__name-col">Series</th>
            <th v-for="col in activeColumns" :key="col.index">{{ col.label }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="stat in seriesStats" :key="stat.field" class="legend-row">
            <td class="legend-table__color-col">
              <span class="legend-color-dot" :style="{ background: stat.color }"></span>
            </td>
            <td class="legend-table__name-col">{{ stat.field }}</td>
            <td v-for="col in activeColumns" :key="col.index" class="legend-table__value">
              {{ formatValue(getStatValue(stat, col.index)) }}
            </td>
          </tr>
        </tbody>
      </table>
    </template>
    <template v-else>
      <div class="legend-list">
        <div v-for="stat in seriesStats" :key="stat.field" class="legend-item">
          <div class="legend-item__header">
            <span class="legend-color-dot" :style="{ background: stat.color }"></span>
            <span class="legend-item__name">{{ stat.field }}</span>
          </div>
          <div class="legend-item__stats" :style="{ gridTemplateColumns: `repeat(${activeColumns.length}, 1fr)` }">
            <div v-for="col in activeColumns" :key="col.index" class="legend-item__stat">
              <span class="legend-item__stat-label">{{ col.rightLabel }}</span>
              <span class="legend-item__stat-value">{{ formatValue(getStatValue(stat, col.index)) }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.chart-legend {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 12px;
  line-height: 1.4;
}

.chart-legend--light {
  color: #333;
}

.chart-legend--dark {
  color: #d4d4d4;
}

.chart-legend--bottom {
  width: 100%;
  overflow-x: auto;
}

.chart-legend--right {
  overflow-y: auto;
}

.legend-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.legend-table th {
  padding: 4px 8px;
  text-align: right;
  font-weight: 600;
  white-space: nowrap;
  border-bottom: 1px solid rgba(128, 128, 128, 0.3);
}

.legend-table__color-col {
  width: 20px;
  text-align: center;
}

.legend-table__name-col {
  text-align: left;
  width: auto;
}

.legend-table__value {
  padding: 4px 8px;
  text-align: right;
  white-space: nowrap;
}

.legend-row:hover {
  background: rgba(128, 128, 128, 0.15);
}

.legend-color-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
  vertical-align: middle;
}

.legend-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.legend-item {
  padding: 4px 8px;
  border-radius: 4px;
}

.legend-item:hover {
  background: rgba(128, 128, 128, 0.15);
}

.legend-item__header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.legend-item__name {
  overflow: hidden;
  text-overflow: ellipsis;
}

.legend-item__stats {
  display: grid;
  gap: 2px 8px;
}

.legend-item__stat {
  display: flex;
  justify-content: space-between;
  gap: 4px;
}

.legend-item__stat-label {
  opacity: 0.6;
  font-size: 11px;
}

.legend-item__stat-value {
  text-align: right;
  font-size: 11px;
}
</style>