# 历史数据回放功能设计规格

**日期**: 2026-03-27
**状态**: 已确认

---

## 一、需求概述

### 1.1 功能目标

- 支持对已接收的串口/WebSocket 历史数据进行回放
- 提供完整播放器交互（播放/暂停/拖拽进度/调速/正倒放）
- 支持保存、命名、管理多条历史数据系列
- 数据持久化：Web 环境使用 IndexedDB，Desktop 环境使用 .wssd 文件

### 1.2 核心决策

| 问题 | 决策 |
|------|------|
| 回放时新数据处理 | 后台静默接收，回放结束后可追加 |
| 降采样策略 | LTTB 算法，内存超 50,000 点时降至 10,000 点 |
| 数据系列管理 | 支持多条命名系列 |
| 导出格式 | NDJSON .wssd（可文本查看） |
| dataStore.ts | **最终删除**，RealtimeProvider 直接重构为独立实现 |

---

## 二、架构设计（方案 C：数据源抽象层）

### 2.1 整体架构

```
┌─────────────────────────────────────────────────┐
│                  Widget 层                       │
│   chart / table / 3d / pipeline / sim / rocket   │
│              ↓ useDataSource()                   │
├─────────────────────────────────────────────────┤
│           DataSourceProvider 接口                │
│   visibleData / fields / timeRange / mode        │
├──────────────────┬──────────────────────────────┤
│ RealtimeProvider │    PlaybackProvider           │
│  (封装 dataStore)│  (驱动回放索引 + LTTB)        │
├──────────────────┴──────────────────────────────┤
│                  存储层                          │
│  IndexedDB (Web) │  .wssd NDJSON 文件 (Desktop) │
│  DataSeriesStore：管理多条历史数据系列            │
└─────────────────────────────────────────────────┘
```

### 2.2 模式切换流程

```
实时模式（默认）:
  EventCenter.DATA_UPDATE
    → RealtimeProvider.addDataPoint()
    → 后台自动分片写入 IndexedDB / .wssd（每 30 秒）

切换到回放模式:
  用户从管理面板或切换系列下拉选择系列
    → PlaybackProvider.load(seriesId)
    → RealtimeProvider 继续后台静默接收（不影响显示）
    → 用户控制播放/暂停/进度

从回放返回实时:
  PlaybackProvider 卸载
    → RealtimeProvider 接管 visibleData
    → 静默期间数据已缓冲，自动追加
```

### 2.3 文件结构

```
src/
├── store/
│   ├── dataStore.ts            # 保留（RealtimeProvider 内部使用）
│   ├── playbackStore.ts        # 新建：回放状态管理
│   └── dataSeriesStore.ts      # 新建：数据系列 CRUD
├── utils/
│   ├── DataSourceProvider.ts   # 新建：接口定义 + useDataSource()
│   ├── RealtimeProvider.ts     # 新建：实时数据源实现
│   ├── PlaybackProvider.ts     # 新建：回放数据源实现
│   ├── PlaybackController.ts   # 新建：回放引擎（RAF 驱动）
│   ├── DataSeriesStorage.ts    # 新建：IndexedDB + .wssd 存储
│   └── lttb.ts                 # 新建：LTTB 降采样算法
├── components/canvasPanel/
│   ├── PlaybackControl.vue     # 新建：替换 TimeRangeControl.vue
│   └── DataSeriesManager.vue   # 新建：数据系列管理抽屉
└── widgets/
    └── (所有 widget 替换 useDataStore → useDataSource)
```

---

## 三、核心数据结构

### 3.1 DataSourceProvider 接口

```typescript
interface DataPoint {
  timestamp: number
  values: Record<string, any>    // 支持 number / string / boolean 等类型
}

interface DataSourceProvider {
  readonly visibleData: DataPoint[]
  readonly fields: string[]
  readonly timeRange: [number, number] | null
  readonly mode: 'realtime' | 'playback'
}

// 全局 composable，替代 useDataStore()
function useDataSource(): DataSourceProvider
```

### 3.2 数据系列

```typescript
interface DataSeries {
  id: string
  name: string                   // 用户命名
  startTime: number
  endTime: number
  pointCount: number
  fields: string[]
  fieldTypes?: Record<string, 'number' | 'string' | 'boolean' | 'other'>
  createdAt: number
  sizeBytes: number
}

interface DataChunk {
  seriesId: string
  chunkIndex: number
  points: DataPoint[]            // 最多 10,000 点/块
}
```

### 3.3 回放状态

