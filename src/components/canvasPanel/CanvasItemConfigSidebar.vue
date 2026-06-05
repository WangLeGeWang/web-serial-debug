<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useDataSourceFromPlaybackStore } from '@/runtime/source/useDataSourceFromPlaybackStore'
import { WorkspaceManagerInst } from '@/utils/ProfileManager'
import { widgetRegistry } from '@/widgets'
import type { ConfigSchemaField } from '@/widgets/types'

interface Props {
  item: {
    id: number
    type: string
    title: string
    titleHidden?: boolean
    config?: Record<string, any>
  } | null
}

interface Emit {
  'update:item': [item: any]
  'delete': [id: number]
  'close': []
}

const props = defineProps<Props>()
const emit = defineEmits<Emit>()

const ds = useDataSourceFromPlaybackStore({ forceMode: 'realtime', includeTimeRange: false })

const localItem = ref<any>(null)
let skipNextEmit = false

const getDefaultConfig = (type: string): Record<string, any> => {
  const widgetDef = widgetRegistry[type]
  return widgetDef?.defaultConfig ? { ...widgetDef.defaultConfig } : {}
}

const availableFields = computed(() => {
  void ds.visibleData
  void WorkspaceManagerInst.activeWorkspaceIdRef.value

  const liveKeys = new Set(ds.fields)
  const profileFields = (WorkspaceManagerInst.activeWorkspace?.config?.fields as any[]) || []
  const allKeys = new Set<string>()

  for (const pf of profileFields) allKeys.add(pf.key as string)
  for (const k of liveKeys) allKeys.add(k)

  return Array.from(allKeys).map(key => ({ label: key, value: key }))
})

// 配置变更时实时保存（仅用户操作触发，跳过 props 同步引起的循环）
watch(localItem, (val) => {
  if (skipNextEmit) {
    skipNextEmit = false
    return
  }
  if (val) {
    emit('update:item', { ...val, config: { ...val.config } })
  }
}, { deep: true })

watch(() => props.item, (newItem) => {
  if (newItem) {
    skipNextEmit = true
    localItem.value = {
      ...newItem,
      config: {
        ...getDefaultConfig(newItem.type),
        ...(newItem.config || {})
      }
    }
  } else {
    localItem.value = null
  }
}, { immediate: true })

const configSchema = computed(() => {
  if (!localItem.value) return []
  const type = localItem.value.type
  const rawSchema = (widgetRegistry[type]?.configSchema || []) as ConfigSchemaField[]

  return rawSchema.map(field => {
    if (field.type === 'dynamicFields') {
      return { ...field, type: 'multiSelect' as const, options: availableFields.value }
    }
    return field
  })
})

// select 字段选项是否 <=5 → 用 radio-group
const shouldUseRadio = (schema: ConfigSchemaField): boolean => {
  return schema.type === 'select' && (schema.options?.length || 0) <= 5
}

const handleDelete = () => {
  if (localItem.value) emit('delete', localItem.value.id)
}

const widgetDef = computed(() => {
  if (!localItem.value) return null
  return widgetRegistry[localItem.value.type]
})
</script>

<template>
  <div class="config-sidebar" v-if="localItem">
    <div class="sidebar-header">
      <span class="sidebar-title">{{ widgetDef?.name || localItem.type }}</span>
      <el-tag size="small" type="info">{{ localItem.type }}</el-tag>
      <el-button class="sidebar-close" text size="small" @click="emit('close')">
        <el-icon><close /></el-icon>
      </el-button>
    </div>

    <div class="sidebar-body">
      <!-- 基础属性 -->
      <div class="config-section">
        <div class="section-label">基础</div>
        <div class="config-row">
          <span class="config-field-label">标题</span>
          <el-input v-model="localItem.title" size="small" placeholder="请输入标题" />
        </div>
        <div class="config-row">
          <span class="config-field-label">隐藏标题</span>
          <el-switch v-model="localItem.titleHidden" size="small" />
        </div>
      </div>

      <!-- 组件配置 -->
      <div class="config-section" v-if="configSchema.length > 0">
        <div class="section-label">组件配置</div>

        <template v-for="schema in configSchema" :key="schema.key">
          <!-- 条件判断：是否应该显示 -->
          <div
            v-if="!schema.condition || localItem.config[schema.condition.key] === schema.condition.value"
            class="config-row"
          >
            <span class="config-field-label">{{ schema.label }}</span>

            <!-- select ≤5 → radio-group -->
            <el-radio-group
              v-if="shouldUseRadio(schema)"
              v-model="localItem.config[schema.key]"
              size="small"
            >
              <el-radio-button
                v-for="opt in schema.options"
                :key="opt.value"
                :value="opt.value"
              >{{ opt.label }}</el-radio-button>
            </el-radio-group>

            <!-- select >5 → el-select -->
            <el-select
              v-else-if="schema.type === 'select'"
              v-model="localItem.config[schema.key]"
              size="small"
              placeholder="请选择"
            >
              <el-option
                v-for="opt in schema.options"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>

            <!-- multiSelect → el-select multiple -->
            <el-select
              v-else-if="schema.type === 'multiSelect'"
              v-model="localItem.config[schema.key]"
              size="small"
              multiple
              filterable
              placeholder="请选择字段"
            >
              <el-option
                v-for="opt in schema.options"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>

            <!-- switch -->
            <el-switch
              v-else-if="schema.type === 'switch'"
              v-model="localItem.config[schema.key]"
              size="small"
            />

            <!-- number -->
            <el-input-number
              v-else-if="schema.type === 'number'"
              v-model="localItem.config[schema.key]"
              size="small"
              :min="schema.min"
              :max="schema.max"
              :step="schema.step || 1"
              controls-position="right"
            />
          </div>
        </template>
      </div>

      <div v-else class="no-config-tip">
        该组件暂无配置选项
      </div>
    </div>

    <!-- 底部操作 -->
    <div class="sidebar-footer">
      <el-button type="danger" size="small" @click="handleDelete">
        <el-icon><delete /></el-icon>删除组件
      </el-button>
    </div>
  </div>

  <div class="config-sidebar-empty" v-else>
    <span>点击组件查看配置</span>
  </div>
</template>

<style scoped lang="less">
.config-sidebar {
  width: 280px;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color-overlay);
  border-left: 1px solid var(--el-border-color);
  overflow-y: auto;
}

.config-sidebar-empty {
  width: 280px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-bg-color-overlay);
  border-left: 1px solid var(--el-border-color);
  color: #999;
  font-size: 13px;
}

.sidebar-header {
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid var(--el-border-color);
}

.sidebar-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  flex: 1;
}

.sidebar-close {
  margin-left: auto;
  padding: 2px;
}

.sidebar-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 16px;
}

.config-section {
  margin-bottom: 16px;
}

.section-label {
  font-size: 11px;
  font-weight: 500;
  color: #999;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.config-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.config-field-label {
  font-size: 12px;
  color: var(--el-text-color-regular);
  min-width: 60px;
  flex-shrink: 0;
}

.config-row :deep(.el-input),
.config-row :deep(.el-select),
.config-row :deep(.el-input-number) {
  flex: 1;
}

.config-row :deep(.el-radio-group) {
  flex: 1;
}

.config-row :deep(.el-radio-button__inner) {
  font-size: 11px;
  padding: 4px 8px;
}

.no-config-tip {
  color: #999;
  font-size: 12px;
  text-align: center;
  padding: 24px 0;
}

.sidebar-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--el-border-color);
}
</style>