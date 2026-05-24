<script setup lang="ts">
import { computed, watch, ref } from 'vue'
import { storeToRefs } from 'pinia'
import LineChart from './LineChart.vue'
import { useDataSource } from '@/runtime/source/useDataSource'
import { usePlaybackStore } from '@/store/playbackStore'

interface Props {
  fields?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  fields: () => []
})

const playbackStore = usePlaybackStore()
const { activeQuery, mode: storeMode, historyTimeRange, windowDuration } = storeToRefs(playbackStore)
const ds = useDataSource(activeQuery.value, storeMode.value)
ds.setWindowDuration(windowDuration.value)
if (historyTimeRange.value) ds.setTimeRange(historyTimeRange.value)

watch(storeMode, (m) => ds.setMode(m))
watch(activeQuery, (q) => ds.setQuery(q), { deep: true })
watch(historyTimeRange, (r) => { if (r) ds.setTimeRange(r) })
watch(windowDuration, (ms) => ds.setWindowDuration(ms))

const chartFields = computed(() => {
  const points = ds.visibleData
  if (points.length === 0) return []
  if (props.fields.length > 0) return props.fields
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
</script>

<template>
  <div class="canvas-chart-panel">
    <LineChart
      :key="key"
      :data="chartData"
      :fields="chartFields"
    />
  </div>
</template>

<style scoped>
.canvas-chart-panel {
  width: 100%;
  height: 100%;
}
</style>
