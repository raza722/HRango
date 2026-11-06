import { Check } from 'lucide-react'

import { LanguageFlag } from '@/components/icons/flags'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { type LanguageCode, LANGUAGES, shownLanguage, useUiStore } from '@/stores/ui-store'

import { TopbarIconButton } from './topbar'

function isLanguageCode(value: string): value is LanguageCode {
  return LANGUAGES.some((language) => language.code === value)
}

/**
 * Flag button that picks the interface language. Only English has its text so far: the others
 * are listed as "Coming soon" and can't be picked yet.
 */
export function LanguageSwitcher() {
  const language = useUiStore((state) => shownLanguage(state.language))
  const setLanguage = useUiStore((state) => state.setLanguage)
  const current = LANGUAGES.find((item) => item.code === language) ?? LANGUAGES[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <TopbarIconButton aria-label={`Language: ${current.label}`} title="Language">
          <LanguageFlag code={current.code} className="size-6" />
        </TopbarIconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Language</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={language}
          onValueChange={(value) => {
            if (isLanguageCode(value)) setLanguage(value)
          }}
        >
          {LANGUAGES.map((item) => (
            <DropdownMenuRadioItem key={item.code} value={item.code} disabled={!item.translated}>
              <LanguageFlag code={item.code} className="size-5" />
              <span className="flex-1">
                <span className="block">{item.label}</span>
                <span className="block text-xs text-muted-foreground">
                  {item.translated ? item.region : 'Coming soon'}
                </span>
              </span>
              {item.code === language && <Check className="size-4 text-primary" />}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
