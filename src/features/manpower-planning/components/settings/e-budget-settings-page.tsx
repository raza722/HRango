import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'

import type { SettingsTab } from '../../constants'
import { MpPage } from '../shared/page-shell'
import { BudgetDurationsTab } from './budget-durations-tab'
import { EmployeePositionsTab } from './employee-positions-tab'
import { PositionTitlesTab } from './position-titles-tab'

const routeApi = getRouteApi('/_app/manpower-planning/e-budget-settings')

const INFO: Record<SettingsTab, string> = {
  'budget-duration':
    'Budget durations are the plan years. Mark one as the current budget period; plans for it show a tick under Current Planning.',
  'position-title':
    'Position titles name the jobs that employee positions, plans and budgets are made for.',
  'employee-position':
    'Employee positions set where a job sits (division, station, department, group, grade) and its salary range. Add New Positions in Planning starts from them.',
}

/** E-Budget Settings: budget durations, position titles and employee positions. */
export function EBudgetSettingsPage() {
  const { tab, page } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const [filtersOpen, setFiltersOpen] = useState(true)
  const goTo = (next: number) => {
    void navigate({ search: (prev) => ({ ...prev, page: next }) })
  }
  const props = { page, goTo, filtersOpen }
  return (
    <MpPage
      title="Manpower Planning"
      info={INFO[tab]}
      filtersOpen={filtersOpen}
      onToggleFilters={() => {
        setFiltersOpen((open) => !open)
      }}
    >
      {tab === 'budget-duration' && <BudgetDurationsTab {...props} />}
      {tab === 'position-title' && <PositionTitlesTab {...props} />}
      {tab === 'employee-position' && <EmployeePositionsTab {...props} />}
    </MpPage>
  )
}
