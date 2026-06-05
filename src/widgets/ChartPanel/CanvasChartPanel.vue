<script setup lang="ts">
import { computed, watch, ref, onMounted, onUnmounted } from 'vue'
import LineChart from './LineChart.vue'
import { useDataSourceFromPlaybackStore } from '@/runtime/source/useDataSourceFromPlaybackStore'

type LegendPlacement = 'bottom' | 'right' | 'none'

interface Props {
  fields?: string[]
  legendPlacement?: LegendPlacement
  legendWidthPercent?: number
  legendColumns?: number[]
  lineWidth?: number
  showPoints?: boolean
  smooth?: boolean
  yRangeMode?: 'auto' | 'fixed'
  yRangeMin?: number
  yRangeMax?: number
}

const props = withDefaults(defineProps<Props>(), {
  fields: () => [],
  legendPlacement: 'right',
  legendWidthPercent: 25,
  legendColumns: () => [0, 1, 2, 3],
  lineWidth: 1.5,
  showPoints: true,
  smooth: false,
  yRangeMode: 'auto',
  yRangeMin: 0,
  yRangeMax: 100
})

const ds = useDataSourceFromPlaybackStore()

const composedYRange = computed(() => {
  if (props.yRangeMode === 'fixed') {
    return { mode: 'fixed', min: props.yRangeMin, max: props.yRangeMax }
  }
  return { mode: 'auto' }
})

const chartFields = computed(() => {
  if (props.fields.length > 0) return props.fields
  const points = ds.visibleData
  if (points.length === 0) return []
  return Object.keys(points[0]?.values || {})
})

const chartData = computed((): number[][] => {
  const points = ds.visibleData
  if (points.length === 0) {
    return [[0], [0]]
  }

  const timestamps = points.map(p => p.timestamp / 1000)
  const fields = chartFields.value

  const seriesData = fields.map(field =>
    points.map(p => p.values[field] ?? 0)
  )

  return [timestamps, ...seriesData]
})

const key = ref(0)

watch(() => props.fields, () => {
  key.value++
})

watch(() => [ds.mode, ds.timeRange, ds.fields, ds.visibleData.length], () => {
  key.value++
}, { deep: true })

// 用 ResizeObserver 获取容器实际高度，动态传给 LineChart
const panelEl = ref<HTMLElement | null>(null)
const containerHeight = ref(300)
let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  if (panelEl.value) {
    containerHeight.value = panelEl.value.clientHeight || 300
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        containerHeight.value = entry.contentRect.height || 300
      }
    })
    resizeObserver.observe(panelEl.value)
  }
})

onUnmounted(() => {
  resizeObserver?.disconnect()
})
</script>

<template>
  <div ref="panelEl" class="canvas-chart-panel">
    <LineChart
      :key="key"
      :data="chartData"
      :fields="chartFields"
      :height="containerHeight"
      :legend-placement="legendPlacement"
      :legend-width-percent="legendWidthPercent"
      :legend-columns="legendColumns"
      :line-width="lineWidth"
      :show-points="showPoints"
      :smooth="smooth"
      :y-range="composedYRange"
    />
  </div>
</template>

<style scoped>
.canvas-chart-panel {
  width: 100%;
  height: 100%;
}
</style>