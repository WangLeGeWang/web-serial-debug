<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useFieldStore } from '../../store/fieldStore'
import LineChart from './LineChart.vue'
import { ProfileManagerInst } from '../../utils/ProfileManager'
import { useDataSourceFromPlaybackStore } from '@/runtime/source/useDataSourceFromPlaybackStore'

type LegendPlacement = 'bottom' | 'right' | 'none'

interface YRangeConfig {
  mode: 'auto' | 'fixed'
  min?: number
  max?: number
}

interface ChartConfig {
  id: number
  name: string
  fields: string[]
  legendPlacement: LegendPlacement
  yRange: YRangeConfig
}

interface Props {
  readonly?: boolean
}

withDefaults(defineProps<Props>(), {
  readonly: false
})

const fieldStore = useFieldStore()
const profileManager = ProfileManagerInst
const ds = useDataSourceFromPlaybackStore()

const chartConfig = computed(() => {
  const profile = profileManager.activeProfile
  return profile?.config?.charts as { list: any[] } | undefined
})

const defaultChartConfig = { list: [] }

const localChartConfig = computed({
  get: () => chartConfig.value || defaultChartConfig,
  set: (val: { list: any[] }) => {
    const profile = profileManager.activeProfile
    if (profile) {
      profileManager.updateProfile(profile.id, {
        config: {
          ...profile.config,
          charts: { ...val }
        }
      })
    }
  }
})

const charts = ref<ChartConfig[]>([])
const nextChartId = computed(() => {
  const maxId = charts.value.reduce((max, chart) => Math.max(max, chart.id), 0)
  return maxId + 1
})

const legendPlacementOptions: { label: string; value: LegendPlacement }[] = [
  { label: '底部', value: 'bottom' },
  { label: '右侧', value: 'right' },
  { label: '无', value: 'none' },
]

const buildChartData = (fields: string[]): number[][] => {
  const points = ds.visibleData
  if (points.length === 0 || fields.length === 0) {
    return [[0], ...fields.map(() => [0])]
  }
  const timestamps = points.map(p => p.timestamp / 1000)
  const seriesData = fields.map(field =>
    points.map(p => {
      const v = p.values[field]
      return typeof v === 'number' ? v : undefined as unknown as number
    })
  )
  return [timestamps, ...seriesData]
}

const chartDataMap = computed<Record<number, number[][]>>(() => {
  const map: Record<number, number[][]> = {}
  for (const chart of charts.value) {
    map[chart.id] = buildChartData(chart.fields)
  }
  return map
})

const createChart = (name: string): ChartConfig => {
  const chart: ChartConfig = {
    id: nextChartId.value,
    name,
    fields: [],
    legendPlacement: 'right',
    yRange: { mode: 'auto' },
  }
  charts.value.push(chart)
  saveChartsConfig()
  return chart
}

const saveChartsConfig = () => {
  const config = charts.value.map(chart => ({
    id: chart.id,
    name: chart.name,
    fields: chart.fields,
    legendPlacement: chart.legendPlacement,
    yRange: chart.yRange,
  }))
  localChartConfig.value = { list: config }
}

const loadChartsConfig = () => {
  const config = localChartConfig.value.list || []
  if (!Array.isArray(config)) return

  config.forEach(chartData => {
    const chart = createChart(chartData.name)
    chart.id = chartData.id
    chart.legendPlacement = chartData.legendPlacement || 'bottom'
    chart.yRange = chartData.yRange || { mode: 'auto' }
    chartData.fields.forEach((field: string) => addField(chart.id, field))
  })
}

const handleTitleChange = () => {
  saveChartsConfig()
}

const handleFieldsChange = () => {
  saveChartsConfig()
}

const handleLegendPlacementChange = () => {
  saveChartsConfig()
}

const handleYRangeChange = () => {
  saveChartsConfig()
}

const addField = (chartId: number, field: string) => {
  const chart = charts.value.find(c => c.id === chartId)
  if (!chart) return

  if (chart.fields.includes(field)) {
    ElMessage.warning('该字段已添加到图表中')
    return
  }

  chart.fields.push(field)
  saveChartsConfig()
}

