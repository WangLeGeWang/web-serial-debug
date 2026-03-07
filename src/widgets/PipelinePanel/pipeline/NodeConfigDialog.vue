<template>
  <el-dialog v-model="dialogVisible" :title="dialogTitle" width="500px" @open="onDialogOpen">
    <el-form :model="form" label-width="100px">
      <!-- 添加模式：选择组件类型 -->
      <el-form-item label="组件类型" v-if="!isEdit">
        <el-select v-model="form.type" placeholder="请选择组件类型" style="width: 100%" @change="onTypeChange">
          <el-option-group v-for="group in nodeTypeOptions" :key="group.label" :label="group.label">
            <el-option
              v-for="item in group.options"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            >
              <span>{{ item.label }}</span>
              <span style="float: right; color: #8492a6; font-size: 12px">{{ item.desc }}</span>
            </el-option>
          </el-option-group>
        </el-select>
      </el-form-item>

      <!-- 所有类型：基本信息 -->
      <el-form-item label="组件名称">
        <el-input v-model="form.label" placeholder="请输入组件名称" />
      </el-form-item>

      <!-- 传感器类型：数据绑定 -->
      <template v-if="isSensor">
        <el-divider>数据绑定</el-divider>
        <el-form-item label="数据 Key">
          <el-input v-model="form.dataKey" placeholder="对应的数据 key，如 pressure_main" />
        </el-form-item>
        <el-form-item label="显示单位">
          <el-input v-model="form.unit" placeholder="如 MPa, ℃, kg/s" />
        </el-form-item>
        <el-form-item label="告警阈值">
          <div class="threshold-row">
            <el-input-number v-model="form.thresholdWarning" :min="0" :precision="2" placeholder="警告" style="flex: 1" />
            <span style="padding: 0 8px">~</span>
            <el-input-number v-model="form.thresholdCritical" :min="0" :precision="2" placeholder="危险" style="flex: 1" />
          </div>
        </el-form-item>
      </template>

      <!-- 阀门类型：控制配置 -->
      <template v-if="isValve">
        <el-divider>数据绑定</el-divider>
        <el-form-item label="状态 Key">
          <el-input v-model="form.dataKey" placeholder="对应的数据 key" />
        </el-form-item>
        <el-form-item label="开度 Key">
          <el-input v-model="form.positionKey" placeholder="开度数据 key (0-100)" />
        </el-form-item>
      </template>

      <!-- 储罐类型：存储配置 -->
      <template v-if="isTank">
        <el-divider>数据绑定</el-divider>
        <el-form-item label="压力 Key">
          <el-input v-model="form.pressureKey" placeholder="压力数据 key" />
        </el-form-item>
        <el-form-item label="温度 Key">
          <el-input v-model="form.temperatureKey" placeholder="温度数据 key" />
        </el-form-item>
        <el-form-item label="液位 Key">
          <el-input v-model="form.levelKey" placeholder="液位数据 key (0-100)" />
        </el-form-item>
        <el-form-item label="液位告警">
          <el-input-number v-model="form.levelWarning" :min="0" :max="100" placeholder="低液位警告 %" style="width: 100%" />
        </el-form-item>
      </template>

      <!-- 发动机类型 -->
      <template v-if="isEngine">
        <el-divider>数据绑定</el-divider>
        <el-form-item label="推力 Key">
          <el-input v-model="form.thrustKey" placeholder="推力数据 key" />
        </el-form-item>
        <el-form-item label="室压 Key">
          <el-input v-model="form.chamberPressureKey" placeholder="燃烧室压力 key" />
        </el-form-item>
        <el-form-item label="混合比 Key">
          <el-input v-model="form.mixtureRatioKey" placeholder="混合比数据 key" />
        </el-form-item>
      </template>

      <!-- 调压阀类型 -->
      <template v-if="form.type === 'regulator'">
        <el-divider>数据绑定</el-divider>
        <el-form-item label="出口压力 Key">
          <el-input v-model="form.dataKey" placeholder="出口压力数据 key" />
        </el-form-item>
        <el-form-item label="设定值 Key">
          <el-input v-model="form.setpointKey" placeholder="设定值数据 key" />
        </el-form-item>
      </template>

      <!-- 连接点配置 -->
      <el-divider>连接点配置</el-divider>
      <el-form-item label="连接桩">
        <div class="handles-config">
          <div v-for="(handle, index) in form.handles" :key="index" class="handle-row">
            <el-input v-model="handle.id" placeholder="ID" style="width: 80px" />
            <el-select v-model="handle.type" placeholder="类型" style="width: 80px">
              <el-option label="输入←" value="target" />
              <el-option label="输出→" value="source" />
            </el-select>
            <el-select v-model="handle.position" placeholder="位置" style="width: 80px">
              <el-option label="↑上" value="top" />
              <el-option label="↓下" value="bottom" />
              <el-option label="←左" value="left" />
              <el-option label="→右" value="right" />
            </el-select>
            <el-button type="danger" link @click="removeHandle(index)" :icon="Delete" />
          </div>
          <el-button type="primary" link @click="addHandle" :icon="Plus">添加连接桩</el-button>
        </div>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" @click="handleConfirm">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { ElDialog, ElForm, ElFormItem, ElInput, ElSelect, ElOption, ElButton, ElInputNumber, ElDivider, ElOptionGroup } from 'element-plus'
