import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { DataPoint } from '@/runtime/data/types'
import { dataSeriesStorage, type DataSeries } from '@/utils/DataSeriesStorage'

export const useDataSeriesStore = defineStore('dataSeries', () => {
  const seriesList = ref<DataSeries[]>([])
  const activeSeriesId = ref<string | null>(null)
  const isLoading = ref(false)

  async function loadSeriesList() {
    isLoading.value = true
    try {
      seriesList.value = await dataSeriesStorage.listSeries()
    } finally {
      isLoading.value = false
    }
  }

  async function saveSeries(name: string, points: DataPoint[], fields: string[]) {
    if (points.length === 0) return

    const id = `series_${Date.now()}`
    const startTime = points[0].timestamp
    const endTime = points[points.length - 1].timestamp

    const fieldTypes: Record<string, 'number' | 'string' | 'boolean' | 'other'> = {}
    fields.forEach(field => {
      const sampleValue = points[0].values[field]
      if (typeof sampleValue === 'number') fieldTypes[field] = 'number'
      else if (typeof sampleValue === 'string') fieldTypes[field] = 'string'
      else if (typeof sampleValue === 'boolean') fieldTypes[field] = 'boolean'
      else fieldTypes[field] = 'other'
    })

    const series: DataSeries = {
      id,
      name,
      startTime,
      endTime,
      pointCount: points.length,
      fields,
      fieldTypes,
      createdAt: Date.now(),
      sizeBytes: JSON.stringify(points).length
    }

    await dataSeriesStorage.saveSeries(series)

    const chunkSize = 10000
    for (let i = 0; i < points.length; i += chunkSize) {
      await dataSeriesStorage.saveChunk({
        seriesId: id,
        chunkIndex: Math.floor(i / chunkSize),
        points: points.slice(i, i + chunkSize)
      })
    }

    seriesList.value.push(series)
  }

  async function deleteSeries(id: string) {
    await dataSeriesStorage.deleteSeries(id)
    seriesList.value = seriesList.value.filter(s => s.id !== id)
    if (activeSeriesId.value === id) {
      activeSeriesId.value = null
    }
  }

  async function exportSeries(seriesId: string): Promise<string> {
    return await dataSeriesStorage.exportToNDJSON(seriesId)
  }

  function setActiveSeries(id: string | null) {
    activeSeriesId.value = id
  }

  return {
    seriesList,
    activeSeriesId,
    isLoading,
    loadSeriesList,
    saveSeries,
    deleteSeries,
    exportSeries,
    setActiveSeries
  }
})
