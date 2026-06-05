<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { getDataHub } from '@/runtime/data/DataHub'
import { useDataSourceFromPlaybackStore } from '@/runtime/source/useDataSourceFromPlaybackStore'
import { usePlaybackStore } from '@/store/playbackStore'
import { WorkspaceManagerInst } from '@/utils/ProfileManager'
import type { FieldState } from '@/runtime/data/types'

interface FieldRow {
  key: string
  value: number | string | boolean | null
  min: number | null
  max: number | null
  avg: number | null
}

interface Props {
  columns?: string[]
  pageSize?: number
}

const props = withDefaults(defineProps<Props>(), {
  columns: () => [],
  pageSize: 20
})

// 强制 realtime 模式 — 数据表始终展示实时字段状态，不受全局 playback mode 影响
const ds = useDataSourceFromPlaybackStore({ forceMode: 'realtime' })
const playbackStore = usePlaybackStore()
const { activeQuery } = storeToRefs(playbackStore)

// 合并数据源：profile 持久化字段定义（骨架） + DataHub 实时统计（值）
// 串口未连接时 DataHub 为空，仍能从 profile 显示字段列表
const visibleFields = computed<FieldRow[]>(() => {
  // 依赖 ds.visibleData 作为实时数据触发器（它内部依赖 frameCounter ref）
  void ds.visibleData
  // 依赖 activeWorkspaceId 确保 workspace 切换时 profile 字段重新读取
  void WorkspaceManagerInst.activeWorkspaceIdRef.value

  const hub = getDataHub()
  const liveStates = hub.getFieldStates(activeQuery.value)
  const liveMap = new Map<string, FieldState>()
  for (const s of liveStates) liveMap.set(s.key, s)

  // 从 workspace profile 取持久化的字段定义作为骨架
  const profileFields = (WorkspaceManagerInst.activeWorkspace?.config?.fields as any[]) || []

  // 合并：profile 字段 + DataHub 中新增但 profile 未记录的字段
  const merged: FieldRow[] = []
  const seen = new Set<string>()

  for (const pf of profileFields) {
    const key = pf.key as string
    seen.add(key)
    const live = liveMap.get(key)
    merged.push({
      key,
      value: live?.value ?? (pf.value ?? null),
      min: live?.min ?? (pf.min ?? null),
      max: live?.max ?? (pf.max ?? null),
      avg: live?.avg ?? (pf.avg ?? null),
    })
  }

  // DataHub 中新增字段（profile 未记录，autoAddField 场景）
  for (const ls of liveStates) {
    if (!seen.has(ls.key)) {
      merged.push({
        key: ls.key,
        value: ls.value,
        min: ls.min,
        max: ls.max,
        avg: ls.avg,
      })
    }
  }

  if (props.columns.length > 0) {
    return merged.filter(f => props.columns.includes(f.key))
  }
  return merged
})

const formatValue = (v: number | string | boolean | null | undefined): string => {
  if (v === null || v === undefined) return '-'
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return String(v)
    const abs = Math.abs(v)
    if (abs >= 100) return v.toFixed(1)
    if (abs >= 1) return v.toFixed(2)
    if (abs >= 0.01) return v.toFixed(3)
    return v.toFixed(4)
  }
  return String(v)
}

const isDark = computed(() => {
  return document.documentElement.classList.contains('dark')
})
</script>

<template>
  <div class="canvas-data-table" :class="{ dark: isDark }">
    <div v-if="visibleFields.length === 0" class="no-data">
      <span>暂无数据</span>
    </div>
    <table v-else>
      <thead>
        <tr>
          <th class="col-name">字段</th>
          <th class="col-value">当前值</th>
          <th class="col-min">最小</th>
          <th class="col-max">最大</th>
          <th class="col-avg">平均</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="f in visibleFields.slice(0, pageSize)" :key="f.key">
          <td class="col-name">{{ f.key }}</td>
          <td class="col-value">{{ formatValue(f.value) }}</td>
          <td class="col-min">{{ formatValue(f.min) }}</td>
          <td class="col-max">{{ formatValue(f.max) }}</td>
          <td class="col-avg">{{ formatValue(f.avg) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.canvas-data-table {
  width: 100%;
  height: 100%;
  overflow: auto;
  font-size: 12px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.no-data {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #888;
  font-size: 13px;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  padding: 4px 8px;
  text-align: left;
  white-space: nowrap;
  border-bottom: 1px solid rgba(128, 128, 128, 0.15);
}

th {
  font-weight: 500;
  color: #999;
  font-size: 11px;
}

.col-name { font-weight: 600; }
.col-value { color: #eee; }
.col-min, .col-max, .col-avg { color: #aaa; font-size: 11px; }

/* Light theme */
.canvas-data-table:not(.dark) th,
.canvas-data-table:not(.dark) td {
  border-bottom-color: rgba(0, 0, 0, 0.08);
}
.canvas-data-table:not(.dark) .col-value { color: #333; }
.canvas-data-table:not(.dark) .col-name { color: #111; }
.canvas-data-table:not(.dark) .col-min,
.canvas-data-table:not(.dark) .col-max,
.canvas-data-table:not(.dark) .col-avg { color: #666; }
.canvas-data-table:not(.dark) th { color: #555; }

/* Dark theme */
.canvas-data-table.dark { color: #ccc; }
.canvas-data-table.dark .col-value { color: #eee; }
.canvas-data-table.dark .col-name { color: #ddd; }
</style>