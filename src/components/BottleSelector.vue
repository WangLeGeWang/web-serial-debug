<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { BottleManager, type BottleTemplate } from '../utils/BottleManager'
import { MultiStageRocketPhysics } from '../utils/MultiStageRocketPhysics'

const bottleManager = BottleManager.getInstance()
const multiStageRocketPhysics = MultiStageRocketPhysics.getInstance()

// 瓶子模板列表
const templates = computed(() => bottleManager.getTemplates())

// 新建瓶子表单
const showNewBottleForm = ref(false)
const newBottle = ref({
  name: '',
  bottleVolume: 2000,
  bottleMass: 100,
  bottleDiameter: 0.1,
  nozzleDiameter: 0.02,
  description: ''
})

// 火箭配置
const stageCount = ref(1)
const bottleCount = ref(1)
const separationTime = ref(2)
const selectedBottles = ref<string[]>(['cola-2l']) // 每级选择的瓶子ID

// 添加自定义瓶子
const handleAddBottle = () => {
  if (!newBottle.value.name) {
    ElMessage.warning('请输入瓶子名称')
    return
  }
  bottleManager.addTemplate(newBottle.value)
  showNewBottleForm.value = false
  newBottle.value = {
    name: '',
    bottleVolume: 2000,
    bottleMass: 100,
    bottleDiameter: 0.1,
    nozzleDiameter: 0.02,
    description: ''
  }
}

// 删除自定义瓶子
const handleDeleteBottle = (id: string) => {
  if (selectedBottles.value.includes(id)) {
    ElMessage.warning('该瓶子正在使用中，无法删除')
    return
  }
  bottleManager.deleteTemplate(id)
}

// 更新火箭配置
const updateRocketConfig = () => {
  const configs = []
  for (let i = 0; i < stageCount.value; i++) {
    const bottleTemplate = bottleManager.getTemplateById(selectedBottles.value[i] || 'cola-2l')
    if (bottleTemplate) {
      configs.push({
        bottleCount: bottleCount.value,
        bottleVolume: bottleTemplate.bottleVolume,
        bottleMass: bottleTemplate.bottleMass,
        bottleDiameter: bottleTemplate.bottleDiameter,
        nozzleDiameter: bottleTemplate.nozzleDiameter,
        waterVolume: 1000, // 默认水量
        pressure: 3, // 默认压力
        separationTime: i < stageCount.value - 1 ? separationTime.value * (i + 1) : undefined
      })
    }
  }
  multiStageRocketPhysics.configureStages(configs)
}

// 监听配置变化
watch([stageCount, bottleCount, separationTime, selectedBottles], () => {
  updateRocketConfig()
})
</script>

<template>
  <div class="bottle-selector">
    <!-- 火箭配置 -->
    <div class="config-section">
      <h3>火箭配置</h3>
      <el-form label-width="120px">
        <el-form-item label="火箭级数">
          <el-input-number v-model="stageCount" :min="1" :max="3" />
        </el-form-item>
        <el-form-item label="每级并联瓶数">
          <el-input-number v-model="bottleCount" :min="1" :max="4" />
        </el-form-item>
        <el-form-item label="分离时间(秒)" v-if="stageCount > 1">
          <el-input-number v-model="separationTime" :min="0.5" :max="10" :step="0.5" />
        </el-form-item>
      </el-form>
    </div>

    <!-- 瓶子选择 -->
    <div class="stages-section">
      <h3>火箭级配置</h3>
      <div class="stage-list">
        <div v-for="i in stageCount" :key="i" class="stage-item">
          <h4>第{{ i }}级</h4>
          <el-select v-model="selectedBottles[i-1]" placeholder="选择瓶子类型">
            <el-option
              v-for="template in templates"
              :key="template.id"
              :label="template.name"
              :value="template.id"
            >
              <div class="bottle-option">
                <span>{{ template.name }}</span>
                <small>{{ template.description }}</small>
              </div>
            </el-option>
          </el-select>
        </div>
      </div>
    </div>

    <!-- 瓶子模板管理 -->
    <div class="templates-section">
      <div class="section-header">
        <h3>瓶子模板</h3>
        <el-button type="primary" @click="showNewBottleForm = true">添加瓶子</el-button>
      </div>
      
      <div class="template-list">
        <el-card v-for="template in templates" :key="template.id" class="template-card">
          <template #header>
            <div class="card-header">
              <span>{{ template.name }}</span>
              <el-button 
                v-if="template.isCustom" 
                type="danger" 
                link 
                @click="handleDeleteBottle(template.id)"
              >
                删除
              </el-button>
            </div>
          </template>
          <p class="description">{{ template.description }}</p>
          <div class="params">
            <p>容积: {{ template.bottleVolume }}ml</p>
            <p>质量: {{ template.bottleMass }}g</p>
            <p>直径: {{ template.bottleDiameter }}m</p>
            <p>喷嘴: {{ template.nozzleDiameter }}m</p>
          </div>
        </el-card>
      </div>
    </div>

    <!-- 新建瓶子表单 -->
    <el-dialog v-model="showNewBottleForm" title="添加自定义瓶子" width="500px">
      <el-form :model="newBottle" label-width="100px">
        <el-form-item label="瓶子名称" required>
          <el-input v-model="newBottle.name" />
        </el-form-item>
        <el-form-item label="容积(ml)">
          <el-input-number v-model="newBottle.bottleVolume" :min="100" :max="5000" />
        </el-form-item>
        <el-form-item label="质量(g)">
          <el-input-number v-model="newBottle.bottleMass" :min="10" :max="500" />
        </el-form-item>
        <el-form-item label="直径(m)">
          <el-input-number v-model="newBottle.bottleDiameter" :min="0.01" :max="0.5" :step="0.01" />
        </el-form-item>
        <el-form-item label="喷嘴直径(m)">
          <el-input-number v-model="newBottle.nozzleDiameter" :min="0.005" :max="0.05" :step="0.001" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="newBottle.description" type="textarea" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showNewBottleForm = false">取消</el-button>
        <el-button type="primary" @click="handleAddBottle">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.bottle-selector {
  padding: 20px;
}

.config-section,
.stages-section,
.templates-section {
  margin-bottom: 30px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.stage-list {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}

.stage-item {
  min-width: 200px;
}

.template-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 20px;
}

.template-card {
  height: 100%;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.description {
  color: #666;
  font-size: 14px;
  margin-bottom: 10px;
}

.params {
  font-size: 13px;
  color: #333;
}

.params p {
  margin: 5px 0;
}

.bottle-option {
  display: flex;
  flex-direction: column;
}

.bottle-option small {
  color: #999;
  font-size: 12px;
}
</style>