import { Delete, Plus } from '@element-plus/icons-vue'

const props = defineProps<{
  modelValue: boolean
  editData?: any
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm', data: any): void
}>()

const dialogVisible = ref(props.modelValue)
const isEdit = computed(() => !!props.editData?.id)
const dialogTitle = computed(() => isEdit.value ? `编辑 - ${props.editData?.data?.label || '组件'}` : '添加组件')

const isSensor = computed(() => ['pressure', 'temperature', 'flow'].includes(form.type))
const isValve = computed(() => ['valve', 'check_valve'].includes(form.type))
const isTank = computed(() => ['fuel', 'oxidizer', 'pressurant'].includes(form.type))
const isEngine = computed(() => form.type === 'engine')

interface Handle {
  id: string
  type: 'target' | 'source'
  position: 'top' | 'bottom' | 'left' | 'right'
}

const form = reactive({
  type: '',
  label: '',
  dataKey: '',
  unit: '',
  positionKey: '',
  pressureKey: '',
  temperatureKey: '',
  levelKey: '',
  levelWarning: undefined as number | undefined,
  thrustKey: '',
  chamberPressureKey: '',
  mixtureRatioKey: '',
  setpointKey: '',
  thresholdWarning: undefined as number | undefined,
  thresholdCritical: undefined as number | undefined,
  handles: [] as Handle[]
})

function addHandle() {
  const positions: Handle['position'][] = ['top', 'bottom', 'left', 'right']
  const currentCount = form.handles.length
  form.handles.push({
    id: `h${currentCount + 1}`,
    type: 'target',
    position: positions[currentCount % 4]
  })
}

function removeHandle(index: number) {
  form.handles.splice(index, 1)
}

const nodeTypeOptions = [
  {
    label: '储罐',
    options: [
      { value: 'fuel', label: '燃料罐', desc: '煤油、酒精等' },
      { value: 'oxidizer', label: '氧化剂罐', desc: '液氧、四氧化二氮等' },
      { value: 'pressurant', label: '增压气罐', desc: '氦气、氮气等' }
    ]
  },
  {
    label: '阀门',
    options: [
      { value: 'valve', label: '阀门', desc: '可控制开闭' },
      { value: 'check_valve', label: '单向阀', desc: '只允许单向流动' },
      { value: 'regulator', label: '调压阀', desc: '调节出口压力' }
    ]
  },
  {
    label: '传感器',
    options: [
      { value: 'pressure', label: '压力传感器', desc: '监测压力' },
      { value: 'temperature', label: '温度传感器', desc: '监测温度' },
      { value: 'flow', label: '流量传感器', desc: '监测流量' }
    ]
  },
  {
    label: '执行器',
    options: [
      { value: 'engine', label: '发动机', desc: '主级发动机' }
    ]
  }
]

function onTypeChange() {
  form.handles = getDefaultHandles(form.type)
  const defaults = getDefaultKeys(form.type)
  Object.assign(form, defaults)
}

function getDefaultHandles(type: string): Handle[] {
  const defaults: Record<string, Handle[]> = {
    fuel: [
      { id: 'pressurant', type: 'target', position: 'top' },
      { id: 'output', type: 'source', position: 'bottom' }
    ],
    oxidizer: [
      { id: 'pressurant', type: 'target', position: 'top' },
      { id: 'output', type: 'source', position: 'bottom' }
    ],
    pressurant: [
      { id: 'output', type: 'source', position: 'bottom' }
    ],
    valve: [
      { id: 'input', type: 'target', position: 'left' },
      { id: 'output', type: 'source', position: 'right' }
    ],
    check_valve: [
      { id: 'input', type: 'target', position: 'left' },
      { id: 'output', type: 'source', position: 'right' }
    ],
    regulator: [
      { id: 'input', type: 'target', position: 'left' },
      { id: 'output', type: 'source', position: 'right' }
    ],
    pressure: [
      { id: 'input', type: 'target', position: 'left' }
    ],
    temperature: [
      { id: 'input', type: 'target', position: 'left' }
    ],
    flow: [
      { id: 'input', type: 'target', position: 'left' },
      { id: 'output', type: 'source', position: 'right' }
    ],
    engine: [
      { id: 'fuel', type: 'target', position: 'left' },
      { id: 'oxidizer', type: 'target', position: 'left' },
      { id: 'output', type: 'source', position: 'right' }
    ]
  }
  return defaults[type] || []
}

