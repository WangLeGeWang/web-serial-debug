# 虚拟串口工具设计规格

## 概述

为 BUS Studio（web-serial-debug-vue）项目创建一个独立的 Node.js 虚拟串口工具 `bus-mock-serial`，用于开发调试和自动化测试。工具放置在项目根目录的 `tools/` 下。

工具同时支持 socat 虚拟串口（与 Tauri 桌面端真实串口路径对接）和 WebSocket（与浏览器端 WebSocket 设备类型对接）两种输出模式，并支持 AT 指令动态控制。

## 需求

1. **开发调试**：无物理设备时模拟 IMU/遥测数据，交互式调试 BUS Studio 功能
2. **自动化测试**：可脚本化启动，预设数据序列，验证解析/图表/录制等
3. **AT 指令控制**：BUS Studio 通过串口/WebSocket 发送 AT 指令动态调整模拟器参数
4. **双模式通信**：socat 虚拟串口 + WebSocket，按需选择

## 架构

```
tools/bus-mock-serial/
├── package.json
├── tsconfig.json
├── src/
│   ├── cli.ts                — CLI 入口，参数解析
│   ├── core/
│   │   ├── SerialBridge.ts   — socat 虚拟串口管理
│   │   ├── WsServer.ts       — WebSocket 服务端
│   │   ├── DataEngine.ts     — 数据生成引擎
│   │   └── AtCommandHandler.ts — AT 指令解析与响应
│   ├── scenarios/
│   │   ├── imu.ts            — IMU 传感器数据生成器
│   │   ├── telemetry.ts      — 遥测数据生成器
│   │   └── types.ts          — 场景配置类型定义
│   └── utils/
│       ├── format.ts         — 数据格式化（CSV/JSON/HEX）
│       └── noise.ts          — 噪声/漂移算法
├── config/
│   ├── imu.yaml              — IMU 场景默认配置
│   └── telemetry.yaml        — 遥测场景默认配置
└── README.md                 — 使用说明
```

## 数据流

```
DataEngine (按场景定时生成数据)
  → AtCommandHandler (可选：根据 AT 指令修改参数)
  → SerialBridge.write (socat 模式，写入 /tmp/ttyV1)
  → WsServer.send (WebSocket 模式，推送给客户端)

BUS Studio 发送 AT 指令
  → SerialBridge.read / WsServer.onMessage
  → AtCommandHandler.parse
  → 修改 DataEngine 参数并响应 OK/ERROR
```

## CLI

```bash
# 启动 IMU 场景，串口+WebSocket 双模式
npx bus-mock-serial --scenario imu --mode both

# 仅 WebSocket 模式（CI 环境）
npx bus-mock-serial --scenario telemetry --mode ws --ws-port 8080

# 仅虚拟串口模式
npx bus-mock-serial --scenario imu --mode serial --baudrate 115200

# 自定义 YAML 配置
npx bus-mock-serial --scenario ./my-scenario.yaml --mode both
```

CLI 参数：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--scenario` | `imu` | 场景名（imu/telemetry）或 YAML 文件路径 |
| `--mode` | `both` | 输出模式：serial/ws/both |
| `--baudrate` | `115200` | 串口波特率 |
| `--ws-port` | `8080` | WebSocket 端口 |
| `--interval` | 场景默认 | 数据输出间隔(ms) |
| `--format` | 场景默认 | 数据格式：csv/json/hex |

## AT 指令

AT 指令以文本行形式发送（以 `\n` 结尾），虚拟串口工具从串口读取端或 WebSocket 接收端解析。

| 指令 | 功能 | 响应 |
|------|------|------|
| `AT` | 心跳确认 | `OK` |
| `AT+SCENE=<name>` | 切换场景 | `OK` 或 `ERROR:NOT_FOUND` |
| `AT+RATE=<ms>` | 改变输出频率 | `OK` |
| `AT+NOISE=<0-1>` | 设置噪声系数 | `OK` |
| `AT+DRIFT=<0-1>` | 设置漂移系数 | `OK` |
| `AT+FIELD=<key>,<value>` | 固定指定字段值 | `OK` 或 `ERROR:FIELD_NOT_FOUND` |
| `AT+STOP` | 停止数据输出 | `OK` |
| `AT+START` | 恢复数据输出 | `OK` |
| `AT+INFO?` | 查询当前状态 | `SCENE:imu,RATE:50,NOISE:0.02,DRIFT:0.001,FIELDS:6` |

AT 指令响应通过同一通道（串口写入/WebSocket）回传给 BUS Studio。

## 场景配置

### YAML 格式

```yaml
name: imu
description: "IMU 传感器模拟"
interval: 50
format: csv
fields:
  - key: pitch
    base: 0
    range: [-90, 90]
    noise: 0.02
    drift: 0.001
  - key: roll
    base: 0
    range: [-180, 180]
    noise: 0.02
  - key: yaw
    base: 0
    range: [0, 360]
    noise: 0.01
  - key: ax
    base: 0
    noise: 0.5
  - key: ay
    base: 0
    noise: 0.5
  - key: az
    base: 9.8
    noise: 0.3
