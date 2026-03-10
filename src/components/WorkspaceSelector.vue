<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ScriptManager } from '../utils/ScriptManager'
import { EventCenter, EventNames } from '../utils/EventCenter'
import { WorkspaceManagerInst, isConnected, connectedDeviceId, type Workspace } from '../utils/ProfileManager'
import { authorizedDevices, type Device } from '../devices'
import { isDesktop } from '../utils/Platform'
import * as DeviceSerialPort from '../devices/serialport'
import * as DeviceWebUSB from '../devices/webusb'
import * as DeviceBluetooth from '../devices/bluetooth'
import * as DeviceWebSocket from '../devices/websocket'
import * as DeviceWebSTLink from '../devices/webstlink'
import * as DeviceDAPLink from '../devices/daplink'
import * as DesktopSerial from '../devices/desktop'

const workspaceManager = WorkspaceManagerInst
const eventCenter = EventCenter.getInstance()
const scriptManager = ScriptManager.getInstance()

const workspaces = computed(() => workspaceManager.workspacesRef.value)
const activeWorkspaceId = computed(() => workspaceManager.activeWorkspaceIdRef.value)
const activeWorkspace = computed(() => workspaceManager.activeWorkspace)

const serialWriter = ref<WritableStreamDefaultWriter | null>(null)
const serialReader = ref<ReadableStreamDefaultReader | null>(null)

const showWorkspacePopover = ref(false)
const showSettings = ref(false)

const refreshDesktopDevices = async () => {
  if (!isDesktop()) return
  const existingIds = new Set(authorizedDevices.value.map(d => d.id))
  const ports = await DesktopSerial.DesktopSerialDevice.getAvailablePorts()
  for (const portName of ports) {
    const id = `desktop-serial-${portName}`
    if (!existingIds.has(id)) {
      const device = new DesktopSerial.DesktopSerialDevice(portName)
      authorizedDevices.value.push(device as unknown as Device)
    }
  }
  const newIds = new Set(ports.map(p => `desktop-serial-${p}`))
  authorizedDevices.value = authorizedDevices.value.filter(d => 
    d.type !== 'desktop-serial' || newIds.has(d.id)
  )
}

watch(showWorkspacePopover, (visible) => {
  if (visible) {
    refreshDesktopDevices()
  }
})
const workspaceName = ref('')
const workspaceDeviceId = ref<string | null>(null)
const autoReconnect = ref(false)
const selectedDeviceType = ref('serialport')

const serialConfig = ref({
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: 'none' as 'none' | 'odd' | 'even',
  flowControl: 'none' as 'none' | 'hardware'
})
const wsConfig = ref({
  url: ''
})

const baudRates = [921600, 460800, 230400, 115200, 57600, 38400, 19200, 9600, 4800, 2400, 1200]

const loadWorkspaceSettings = (workspace: Workspace) => {
  workspaceName.value = workspace.name
  workspaceDeviceId.value = workspace.deviceId
  autoReconnect.value = workspace.config.autoReconnect ?? false
  if (workspace.config.serial) {
    serialConfig.value = { ...serialConfig.value, ...workspace.config.serial }
  }
  if (workspace.config.websocket) {
    wsConfig.value = { ...wsConfig.value, ...workspace.config.websocket }
  }
}

const openSettings = () => {
  const workspace = activeWorkspace.value
  if (workspace) {
    loadWorkspaceSettings(workspace)
  }
  showSettings.value = true
}

const saveWorkspaceSettings = () => {
  const workspace = activeWorkspace.value
  if (workspace) {
    if (workspaceName.value && workspaceName.value !== workspace.name) {
      workspaceManager.renameWorkspace(workspace.id, workspaceName.value)
    }
    workspaceManager.updateWorkspace(workspace.id, {
      deviceId: workspaceDeviceId.value,
      config: {
        ...workspace.config,
        serial: { ...serialConfig.value },
        websocket: { ...wsConfig.value },
        autoReconnect: autoReconnect.value
      }
    })
    ElMessage.success('设置已保存')
  }
  showSettings.value = false
}

