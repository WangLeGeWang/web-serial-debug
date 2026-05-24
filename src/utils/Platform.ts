import { isTauriRuntime } from './desktopApi'

export type Platform = 'browser' | 'desktop'

export const isDesktop = (): boolean => isTauriRuntime()

export const isBrowser = (): boolean => {
  return typeof navigator !== 'undefined' && typeof navigator.serial !== 'undefined'
}

export const getPlatform = (): Platform => (isDesktop() ? 'desktop' : 'browser')

export const platform = getPlatform()
