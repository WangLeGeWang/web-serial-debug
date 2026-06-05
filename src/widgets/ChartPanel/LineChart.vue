<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, reactive } from 'vue'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { useDark } from '@vueuse/core'
import ChartLegend from './ChartLegend.vue'

interface YRangeConfig {
  mode: 'auto' | 'fixed'
  min?: number
  max?: number
}

interface TooltipRow {
  field: string
  color: string
  value: number | null
  focused: boolean
}

interface Props {
  data: number[][]
  fields: string[]
  height?: number
  legendPlacement?: 'bottom' | 'right' | 'none'
  legendWidthPercent?: number
  legendColumns?: number[]
  lineWidth?: number
  showPoints?: boolean
  smooth?: boolean
  yRange?: YRangeConfig
}

const props = withDefaults(defineProps<Props>(), {
  height: 300,
  legendPlacement: 'right',
  legendWidthPercent: 25,
  legendColumns: () => [0, 1, 2, 3],
  lineWidth: 1.5,
  showPoints: true,
  smooth: false,
  yRange: () => ({ mode: 'auto' })
})

const container = ref<HTMLElement | null>(null)
const chartAreaEl = ref<HTMLElement | null>(null)
const chart = ref<uPlot | null>(null)
const isDark = useDark()

const tooltipState = reactive({
  visible: false,
  idx: -1,
  leftPx: 0,
  topPx: 0,
  rows: [] as TooltipRow[],
  time: '',
})

const darkTheme = {
  background: '#141414',
  gridColor: 'rgba(255,255,255,0.06)',
  textColor: '#b0b0b0',
  lineColors: ['#3b82f6', '#ef4444', '#22c55e', '#eab308', '#d946ef', '#06b6d4']
}

const lightTheme = {
  background: '#ffffff',
  gridColor: 'rgba(0,0,0,0.06)',
  textColor: '#666666',
  lineColors: ['#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#c026d3', '#0891b2']
}

const currentTheme = computed(() => isDark.value ? darkTheme : lightTheme)

const formatValue = (v: number | null): string => {
  if (v === null || v === undefined || isNaN(v as number)) return '--'
  const n = v as number
  const abs = Math.abs(n)
  if (abs === 0) return '0'
  if (abs >= 10000) return n.toFixed(0)
  if (abs >= 100) return n.toFixed(1)
  if (abs >= 1) return n.toFixed(2)
  if (abs >= 0.01) return n.toFixed(3)
  return n.toFixed(4)
}

const hasData = computed(() => {
  const ts = props.data[0]
  if (!ts || ts.length === 0) return false
  if (ts.length === 1 && ts[0] <= 1) return false
  const span = ts[ts.length - 1] - ts[0]
  if (span <= 0 && ts.length <= 2) return false
  return true
})

const effectiveData = computed(() => {
  if (hasData.value) return props.data

  const now = Date.now() / 1000
  const start = now - 300
  const count = 31
  const timestamps: number[] = Array.from({ length: count }, (_, i) => start + i * 10)
  const seriesData = props.fields.length > 0
    ? props.fields.map(() => timestamps.map(() => null as unknown as number))
    : [timestamps.map(() => null as unknown as number)]
  return [timestamps, ...seriesData]
})

const chartAreaHeight = computed(() => {
  if (props.legendPlacement === 'none') return props.height
  if (props.legendPlacement === 'bottom') {
    const legendRows = Math.max(props.fields.length, 1)
    const legendH = legendRows <= 1 ? 36 : 28 + legendRows * 24
    return Math.max(props.height - legendH, 80)
  }
  return props.height
})

const formatTooltipTime = (u: uPlot, v: number): string => {
  if (!v) return '--'
  const d = new Date(v * 1000)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  const ms = String(d.getMilliseconds()).padStart(3, '0')
  return `${hh}:${mm}:${ss}.${ms}`
}

const formatTimeFromEpoch = (epoch: number): string => {
  const d = new Date(epoch * 1000)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  const ms = String(d.getMilliseconds()).padStart(3, '0')
  return `${hh}:${mm}:${ss}.${ms}`
}

const formatYValue = (u: uPlot, vals: number[], space: number): string[] => {
  return vals.map(v => {
    if (v === null || isNaN(v as number)) return '--'
    const n = v as number
    const abs = Math.abs(n)
    if (abs === 0) return '0'
    if (abs >= 10000) return n.toFixed(0)
    if (abs >= 100) return n.toFixed(1)
    if (abs >= 1) return n.toFixed(2)
    if (abs >= 0.01) return n.toFixed(3)
    return n.toFixed(4)
  })
}