const handleWorkspaceChange = (workspaceId: string) => {
  workspaceManager.setActiveWorkspace(workspaceId)
  const url = new URL(window.location.href)
  url.searchParams.set('workspace', workspaceId)
  window.history.replaceState({}, '', url.toString())
}

const handleCreateWorkspace = () => {
  showWorkspacePopover.value = false
  ElMessageBox.prompt('请输入新工作区名称', '新建工作区', {
    confirmButtonText: '创建',
    cancelButtonText: '取消',
    inputPattern: /.+/,
    inputErrorMessage: '名称不能为空'
  }).then(({ value }) => {
    if (value) {
      workspaceManager.createWorkspace(value)
      ElMessage.success('工作区创建成功')
    }
  }).catch(() => {})
}

const handleDeleteWorkspace = () => {
  showWorkspacePopover.value = false
  if (!activeWorkspace.value) return
  
  if (workspaces.value.length <= 1) {
    ElMessage.warning('至少保留一个工作区')
    return
  }
  
  ElMessageBox.confirm(`确定要删除工作区"${activeWorkspace.value.name}"吗？`, '删除工作区', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    workspaceManager.deleteWorkspace(activeWorkspace.value!.id)
    ElMessage.success('删除成功')
  }).catch(() => {})
}

const handleDuplicateWorkspace = () => {
  showWorkspacePopover.value = false
  if (!activeWorkspace.value) return
  
  ElMessageBox.prompt('请输入新工作区名称', '复制工作区', {
    confirmButtonText: '复制',
    cancelButtonText: '取消',
    inputValue: activeWorkspace.value.name + '_copy',
    inputPattern: /.+/,
    inputErrorMessage: '名称不能为空'
  }).then(({ value }) => {
    if (value) {
      workspaceManager.duplicateWorkspace(activeWorkspace.value!.id, value)
      ElMessage.success('复制成功')
    }
  }).catch(() => {})
}

const getDeviceConfig = (device: Device) => {
  return {
    deviceType: device.type,
    deviceId: device.id,
    deviceTitle: device.title
  }
}

const saveDeviceConfig = (device: Device) => {
  const workspace = activeWorkspace.value
  if (workspace) {
    workspaceManager.updateWorkspace(workspace.id, {
      config: {
        ...workspace.config,
        savedDevice: getDeviceConfig(device)
      }
    })
  }
}

const DataEmit = async (data: Uint8Array) => {
  const runtimer = await scriptManager.getRuntimer()
  if (runtimer.DataReceiverInterface) {
    data = await runtimer.DataReceiverInterface(data)
  }
  eventCenter.emit(EventNames.SERIAL_DATA, data)
}

const startReading = async () => {
  while (isConnected.value && serialReader.value) {
    try {
      const { value, done } = await serialReader.value.read()
      if (done) {
        break
      }
      DataEmit(value)
    } catch (error: any) {
      const errorMessage = error?.message || String(error)
      if (errorMessage.includes('device has been lost') || 
          errorMessage.includes('The device has been lost') ||
          errorMessage.includes('Port not found') ||
          errorMessage.includes('Closed')) {
        await handleUnexpectedDisconnection()
      } else {
        ElMessage.error('读取设备数据失败：' + error)
      }
      break
    }
  }
}

const handleUnexpectedDisconnection = async () => {
  const deviceId = connectedDeviceId.value
  serialReader.value = null
  serialWriter.value = null
  isConnected.value = false
  connectedDeviceId.value = null
  
  const workspace = activeWorkspace.value
  if (workspace?.config?.autoReconnect && deviceId) {
    ElMessage.warning('设备意外断开，正在尝试重连...')
    setTimeout(async () => {
      await attemptAutoReconnect(deviceId)
    }, 1500)
  } else {
    ElMessage.warning('设备已断开')
  }
}

