<script setup lang="ts">
import { onMounted, onUnmounted, computed } from 'vue'
import { useDataStore } from '../store/fieldStore'
import { EventCenter, EventNames } from '../utils/EventCenter'
import { WorkspaceManagerInst } from '../utils/ProfileManager'

interface Props {
  readonly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false
})

const eventCenter = EventCenter.getInstance()
const dataStore = useDataStore()
const workspaceManager = WorkspaceManagerInst

const activeWorkspace = computed(() => workspaceManager.activeWorkspace)
const autoAddField = computed(() => activeWorkspace.value?.config?.autoAddField ?? true)


const handleDataKey = (data: any) => {
  if (typeof data !== 'object' || data === null) return

  Object.entries(data).forEach(([key, value]) => {
    const existingField = dataStore.fields.find(f => f.key === key)
    if (existingField) {
      dataStore.updateField(existingField, value)
    } else if (autoAddField.value) {
      dataStore.fields.push(dataStore.createField(key, value))
    }
  })
}

const addNewField = () => {
  dataStore.createField('new_field', '')
}

const updateField = () => {
  dataStore.saveToProfile()
}

const resetData = () => {
  dataStore.fields.forEach(field => {
    field.value = ''
    field.avg = null
    field.avgSum = null
    field.min = null
    field.max = null
    field.updateCount = 0
    field.lastUpdate = 0
  })
  dataStore.saveToProfile()
}

onMounted(() => {
  dataStore.loadFromProfile()
  eventCenter.on(EventNames.DATA_UPDATE, handleDataKey)
})

onUnmounted(() => {
  eventCenter.off(EventNames.DATA_UPDATE, handleDataKey)
})
</script>

