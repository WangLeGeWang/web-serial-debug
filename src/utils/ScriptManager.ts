import { SerialHelper } from './SerialHelper'
import { useFieldStore } from '../store/fieldStore'
import { EventCenter, EventNames } from '../utils/EventCenter'
import { ProfileManagerInst } from './ProfileManager'

const eventCenter = EventCenter.getInstance()

export interface Script {
  id: number
  name: string
  code: string
  isRunning: boolean
}

export interface Runtimer {
  DataReceiverInterface: Function | null,
  DataSenderInterface: Function | null
}

const demoCode = `let receiveBuffer = '';

// 处理接收的数据
async function DataReceiver(data) {
  receiveBuffer += uint8ArrayToString(data);
  // 数据格式："pitch:-0.13,roll:0.00,yaw:0.07\\n"

  if (receiveBuffer.indexOf('\\n') !== -1) {
    const lines = receiveBuffer.split('\\n');
    receiveBuffer = lines.pop() || '';
    
    for (const line of lines) {
      let fields = line.split(',')
      let parsedData = {};
      fields.map((str) => {
        let s2 = str.split(':')
        if (s2.length === 2) {
          parsedData[s2[0]] = parseFloat(s2[1])
        }
      })
      
      // 更新到数据表
      updateDataTable(parsedData);
    }
  }
  return data;
}

// 处理发送的数据
async function DataSender(data) {
  // checksum
  // await sleep(10);

  return data;
}

// 定时发送数据
setInterval(async () => {
  const bytes = new Uint8Array(3);
  // sendHex(bytes);
}, 1000);

// 支持的函数
// stringToUint8Array();
// uint8ArrayToHexString();
// uint8ArrayToString();

`;

export class ScriptManager {
  private static instance: ScriptManager
  private script: Script = {
    id: 1,
    name: '数据处理脚本',
    code: demoCode,
    isRunning: false
  }
  private serialHelper = SerialHelper.getInstance()
  private profileManager = ProfileManagerInst

  private runtimer: Runtimer = {
    DataReceiverInterface: null,
    DataSenderInterface: null
  }
  private RuntimerTimerIntervals: number[] = []
  private RuntimerTimerouts: number[] = []

  private constructor() {
    this.loadScript()
  }

  public static getInstance(): ScriptManager {
    if (!ScriptManager.instance) {
      ScriptManager.instance = new ScriptManager()
    }
    return ScriptManager.instance
  }

  public getScript(): Script {
    return this.script
  }

  public updateScript(updates: Partial<Script>): void {
    this.script = { ...this.script, ...updates }
    this.saveScript()
  }

  public async runScript(): Promise<void> {
    if (this.script.isRunning) {
      return
    }

    this.script.isRunning = true

    try {
      const scriptContext = {
        stringToUint8Array: this.serialHelper.stringToUint8Array.bind(this.serialHelper),
        uint8ArrayToHexString: this.serialHelper.uint8ArrayToHexString.bind(this.serialHelper),
        uint8ArrayToString: this.serialHelper.uint8ArrayToString.bind(this.serialHelper),
        sendText: (text: string) => {
          const data = this.serialHelper.stringToUint8Array(text)
          eventCenter.emit(EventNames.SERIAL_SEND, data)
        },
        sendHex: (hex: string | Uint8Array) => {
          let data = hex;
          if (typeof hex === 'string') {
            data = this.serialHelper.stringToUint8Array(hex, true)
          }
          eventCenter.emit(EventNames.SERIAL_SEND, data)
        },
        updateDataTable: (data: any) => {
          eventCenter.emit(EventNames.DATA_UPDATE, data)
        },
        getDataTables: () => {
          const fieldStore = useFieldStore()
          return JSON.parse(JSON.stringify(fieldStore.fields))
        },
        sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
        setTimeout: (fn: Function, ms: number) => {
          const timeout = setTimeout(fn, ms)
          this.RuntimerTimerouts.push(timeout)
          return timeout
        },
        setInterval: (fn: Function, ms: number) => {
          const interval = setInterval(fn, ms)
          this.RuntimerTimerIntervals.push(interval)
          return interval
        }
      }

      const wrappedCode = `
return (async function() {
  ${this.script.code}

  let onDataReceiverInterface = typeof onDataReceived == 'undefined' ? null : onDataReceived;
  let onDataSenderInterface = typeof onDataToSend == 'undefined'? null : onDataToSend;
  if (!onDataReceiverInterface) {
      onDataReceiverInterface = typeof DataReceiver == 'undefined' ? null : DataReceiver;
  }
  if (!onDataSenderInterface) {
      onDataSenderInterface = typeof DataSender == 'undefined' ? null : DataSender;
  }
  return { DataReceiverInterface: onDataReceiverInterface, DataSenderInterface: onDataSenderInterface };
})()
      `

      const fn = new Function('context', `with(context) { ${wrappedCode} }`)
      this.runtimer = await fn(scriptContext)
      
    } catch (error) {
      console.error('脚本执行错误:', error)
      eventCenter.emit(EventNames.SERIAL_ERROR, { error: error instanceof Error ? error.message : '未知错误' })
      this.stopScript()
    }
  }

  public stopScript(): void {
    this.script.isRunning = false

    this.RuntimerTimerouts.forEach(clearTimeout)
    this.RuntimerTimerouts = []
    this.RuntimerTimerIntervals.forEach(clearInterval)
    this.RuntimerTimerIntervals = []
  }

  public async getRuntimer(): Promise<Runtimer> {
    if (!this.script.isRunning) {
      await this.runScript()
    }
    return this.runtimer
  }

  public saveScript(): void {
    const profile = this.profileManager.activeProfile
    if (profile) {
      this.profileManager.updateProfile(profile.id, {
        config: {
          ...profile.config,
          script: { ...this.script }
        }
      })
    }
  }

  private loadScript(): void {
    const profile = this.profileManager.activeProfile
    const savedScript = profile?.config?.script as Script | undefined
    
    if (savedScript && savedScript.code) {
      this.script = { ...savedScript, isRunning: false }
    } else {
      this.script = {
        id: 1,
        name: '数据处理脚本',
        code: demoCode,
        isRunning: false
      }
      this.saveScript()
    }
  }

  public reloadFromProfile(): void {
    this.loadScript()
  }
}