```typescript
interface PlaybackState {
  isActive: boolean
  isPlaying: boolean
  currentTime: number
  speed: 0.1 | 0.5 | 1 | 2 | 5 | 10
  direction: 1 | -1
  loopMode: 'none' | 'loop'
  activeSeries: DataSeries | null
  windowDuration: number         // 可见时间窗口宽度，与实时模式保持一致
}
```

### 3.4 Widget 迁移方式

```typescript
// 修改前
import { useDataStore } from '@/store/dataStore'
const store = useDataStore()
// 使用 store.visibleData, store.fields

// 修改后
import { useDataSource } from '@/utils/DataSourceProvider'
const source = useDataSource()
// 使用 source.visibleData, source.fields（接口相同，无缝替换）
```

---

## 四、存储层

### 4.1 整体策略

```
实时接收数据
  → 内存（上限 50,000 点）
  → 超过 50,000 点触发 LTTB 降采样至 10,000 点（内存展示用）
  → 原始数据每 30 秒自动分片写入 IndexedDB / .wssd（完整保留）

用户手动保存:
  → 弹出保存对话框，选择时间范围 + 命名
  → 写入 DataSeries 元数据，IndexedDB 分片数据已在后台写好
```

### 4.2 IndexedDB 结构（Web 环境）

```
数据库名: wssd_data_series
版本: 1

Object Store: series
  keyPath: id
  存储: DataSeries 元数据

Object Store: chunks
  keyPath: [seriesId, chunkIndex]
  index: seriesId
  存储: DataChunk（每块最多 10,000 点）
```

### 4.3 .wssd NDJSON 格式（Desktop 环境）

```
第 1 行 - 元数据:
{"type":"meta","version":1,"name":"飞行测试001","startTime":1700000000000,"endTime":1700003600000,"fields":["x","y","z"],"pointCount":12345}

第 2~N 行 - 数据点（每行一个 JSON 对象）:
{"t":1700000000000,"v":{"x":1.23,"y":4.56,"z":true}}
{"t":1700000000100,"v":{"x":1.24,"y":"OK","z":false}}
```

特点：
- 任意文本编辑器可读
- `jq '.v.x' data.wssd` 直接分析
- Python `for line in f` 流式处理
- Desktop 模式下实时接收时直接 append，文件即数据库
- 存储路径：`{appDataDir}/data-series/{seriesId}.wssd`

### 4.4 DataSeriesStorage 接口

```typescript
interface DataSeriesStorage {
  listSeries(): Promise<DataSeries[]>
  saveSeries(series: DataSeries): Promise<void>
  loadChunk(seriesId: string, chunkIndex: number): Promise<DataPoint[]>
  deleteSeries(seriesId: string): Promise<void>
  exportToFile(seriesId: string, filePath: string): Promise<void>
  importFromFile(filePath: string): Promise<DataSeries>
}
```

### 4.5 分页预加载策略

```
回放时按需分页加载，避免全量加载导致内存溢出:

当前播放位置 → 当前块 + 预加载前后各 1 块
内存中最多保留 3 块（约 30,000 点）
剩余 < 20% 时异步预加载下一块
用户 seek 时立即加载目标块
```

---

## 五、回放引擎

### 5.1 PlaybackController

```typescript
class PlaybackController {
  private rafId: number | null = null
  private lastRealTime: number = 0

  play(): void    // RAF 驱动虚拟时间推进
  pause(): void   // 取消 RAF
  stop(): void    // 重置到起点
  seek(timestamp: number): void
  setSpeed(speed: number): void
  setDirection(dir: 1 | -1): void
}
```

RAF tick 逻辑：
```
delta = (realTime - lastRealTime) × speed × direction
currentTime += delta
→ 触发 PlaybackProvider.onTick(currentTime)
→ 更新 visibleData（二分查找当前时间窗口内的点）
→ 检查是否需要预加载下一块
```

### 5.2 分片预加载状态机

```
IDLE → LOADING_INITIAL → READY
READY → PREFETCHING（异步，剩余 < 20%）→ READY
READY → SEEKING → LOADING_CHUNK → READY
```

### 5.3 LTTB 降采样

```
触发条件: 内存数据点数 ≥ 50,000
目标点数: 10,000（用于内存展示）
策略: LTTB（保留视觉上最重要的点，保留极值/转折点）
原始数据: 完整保留在 IndexedDB，不受影响
```

---

## 六、UI 组件

### 6.1 PlaybackControl.vue（替换 TimeRangeControl.vue）