const removeChart = (chartId: number) => {
  const index = charts.value.findIndex(c => c.id === chartId)
  if (index === -1) return

  charts.value.splice(index, 1)
  saveChartsConfig()
}

const getConfig = () => {
  return {
    charts: charts.value.map(chart => ({
      id: chart.id,
      name: chart.name,
      fields: chart.fields,
      legendPlacement: chart.legendPlacement,
      yRange: chart.yRange,
    }))
  }
}

const setConfig = (config: Record<string, any>) => {
  if (config.charts) {
    charts.value = []
    config.charts.forEach((chartData: any) => {
      const chart = createChart(chartData.name)
      chart.id = chartData.id
      chart.legendPlacement = chartData.legendPlacement || 'bottom'
      chart.yRange = chartData.yRange || { mode: 'auto' }
      chartData.fields?.forEach((field: string) => addField(chart.id, field))
    })
  }
}

defineExpose({
  getConfig,
  setConfig
})

onMounted(() => {
  loadChartsConfig()
})
</script>

<template>
  <div class="chart-panel">
    <div class="chart-controls" v-if="!readonly">
      <el-button @click="createChart('新图表')" type="primary" size="small">
        添加图表
      </el-button>
    </div>
    <div class="charts-container">
      <div v-for="chart in charts" :key="chart.id" class="chart-item">
        <div class="chart-header">
          <el-input
            v-model="chart.name"
            size="small"
            placeholder="图表名称"
            class="chart-name-input"
            :readonly="readonly"
            @change="handleTitleChange"
          />
          <el-select
            v-model="chart.fields"
            multiple
            filterable
            placeholder="选择字段"
            size="small"
            class="chart-fields-select"
            :disabled="readonly"
            @change="handleFieldsChange()"
          >
            <el-option
              v-for="field in fieldStore.fields.map(f => f.key)"
              :key="field"
              :label="field"
              :value="field"
            />
          </el-select>
          <el-select
            v-model="chart.legendPlacement"
            size="small"
            class="chart-legend-select"
            :disabled="readonly"
            @change="handleLegendPlacementChange()"
          >
            <el-option
              v-for="opt in legendPlacementOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
          <el-select
            v-model="chart.yRange.mode"
            size="small"
            class="chart-yrange-select"
            :disabled="readonly"
            @change="handleYRangeChange()"
          >
            <el-option label="自动" value="auto" />
            <el-option label="固定" value="fixed" />
          </el-select>
          <template v-if="chart.yRange.mode === 'fixed'">
            <el-input-number
              v-model="chart.yRange.min"
              size="small"
              controls-position="right"
              class="chart-yrange-input"
              :disabled="readonly"
              @change="handleYRangeChange()"
            />
            <el-input-number
              v-model="chart.yRange.max"
              size="small"
              controls-position="right"
              class="chart-yrange-input"
              :disabled="readonly"
              @change="handleYRangeChange()"
            />
          </template>
          <el-button
            v-if="!readonly"
            @click="removeChart(chart.id)"
            type="danger"
            size="small"
            circle
          >
            <el-icon><Delete /></el-icon>
          </el-button>
        </div>
        <div class="chart-content">
          <LineChart
            :data="chartDataMap[chart.id]"
            :fields="chart.fields"
            :legend-placement="chart.legendPlacement"
            :y-range="chart.yRange"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chart-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 12px;
}

.chart-controls {
  margin-bottom: 12px;
}

.charts-container {
  flex: 1;
  overflow-y: auto;
}

.chart-item {
  background: var(--el-bg-color);
  border-radius: 4px;
  padding: 12px;
  margin-bottom: 12px;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
}

.chart-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.chart-name-input {
  max-width: 140px;
}

.chart-fields-select {
  min-width: 160px;
}

.chart-legend-select {
  width: 80px;
}

.chart-yrange-select {
  width: 80px;
}

.chart-yrange-input {
  width: 90px;
}

.chart-content {
  height: 300px;
}
</style>