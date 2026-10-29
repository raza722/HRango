import { MODULES } from '@/app/modules'
import { AttendanceSettingsMenuIcon } from '@/components/icons/attendance-menu-icons'
import { AssetsIcon, CalendarCheckIcon, SettingsIcon } from '@/components/icons/figma-icons'
import { PayrollSettingsIcon, RulesIcon } from '@/components/icons/payroll-icons'
import {
  DelegatesIcon,
  LeavesNavIcon,
  RequestSettingsIcon,
  RequestsNavIcon,
} from '@/components/icons/request-icons'
import { type HubSection, ModuleHub } from '@/components/layout'

const SECTIONS: readonly HubSection[] = [
  {
    key: 'assets',
    title: 'Assets',
    links: [
      {
        key: 'company-assets',
        label: 'Company Assets',
        description: 'The laptops, phones and other items the company hands out.',
        to: '/assets/company-assets',
        icon: AssetsIcon,
        permission: 'assets.company_assets',
      },
      {
        key: 'asset-types',
        label: 'Asset Types',
        description: 'The kinds of asset, used to group and report them.',
        to: '/assets/types',
        icon: RulesIcon,
        permission: 'assets.types',
      },
    ],
  },
  {
    key: 'requests',
    title: 'Requests',
    links: [
      {
        key: 'restrictions',
        label: 'Request Restriction',
        description: 'Limits on when and how often each request type can be made.',
        to: '/requests/settings/restrictions',
        icon: RequestSettingsIcon,
        permission: 'requests.settings.restrictions',
      },
      {
        key: 'delegation',
        label: 'Delegation',
        description: 'Who approves on someone’s behalf while they are away.',
        to: '/requests/settings/delegation',
        icon: DelegatesIcon,
        permission: 'requests.settings.delegations',
      },
      {
        key: 'flows',
        label: 'Request Flows',
        description: 'The approval steps each request type goes through.',
        to: '/requests/settings/flows',
        icon: RequestsNavIcon,
        permission: 'requests.settings.flows',
      },
    ],
  },
  {
    key: 'checklists',
    title: 'Checklists',
    links: [
      {
        key: 'off-boarding',
        label: 'Off Boarding Checklist',
        description: 'The checklist fields every exit asks for.',
        to: '/settings/off-boarding/checklist',
        icon: CalendarCheckIcon,
        permission: 'offboarding.settings',
      },
    ],
  },
  {
    key: 'modules',
    title: 'Module settings',
    links: [
      {
        key: 'attendance',
        label: 'Attendance Settings',
        description: 'Shifts, rest days, holidays, overtime and attendance rules.',
        to: '/attendance/settings',
        icon: AttendanceSettingsMenuIcon,
        permission: ['attendance.settings', 'scheduling.settings'],
      },
      {
        key: 'leaves',
        label: 'Leave Settings',
        description: 'Leave types, policies and the general leave rules.',
        to: '/leaves/settings/general',
        icon: LeavesNavIcon,
        permission: 'leaves.settings',
      },
      {
        key: 'payroll',
        label: 'Payroll Settings',
        description: 'Tax, pay components, rewards and disbursement banks.',
        to: '/payroll/settings/general',
        icon: PayrollSettingsIcon,
        permission: 'payroll.settings',
      },
      {
        key: 'control-panel',
        label: 'Control Panel',
        description: 'Company details, branches, locations, areas and job titles.',
        to: '/settings/control-panel',
        icon: SettingsIcon,
        permission: 'organisation',
      },
    ],
  },
]

/** Configuration: the setup screens of Assets, Requests, Off Boarding and each module. */
export function ConfigurationPage() {
  const config = MODULES.configuration
  return (
    <ModuleHub
      title={config.title}
      description={config.description}
      icon={config.icon}
      sections={SECTIONS}
    />
  )
}