```
实时模式（默认）:
┌────────────────────────────────────────────┐
│  ● 实时                              [历史] │
└────────────────────────────────────────────┘

回放模式:
┌────────────────────────────────────────────────────────────────────┐
│  [● 回放中]  飞行测试001  [切换系列 ▼]  [保存当前]  [管理]         │
│                                                                    │
│  ⏮  ⏪5s  ⏯  ⏩5s  ⏭     ══════●══════════════  01:23 / 05:30  [1x▼] │
└────────────────────────────────────────────────────────────────────┘
高度约 80px，固定在 canvas-panel 底部
```

### 6.2 控件交互

| 控件 | 行为 | 快捷键 |
|------|------|--------|
| 实时/回放切换 | 切换 DataSourceProvider | - |
| 切换系列下拉 | 加载另一条历史系列 | - |
| 保存当前 | 弹出保存对话框 | - |
| 管理 | 打开 DataSeriesManager 抽屉 | - |
| ⏮ / ⏭ | 跳到起点 / 终点 | `Home` / `End` |
| ⏪5s / ⏩5s | 后退 / 前进 5 秒 | `←` / `→` |
| ⏯ | 播放 / 暂停 | `Space` |
| 进度条 | 拖拽 seek（显示完整系列时间段） | 鼠标拖拽 |
| 速度下拉 | 0.1x / 0.5x / 1x / 2x / 5x / 10x | `1`~`6` |

### 6.3 保存对话框

```
┌─────────────────────────────────────────────┐
│  保存数据记录                                │
│                                             │
│  名称: [飞行测试 001________________]       │  ← 默认当前时间
│                                             │
│  选择时间范围:                              │
│  ┌───────────────────────────────────────┐  │
│  │  ▓▓▓▓▓▓▓▓████████████████▓▓▓▓▓▓▓▓▓  │  │  ← 缩略波形（复用 uPlot）
│  │         ↑              ↑             │  │
│  └───────────────────────────────────────┘  │
│  14:30:00            ~  15:05:00            │
│                                             │
│  预计: 12,340 点 · 约 2.1MB                 │
│                                             │
│              [取消]  [保存]                  │
└─────────────────────────────────────────────┘
```

### 6.4 DataSeriesManager.vue（抽屉式）

```
┌─────────────────────────────────┐
│  历史数据系列              [✕]  │
├─────────────────────────────────┤
│  [+ 保存当前数据]               │
├─────────────────────────────────┤
│  ● 飞行测试 001                 │
│    14:30 ~ 15:05  1.2万点  2MB │
│    [回放]  [导出.wssd]  [删除]  │
│                                 │
│  ● 测试记录 2026-03-27          │
│    09:00 ~ 09:45  3.4万点  6MB │
│    [回放]  [导出.wssd]  [删除]  │
├─────────────────────────────────┤
│  [从文件导入 .wssd]             │
│  已用空间: 8.2MB / 50MB         │
└─────────────────────────────────┘
```

---

## 七、实施阶段

### 阶段一：数据源抽象层
1. 定义 `DataSourceProvider` 接口和 `useDataSource()` composable
2. 实现 `RealtimeProvider`（封装现有 dataStore）
3. 所有 widget 迁移 `useDataStore` → `useDataSource`

### 阶段二：存储层
1. 实现 `DataSeriesStorage`（IndexedDB 适配器）
2. 实现 .wssd NDJSON 读写（Desktop）
3. 实现 LTTB 降采样算法
4. 实现 `dataSeriesStore`（系列 CRUD）

### 阶段三：回放引擎
1. 实现 `PlaybackController`（RAF 驱动）
2. 实现 `PlaybackProvider`（分片预加载 + 二分查找）
3. 实现 `playbackStore`（回放状态）

### 阶段四：UI
1. 实现 `PlaybackControl.vue`（替换 TimeRangeControl.vue）
2. 实现 `DataSeriesManager.vue`（管理抽屉）
3. 实现保存对话框（复用 uPlot 波形选择范围）
4. 添加键盘快捷键

---

## 八、兼容性与风险

| 场景 | 处理方式 |
|------|----------|
| Web 环境 | IndexedDB 存储，NDJSON 导出 |
| Desktop 环境 | .wssd 直接 append 写，省去 IndexedDB |
| 内存超限 | LTTB 自动降采样（50,000 → 10,000） |
| 大数据回放 | 按需分片加载，内存最多 3 块 |
| 回放中接收新数据 | 静默写入 RealtimeProvider，不干扰回放 |
| 字段类型不一致 | DataSeries.fieldTypes 记录元数据，widget 自行处理 |
