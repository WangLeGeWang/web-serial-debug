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
import { createRuntimeClient, RuntimeClientKey } from './runtime'
import { setDataSourceProvider, createRealtimeProvider } from './utils/RealtimeProvider'

async function bootstrap() {
  const app = createApp(App)
  const pinia = createPinia()
  const runtimeClient = await createRuntimeClient()

  setDataSourceProvider(createRealtimeProvider())

  for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component)
  }

  app.provide(RuntimeClientKey, runtimeClient)
  app.use(pinia)
  app.use(router)
  app.use(ElementPlus)
  app.mount('#app')

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
