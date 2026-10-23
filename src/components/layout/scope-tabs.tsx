import { AllScopeIcon, MyScopeIcon, SubordinatesScopeIcon } from '@/components/icons/scope-icons'
import { cn } from '@/lib/utils'

const TABS = {
  my: { label: 'My', icon: MyScopeIcon },
  all: { label: 'All', icon: AllScopeIcon },
  subordinates: { label: 'Subordinates', icon: SubordinatesScopeIcon },
} as const

type Scope = keyof typeof TABS

const TONES = {
  /** Attendance: purple when chosen; Inter Medium 16, #897A7A otherwise. */
  primary: {
    type: 'font-inter text-base font-medium',
    selected: 'bg-primary text-primary-foreground',
    idle: 'text-[#897A7A]',
  },
  /** Requests: sidebar navy when chosen; Poppins Regular 13, #5C5C5C otherwise. */
  navy: {
    type: 'text-[0.8125rem] font-normal',
    selected: 'bg-sidebar text-white dark:bg-primary',
    idle: 'text-tab',
  },
} as const

/** My / All / Subordinates as drawn: coloured when selected, grey otherwise. */
export function ScopeTabs<TScope extends Scope>({
  scopes,
  value,
  onChange,
  label,
  tone = 'primary',
}: {
  scopes: readonly TScope[]
  value: TScope
  onChange: (scope: TScope) => void
  label: string
  tone?: keyof typeof TONES
}) {
  const style = TONES[tone]
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-4">
      {scopes.map((scope) => {
        const { label: text, icon: Icon } = TABS[scope]
        const selected = scope === value
        return (
          <button
            key={scope}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => {
              onChange(scope)
            }}
            className={cn(
              'inline-flex h-8 min-w-[5.25rem] items-center justify-center gap-2.5 rounded-sm px-4 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 pointer-coarse:h-10',
              style.type,
              selected
                ? style.selected
                : cn(
                    'bg-chip hover:brightness-95 dark:bg-input dark:text-field-foreground',
                    style.idle,
                  ),
            )}
          >
            <Icon className="size-4" />
            {text}
          </button>
        )
      })}
    </div>
  )
}