const connectDevice = async (device: Device, saveToWorkspace = true) => {
  const device2 = authorizedDevices.value.find(p => p.id === device.id)
  if (!device2) {
    authorizedDevices.value.push(device)
  }
  
  let port
  try {
    const workspace = activeWorkspace.value
    const config = workspace?.config?.serial || serialConfig.value
    port = await device.connect(config)
  } catch (error) {
    ElMessage.error('设备连接失败：' + error)
    console.log(error)
  }

  if (port) {
    serialWriter.value = port.writer
    serialReader.value = port.reader
    isConnected.value = true
    connectedDeviceId.value = device.id
    ElMessage.success('设备连接成功')
    startReading()
    if (saveToWorkspace) {
      saveDeviceConfig(device)
    }
  }
}

const disconnectDevice = async () => {
  try {
    if (serialReader.value) {
      await serialReader.value.cancel()
      serialReader.value.releaseLock()
    }
    if (serialWriter.value) {
      await serialWriter.value.close()
      serialWriter.value.releaseLock()
    }
  } catch (error) {
    console.log(error)
  }

  try {
    const device = authorizedDevices.value.find(d => d.id === connectedDeviceId.value)
    if (device) {
      await device.disconnect()
    }
    isConnected.value = false
    const wasConnectedDeviceId = connectedDeviceId.value
    connectedDeviceId.value = null
    serialReader.value = null
    serialWriter.value = null
    
    const workspace = activeWorkspace.value
    if (workspace?.config?.autoReconnect && wasConnectedDeviceId) {
      const savedDevice = workspace?.config?.savedDevice as { deviceType: string; deviceId?: string } | undefined
      if (savedDevice?.deviceId === wasConnectedDeviceId || savedDevice?.deviceId === 'mock_imu') {
        setTimeout(async () => {
          await attemptAutoReconnect(wasConnectedDeviceId)
        }, 1000)
        return
      }
    }
    ElMessage.success('设备已断开')
  } catch (error) {
    ElMessage.error('断开设备失败：' + error)
    console.log(error)
  }
}

const attemptAutoReconnect = async (deviceId: string | null) => {
  const workspace = activeWorkspace.value
  if (!workspace?.config?.autoReconnect) return
  
  let device = authorizedDevices.value.find(d => d.id === deviceId)
  if (!device) {
    const savedDevice = workspace?.config?.savedDevice as { deviceType: string; deviceId?: string } | undefined
    if (savedDevice?.deviceId === 'mock_imu') {
      const MockIMUDevice = await import('../devices/mock-imu')
      device = MockIMUDevice.MockIMUDevice.getInstance() as unknown as Device
    }
  }
  
  if (device) {
    ElMessage.info('正在尝试自动重连...')
    await connectDevice(device, false)
  }
}

const handleConnectClick = async () => {
  if (isConnected.value) {
    await disconnectDevice()
  } else {
    const workspace = activeWorkspace.value
    const savedDevice = workspace?.config?.savedDevice as { deviceType: string; deviceId?: string } | undefined
    
    if (savedDevice?.deviceId) {
      let device = authorizedDevices.value.find(d => d.id === savedDevice.deviceId)
      
      if (savedDevice.deviceType === 'serialport' && navigator.serial) {
        const ports = await navigator.serial.getPorts()
        const existingPort = ports.find(p => {
          const info = p.getInfo()
          const productId = info.usbProductId?.toString() || ''
          return 'serialport_' + productId === savedDevice.deviceId
        })
        
        if (!existingPort && device) {
          authorizedDevices.value = authorizedDevices.value.filter(d => d.id !== savedDevice.deviceId)
          device = null
        } else if (existingPort && !device) {
          const { SerialPortDevice } = await import('../devices/serialport')
          device = new SerialPortDevice(existingPort) as unknown as Device
          authorizedDevices.value.push(device)
        }
      }
      
      if (device) {
        await connectDevice(device)
        return
      }
      
      if (savedDevice.deviceType === 'serialport') {
        ElMessage.warning('设备已断开，请重新授权')
        authorizeSerialDevice()
        return
      }
    }
    
    ElMessage.warning('请先选择设备')
    openSettings()
  }
}

