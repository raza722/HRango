import { useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { toast } from 'sonner'

import { rowMenuItemClass } from '@/components/layout'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

import { btn, toolbarButton } from '../../utils/styles'

export interface MenuChoice<K extends string> {
  key: K
  label: string
}

/** "Sample Import ⌄" / "Import File ⌄": a green button with a short menu. */
export function MenuButton<K extends string>({
  label,
  choices,
  onChoose,
  className = btn.green,
}: {
  label: string
  choices: readonly MenuChoice<K>[]
  onChoose: (key: K) => void
  className?: string
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button className={cn(toolbarButton, className, 'gap-1')}>
          {label}
          <ChevronDown aria-hidden="true" className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36 py-1">
        {choices.map((choice) => (
          <DropdownMenuItem
            key={choice.key}
            onSelect={() => {
              onChoose(choice.key)
            }}
            className={cn('justify-center', rowMenuItemClass.inter)}
          >
            {choice.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * "Import File ⌄": choose the kind, pick a CSV file, and the page imports it.
 * `onFile` returns the import's messages; they are shown as toasts.
 */
export function ImportButton<K extends string>({
  label = 'Import File',
  choices,
  onFile,
}: {
  label?: string
  choices: readonly MenuChoice<K>[]
  onFile: (key: K, text: string) => Promise<{ created: number; errors: string[] }>
}) {
  const input = useRef<HTMLInputElement>(null)
  const kind = useRef<K | null>(null)
  return (
    <>
      <MenuButton
        label={label}
        choices={choices}
        onChoose={(key) => {
          kind.current = key
          input.current?.click()
        }}
      />
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv"
        aria-label={`${label} (CSV)`}
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          const chosen = kind.current
          if (!file || !chosen) return
          void file.text().then(async (text) => {
            try {
              const result = await onFile(chosen, text)
              if (result.errors.length > 0) {
                toast.error(result.errors.slice(0, 3).join('\n'))
              }
            } catch {
              toast.error('The file could not be imported.')
            }
          })
        }}
      />
    </>
  )
}
