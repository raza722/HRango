import { useEffect } from 'react'

import { shownLanguage, useUiStore } from '@/stores/ui-store'

/**
 * Mirrors ui-store preferences onto <html>: the `dark` class (Tailwind's dark
 * variant), `color-scheme`, and the `lang` attribute (of the language the text is in).
 * Renders nothing.
 */
export function ThemeSync() {
  const theme = useUiStore((state) => state.theme)
  const language = useUiStore((state) => shownLanguage(state.language))

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#101A28' : '#17263A')
  }, [theme])

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  return null
}
