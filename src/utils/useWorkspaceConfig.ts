import { ref, watch, onMounted } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { WorkspaceManagerInst } from './ProfileManager'

export function useWorkspaceConfig<T>(key: string, defaultValue: T) {
  const workspaceManager = WorkspaceManagerInst
  const localConfig = ref<T>({ ...defaultValue as any })
  const isLoaded = ref(false)

  const loadFromProfile = () => {
    const workspace = workspaceManager.activeWorkspace
    if (workspace?.config?.[key]) {
      localConfig.value = { ...workspace.config[key] as T }
    } else {
      localConfig.value = { ...defaultValue as any }
    }
    isLoaded.value = true
  }

  const saveToProfile = useDebounceFn(() => {
    const workspace = workspaceManager.activeWorkspace
    if (workspace) {
      workspaceManager.updateWorkspace(workspace.id, {
        config: {
          ...workspace.config,
          [key]: { ...localConfig.value }
        }
      })
    }
  }, 300)

  watch(() => workspaceManager.activeWorkspaceIdRef.value, () => {
    if (workspaceManager.activeWorkspaceIdRef.value) {
      loadFromProfile()
    }
  }, { immediate: true })

  watch(localConfig, () => {
    if (isLoaded.value) {
      saveToProfile()
    }
  }, { deep: true })

  return {
    config: localConfig
  }
}
