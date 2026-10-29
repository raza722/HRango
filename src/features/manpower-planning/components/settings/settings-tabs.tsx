import { Link } from '@tanstack/react-router'

import { cn } from '@/lib/utils'

import { SETTINGS_TABS, type SettingsTab } from '../../constants'

/** The Budget Duration / Position Title / Employee Position tabs, as drawn under the filters. */
export function SettingsTabs({ current }: { current: SettingsTab }) {
  return (
    <nav
      aria-label="E-Budget Settings"
      className="flex min-w-0 flex-wrap items-end gap-2.5 px-4 sm:px-6"
    >
      {SETTINGS_TABS.map((tab) => {
        const selected = tab.value === current
        return (
          <Link
            key={tab.value}
            to="/manpower-planning/e-budget-settings"
            search={{ tab: tab.value, page: 1 }}
            // Defaults are stripped from the URL, so the first tab's link has no search; a
            // partial match would make the router mark it current on every tab.
            activeOptions={{ exact: true }}
            aria-current={selected ? 'page' : undefined}
            className={cn(
              'inline-flex h-[2.375rem] items-center rounded-t-[5px] border border-b-0 border-[#EBEFF8] px-3 text-sm font-medium text-heading outline-none focus-visible:ring-[3px] focus-visible:ring-[#7469E8]/35 dark:border-border',
              selected && 'bg-[#EBEFF8] dark:bg-muted',
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
