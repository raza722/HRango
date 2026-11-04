import {
  Building2,
  CreditCard,
  History,
  LifeBuoy,
  Package,
  ReceiptText,
  TrendingUp,
  UsersRound,
} from 'lucide-react'

import type { NavItem } from '@/app/navigation'
import { DashboardIcon } from '@/components/icons/figma-icons'
import type { StaffRole } from '@/stores/platform-store'

export const ROLE_LABELS: Record<StaffRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  support: 'Support',
  billing: 'Billing',
  sales: 'Sales',
}

export const isAdmin = (role: StaffRole | undefined) => role === 'super_admin' || role === 'admin'
/** Who registers and edits organisations: `SALES` in `app/routers/platform.py`. */
export const canRegister = (role: StaffRole | undefined) => isAdmin(role) || role === 'sales'

const EVERYONE: readonly StaffRole[] = ['super_admin', 'admin', 'support', 'billing', 'sales']
const ADMINS: readonly StaffRole[] = ['super_admin', 'admin']

interface PlatformNavItem extends NavItem {
  roles: readonly StaffRole[]
}

/** The staff menu; the API enforces the same roles (`app/routers/platform.py`). */
const PLATFORM_NAV: readonly PlatformNavItem[] = [
  { label: 'Dashboard', to: '/platform', icon: DashboardIcon, exact: true, roles: EVERYONE },
  { label: 'Organisations', to: '/platform/organisations', icon: Building2, roles: EVERYONE },
  {
    label: 'Subscriptions',
    to: '/platform/subscriptions',
    icon: CreditCard,
    roles: [...ADMINS, 'billing'],
  },
  { label: 'Plans', to: '/platform/plans', icon: Package, roles: EVERYONE },
  {
    label: 'Invoices',
    to: '/platform/invoices',
    icon: ReceiptText,
    roles: [...ADMINS, 'billing'],
  },
  { label: 'Sales', to: '/platform/sales', icon: TrendingUp, roles: [...ADMINS, 'sales'] },
  { label: 'Support', to: '/platform/support', icon: LifeBuoy, roles: [...ADMINS, 'support'] },
  { label: 'Staff', to: '/platform/staff', icon: UsersRound, roles: ADMINS },
  { label: 'Activity Log', to: '/platform/activity', icon: History, roles: ADMINS },
]

export function platformNavFor(role: StaffRole | undefined): readonly NavItem[] {
  return PLATFORM_NAV.filter((item) => role !== undefined && item.roles.includes(role))
}

/** Whether a staff role opens this page: the same list as its menu. */
export function canOpenPlatform(role: StaffRole | undefined, pathname: string): boolean {
  const entry = [...PLATFORM_NAV]
    .sort((a, b) => b.to.length - a.to.length)
    .find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))
  return role !== undefined && (entry?.roles.includes(role) ?? true)
}
