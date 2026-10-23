import { describe, expect, it } from 'vitest'

import { useSidebarStore } from './sidebar-store'
import { UI_STORE_KEY, useUiStore } from './ui-store'

function persisted(key: string): unknown {
  const raw = localStorage.getItem(key)
  return raw ? (JSON.parse(raw) as { state: unknown }).state : null
}

describe('ui store', () => {
  it('starts light and toggles to dark, persisting the choice', () => {
    expect(useUiStore.getState().theme).toBe('light')

    useUiStore.getState().toggleTheme()

    expect(useUiStore.getState().theme).toBe('dark')
    expect(persisted(UI_STORE_KEY)).toEqual({ theme: 'dark', language: 'en' })
  })

  it('changes the interface language', () => {
    useUiStore.getState().setLanguage('fr')
    expect(useUiStore.getState().language).toBe('fr')
  })
})

describe('sidebar store', () => {
  it('persists the collapsed rail but not the mobile drawer state', () => {
    useSidebarStore.getState().toggleCollapsed()
    useSidebarStore.getState().setMobileOpen(true)

    expect(useSidebarStore.getState()).toMatchObject({ collapsed: true, mobileOpen: true })
    expect(persisted('hrms-sidebar')).toEqual({ collapsed: true })
  })
})
