import { create } from 'zustand'
import { createJSONStorage, devtools, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

export type Theme = 'light' | 'dark'

/** The switcher's languages; `translated` once the interface has its text in that language. */
export const LANGUAGES = [
  { code: 'en', label: 'English', region: 'United States', translated: true },
  { code: 'fr', label: 'Français', region: 'France', translated: false },
  { code: 'de', label: 'Deutsch', region: 'Deutschland', translated: false },
] as const

export type LanguageCode = (typeof LANGUAGES)[number]['code']

/**
 * The language the interface is actually in: the chosen one once it is translated, English until
 * then (so `<html lang>` matches the text screen readers read).
 */
export function shownLanguage(code: LanguageCode): LanguageCode {
  return LANGUAGES.find((item) => item.code === code)?.translated ? code : 'en'
}

interface UiState {
  theme: Theme
  language: LanguageCode
}

interface UiActions {
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  setLanguage: (language: LanguageCode) => void
}

export type UiStore = UiState & UiActions

/** Storage key; `index.html` reads it before first paint to avoid a theme flash. */
export const UI_STORE_KEY = 'hrms-ui'

const initialState: UiState = {
  theme: 'light',
  language: 'en',
}

/**
 * Global UI preferences: colour theme and interface language.
 * Persisted to localStorage; `ThemeSync` applies them to `<html>`.
 */
export const useUiStore = create<UiStore>()(
  devtools(
    persist(
      immer((set) => ({
        ...initialState,
        setTheme: (theme) => {
          set((state) => {
            state.theme = theme
          })
        },
        toggleTheme: () => {
          set((state) => {
            state.theme = state.theme === 'dark' ? 'light' : 'dark'
          })
        },
        setLanguage: (language) => {
          set((state) => {
            state.language = language
          })
        },
      })),
      {
        name: UI_STORE_KEY,
        version: 1,
        storage: createJSONStorage(() => localStorage),
        partialize: ({ theme, language }) => ({ theme, language }),
      },
    ),
    { name: 'ui-store', enabled: import.meta.env.DEV },
  ),
)

/** Restores defaults; used by tests. */
export function resetUiStore(): void {
  useUiStore.setState(initialState)
}
