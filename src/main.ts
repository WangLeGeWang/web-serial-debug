import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import { createPinia } from 'pinia'
import './style.css'
import 'markstream-vue/index.css'
import App from './App.vue'
import router from './router'
// import { createRuntimeClient, RuntimeClientKey } from './runtime'
import { initDataHub, getDataHub } from './runtime/data/DataHub'
import { BroadcastChannelTransport } from './runtime/transport/BroadcastChannelTransport'
import { WorkspaceManagerInst, ensureWorkspaceNamespace } from './utils/ProfileManager'
import { ScriptManager } from './utils/ScriptManager'
import { useFieldStore, bindFieldStoreToDataHub } from './store/fieldStore'

const PAGE_ORIGIN_KEY = 'wssd.pageOrigin'

function resolvePageOrigin(): string {
  try {
    const existing = sessionStorage.getItem(PAGE_ORIGIN_KEY)
    if (existing && existing.length > 0) return existing
    const uuid = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    const origin = `page-${uuid}`
    sessionStorage.setItem(PAGE_ORIGIN_KEY, origin)
    return origin
  } catch {
    return `page-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  }
}

function bootstrapDataHub(): void {
  try {
    const origin = resolvePageOrigin()
    initDataHub({ origin, bufferCapacity: 50000 })

    const syncCurrentNamespace = () => {
      try {
        const hub = getDataHub()
        const ws = WorkspaceManagerInst.activeWorkspace
        if (ws) {
          ensureWorkspaceNamespace(ws)
          hub.setCurrentWorkspaceNamespace(ws.config.namespace as string)
        } else {
          hub.setCurrentWorkspaceNamespace(null)
        }
      } catch (err) {
        console.error('[DataHub] syncCurrentNamespace failed:', err)
      }
    }

    syncCurrentNamespace()
    WorkspaceManagerInst.onWorkspaceChange(() => syncCurrentNamespace())

    ScriptManager.getInstance().setNamespaceProvider(
      () => (WorkspaceManagerInst.activeWorkspace?.config?.namespace as string) ?? 'default'
    )

    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannelTransport('wssd-hub')
      bc.start().then(() => {
        getDataHub().attachTransport(bc)
        console.log('[transport] broadcast channel attached')
      }).catch(err => console.error('[transport] broadcast channel start failed:', err))
    }
  } catch (err) {
    console.error('[DataHub] bootstrap failed:', err)
  }
}

async function bootstrap() {
  bootstrapDataHub()

  const app = createApp(App)
  const pinia = createPinia()
  // const runtimeClient = await createRuntimeClient()

  for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component)
  }

  // app.provide(RuntimeClientKey, runtimeClient)
  app.use(pinia)
  app.use(router)
  app.use(ElementPlus)
  app.mount('#app')

  // pinia 已挂载，可以安全地实例化 store 并把它绑定到 DataHub.subscribeCurrent。
  // 这里替换了 WorkbenchPage.vue 里原先 EventCenter.on(DATA_UPDATE) → handleDataUpdate 的桥，
  // 避免「DataHub.append → EventCenter.emit → handleDataUpdate」和「DataHub.subscribeCurrent → handleDataUpdate」
  // 同一帧被处理两次。
  try {
    bindFieldStoreToDataHub(useFieldStore(pinia))
  } catch (err) {
    console.error('[fieldStore] bind to DataHub failed:', err)
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        // @ts-ignore
        .then(registration => {
          console.log('ServiceWorker registration successful');
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  if (confirm('有新版本可用，是否刷新页面？')) {
                    window.location.reload();
                  }
                }
              });
            }
          });
        })
        .catch(error => {
          console.error('ServiceWorker registration failed:', error);
        });
    });
  }
}

bootstrap().catch(error => {
  console.error('Application bootstrap failed:', error)
})
