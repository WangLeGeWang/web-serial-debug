<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useDark } from '@vueuse/core'
import { useDataSource, type DataPoint } from '../../utils/DataSourceProvider'
import { echarts, type ECharts, type EChartsOption, type LineSeriesOption } from './echartsCore'
import { createBaseOption, getTheme } from './chartTheme'

interface Props {
  fields?: string[]
  maxPoints?: number
  refreshRate?: number
  sampling?: 'lttb' | 'average' | 'max' | 'min' | 'none'
  showArea?: boolean
  showSymbol?: boolean
  smooth?: boolean
  lineWidth?: number
}

const props = withDefaults(defineProps<Props>(), {
  fields: () => [],
  maxPoints: 10000,
  refreshRate: 100,
  sampling: 'lttb',
  showArea: true,
  showSymbol: false,
  smooth: false,
  lineWidth: 1.5
})

const chartEl = ref<HTMLElement | null>(null)
const chart = ref<ECharts | null>(null)
const isDark = useDark()
const dataSource = useDataSource()
let resizeObserver: ResizeObserver | null = null
let refreshTimer: number | null = null

const theme = computed(() => getTheme(isDark.value))

const chartFields = computed(() => {
  if (props.fields.length > 0) return props.fields
  return dataSource.fields
})

const visiblePoints = computed<DataPoint[]>(() => {
  const points = dataSource.visibleData
  const maxPoints = Number(props.maxPoints) || 10000
  if (points.length <= maxPoints) return points
  return points.slice(-maxPoints)
})

const hasData = computed(() => {
  return visiblePoints.value.length > 0 && chartFields.value.length > 0
})

const formatTime = (value: number) => {
  const date = new Date(value)
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')
  const seconds = `${date.getSeconds()}`.padStart(2, '0')
  const millis = `${date.getMilliseconds()}`.padStart(3, '0')
  return `${hours}:${minutes}:${seconds}.${millis}`
}

const createSeries = (): LineSeriesOption[] => {
  return chartFields.value.map((field: string, index: number): LineSeriesOption => ({
    name: field,
    type: 'line',
    data: visiblePoints.value.map((point: DataPoint): [number, number | null] => [point.timestamp, point.values[field] ?? null]),
    showSymbol: props.showSymbol,
    symbol: 'circle',
    symbolSize: 4,
    smooth: props.smooth,
    connectNulls: false,
    sampling: props.sampling === 'none' ? undefined : props.sampling,
    progressive: 5000,
    progressiveThreshold: 10000,
    lineStyle: {
      width: props.lineWidth,
      color: theme.value.colors[index % theme.value.colors.length]
    },
    itemStyle: {
      color: theme.value.colors[index % theme.value.colors.length]
    },
    areaStyle: props.showArea ? {
      opacity: 0.08,
      color: theme.value.colors[index % theme.value.colors.length]
    } : undefined,
    emphasis: {
      focus: 'series'
    }
  }))
}

const createOption = (): EChartsOption => {
  const baseOption = createBaseOption(theme.value)
  return {
    ...baseOption,
    xAxis: {
      type: 'time',
      axisLine: {
        lineStyle: {
          color: theme.value.axis
        }
      },
      axisTick: {
        lineStyle: {
          color: theme.value.axis
        }
      },
      axisLabel: {
        color: theme.value.mutedText,
        fontSize: 10,
        formatter: (value: number) => formatTime(value)
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: theme.value.grid,
          type: 'dashed'
        }
      },
      splitArea: {
        show: true,
        areaStyle: {
          color: [theme.value.splitArea, 'transparent']
        }
      }
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLine: {
        show: true,
        lineStyle: {
          color: theme.value.axis
        }
      },
      axisTick: {
        show: false
      },
      axisLabel: {
        color: theme.value.mutedText,
        fontSize: 10,
        formatter: (value: number) => Number.isInteger(value) ? `${value}` : value.toFixed(2)
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: theme.value.grid,
          type: 'dashed'
        }
      }
    },
    series: createSeries()
  }
}

const renderChart = () => {
  if (!chart.value) return
  chart.value.setOption(createOption(), {
    notMerge: true,
    lazyUpdate: true
  })
}

const scheduleRender = () => {
  if (refreshTimer !== null) return
  refreshTimer = window.setTimeout(() => {
    refreshTimer = null
    renderChart()
  }, Math.max(Number(props.refreshRate) || 100, 16))
}

const initChart = () => {
  if (!chartEl.value) return
  chart.value = echarts.init(chartEl.value, undefined, { renderer: 'canvas' })
  renderChart()
}

const resizeChart = () => {
  chart.value?.resize()
}

watch(() => [dataSource.mode, dataSource.timeRange, dataSource.fields, dataSource.visibleData.length], scheduleRender, { deep: true })
watch(() => [props.fields, props.maxPoints, props.sampling, props.showArea, props.showSymbol, props.smooth, props.lineWidth], renderChart, { deep: true })
watch(isDark, renderChart)

onMounted(() => {
  nextTick(() => {
    initChart()
    if (chartEl.value) {
      resizeObserver = new ResizeObserver(resizeChart)
      resizeObserver.observe(chartEl.value)
    }
    window.addEventListener('resize', resizeChart)
  })
})

onUnmounted(() => {
  if (refreshTimer !== null) {
    window.clearTimeout(refreshTimer)
  }
  resizeObserver?.disconnect()
  window.removeEventListener('resize', resizeChart)
  chart.value?.dispose()
  chart.value = null
})
</script>

<template>
  <div class="echarts-time-series" :style="{ backgroundColor: theme.panelBackground }">
    <div v-if="!hasData" class="empty-state">
      <div class="empty-title">No data</div>
      <div class="empty-desc">等待实时数据或在配置中选择字段</div>
    </div>
    <div ref="chartEl" class="chart-surface"></div>
  </div>
</template>

<style scoped lang="less">
.echarts-time-series {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}

.chart-surface {
  width: 100%;
  height: 100%;
}

.empty-state {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  color: var(--el-text-color-secondary);
}

.empty-title {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: .02em;
}

.empty-desc {
  margin-top: 6px;
  font-size: 12px;
  opacity: .72;
}
</style>