const handleSerialSend = async (data: Uint8Array) => {
  if (!isConnected.value || !serialWriter.value) {
    if (data.length == 1 && data[0] == 13) {
      eventCenter.emit(EventNames.TERM_WRITE, data)
    } else {
      ElMessage.error('设备未连接')
    }
    return
  }

  const runtimer = await scriptManager.getRuntimer()
  if (runtimer.DataSenderInterface) {
    data = await runtimer.DataSenderInterface(data)
  }

  try {
    await serialWriter.value.write(data)
  } catch (error) {
    console.log(error)
    ElMessage.error('发送数据失败：' + error)
  }
}

onMounted(() => {
  eventCenter.on(EventNames.SERIAL_SEND, handleSerialSend)
  DeviceSerialPort.init()
  DeviceWebUSB.init()
  DeviceBluetooth.init()
  DeviceWebSTLink.init()
  DeviceDAPLink.init()
})

onUnmounted(() => {
  eventCenter.off(EventNames.SERIAL_SEND, handleSerialSend)
})

const authorizeSerialDevice = async () => {
  try {
    const device = await DeviceSerialPort.request()
    if (device) {
      authorizedDevices.value.push(device)
      ElMessage.success('授权成功')
    }
  } catch (error) {
    ElMessage.error('授权失败：' + error)
  }
}

const authorizeWebUSBDevice = async () => {
  try {
    const device = await DeviceWebUSB.request()
    if (device) {
      authorizedDevices.value.push(device as unknown as Device)
      ElMessage.success('授权成功')
    }
  } catch (error) {
    ElMessage.error('授权失败：' + error)
  }
}

const authorizeBluetoothDevice = async () => {
  try {
    const device = await DeviceBluetooth.request()
    if (device) {
      authorizedDevices.value.push(device as unknown as Device)
      ElMessage.success('授权成功')
    }
  } catch (error) {
    ElMessage.error('授权失败：' + error)
  }
}

const authorizeWebSocketDevice = async () => {
  try {
    ElMessageBox.prompt('请输入WebSocket URL', '连接WebSocket', {
      inputValue: wsConfig.value.url || 'ws://localhost:8080',
      confirmButtonText: '连接',
      cancelButtonText: '取消',
      inputPattern: /.+/,
      inputErrorMessage: 'URL不能为空'
    }).then(async ({ value }) => {
      if (value) {
        wsConfig.value.url = value
        const device = await DeviceWebSocket.request(value)
        if (device) {
          authorizedDevices.value.push(device)
          ElMessage.success('连接成功')
        }
      }
    }).catch(() => {})
  } catch (error) {
    ElMessage.error('连接失败：' + error)
  }
}

const authorizeWebSTLinkDevice = async () => {
  try {
    const device = await DeviceWebSTLink.request()
    if (device) {
      authorizedDevices.value.push(device as unknown as Device)
      ElMessage.success('授权成功')
    }
  } catch (error) {
    ElMessage.error('授权失败：' + error)
  }
}

const authorizeDAPLinkDevice = async () => {
  try {
    const device = await DeviceDAPLink.request()
    if (device) {
      authorizedDevices.value.push(device as unknown as Device)
      ElMessage.success('授权成功')
    }
  } catch (error) {
    ElMessage.error('授权失败：' + error)
  }
}

const handleDeviceSelect = async (device: Device) => {
  showWorkspacePopover.value = false
  if (isConnected.value && connectedDeviceId.value !== device.id) {
    await disconnectDevice()
  }
  if (!isConnected.value || connectedDeviceId.value !== device.id) {
    await connectDevice(device)
  }
}

const getDeviceTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    'serialport': '串口设备',
    'usb': 'WebUSB设备',
    'bluetooth': '蓝牙设备',
    'websocket': 'WebSocket',
    'webstlink': 'ST-Link',
    'daplink': 'DAPLink',
    'mock': '模拟数据(IMU)',
    'desktop-serial': '桌面串口'
  }
  return labels[type] || type
}

