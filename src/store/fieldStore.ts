import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ProfileManagerInst } from '../utils/ProfileManager'
import { getDataHub } from '../runtime/data/DataHub'

export interface DataField {
  id: number
  key: string
  name: string
  unit: string
  description: string
  keyAddr: number
  keySize: number
  value: any
  dataType: 'number' | 'string' | 'boolean' | 'object'
  avg: number | null
  avgSum: number | null
  min: number | null
  max: number | null
  lastUpdate: number
  updateCount: number
}

export interface ColumnVisibility {
  key: boolean
  name: boolean
  unit: boolean
  dataType: boolean
  description: boolean
  keyAddr: boolean
  keySize: boolean
  value: boolean
  avg: boolean
  min: boolean
  max: boolean
  lastUpdate: boolean
  updateCount: boolean
}

const createFieldItem = (id: number, key: string, value: any, dataType?: 'number' | 'string' | 'boolean' | 'object'): DataField => {
  return {
    id: id,
    key,
    name: key,
    unit: '',
    keyAddr: 0,
    keySize: 0,
    dataType: dataType || 'number',
    description: '',
    value,
    avg: typeof value === 'number' ? value : null,
    avgSum: typeof value === 'number' ? value : null,
    min: typeof value === 'number' ? value : null,
    max: typeof value === 'number' ? value : null,
    lastUpdate: Date.now(),
    updateCount: 1
  }
}

const initDefaultFields: DataField[] = [
  createFieldItem(1, 'pitch', 0, 'number'),
  createFieldItem(2, 'roll', 0, 'number'),
  createFieldItem(3, 'yaw', 0, 'number'),
]

const defaultColumnVisibility: ColumnVisibility = {
  key: true,
  name: false,
  unit: false,
  keyAddr: false,
  keySize: false,
  dataType: true,
  description: false,
  value: true,
  avg: false,
  min: false,
  max: false,
  lastUpdate: true,
  updateCount: true
}

export const useFieldStore = defineStore('field', () => {
  const profileManager = ProfileManagerInst

  const fields = ref<DataField[]>([])
  const nextId = ref(1)
  const columnVisibility = ref<ColumnVisibility>({ ...defaultColumnVisibility })
  const loadFromProfile = () => {
    const profile = profileManager.activeProfile
    if (profile?.config?.fields && profile.config.fields.length > 0) {
      fields.value = profile.config.fields as DataField[]
    } else {
      fields.value = JSON.parse(JSON.stringify(initDefaultFields))
    }
    
    if (profile?.config?.columnVisibility) {
      columnVisibility.value = { ...defaultColumnVisibility, ...profile.config.columnVisibility }
    } else {
      columnVisibility.value = { ...defaultColumnVisibility }
    }

    const maxId = fields.value.reduce((max, f) => Math.max(max, f.id), 0)
    nextId.value = maxId + 1
  }

  const saveToProfile = () => {
    const profile = profileManager.activeProfile
    if (profile) {
      profileManager.updateProfile(profile.id, {
        config: {
          ...profile.config,
          fields: fields.value,
          columnVisibility: columnVisibility.value
        }
      })
    }
  }

  const createField = (key: string, value: any, dataType?: 'number' | 'string' | 'boolean' | 'object'): DataField => {
    const field = createFieldItem(nextId.value++, key, value, dataType)
    fields.value.push(field)
    saveToProfile()
    return field
  }

  const handleDataUpdate = (data: any, autoAddField = true) => {
    if (typeof data !== 'object' || data === null) return

    Object.entries(data).forEach(([key, value]) => {
      const existingField = fields.value.find(f => f.key === key)
      if (existingField) {
        updateField(existingField, value)
      } else if (autoAddField) {
        createField(key, value)
      }
    })
  }

  const updateField = (field: DataField, value: any) => {
    field.value = value
    field.lastUpdate = Date.now()
    field.updateCount++

    if (typeof value === 'number') {
      if (field.avgSum == null) {
        field.avgSum = 0
      }
      field.avgSum += value
      field.avg = Math.floor(field.avgSum / field.updateCount * 1000) / 1000
      
      if (field.min === null || value < field.min) field.min = value
      if (field.max === null || value > field.max) field.max = value
    }
  }

  const deleteField = (fieldId: number) => {
    const index = fields.value.findIndex(f => f.id === fieldId)
    if (index !== -1) {
      fields.value.splice(index, 1)
      saveToProfile()
    }
  }

  const exportData = () => {
    const data = JSON.stringify(fields.value, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `data-export-${new Date().toISOString()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importData = async (file: File) => {
    try {
      const text = await file.text()
      const data = JSON.parse(text) as DataField[]
      fields.value = data
      saveToProfile()
      return true
    } catch (error) {
      console.error('导入数据失败:', error)
      return false
    }
  }

  const setFields = (newFields: DataField[]) => {
    fields.value = newFields
    saveToProfile()
  }

  const setColumnVisibility = (visibility: ColumnVisibility) => {
    columnVisibility.value = visibility
    saveToProfile()
  }

  const toggleColumnVisibility = () => {
    saveToProfile()
  }

  return {
    fields,
    nextId,
    columnVisibility,
    createField,
    handleDataUpdate,
    updateField,
    deleteField,
    exportData,
    importData,
    loadFromProfile,
    saveToProfile,
    setFields,
    setColumnVisibility,
    toggleColumnVisibility
  }
})

export const useDataStore = useFieldStore

export type FieldStore = ReturnType<typeof useFieldStore>

/**
 * 把 fieldStore 绑定到 DataHub.subscribeCurrent。
 * 必须在 DataHub 已 init 之后调用（通常在 main.ts bootstrap 结束后）。
 * 返回 dispose 函数，用于取消订阅（测试隔离 / hot-reload）。
 *
 * 如果 DataHub 尚未初始化（例如在测试或工具脚本中），返回一个 no-op dispose，
 * 不抛出，方便调用方安心 try。
 */
export function bindFieldStoreToDataHub(store: FieldStore): () => void {
  let hub
  try {
    hub = getDataHub()
  } catch {
    return () => {}
  }
  const off = hub.subscribeCurrent((frame) => {
    const autoAddField = ProfileManagerInst.activeWorkspace?.config?.autoAddField ?? true
    store.handleDataUpdate(frame.values, autoAddField)
  })
  return off
}
