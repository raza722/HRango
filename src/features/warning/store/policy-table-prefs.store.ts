import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '@/lib/constants'

export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number]

interface PolicyTablePrefsState {
  pageSize: PageSize
}

interface PolicyTablePrefsActions {
  setPageSize: (pageSize: PageSize) => void
}

/**
 * Feature-local preferences for the Warning Policy table.
 * The page number lives in the URL (shareable); the page size is a personal
 * preference, so it lives here and survives reloads.
 */
export const usePolicyTablePrefs = create<PolicyTablePrefsState & PolicyTablePrefsActions>()(
  persist(
    immer((set) => ({
      pageSize: DEFAULT_PAGE_SIZE,
      setPageSize: (pageSize) => {
        set((state) => {
          state.pageSize = pageSize
        })
      },
    })),
    {
      name: 'hrms-warning-policy-table',
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
)

export function isPageSize(value: number): value is PageSize {
  return PAGE_SIZE_OPTIONS.some((option) => option === value)
}