const getConnectedDeviceName = computed(() => {
  if (!connectedDeviceId.value) return '未连接'
  const device = authorizedDevices.value.find(d => d.id === connectedDeviceId.value)
  return device?.title || '未知设备'
})
</script>

<template>
  <div class="workspace-selector">
    <el-popover
      v-model:visible="showWorkspacePopover"
      placement="bottom-start"
      :width="400"
      trigger="click"
    >
      <template #reference>
        <div class="workspace-trigger">
          <span class="workspace-name">{{ activeWorkspace?.name || '选择工作区' }}</span>
          <el-icon class="arrow-icon"><ArrowDown /></el-icon>
        </div>
      </template>
      
      <div class="workspace-menu">
        <div class="menu-section">
          <div class="section-title">已授权设备</div>
          <div v-if="authorizedDevices.length === 0" class="empty-tip">
            暂无授权设备
          </div>
          <div 
            v-for="device in authorizedDevices" 
            :key="device.id"
            class="device-item"
            :class="{ active: connectedDeviceId === device.id }"
            @click="handleDeviceSelect(device)"
          >
            <div class="device-info">
              <span class="device-name">{{ device.title }}</span>
              <span class="device-type">{{ getDeviceTypeLabel(device.type) }}</span>
            </div>
            <el-tag v-if="connectedDeviceId === device.id" type="success" size="small">已连接</el-tag>
          </div>
        </div>
        
        <el-divider />
        
        <div class="menu-section">
          <div class="section-title">授权新设备</div>
          <div class="auth-buttons">
            <el-button v-if="!isDesktop()" size="small" @click="authorizeSerialDevice">串口</el-button>
            <el-button v-if="!isDesktop()" size="small" @click="authorizeWebUSBDevice">WebUSB</el-button>
            <el-button v-if="!isDesktop()" size="small" @click="authorizeBluetoothDevice">蓝牙</el-button>
            <el-button v-if="!isDesktop()" size="small" @click="authorizeWebSTLinkDevice">ST-Link</el-button>
            <el-button v-if="!isDesktop()" size="small" @click="authorizeDAPLinkDevice">DAPLink</el-button>
            <el-button size="small" @click="authorizeWebSocketDevice">WebSocket</el-button>
          </div>
        </div>
        
        <el-divider />
        
        <div class="menu-section">
          <div class="section-title">工作区</div>
          <div 
            v-for="workspace in workspaces" 
            :key="workspace.id"
            class="workspace-item"
            :class="{ active: activeWorkspaceId === workspace.id }"
            @click="handleWorkspaceChange(workspace.id)"
          >
            <span>{{ workspace.name }}</span>
            <el-icon v-if="activeWorkspaceId === workspace.id" class="check-icon"><Check /></el-icon>
          </div>
        </div>
        
        <div class="menu-actions">
          <el-button size="small" @click="handleCreateWorkspace">
            <el-icon><Plus /></el-icon>新建工作区
          </el-button>
          <el-button size="small" @click="showWorkspacePopover = false; openSettings()">
            <el-icon><Edit /></el-icon>设置
          </el-button>
          <el-button size="small" @click="handleDuplicateWorkspace">
            <el-icon><CopyDocument /></el-icon>复制
          </el-button>
          <el-button size="small" type="danger" @click="handleDeleteWorkspace">
            <el-icon><Delete /></el-icon>删除
          </el-button>
        </div>
      </div>
    </el-popover>
    
    <el-button 
      :type="isConnected ? 'danger' : 'primary'" 
      size="small" 
      @click="handleConnectClick"
    >
      {{ isConnected ? '断开' : '连接' }}
    </el-button>
    
    <el-button size="small" circle @click="openSettings">
      <el-icon><Setting /></el-icon>
    </el-button>
    
    <el-dialog
      v-model="showSettings"
      title="工作区设置"
      width="600px"
    >
      <el-tabs type="card">
        <el-tab-pane label="工作区">
          <el-form label-width="100px">
            <el-form-item label="名称">
              <el-input v-model="workspaceName" placeholder="工作区名称" />
            </el-form-item>
            <el-form-item label="设备">
              <el-select v-model="workspaceDeviceId" placeholder="选择设备" clearable style="width: 100%;">
                <el-option
                  v-for="device in authorizedDevices"
                  :key="device.id"
                  :label="device.title"
                  :value="device.id"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="自动重连">
              <el-switch v-model="autoReconnect" />
            </el-form-item>
          </el-form>
        </el-tab-pane>
        
        <el-tab-pane label="设备配置">
          <el-form :model="serialConfig" label-width="100px">
            <el-divider>串口参数</el-divider>
            
            <el-form-item label="波特率">
              <el-select v-model="serialConfig.baudRate" style="width: 100%;">
                <el-option v-for="rate in baudRates" :key="rate" :label="rate.toString()" :value="rate" />
              </el-select>
            </el-form-item>
            
            <el-form-item label="数据位">
              <el-select v-model="serialConfig.dataBits" style="width: 100%;">
                <el-option v-for="bits in [8, 7, 6, 5]" :key="bits" :label="bits.toString()" :value="bits" />
              </el-select>
            </el-form-item>
            
            <el-form-item label="停止位">
              <el-select v-model="serialConfig.stopBits" style="width: 100%;">
                <el-option v-for="bits in [1, 2]" :key="bits" :label="bits.toString()" :value="bits" />
              </el-select>
            </el-form-item>
            
            <el-form-item label="校验位">
              <el-select v-model="serialConfig.parity" style="width: 100%;">
                <el-option label="无" value="none" />
                <el-option label="奇校验" value="odd" />
                <el-option label="偶校验" value="even" />
              </el-select>
            </el-form-item>
            
            <el-form-item label="流控制">
              <el-select v-model="serialConfig.flowControl" style="width: 100%;">
                <el-option label="无" value="none" />
                <el-option label="硬件流控" value="hardware" />
              </el-select>
            </el-form-item>
          </el-form>
        </el-tab-pane>
        
        <el-tab-pane label="WebSocket">
          <el-form :model="wsConfig" label-width="100px">
            <el-form-item label="WebSocket URL">
              <el-input v-model="wsConfig.url" placeholder="ws://localhost:8080" />
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>
      
      <template #footer>
        <el-button @click="showSettings = false">取消</el-button>
        <el-button type="primary" @click="saveWorkspaceSettings">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.workspace-selector {
  display: flex;
  align-items: center;
  gap: 8px;
}

