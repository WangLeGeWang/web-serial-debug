<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDashboardStore } from '@/store/dashboardStore'
import { useRouter } from 'vue-router'

const dashboardStore = useDashboardStore()
const router = useRouter()

const dashboards = computed(() => dashboardStore.dashboards)

const handleToggleShowInTab = (id: string) => {
  dashboardStore.toggleShowInTab(id)
}

const handleCopy = (id: string) => {
  dashboardStore.copyDashboard(id)
}

const handleDelete = (id: string) => {
  dashboardStore.removeDashboard(id)
}

const resolveCanvasUrl = (id: string, mode: string) => {
  return router.resolve({ name: 'canvas', params: { id }, query: { mode } }).href
}

const handleOpenEdit = (id: string) => {
  window.open(resolveCanvasUrl(id, 'edit'), '_blank')
}

const handleOpenView = (id: string) => {
  window.open(resolveCanvasUrl(id, 'view'), '_blank')
}

const showCreateDialog = ref(false)
const newDashboardName = ref('')

const handleCreate = () => {
  if (newDashboardName.value.trim()) {
    const id = dashboardStore.addDashboard(newDashboardName.value.trim())
    newDashboardName.value = ''
    showCreateDialog.value = false
    handleOpenEdit(id)
  }
}
</script>

<template>
  <div class="canvas-list-page">
    <div class="list-section">
      <div class="list-header">
        <h3>画布管理</h3>
        <el-button type="primary" size="small" @click="showCreateDialog = true">
          <el-icon><plus /></el-icon> 新建画布
        </el-button>
      </div>

      <div class="list-body">
        <div v-for="db in dashboards" :key="db.id" class="list-row">
          <div class="row-info">
            <el-icon v-if="!db.deletable" class="pin-icon"><star-filled /></el-icon>
            <span class="row-name">{{ db.name }}</span>
            <span class="row-count">{{ db.items.length }} Widget</span>
          </div>
          <div class="row-actions">
            <el-switch
              :model-value="db.showInTab"
              size="small"
              active-text="Tab"
              @change="handleToggleShowInTab(db.id)"
            />
            <el-button size="small" type="primary" :disabled="!db.editable" @click="handleOpenEdit(db.id)">
              <el-icon><edit /></el-icon> 编辑
            </el-button>
            <el-button size="small" @click="handleOpenView(db.id)">
              <el-icon><full-screen /></el-icon> 查看
            </el-button>
            <el-button size="small" @click="handleCopy(db.id)">
              <el-icon><copy-document /></el-icon> 复制
            </el-button>
            <el-button v-if="db.deletable" size="small" type="danger" @click="handleDelete(db.id)">
              <el-icon><delete /></el-icon> 删除
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <el-dialog v-model="showCreateDialog" title="新建画布" width="400px">
      <el-input
        v-model="newDashboardName"
        placeholder="请输入画布名称"
        @keyup.enter="handleCreate"
      />
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="handleCreate">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="less">
.canvas-list-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
}

.list-section {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.list-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--el-border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;

  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }
}

.list-body {
  flex: 1;
  overflow: auto;
  padding: 12px 16px;
}

.list-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border: 1px solid #0000;
  border-radius: 4px;
  margin-bottom: 8px;
  background: var(--el-bg-color-overlay);

  &:hover {
    border-color: var(--el-border-color);
  }
}

.row-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pin-icon {
  color: var(--el-color-warning);
}

.row-name {
  font-size: 14px;
  font-weight: 500;
}

.row-count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.row-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.row-actions .el-button {
  margin-left: 0px;
}
</style>