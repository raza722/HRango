import { Moon, Sun } from 'lucide-react'

import { useUiStore } from '@/stores/ui-store'

import { TopbarIconButton } from './topbar'

const ICON_CLASS =
  'size-5 animate-in duration-300 fade-in-0 spin-in-90 transition-[rotate] group-hover:rotate-[18deg]'

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
      {/* The new icon spins in when the theme changes; hovering turns it a little. */}
      {isDark ? (
        <Sun key="sun" className={ICON_CLASS} strokeWidth={1.5} />
      ) : (
        <Moon key="moon" className={ICON_CLASS} strokeWidth={1.5} />
      )}
    </TopbarIconButton>
  )
}
