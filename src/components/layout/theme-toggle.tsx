import { Moon, Sun } from 'lucide-react'

import { useUiStore } from '@/stores/ui-store'

import { TopbarIconButton } from './topbar'

/** Switches between the light and dark theme (persisted in the ui store). */
export function ThemeToggle() {
  const theme = useUiStore((state) => state.theme)
  const toggleTheme = useUiStore((state) => state.toggleTheme)
  const isDark = theme === 'dark'

  return (
    <TopbarIconButton
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Light theme' : 'Dark theme'}
      onClick={toggleTheme}
    >
      {isDark ? (
        <Sun className="size-5" strokeWidth={1.5} />
      ) : (
        <Moon className="size-5" strokeWidth={1.5} />
      )}
    </TopbarIconButton>
  )
}