.workspace-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
  min-width: 40px;
}

.workspace-trigger:hover {
  background: var(--el-fill-color);
}

.workspace-name {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.arrow-icon {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.workspace-menu {
  max-height: 500px;
  overflow-y: auto;
}

.workspace-menu :deep(.el-divider) {
  margin: 8px 0;
}

.menu-section {
  padding: 4px 0;
}

.section-title {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  padding: 4px 8px;
  margin-bottom: 4px;
}

.empty-tip {
  text-align: center;
  color: var(--el-text-color-secondary);
  padding: 12px;
  font-size: 12px;
}

.device-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.2s;
}

.device-item:hover {
  background: var(--el-fill-color-light);
}

.device-item.active {
  background: var(--el-color-primary-light-9);
}

.device-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.device-name {
  font-size: 13px;
}

.device-type {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.workspace-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.2s;
}

.workspace-item:hover {
  background: var(--el-fill-color-light);
}

.workspace-item.active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.check-icon {
  color: var(--el-color-success);
}

.menu-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 4px 0;
}
.menu-actions .el-button {
  margin: 0;
  padding: 5px;
}

.auth-buttons {
  display: flex;
  flex-wrap: nowrap;
  gap: 4px;
}

.auth-buttons .el-button {
  white-space: nowrap;
  margin: 0;
  padding: 5px;
}
</style>
