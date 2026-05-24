import { describe, it, expect, beforeEach } from 'vitest'
import { defineComponent, h, nextTick, createApp } from 'vue'
import { initDataHub, getDataHub } from '@/runtime/data/DataHub'
import { useDataSource } from '@/runtime/source/useDataSource'

function mountInDom(Comp: any): {
  app: ReturnType<typeof createApp>
  container: HTMLElement
} {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const app = createApp(Comp)
  app.mount(container)
  return { app, container }
}

describe('useDataSource composable', () => {
  beforeEach(() => {
    localStorage.clear()
    initDataHub({ origin: 'test', bufferCapacity: 100 })
  })

  it('在组件中提供响应式 visibleData', async () => {
    let dsRef: ReturnType<typeof useDataSource> | null = null
    const Comp = defineComponent({
      setup() {
        const ds = useDataSource({ namespace: 'ns' }, 'realtime')
        ds.setWindowDuration(60_000)
        dsRef = ds
        return () => h('div', String(ds.visibleData.length))
      }
    })

    const { app, container } = mountInDom(Comp)
    expect(container.textContent).toBe('0')

    getDataHub().append({ namespace: 'ns', timestamp: 1, values: { a: 1 } })
    getDataHub().append({ namespace: 'ns', timestamp: 2, values: { a: 2 } })
    await nextTick()
    expect(container.textContent).toBe('2')
    expect(dsRef!.fields).toContain('a')

    app.unmount()
    container.remove()
  })

  it('组件 unmount 后自动 destroy，订阅不再接收帧', async () => {
    let dsRef: ReturnType<typeof useDataSource> | null = null
    const Comp = defineComponent({
      setup() {
        const ds = useDataSource({ namespace: 'ns' }, 'realtime')
        ds.setWindowDuration(60_000)
        dsRef = ds
        return () => h('div')
      }
    })
    const { app, container } = mountInDom(Comp)
    getDataHub().append({ namespace: 'ns', timestamp: 1, values: { a: 1 } })
    await nextTick()
    expect(dsRef!.visibleData.length).toBe(1)

    app.unmount()
    container.remove()

    getDataHub().append({ namespace: 'ns', timestamp: 2, values: { a: 2 } })
    expect(dsRef!.visibleData.length).toBe(1)
  })
})
