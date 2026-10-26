import {
  BriefcaseBusiness,
  Building2,
  CreditCard,
  LandPlot,
  LifeBuoy,
  type LucideIcon,
  MapPin,
  Network,
  Settings2,
  Users,
} from 'lucide-react'

import type { FileRouteTypes } from '@/routeTree.gen'

type SettingsPath = FileRouteTypes['to']

export interface ControlPanelLink {
  label: string
  to: SettingsPath
  icon: LucideIcon
  /** View code the screen needs (hidden without it); none means always shown. */
  permission?: string
}

export interface ControlPanelSection {
  label: string
  icon: LucideIcon
  /** Tailwind classes for the icon tile (tint + colour). */
  tone: string
  /** A section is either a link or a group of links. */
  to?: SettingsPath
  children?: readonly ControlPanelLink[]
  /** View code a link section needs (hidden without it); none means always shown. */
  permission?: string
}

/** Second-level menu of Settings → Control Panel, as drawn. */
export const CONTROL_PANEL_SECTIONS: readonly ControlPanelSection[] = [
  {
    label: 'General Settings',
    icon: Settings2,
    tone: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
    to: '/settings/control-panel/general',
    permission: 'organisation.general.view',
  },
  {
    label: 'Organization',
    icon: Building2,
    tone: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
    children: [
      {
        label: 'Branch',
        to: '/settings/control-panel/branches',
        icon: Network,
        permission: 'organisation.branches.view',
      },
      {
        label: 'Location',
        to: '/settings/control-panel/locations',
        icon: MapPin,
        permission: 'organisation.locations.view',
      },
      {
        label: 'Area',
        to: '/settings/control-panel/areas',
        icon: LandPlot,
        permission: 'organisation.areas.view',
      },
      {
        label: 'Job Title',
        to: '/settings/control-panel/job-titles',
        icon: BriefcaseBusiness,
        permission: 'organisation.job_titles.view',
      },
    ],
  },
  {
    label: 'Users',
    icon: Users,
    tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    to: '/settings/control-panel/users',
    permission: 'access.users.view',
  },
  {
    label: 'Subscriptions',
    icon: CreditCard,
    tone: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    to: '/settings/control-panel/subscriptions',
  },
  {
    label: 'Help & Support',
    icon: LifeBuoy,
    tone: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
    to: '/settings/control-panel/help',
  },
]

/** Copy for Settings screens that are routed but not designed yet. */
export const SETTINGS_PLACEHOLDERS = {
  users: {
    title: 'Users',
    description: 'People who can sign in to the portal and what they can see.',
    planned: ['Invite user', 'Roles', 'Deactivate', 'Reset password'],
  },
  subscriptions: {
    title: 'Subscriptions',
    description: 'Your plan, seats, invoices and payment method.',
    planned: ['Current plan', 'Seats', 'Invoices', 'Billing contact'],
  },
  help: {
    title: 'Help & Support',
    description: 'Guides, contact details and support tickets.',
    planned: ['Knowledge base', 'Contact support', 'Ticket history', 'Release notes'],
  },
  customForms: {
    title: 'Custom Forms',
    description: 'Fields your company adds to employee records and requests.',
    planned: ['Form list', 'Field builder', 'Assign to module'],
  },
  systemUsers: {
    title: 'System User',
    description: 'Service and integration accounts that use the API.',
    planned: ['System users', 'API keys', 'Access log'],
  },
  userGroupPermissions: {
    title: 'User Group Permissions',
    description: 'Groups of users and the modules and actions each group may use.',
    planned: ['Groups', 'Module permissions', 'Data scope'],
  },
  biometricDevices: {
    title: 'Biometric Devices',
    description: 'Fingerprint and face attendance terminals at each branch.',
    planned: ['Devices', 'Device sync', 'Enrolments', 'Punch log'],
  },
} as const satisfies Record<
  string,
  { title: string; description: string; planned: readonly string[] }
>

export type SettingsPlaceholderKey = keyof typeof SETTINGS_PLACEHOLDERS

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const