const onSetCursor = (u: uPlot) => {
  const idx = u.cursor.idx
  if (idx === null || idx === undefined || idx < 0) {
    tooltipState.visible = false
    return
  }

  const theme = currentTheme.value
  const timestamps = u.data[0]
  const timeVal = timestamps[idx]
  tooltipState.time = timeVal != null ? formatTimeFromEpoch(timeVal as number) : '--'

  tooltipState.idx = idx as number
  tooltipState.leftPx = u.cursor.left ?? 0
  tooltipState.topPx = u.cursor.top ?? 0

  let focusedIdx = -1
  let minDist = Infinity
  const cursorY = u.cursor.top ?? 0

  tooltipState.rows = props.fields.map((field, i) => {
    const seriesIdx = i + 1
    const val = u.data[seriesIdx]?.[idx as number]
    const focused = false
    if (val != null && !isNaN(val as number)) {
      const yPos = u.valToPos(val as number, 'y')
      const dist = Math.abs(cursorY - yPos)
      if (dist < minDist) {
        minDist = dist
        focusedIdx = i
      }
    }
    return {
      field,
      color: theme.lineColors[i % theme.lineColors.length],
      value: val as number | null,
      focused,
    }
  })

  if (focusedIdx >= 0 && minDist < 40) {
    tooltipState.rows[focusedIdx].focused = true
  }

  tooltipState.visible = true
}

const tooltipPosition = computed(() => {
  if (!chartAreaEl.value) return { left: '0px', top: '0px' }

  const chartRect = chartAreaEl.value.getBoundingClientRect()
  const left = tooltipState.leftPx
  const top = tooltipState.topPx

  const tooltipWidth = 180
  const chartWidth = chartRect.width

  if (left + tooltipWidth + 20 > chartWidth) {
    return { left: `${left - tooltipWidth - 12}px`, top: `${top + 16}px` }
  }
  return { left: `${left + 16}px`, top: `${top + 16}px` }
})

const initUplot = () => {
  if (!container.value) return

  const theme = currentTheme.value
  const yRange = props.yRange

  const yRangeConfig = yRange.mode === 'fixed'
    ? { auto: false, range: [yRange.min ?? 0, yRange.max ?? 100] as [number, number] }
    : { auto: true, range: undefined }

  const opts = {
    width: container.value.clientWidth || 200,
    height: chartAreaHeight.value,
    cursor: {
      sync: { key: 'serial0' },
      drag: { x: true, y: true },
      focus: { prox: 30 },
    },
    hooks: {
      setCursor: [onSetCursor],
    },
    legend: { show: false },
    series: [
      {
        label: 'Time',
        value: formatTooltipTime,
      },
      ...props.fields.map((field, i) => ({
        label: field,
        stroke: theme.lineColors[i % theme.lineColors.length],
        width: props.lineWidth,
        points: { show: props.showPoints, size: 4 },
        smooth: props.smooth ? 0.3 : undefined as number | undefined,
      }))
    ],
    axes: [
      {
        stroke: theme.textColor,
        grid: {
          stroke: theme.gridColor,
          width: 1,
        },
        ticks: {
          stroke: theme.gridColor,
          width: 1,
        },
        font: '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        labelFont: '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        gap: 6,
        size: 36,
      },
      {
        stroke: theme.textColor,
        grid: {
          stroke: theme.gridColor,
          width: 1,
        },
        ticks: {
          stroke: theme.gridColor,
          width: 1,
        },
        font: '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        labelFont: '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        gap: 6,
        size: 44,
        values: formatYValue,
      }
    ],
    scales: {
      x: { time: true },
      y: yRangeConfig,
    },
    padding: [14, 12, 14, 12] as [number, number, number, number],
    bg: theme.background,
  }

  chart.value = new uPlot(opts, effectiveData.value as any, container.value)
}

const handleResize = () => {
  if (chart.value && container.value) {
    const w = container.value.clientWidth
    if (w) {
      chart.value.setSize({ width: w, height: chartAreaHeight.value })
    }
  }
}

let resizeObserver: ResizeObserver | null = null

watch(() => props.data, (newData) => {
  if (chart.value) {
    chart.value.setData(effectiveData.value as any)
  }
}, { deep: true })

watch(() => props.fields, () => {
  if (chart.value) {
    chart.value.destroy()
    chart.value = null
  }
  tooltipState.visible = false
  initUplot()
})

watch(() => props.yRange, () => {
  if (chart.value) {
    chart.value.destroy()
    chart.value = null
  }
  tooltipState.visible = false
  initUplot()
}, { deep: true })

