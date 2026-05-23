<template>
  <el-dialog v-model="dialogVisible" :title="dialogTitle" width="760px" @open="onDialogOpen">
    <el-form :model="form" label-width="90px">
      <el-divider>基础信息</el-divider>
      <el-form-item label="组件名称">
        <el-input v-model="form.label" placeholder="请输入组件名称" />
      </el-form-item>
      <el-form-item label="组件类型">
        <el-select v-model="form.type" style="width: 100%" :disabled="isEdit" @change="onTypeChange">
          <el-option v-for="item in nodeTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="具体类型">
        <el-select v-model="form.subtype" style="width: 100%" @change="onSubtypeChange">
          <el-option v-for="item in currentSubtypeOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>

      <el-divider>显示字段</el-divider>
      <div class="section-toolbar">
        <el-button size="small" type="primary" @click="addField('realtime')">实时数据</el-button>
        <el-button size="small" @click="addField('static')">固定文字</el-button>
        <el-button size="small" @click="addField('mapping')">状态映射</el-button>
        <el-button size="small" @click="addField('expression')">计算表达式</el-button>
      </div>
      <el-collapse v-model="activeFieldNames" class="config-collapse">
        <el-collapse-item v-for="(field, index) in form.displayFields" :key="field.id" :name="field.id">
          <template #title>
            <span class="collapse-title">{{ field.label || '字段' }} · {{ fieldTypeLabel(field.type) }}</span>
          </template>
          <div class="field-card">
            <el-row :gutter="12">
              <el-col :span="8">
                <el-form-item label="字段类型" label-width="80px">
                  <el-select v-model="field.type" style="width: 100%" @change="onFieldTypeChange(field)">
                    <el-option label="实时数据" value="realtime" />
                    <el-option label="固定文字" value="static" />
                    <el-option label="状态映射" value="mapping" />
                    <el-option label="计算表达式" value="expression" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="显示名" label-width="70px">
                  <el-input v-model="field.label" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <div class="row-actions">
                  <el-button size="small" :disabled="index === 0" @click="moveField(index, -1)">上移</el-button>
                  <el-button size="small" :disabled="index === form.displayFields.length - 1" @click="moveField(index, 1)">下移</el-button>
                  <el-button size="small" type="danger" @click="removeField(index)">删除</el-button>
                </div>
              </el-col>
            </el-row>

            <el-form-item v-if="field.type === 'realtime' || field.type === 'mapping'" label="数据 Key">
              <el-input v-model="field.key" placeholder="例如 fuel_pressure" />
            </el-form-item>
            <el-form-item v-if="field.type === 'static'" label="固定文字">
              <el-input v-model="field.text" placeholder="例如 煤油" />
            </el-form-item>
            <el-form-item v-if="field.type === 'expression'" label="表达式">
              <el-input v-model="field.expression" placeholder="例如 lox_flow / fuel_flow" />
            </el-form-item>
            <el-form-item v-if="field.type === 'mapping'" label="映射表">
              <el-input v-model="field.mapText" type="textarea" :rows="3" placeholder="0=关闭\n1=开启\n2=故障" />
            </el-form-item>
            <el-row :gutter="12" v-if="field.type !== 'static'">
              <el-col :span="8">
                <el-form-item label="单位">
                  <el-input v-model="field.unit" placeholder="MPa" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="精度">
                  <el-input-number v-model="field.precision" :min="0" :max="6" style="width: 100%" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="模板">
                  <el-input v-model="field.template" placeholder="{label}: {value} {unit}" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-form-item v-else label="模板">
              <el-input v-model="field.template" placeholder="{label}: {text}" />
            </el-form-item>
            <el-row :gutter="12" v-if="field.type === 'realtime' || field.type === 'expression'">
              <el-col :span="8">
                <el-form-item label="阈值模式">
                  <el-select v-model="field.thresholdMode" clearable style="width: 100%">
                    <el-option label="大于" value="greater" />
                    <el-option label="小于" value="less" />
                    <el-option label="范围外" value="range" />
                    <el-option label="等于" value="equal" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="8" v-if="field.thresholdMode === 'greater' || field.thresholdMode === 'less'">
                <el-form-item label="警告">
                  <el-input-number v-model="field.warning" style="width: 100%" />
                </el-form-item>
              </el-col>
              <el-col :span="8" v-if="field.thresholdMode === 'greater' || field.thresholdMode === 'less'">
                <el-form-item label="危险">
                  <el-input-number v-model="field.critical" style="width: 100%" />
                </el-form-item>
              </el-col>
              <el-col :span="8" v-if="field.thresholdMode === 'range'">
                <el-form-item label="最小">
                  <el-input-number v-model="field.min" style="width: 100%" />
                </el-form-item>
              </el-col>
              <el-col :span="8" v-if="field.thresholdMode === 'range'">
                <el-form-item label="最大">
                  <el-input-number v-model="field.max" style="width: 100%" />
                </el-form-item>
              </el-col>
              <el-col :span="8" v-if="field.thresholdMode === 'equal'">
                <el-form-item label="等于">
                  <el-input v-model="field.equal" />
                </el-form-item>
              </el-col>
            </el-row>
          </div>
        </el-collapse-item>
      </el-collapse>

      <el-divider>连接点配置</el-divider>
      <div class="handles-config">
        <div v-for="(handle, index) in form.handles" :key="index" class="handle-row">
          <el-input v-model="handle.id" placeholder="ID" style="width: 120px" />
          <el-select v-model="handle.type" placeholder="类型" style="width: 100px">
            <el-option label="输入" value="target" />
            <el-option label="输出" value="source" />
          </el-select>
          <el-select v-model="handle.position" placeholder="位置" style="width: 100px">
            <el-option label="上" value="top" />
            <el-option label="下" value="bottom" />
            <el-option label="左" value="left" />
            <el-option label="右" value="right" />
          </el-select>
          <el-button type="danger" link @click="removeHandle(index)">删除</el-button>
        </div>
        <el-button type="primary" link @click="addHandle">添加连接点</el-button>
      </div>

      <el-divider>动作按钮</el-divider>
      <div class="handles-config">
        <div v-for="(action, index) in form.actions" :key="index" class="handle-row">
          <el-input v-model="action.label" placeholder="按钮名" style="width: 160px" />
          <el-input v-model="action.value" placeholder="值" style="width: 160px" />
          <el-button type="danger" link @click="removeAction(index)">删除</el-button>
        </div>
        <el-button type="primary" link @click="addAction">添加动作</el-button>
      </div>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" @click="handleConfirm">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElButton, ElCollapse, ElCollapseItem, ElCol, ElDialog, ElDivider, ElForm, ElFormItem, ElInput, ElInputNumber, ElOption, ElRow, ElSelect } from 'element-plus'
