import { create } from 'zustand'
import { createJSONStorage, devtools, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

interface SidebarState {
  /** Desktop: icon-only rail instead of the full sidebar. Persisted. */
  collapsed: boolean
  /** Mobile: off-canvas drawer is open. Not persisted. */
  mobileOpen: boolean
}

interface SidebarActions {
  toggleCollapsed: () => void
  setCollapsed: (collapsed: boolean) => void
  setMobileOpen: (open: boolean) => void
}

export type SidebarStore = SidebarState & SidebarActions

const initialState: SidebarState = {
  collapsed: false,
  mobileOpen: false,
}

/** Sidebar layout state shared by the topbar hamburger and the shell. */
export const useSidebarStore = create<SidebarStore>()(
  devtools(
    persist(
      immer((set) => ({
        ...initialState,
        toggleCollapsed: () => {
          set((state) => {
            state.collapsed = !state.collapsed
          })
        },
        setCollapsed: (collapsed) => {
          set((state) => {
            state.collapsed = collapsed
          })
        },
        setMobileOpen: (open) => {
          set((state) => {
            state.mobileOpen = open
          })
        },
      })),
      {
        name: 'hrms-sidebar',
        version: 1,
        storage: createJSONStorage(() => localStorage),
        partialize: ({ collapsed }) => ({ collapsed }),
      },
    ),
    { name: 'sidebar-store', enabled: import.meta.env.DEV },
  ),
)

export function resetSidebarStore(): void {
  useSidebarStore.setState(initialState)
}