watch(() => props.lineWidth, () => {
  if (chart.value) {
    chart.value.destroy()
    chart.value = null
  }
  tooltipState.visible = false
  initUplot()
})

watch(() => props.showPoints, () => {
  if (chart.value) {
    chart.value.destroy()
    chart.value = null
  }
  tooltipState.visible = false
  initUplot()
})

watch(() => props.smooth, () => {
  if (chart.value) {
    chart.value.destroy()
    chart.value = null
  }
  tooltipState.visible = false
  initUplot()
})

onMounted(() => {
  initUplot()
  window.addEventListener('resize', handleResize)
  // ResizeObserver 直接监听容器 DOM 元素，精确感知 grid-layout 内的 resize
  if (container.value) {
    resizeObserver = new ResizeObserver(() => {
      handleResize()
    })
    resizeObserver.observe(container.value)
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  resizeObserver?.disconnect()
  if (chart.value) {
    chart.value.destroy()
  }
})
</script>

<template>
  <div
    class="line-chart"
    :style="{ height: props.height + 'px' }"
  >
    <div
      class="chart-body"
      :class="`chart-body--legend-${legendPlacement}`"
    >
      <div ref="chartAreaEl" class="chart-area">
        <div
          v-if="!hasData"
          class="no-data-overlay"
        >
          <span class="no-data-text">No data</span>
        </div>
        <div
          ref="container"
          class="chart-container"
          :style="{ height: chartAreaHeight + 'px' }"
        ></div>
        <div
          v-if="tooltipState.visible && hasData"
          class="chart-tooltip"
          :class="isDark ? 'chart-tooltip--dark' : 'chart-tooltip--light'"
          :style="tooltipPosition"
        >
          <div class="chart-tooltip__time">{{ tooltipState.time }}</div>
          <div class="chart-tooltip__rows">
            <div
              v-for="row in tooltipState.rows"
              :key="row.field"
              class="chart-tooltip__row"
              :class="{ 'chart-tooltip__row--focused': row.focused }"
            >
              <span class="chart-tooltip__dot" :style="{ background: row.color }"></span>
              <span class="chart-tooltip__name">{{ row.field }}</span>
              <span class="chart-tooltip__value">{{ formatValue(row.value) }}</span>
            </div>
          </div>
        </div>
      </div>
      <ChartLegend
        v-if="legendPlacement !== 'none'"
        :data="effectiveData"
        :fields="fields"
        :line-colors="currentTheme.lineColors"
        :placement="legendPlacement"
        :width-percent="legendWidthPercent"
        :visible-columns="legendColumns"
      />
    </div>
  </div>
</template>

<style scoped>
.line-chart {
  width: 100%;
  position: relative;
  background: var(--el-bg-color);
  border-radius: 4px;
}

.chart-body--legend-bottom {
  display: flex;
  flex-direction: column;
}

.chart-body--legend-right {
  display: flex;
  flex-direction: row;
}

.chart-body--legend-none {
  display: flex;
  flex-direction: column;
}

.chart-area {
  flex: 1;
  min-width: 0;
  position: relative;
}

.chart-body--legend-right .chart-area {
  flex: 1;
}

.chart-container {
  width: 100%;
}

.no-data-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 10;
}

.no-data-text {
  font-size: 14px;
  opacity: 0.5;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.chart-tooltip {
  position: absolute;
  min-width: 100px;
  max-width: 200px;
  padding: 5px 7px;
  border-radius: 4px;
  font-size: 11px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  pointer-events: none;
  z-index: 20;
  line-height: 1.4;
  backdrop-filter: blur(4px);
  transition: opacity 0.08s;
}

.chart-tooltip--dark {
  background: rgba(20, 20, 20, 0.92);
  color: #d4d4d4;
}

.chart-tooltip--light {
  background: rgba(255, 255, 255, 0.92);
  color: #333;
}

.chart-tooltip__time {
  font-weight: 600;
  padding-bottom: 3px;
  margin-bottom: 3px;
}

.chart-tooltip__rows {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.chart-tooltip__row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 1px 0;
  border-radius: 2px;
  opacity: 0.6;
}

.chart-tooltip__row--focused {
  opacity: 1;
  background: rgba(128, 128, 128, 0.2);
}

.chart-tooltip__dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 2px;
}

.chart-tooltip__row--focused .chart-tooltip__dot {
  width: 10px;
  height: 10px;
}

.chart-tooltip__name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chart-tooltip__value {
  text-align: right;
  font-weight: 500;
  white-space: nowrap;
}
</style>