import { createDisplayField, getDefaultHandles, getDefaultLabel, getDefaultNodeData, nodeTypeOptions, subtypeOptions } from './defaults'
import type { DisplayField, DisplayFieldType, PipelineAction, PipelineHandle, PipelineNodeType } from './types'

interface EditableDisplayField extends DisplayField {
  mapText?: string
  thresholdMode?: 'greater' | 'less' | 'range' | 'equal' | ''
  warning?: number
  critical?: number
  min?: number
  max?: number
  equal?: string | number
}

const props = defineProps<{
  modelValue: boolean
  editData?: any
  initialType?: PipelineNodeType
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm', data: any): void
}>()

const dialogVisible = ref(props.modelValue)
const activeFieldNames = ref<string[]>([])
const isEdit = computed(() => !!props.editData?.id)
const dialogTitle = computed(() => isEdit.value ? `编辑 - ${props.editData?.data?.label || '组件'}` : '添加组件')
const currentSubtypeOptions = computed(() => subtypeOptions[form.type])

const form = reactive({
  id: '',
  type: 'tank' as PipelineNodeType,
  label: '',
  subtype: 'fuel',
  displayFields: [] as EditableDisplayField[],
  handles: [] as PipelineHandle[],
  actions: [] as PipelineAction[]
})

watch(() => props.modelValue, val => {
  dialogVisible.value = val
})

watch(() => dialogVisible.value, val => {
  emit('update:modelValue', val)
})

function onDialogOpen() {
  const type = (props.editData?.type || props.initialType || 'tank') as PipelineNodeType
  const data = props.editData?.data || getDefaultNodeData(type)
  form.id = props.editData?.id || ''
  form.type = type
  form.subtype = data.subtype || subtypeOptions[type][0].value
  form.label = data.label || getDefaultLabel(type, form.subtype)
  form.displayFields = normalizeEditableFields(data.displayFields || [])
  form.handles = JSON.parse(JSON.stringify(data.handles || getDefaultHandles(type, form.subtype)))
  form.actions = JSON.parse(JSON.stringify(data.actions || []))
  activeFieldNames.value = form.displayFields.map(field => field.id)
}

