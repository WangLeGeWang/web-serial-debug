# [BUS Studio](https://qdsang.github.io/bus-studio/)

Bus Studio 串口监听和调试， 支持 UART、蓝牙、websocket、stlink等等。
提供WEB网页 和 桌面端版本。 [https://qdsang.github.io/bus-studio/](https://qdsang.github.io/bus-studio/)

## Demo

<table>
<tr>
    <td colspan="2"><img src="./docs/1.png" title="Serial Debugger Preview" /></td>
</tr>
<tr>
    <td><img src="./docs/2.png" title="Serial Debugger Preview" /></td>
    <td><img src="./docs/3.png" title="Serial Debugger Preview" /></td>
</tr>
</table>


## 功能特点
```
┌─────────────────────────────────────────────────────────┐
│                       BUS Studio                          │
├─────────────────────────────────────────────────────────┤
│  🔌 连接层          │  📡 协议层        │  📊 数据层   │
│  ├─ 串口            │  ├─ 自定义协议    │  ├─ 实时数据  │
│  ├─ WebUSB          │  ├─ JSON 解析     │  ├─ 历史存储  │
│  ├─ 蓝牙            │  ├─ HEX 解析      │  ├─ 数据导出  │
│  ├─ WebSocket       │  ├─ CSV 解析      │  └─ 数据计算  │
│  ├─ ST-Link/DAPLink │  └─ (可扩展)      │              │
├─────────────────────────────────────────────────────────┤
│  📟 调试功能         │  📈 可视化功能    │  ⚙️ 工具     │
│  ├─ 发送/接收       │  ├─ 串口终端      │  ├─ 快捷指令  │
│  ├─ 脚本自动化      │  ├─ 数据表格      │  ├─ 脚本编辑  │
│  ├─ 协议解析        │  ├─ 实时图表      │  ├─ 协议配置  │
│  └─ 日志记录        │  ├─ 3D 姿态       │  └─ 主题设置  │
│                     │  ├─ 流程图        │              │
│                     │  └─ 模拟仿真      │              │
└─────────────────────────────────────────────────────────┘
```

## 脚本功能
可以编写JavaScript脚本来实现自动化操作，支持以下API：
- `sendText(text)` - 发送文本数据
- `sendHex(hex)` - 发送HEX格式数据
- `sleep(ms)` - 延时指定毫秒数

## 架构亮点

### DataHub 数据中枢

所有数据流转通过 `DataHub` 单例。脚本 `updateDataTable(values)` 实际写入当前工作区的 namespace；可视化层通过 `useDataSource` composable 订阅，自动切换 realtime / history / playback 三种模式。

### 多 Tab 数据互通

基于 `BroadcastChannel` 实现的 `HubTransport`，让多个浏览器 Tab 选择**相同 namespace** 时自动同步数据：

- Tab A 接设备产数据 → Tab B 同 namespace 的图表实时更新
- 通过 frame.origin 防回环
- 每个 Tab 进程独立，互不阻塞

### 历史数据存储

`DataSeriesStorage` 基于 IndexedDB，按 namespace 索引：

- `DataHub.startRecording(namespace, name)` → `stopRecording(id)` 持久化录制
- 按 chunk（10000 点/批）存储，避免大数据集阻塞主线程
- `DataHub.queryHistory({ namespace, timeRange, maxPoints })` 支持 LTTB 抽稀

## 开发环境要求

- Node.js >= 18.0.0
- 支持 Web Serial API 的现代浏览器（如 Chrome、Edge）

## 编译

```bash
# 安装依赖
yarn install

# 启动开发服务器
yarn dev

# 构建生产版本
yarn build

# 预览生产版本
yarn preview
```

## 参考

https://github.com/devanlai/webstlink  
https://v2.tauri.app/zh-cn/start/  
https://github.com/mateosolinho/AeroTelemProc_VidData/tree/main  
https://github.com/Serial-Studio/Serial-Studio  
https://github.com/klonyyy/MCUViewer  


## 许可证

MIT License
