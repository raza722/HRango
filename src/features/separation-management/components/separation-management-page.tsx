import { MODULES } from '@/app/modules'
import {
  AssetsIcon,
  CalendarCheckIcon,
  EndOfEmploymentIcon,
  TalentManagementIcon,
} from '@/components/icons/figma-icons'
import { CompensationIcon } from '@/components/icons/payroll-icons'
import { ResignationRequestIcon } from '@/components/icons/request-icons'
import { type HubSection, ModuleHub } from '@/components/layout'
import { assetKeys, assetsApi } from '@/features/assets'
import { offboardingApi, offboardingKeys } from '@/features/offboarding'
import { payrollApi, payrollKeys } from '@/features/payroll'
import { standardApi, standardKeys } from '@/features/requests'

import { COUNT_PAGE, useHubCount } from '../hooks/use-hub-count'

const PENDING_EXITS = { ...COUNT_PAGE, status: 'pending' }
const PENDING_RESIGNATIONS = { ...COUNT_PAGE, scope: 'all', status: 'pending' } as const
const CLEARANCES_IN_PROGRESS = { ...COUNT_PAGE, status: 'in_progress' }
/** Settlements still to do: pending (not calculated) and open (not closed yet). */
const PENDING_SETTLEMENTS = { ...COUNT_PAGE, status: 'pending' }
const OPEN_SETTLEMENTS = { ...COUNT_PAGE, status: 'open' }

/**
 * Separation Management: the exit screens built under End of Employment, Requests, Assets,
 * Payroll and Settings, gathered on one page with how many of each wait for someone.
 */
export function SeparationManagementPage() {
  const exits = useHubCount({
    queryKey: offboardingKeys.list('end-of-employment', PENDING_EXITS),
    fetch: (signal) => offboardingApi.endOfEmployments(PENDING_EXITS, signal),
    permission: 'offboarding.end_of_employment',
    label: 'pending',
  })
  const resignations = useHubCount({
    queryKey: standardKeys.list('resignation', PENDING_RESIGNATIONS),
    fetch: (signal) => standardApi.list('resignation', PENDING_RESIGNATIONS, signal),
    permission: 'requests.resignation',
    label: 'pending',
  })
  const clearances = useHubCount({
    queryKey: assetKeys.list('clearances', CLEARANCES_IN_PROGRESS),
    fetch: (signal) => assetsApi.clearances(CLEARANCES_IN_PROGRESS, signal),
    permission: 'assets.clearance',
    label: 'in progress',
  })
  const settlements = useHubCount({
    queryKey: payrollKeys.list('final-settlements', { ...COUNT_PAGE, status: 'pending+open' }),
    fetch: async (signal) => {
      const [pending, open] = await Promise.all([
        payrollApi.finalSettlements(PENDING_SETTLEMENTS, signal),
        payrollApi.finalSettlements(OPEN_SETTLEMENTS, signal),
      ])
      return { meta: { total: pending.meta.total + open.meta.total } }
    },
    permission: 'payroll.final_settlement',
    label: 'to settle',
  })

  const sections: HubSection[] = [
    {
      key: 'exit',
      title: 'Exit process',
      links: [
        {
          key: 'resignations',
          label: 'Resignation Requests',
          description: 'Resignations employees submit, and their approvals.',
          to: '/requests/$type',
          params: { type: 'resignation' },
          // The count is of every pending resignation, so the link opens them all, not "My".
          search: { scope: 'all' },
          icon: ResignationRequestIcon,
          permission: 'requests.resignation',
          badge: resignations,
        },
        {
          key: 'end-of-employment',
          label: 'End of Employment',
          description: 'Record an employee’s exit and follow it through to completion.',
          // The badge counts the pending ones: the link opens that list.
          to: '/end-of-employment/pending',
          icon: EndOfEmploymentIcon,
          permission: 'offboarding.end_of_employment',
          badge: exits,
        },
        {
          key: 'clearance',
          label: 'Asset Clearance Form',
          description: 'Check returned company assets and approve the clearance.',
          to: '/assets/clearance-form',
          icon: AssetsIcon,
          permission: 'assets.clearance',
          badge: clearances,
        },
        {
          key: 'final-settlement',
          label: 'Final Settlement',
          description: 'Calculate the last pay, recalculate it and close the settlement.',
          to: '/payroll/final-settlement',
          icon: CompensationIcon,
          permission: 'payroll.final_settlement',
          badge: settlements,
        },
      ],
    },
    {
      key: 'former',
      title: 'Former employees',
      links: [
        {
          key: 'rehire',
          label: 'Rehire',
          description: 'Bring a former employee back from their completed exit record.',
          to: '/end-of-employment/completed',
          icon: TalentManagementIcon,
          permission: 'offboarding.end_of_employment',
        },
      ],
    },
    {
      key: 'setup',
      title: 'Setup',
      links: [
        {
          key: 'checklist',
          label: 'Off Boarding Checklist',
          description: 'The checklist fields every exit asks for.',
          to: '/settings/off-boarding/checklist',
          icon: CalendarCheckIcon,
          permission: 'offboarding.settings',
        },
      ],
    },
  ]

  const config = MODULES.separationManagement
  return (
    <ModuleHub
      title={config.title}
      description={config.description}
      icon={config.icon}
      sections={sections}
    />
  )
}