function onTypeChange() {
  const data = getDefaultNodeData(form.type)
  form.subtype = data.subtype
  form.label = data.label
  form.displayFields = normalizeEditableFields(data.displayFields)
  form.handles = JSON.parse(JSON.stringify(data.handles))
  form.actions = JSON.parse(JSON.stringify(data.actions || []))
  activeFieldNames.value = form.displayFields.map(field => field.id)
}

function onSubtypeChange() {
  const data = getDefaultNodeData(form.type, form.subtype)
  form.label = data.label
  form.displayFields = normalizeEditableFields(data.displayFields)
  form.handles = JSON.parse(JSON.stringify(data.handles))
  form.actions = JSON.parse(JSON.stringify(data.actions || []))
  activeFieldNames.value = form.displayFields.map(field => field.id)
}

function normalizeEditableFields(fields: DisplayField[]): EditableDisplayField[] {
  return fields.map(field => ({
    ...JSON.parse(JSON.stringify(field)),
    mapText: field.map ? Object.entries(field.map).map(([key, value]) => `${key}=${value}`).join('\n') : '',
    thresholdMode: field.threshold?.mode || '',
    warning: field.threshold?.warning,
    critical: field.threshold?.critical,
    min: field.threshold?.min,
    max: field.threshold?.max,
    equal: field.threshold?.equal
  }))
}

function addField(type: DisplayFieldType) {
  const field = createDisplayField(type) as EditableDisplayField
  field.mapText = field.map ? Object.entries(field.map).map(([key, value]) => `${key}=${value}`).join('\n') : ''
  field.thresholdMode = ''
  form.displayFields.push(field)
  activeFieldNames.value.push(field.id)
}

function removeField(index: number) {
  form.displayFields.splice(index, 1)
}

function moveField(index: number, offset: number) {
  const target = index + offset
  if (target < 0 || target >= form.displayFields.length) return
  const [field] = form.displayFields.splice(index, 1)
  form.displayFields.splice(target, 0, field)
}

function onFieldTypeChange(field: EditableDisplayField) {
  field.template = field.type === 'static' ? '{label}: {text}' : field.type === 'mapping' ? '{label}: {value}' : '{label}: {value} {unit}'
  if (field.type === 'mapping' && !field.mapText) field.mapText = '0=关闭\n1=开启'
}

function addHandle() {
  form.handles.push({ id: `h${form.handles.length + 1}`, type: 'target', position: 'left' })
}

function removeHandle(index: number) {
  form.handles.splice(index, 1)
}

function addAction() {
  form.actions.push({ label: '动作', value: '' })
}

function removeAction(index: number) {
  form.actions.splice(index, 1)
}

function fieldTypeLabel(type: DisplayFieldType) {
  const labels: Record<DisplayFieldType, string> = {
    realtime: '实时数据',
    static: '固定文字',
    mapping: '状态映射',
    expression: '计算表达式'
  }
  return labels[type]
}

function parseMap(text?: string) {
  const map: Record<string, string> = {}
  ;(text || '').split('\n').forEach(line => {
    const index = line.indexOf('=')
    if (index <= 0) return
    const key = line.slice(0, index).trim()
    const value = line.slice(index + 1).trim()
    if (key) map[key] = value
  })
  return map
}

function cleanField(field: EditableDisplayField): DisplayField {
  const result: DisplayField = {
    id: field.id,
    type: field.type,
    label: field.label,
    template: field.template
  }
  if (field.type === 'static') result.text = field.text
  if (field.type === 'realtime' || field.type === 'mapping') result.key = field.key
  if (field.type === 'expression') result.expression = field.expression
  if (field.type === 'mapping') result.map = parseMap(field.mapText)
  if (field.type !== 'static') {
    result.unit = field.unit
    result.precision = field.precision
  }
  if (field.thresholdMode) {
    result.threshold = {
      mode: field.thresholdMode,
      warning: field.warning,
      critical: field.critical,
      min: field.min,
      max: field.max,
      equal: field.equal
    }
  }
  return result
}

function handleConfirm() {
  emit('confirm', {
    id: form.id,
    type: form.type,
    data: {
      label: form.label || getDefaultLabel(form.type, form.subtype),
      subtype: form.subtype,
      displayFields: form.displayFields.map(cleanField),
      handles: form.handles,
      actions: form.actions
    }
  })
  dialogVisible.value = false
}
</script>

<style scoped>
.section-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.config-collapse {
  margin-bottom: 12px;
}

.collapse-title {
  font-weight: 600;
}

.field-card {
  padding: 4px 0;
}

.row-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

.handles-config {
  width: 100%;
}

.handle-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;
}
</style>