```

### 遥测场景

```yaml
name: telemetry
description: "火箭遥测模拟"
interval: 100
format: json
fields:
  - key: altitude
    base: 0
    range: [0, 10000]
    noise: 1.0
    drift: 0.5
  - key: velocity
    base: 0
    range: [0, 500]
    noise: 2.0
  - key: temperature
    base: 25
    range: [-40, 80]
    noise: 0.1
  - key: pressure
    base: 101325
    range: [0, 101325]
    noise: 10
  - key: gps_lat
    base: 39.9
    noise: 0.0001
  - key: gps_lon
    base: 116.4
    noise: 0.0001
  - key: battery
    base: 100
    range: [0, 100]
    drift: -0.01
```

### 输出格式

- **csv**: `pitch:0.13,roll:0.00,yaw:0.07,ax:0.50,ay:-0.30,az:9.81\n` — 与 BUS Studio 默认脚本兼容
- **json**: `{"pitch":0.13,"roll":0.00,"yaw":0.07,"ax":0.50,"ay":-0.30,"az":9.81}\n`
- **hex**: 二进制帧，帧头 + 字段值 + 校验和（与 SerialHelper HEX 模式兼容）

## SerialBridge（socat 管理）

- 使用 `child_process.spawn` 管理 socat 进程
- 创建串口对：`socat -d -d pty,link=/tmp/ttyV0,raw,echo=0 pty,link=/tmp/ttyV1,raw,echo=0`
- BUS Studio (Tauri 桌面端) 连接 `/tmp/ttyV0`，工具读写 `/tmp/ttyV1`
- Tauri Rust 后端已有 `get_serial_ports()` 扫描 `/tmp/ttyV*` 路径
- 串口配置（波特率等）通过 socat 的 `rawer` 模式传递，不限制速率
- 退出时 SIGTERM socat 进程并清理

## WsServer

- 使用 `ws` 库
- 支持多客户端同时连接，每个连接独立维护数据推送
- 收到文本消息时解析为 AT 指令，处理后回传响应
- 收到二进制消息时按 HEX 模式解析 AT 指令
- 新连接时自动按当前场景推送数据

## DataEngine

- 根据场景配置定时生成数据行
- 每个字段：base + drift*time + noise*random
- 支持 AT 指令动态修改参数（rate/noise/drift/field 值）
- AT+STOP 暂停输出，AT+START 恢复
- AT+SCENE 切换场景时重置所有参数

## 依赖

| 包 | 用途 |
|----|------|
| `ws` | WebSocket 服务端 |
| `yaml` | YAML 配置解析 |
| `commander` | CLI 参数解析 |

无其他外部依赖。socat 为系统级依赖（macOS/Linux 自带或 brew 安装）。

## 项目集成

- 工具代码放在 `tools/bus-mock-serial/` 目录
- 独立 `package.json`，有自己的 TypeScript 编译配置
- BUS Studio 项目不需要安装此工具的依赖
- 在 BUS Studio 的 `package.json` 中添加便利脚本：`"mock-serial": "node tools/bus-mock-serial/dist/cli.js"`