<template>
  <div class="data-table-container">
    <div class="table-toolbar" v-if="!readonly">
      <el-dropdown trigger="click">
        <el-button type="primary" size="small">
          显示/隐藏列
          <el-icon class="el-icon--right"><arrow-down /></el-icon>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item v-for="(_, key) in dataStore.columnVisibility" :key="key">
              <el-checkbox v-model="dataStore.columnVisibility[key]" @change="dataStore.toggleColumnVisibility()">
                {{ key === 'key' ? 'Key' :
                   key === 'name' ? '字段名' :
                   key === 'unit' ? '单位' :
                   key === 'dataType' ? '数据类型' :
                   key === 'keyAddr' ? '内存地址' :
                   key === 'keySize' ? '内存大小' :
                   key === 'description' ? '描述' :
                   key === 'value' ? '当前值' :
                   key === 'avg' ? '平均值' :
                   key === 'min' ? '最小值' :
                   key === 'max' ? '最大值' :
                   key === 'lastUpdate' ? '最后更新' :
                   key === 'updateCount' ? '更新次数' : key }}
              </el-checkbox>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <div class="import-export-buttons">
        <el-button type="primary" size="small" @click="addNewField">添加</el-button>
        <el-button type="primary" size="small" @click="dataStore.exportData">导出数据</el-button>
        <el-button type="primary" size="small" @click="$refs.fileInput.click()">导入数据</el-button>
        <el-button type="warning" size="small" @click="resetData">重置数据</el-button>
        <input
          ref="fileInput"
          type="file"
          accept=".json"
          style="display: none"
          @change="(e: Event) => {
            const file = (e.target as HTMLInputElement).files?.[0]
            if (file) dataStore.importData(file)
          }"
         />
      </div>
    </div>

    <el-table :data="dataStore.fields" border stripe>
      <el-table-column v-if="!readonly" label="操作" width="60" fixed="left">
        <template #default="{ row }">
          <div class="operation-buttons">
            <el-button @click="dataStore.deleteField(row.id)" type="danger" size="small" circle>
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </template>
      </el-table-column>

      <el-table-column v-if="dataStore.columnVisibility.key" label="Key" sortable min-width="100">
        <template #default="{ row }">
          <el-input v-if="!readonly" v-model="row.key" size="small" @change="updateField" />
          <span v-else>{{ row.key }}</span>
        </template>
      </el-table-column>

      <el-table-column v-if="dataStore.columnVisibility.name" label="字段名" sortable min-width="100">
        <template #default="{ row }">
          <el-input v-if="!readonly" v-model="row.name" size="small" @change="updateField" />
          <span v-else>{{ row.name }}</span>
        </template>
      </el-table-column>

      <el-table-column v-if="dataStore.columnVisibility.unit" label="单位" min-width="60">
        <template #default="{ row }">
          <el-input v-if="!readonly" v-model="row.unit" size="small" @change="updateField" />
          <span v-else>{{ row.unit }}</span>
        </template>
      </el-table-column>

      <el-table-column v-if="dataStore.columnVisibility.dataType" label="数据类型" sortable min-width="80">
        <template #default="{ row }">
          <el-select v-if="!readonly" v-model="row.dataType" size="small" @change="updateField">
            <el-option label="数字" value="number" />
            <el-option label="字符串" value="string" />
            <el-option label="布尔值" value="boolean" />
            <el-option label="对象" value="object" />
          </el-select>
          <span v-else>{{ row.dataType }}</span>
        </template>
      </el-table-column>

      <el-table-column v-if="dataStore.columnVisibility.description" label="描述" min-width="150">
        <template #default="{ row }">
          <el-input v-if="!readonly" v-model="row.description" size="small" @change="updateField" />
          <span v-else>{{ row.description }}</span>
        </template>
      </el-table-column>

      <el-table-column v-if="dataStore.columnVisibility.keyAddr" label="内存地址" sortable min-width="100">
        <template #default="{ row }">
          <el-input v-if="!readonly" v-model="row.keyAddr" size="small" @change="updateField" />
          <span v-else>{{ row.keyAddr }}</span>
        </template>
      </el-table-column>

      <el-table-column v-if="dataStore.columnVisibility.keySize" label="内存大小" sortable min-width="100">
        <template #default="{ row }">
          <el-input v-if="!readonly" v-model="row.keySize" size="small" @change="updateField" />
          <span v-else>{{ row.keySize }}</span>
        </template>
      </el-table-column>

      <el-table-column v-if="dataStore.columnVisibility.value" label="当前值" min-width="100">
        <template #default="{ row }">
          <span>{{ row.value }}</span>
        </template>
      </el-table-column>

      <el-table-column v-if="dataStore.columnVisibility.avg" label="平均值" min-width="100">
        <template #default="{ row }">
          <span>{{ row.avg ?? '-' }}</span>
        </template>
      </el-table-column>

      <el-table-column v-if="dataStore.columnVisibility.min" label="最小值" min-width="100">
        <template #default="{ row }">
          <span>{{ row.min ?? '-' }}</span>
        </template>
      </el-table-column>

      <el-table-column v-if="dataStore.columnVisibility.max" label="最大值" min-width="100">
        <template #default="{ row }">
          <span>{{ row.max ?? '-' }}</span>
        </template>
      </el-table-column>

      <el-table-column v-if="dataStore.columnVisibility.lastUpdate" label="最后更新" sortable min-width="120">
        <template #default="{ row }">
          <el-tooltip :content="new Date(row.lastUpdate).toLocaleString()" placement="top" effect="dark">
            <span>{{ new Date(row.lastUpdate).toLocaleTimeString() + '.' + String(new Date(row.lastUpdate).getMilliseconds()).padStart(3, '0') }}</span>
          </el-tooltip>
        </template>
      </el-table-column>

      <el-table-column v-if="dataStore.columnVisibility.updateCount" label="更新次数" sortable width="100">
        <template #default="{ row }">
          <span>{{ row.updateCount }}</span>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style scoped>
.data-table-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.table-toolbar {
  padding: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.import-export-buttons {
  display: flex;
  gap: 8px;
}

.operation-buttons {
  display: flex;
  gap: 8px;
}


.mb-3 {
  margin-bottom: 12px;
}

.flow-title {
  font-weight: bold;
  font-size: 14px;
  margin-bottom: 8px;
}

.flow-content {
  font-size: 13px;
  line-height: 1.5;
}

.flow-step {
  display: flex;
  align-items: flex-start;
  margin-bottom: 8px;
}

.step-number {
  width: 20px;
  height: 20px;
  background-color: var(--el-color-primary);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  margin-right: 8px;
  flex-shrink: 0;
}

.step-content {
  flex: 1;
}

.step-content b {
  color: var(--el-color-primary);
}
</style>
