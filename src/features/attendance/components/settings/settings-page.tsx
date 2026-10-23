import { useEffect, useRef } from 'react'
import { getRouteApi } from '@tanstack/react-router'

import { cn } from '@/lib/utils'

import { SETTINGS_TABS, type SettingsTab } from '../../routing'
import { AttendanceSubLayout } from '../layout/attendance-sub-layout'
import { BreakTypesTab } from './break-types-tab'
import { ConfigTab } from './config-tabs'
import { GeoFencingTab } from './geo-fencing-tab'
import { HolidaysTab } from './holidays-tab'
import { IpRestrictionsTab } from './ip-restrictions-tab'
import { RestDaysTab } from './rest-days-tab'

const routeApi = getRouteApi('/_app/attendance/settings')

const TAB_LABELS: Record<SettingsTab, string> = {
  basic: 'Basic',
  scheduling: 'Scheduling',
  'rest-days': 'Rest Days',
  'break-types': 'Break Types',
  'ip-restrictions': 'IP Restrictions',
  'geo-fencing': 'Geo Fencing',
  holidays: 'Holidays',
}

/**
 * Attendance → Settings: Basic, Scheduling, Rest Days, Break Types, IP
 * Restrictions, Geo Fencing and Holidays, with the tab in the URL.
 */
export function AttendanceSettingsPage() {
  const { tab } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const tabsRef = useRef<HTMLDivElement>(null)

  // On a phone the tabs scroll sideways: keep the chosen one in view.
  useEffect(() => {
    const align = () => {
      const list = tabsRef.current
      const active = list?.querySelector<HTMLElement>('[aria-selected="true"]')
      if (!list || !active) return
      const start = active.offsetLeft - 16
      const end = active.offsetLeft + active.offsetWidth + 16 - list.clientWidth
      if (list.scrollLeft > start) list.scrollLeft = start
      else if (list.scrollLeft < end) list.scrollLeft = end
    }
    align()
    // The tabs widen once the web font arrives.
    if ('fonts' in document) void document.fonts.ready.then(align)
  }, [tab])

  return (
    <AttendanceSubLayout current="settings">
      <section
        aria-labelledby="attendance-settings-title"
        className="overflow-hidden rounded-xl bg-card shadow-xs"
      >
        <h1 id="attendance-settings-title" className="sr-only">
          Attendance Settings
        </h1>
        <div
          ref={tabsRef}
          role="tablist"
          aria-label="Settings"
          className="relative flex scrollbar-thin gap-6 overflow-x-auto border-b px-4 sm:px-6"
        >
          {SETTINGS_TABS.map((item) => {
            const selected = item === tab
            return (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => {
                  void navigate({ search: { tab: item } })
                }}
                className={cn(
                  'relative h-14 shrink-0 px-1 text-[0.8125rem] whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                  selected
                    ? 'text-sm font-medium text-sidebar dark:text-heading'
                    : 'text-tab hover:text-title',
                )}
              >
                {selected && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 top-0 h-0.5 rounded-b bg-sidebar dark:bg-primary"
                  />
                )}
                {TAB_LABELS[item]}
              </button>
            )
          })}
        </div>
        <div role="tabpanel" aria-label={TAB_LABELS[tab]}>
          {tab === 'basic' && <ConfigTab section="basic" />}
          {tab === 'scheduling' && <ConfigTab section="scheduling" />}
          {tab === 'rest-days' && <RestDaysTab />}
          {tab === 'break-types' && <BreakTypesTab />}
          {tab === 'ip-restrictions' && <IpRestrictionsTab />}
          {tab === 'geo-fencing' && <GeoFencingTab />}
          {tab === 'holidays' && <HolidaysTab />}
        </div>
      </section>
    </AttendanceSubLayout>
  )
}
