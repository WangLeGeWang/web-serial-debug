import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { copyFileSync } from 'fs'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    // GitHub Pages SPA 回退：将 index.html 复制为 404.html
    // 当直接访问子路径时，GitHub Pages 返回 404.html，从而加载 SPA
    {
      name: 'gh-pages-404',
      writeBundle({ dir = 'dist' }) {
        copyFileSync(resolve(dir, 'index.html'), resolve(dir, '404.html'))
      }
    }
  ],
  base: '/bus-studio/',
  resolve: {
    alias: {
      '@': '/src',
    }
  },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': [],
          'vue': ['vue', 'vue-router', '@vueuse/core', 'pinia'],
          'three': ['three', 'stats.js', 'three-particle-fire'],
          'uplot': ['uplot'],
          'xterm': ['xterm', 'xterm-addon-fit', 'xterm-addon-web-links', '@xterm/addon-search'],
          'utils': ['splitpanes', 'element-plus']
        }
      }
    }
  },
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString())
  }
})
