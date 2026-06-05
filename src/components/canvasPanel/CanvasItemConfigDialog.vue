<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useDataSourceFromPlaybackStore } from '@/runtime/source/useDataSourceFromPlaybackStore'
import { WorkspaceManagerInst } from '@/utils/ProfileManager'
import { widgetRegistry } from '@/widgets'
import type { ConfigSchemaField } from '@/widgets/types'

interface Props {
  visible: boolean
  item: {
    id: number
    type: string
    title: string
    titleHidden?: boolean
    config?: Record<string, any>
  } | null
}

interface Emit {
  'update:visible': [val: boolean]
  'save': [item: any]
}

const props = defineProps<Props>()
const emit = defineEmits<Emit>()

// 字段下拉强制使用 realtime 数据源（独立于全局 mode），始终展示实时可见字段供配置
const ds = useDataSourceFromPlaybackStore({ forceMode: 'realtime', includeTimeRange: false })

const localItem = ref<any>(null)

// 合并实时字段 + profile 持久化字段，确保串口未连接时也能选择字段
const availableFields = computed(() => {
  void ds.visibleData // 响应式触发器
  void WorkspaceManagerInst.activeWorkspaceIdRef.value // workspace 切换触发

  const liveKeys = new Set(ds.fields)
  const profileFields = (WorkspaceManagerInst.activeWorkspace?.config?.fields as any[]) || []
  const allKeys = new Set<string>()

  // profile 字段优先
  for (const pf of profileFields) {
    allKeys.add(pf.key as string)
  }
  // 实时新增字段补充
  for (const k of liveKeys) {
    allKeys.add(k)
  }

  return Array.from(allKeys).map(key => ({ label: key, value: key }))
})

watch(() => props.item, (newItem) => {
  if (newItem) {
    localItem.value = {
      ...newItem,
      config: {
        ...getDefaultConfig(newItem.type),
        ...(newItem.config || {})
      }
    }
  }
}, { immediate: true })

const getDefaultConfig = (type: string): Record<string, any> => {
  const widgetDef = widgetRegistry[type]
  if (widgetDef && widgetDef.defaultConfig) {
    return { ...widgetDef.defaultConfig }
  }
  return {}
}

const resolveSchemaFields = (type: string): ConfigSchemaField[] => {
  const widgetDef = widgetRegistry[type]
  return widgetDef?.configSchema || []
}

const configSchema = computed(() => {
  if (!localItem.value) return []

  const type = localItem.value.type
  const rawSchema = resolveSchemaFields(type)

  // 将 dynamicFields 类型替换为 multiSelect + 运行时 options
  return rawSchema.map(field => {
    if (field.type === 'dynamicFields') {
      return {
        ...field,
        type: 'multiSelect',
        options: availableFields.value,
      }
    }
    return field
  })
})

const handleClose = () => {
  emit('update:visible', false)
}

const handleSave = () => {
  if (localItem.value) {
    emit('save', {
      ...localItem.value,
      config: localItem.value.config
    })
  }
  handleClose()
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    :title="`配置 ${localItem?.title || ''}`"
    width="500px"
    @update:model-value="emit('update:visible', $event)"
    @close="handleClose"
  >
    <el-form v-if="localItem" label-width="100px">
      <el-form-item label="组件类型">
        <el-tag>{{ localItem.type }}</el-tag>
      </el-form-item>

      <el-form-item label="标题">
        <el-input v-model="localItem.title" placeholder="请输入标题" />
      </el-form-item>

      <el-form-item label="隐藏标题">
        <el-switch v-model="localItem.titleHidden" />
      </el-form-item>

      <el-divider>组件配置</el-divider>

      <template v-for="schema in configSchema" :key="schema.key">
        <el-form-item
          v-if="schema.type === 'select' && (!schema.condition || localItem.config[schema.condition.key] === schema.condition.value)"
          :label="schema.label"
        >
          <el-select v-model="localItem.config[schema.key]" placeholder="请选择">
            <el-option
              v-for="opt in schema.options"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>

        <el-form-item
          v-else-if="schema.type === 'multiSelect' && (!schema.condition || localItem.config[schema.condition.key] === schema.condition.value)"
          :label="schema.label"
        >
          <el-select
            v-model="localItem.config[schema.key]"
            multiple
            filterable
            placeholder="请选择"
          >
            <el-option
              v-for="opt in schema.options"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>

        <el-form-item
          v-else-if="schema.type === 'switch' && (!schema.condition || localItem.config[schema.condition.key] === schema.condition.value)"
          :label="schema.label"
        >
          <el-switch v-model="localItem.config[schema.key]" />
        </el-form-item>

        <el-form-item
          v-else-if="schema.type === 'number' && (!schema.condition || localItem.config[schema.condition.key] === schema.condition.value)"
          :label="schema.label"
        >
          <el-input-number
            v-model="localItem.config[schema.key]"
            :min="schema.min"
            :max="schema.max"
            :step="schema.step || 1"
          />
        </el-form-item>
      </template>

      <el-alert
        v-if="configSchema.length === 0"
        type="info"
        :closable="false"
        show-icon
      >
        该组件暂无配置选项
      </el-alert>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" @click="handleSave">确定</el-button>
    </template>
  </el-dialog>
</template>