function getDefaultKeys(type: string) {
  const defaults: Record<string, any> = {
    fuel: { pressureKey: 'fuel_pressure', temperatureKey: 'fuel_temperature', levelKey: 'fuel_level' },
    oxidizer: { pressureKey: 'lox_pressure', temperatureKey: 'lox_temperature', levelKey: 'lox_level' },
    pressurant: { pressureKey: 'he_pressure', temperatureKey: 'he_temperature', levelKey: '' },
    valve: { dataKey: 'valve_state', positionKey: 'valve_position' },
    check_valve: { dataKey: 'checkvalve_state' },
    regulator: { dataKey: 'regulator_out_pressure', setpointKey: 'regulator_setpoint' },
    pressure: { dataKey: 'pressure_', unit: 'MPa', thresholdWarning: 35, thresholdCritical: 40 },
    temperature: { dataKey: 'temperature_', unit: '℃' },
    flow: { dataKey: 'flow_', unit: 'kg/s' },
    engine: { thrustKey: 'engine_thrust', chamberPressureKey: 'engine_chamber_pressure', mixtureRatioKey: 'engine_mixture_ratio' }
  }
  return defaults[type] || {}
}

function onDialogOpen() {
  if (props.editData) {
    const data = props.editData.data || {}
    const type = props.editData.type || ''
    form.type = type
    form.label = data.label || ''
    form.dataKey = data.dataKey || ''
    form.unit = data.unit || ''
    form.positionKey = data.positionKey || ''
    form.pressureKey = data.pressureKey || ''
    form.temperatureKey = data.temperatureKey || ''
    form.levelKey = data.levelKey || ''
    form.levelWarning = data.threshold?.levelWarning
    form.thrustKey = data.thrustKey || ''
    form.chamberPressureKey = data.chamberPressureKey || ''
    form.mixtureRatioKey = data.mixtureRatioKey || ''
    form.setpointKey = data.setpointKey || ''
    form.thresholdWarning = data.threshold?.warning
    form.thresholdCritical = data.threshold?.critical
    form.handles = data.handles ? [...data.handles] : getDefaultHandles(type)
  } else {
    form.type = ''
    form.label = ''
    form.dataKey = ''
    form.unit = ''
    form.positionKey = ''
    form.pressureKey = ''
    form.temperatureKey = ''
    form.levelKey = ''
    form.levelWarning = undefined
    form.thrustKey = ''
    form.chamberPressureKey = ''
    form.mixtureRatioKey = ''
    form.setpointKey = ''
    form.thresholdWarning = undefined
    form.thresholdCritical = undefined
    form.handles = []
  }
}

watch(() => props.modelValue, (val) => {
  dialogVisible.value = val
})

watch(() => dialogVisible.value, (val) => {
  emit('update:modelValue', val)
})

function handleConfirm() {
  const config: any = {
    id: props.editData?.id,
    type: form.type || props.editData?.type,
    label: form.label
  }

  if (isSensor.value) {
    config.dataKey = form.dataKey
    config.unit = form.unit
    const threshold: any = {}
    if (form.thresholdWarning !== undefined) threshold.warning = form.thresholdWarning
    if (form.thresholdCritical !== undefined) threshold.critical = form.thresholdCritical
    if (Object.keys(threshold).length > 0) config.threshold = threshold
  }

  if (isValve.value) {
    config.dataKey = form.dataKey
    config.positionKey = form.positionKey
  }

  if (isTank.value) {
    config.pressureKey = form.pressureKey
    config.temperatureKey = form.temperatureKey
    config.levelKey = form.levelKey
    if (form.levelWarning !== undefined) {
      config.threshold = { ...config.threshold, levelWarning: form.levelWarning }
    }
  }

  if (isEngine.value) {
    config.thrustKey = form.thrustKey
    config.chamberPressureKey = form.chamberPressureKey
    config.mixtureRatioKey = form.mixtureRatioKey
  }

  if (form.type === 'regulator') {
    config.dataKey = form.dataKey
    config.setpointKey = form.setpointKey
  }

  config.handles = form.handles

  emit('confirm', config)
  dialogVisible.value = false
}
</script>

<style scoped>
.threshold-row {
  display: flex;
  align-items: center;
  width: 100%;
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
