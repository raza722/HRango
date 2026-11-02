import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export type StaffRole = 'super_admin' | 'admin' | 'support' | 'billing'

export interface StaffUser {
  id: string
  email: string
  displayName: string
  role: StaffRole
}

export interface StaffSession {
  token: string
  staff: StaffUser
}

interface PlatformState {
  token: string | null
  staff: StaffUser | null
  setSession: (session: StaffSession) => void
  clearSession: () => void
}

/**
 * The session of hRango's own staff. Kept apart from `useAuthStore`: a staff token opens no customer
 * route, a customer token opens no platform route, and signing out of one leaves the other alone.
 */
export const usePlatformStore = create<PlatformState>()(
  persist(
    (set) => ({
      token: null,
      staff: null,
      setSession: ({ token, staff }) => {
        set({ token, staff })
      },
      clearSession: () => {
        set({ token: null, staff: null })
      },
    }),
    {
      name: 'hrango-platform-auth',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ token, staff }) => ({ token, staff }),
    },
  ),
)
