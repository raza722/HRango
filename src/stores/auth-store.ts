import { create } from 'zustand'
import { createJSONStorage, devtools, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

import type { AuthSession, AuthUser } from '@/types/auth'

interface AuthState {
  token: string | null
  user: AuthUser | null
}

interface AuthActions {
  setSession: (session: AuthSession) => void
  updateUser: (user: AuthUser) => void
  clearSession: () => void
}

export type AuthStore = AuthState & AuthActions

const initialState: AuthState = {
  token: null,
  user: null,
}

/**
 * Client-side session (mocked login). Persisted so a reload keeps you signed in.
 * Read it outside React with `useAuthStore.getState()` (router guards, axios).
 */
export const useAuthStore = create<AuthStore>()(
  devtools(
    persist(
      immer((set) => ({
        ...initialState,
        setSession: ({ token, user }) => {
          set((state) => {
            state.token = token
            state.user = user
          })
        },
        updateUser: (user) => {
          set((state) => {
            state.user = user
          })
        },
        clearSession: () => {
          set((state) => {
            state.token = null
            state.user = null
          })
        },
      })),
      {
        name: 'hrms-auth',
        version: 1,
        storage: createJSONStorage(() => localStorage),
        partialize: ({ token, user }) => ({ token, user }),
      },
    ),
    { name: 'auth-store', enabled: import.meta.env.DEV },
  ),
)

export const selectIsAuthenticated = (state: AuthStore): boolean => state.token !== null

export function resetAuthStore(): void {
  useAuthStore.setState(initialState)
}
