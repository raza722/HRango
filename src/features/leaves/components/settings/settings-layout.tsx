import { Link, Outlet, useRouterState } from '@tanstack/react-router'

import { AttendanceSettingsMenuIcon } from '@/components/icons/attendance-menu-icons'
import { LeaveRequestIcon, ResignationRequestIcon } from '@/components/icons/request-icons'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { LEAVE_CODES } from '../../constants'
import {
  leaveNavyButtonClass,
  leaveOutlineButtonClass,
  leaveTitleClass,
  leaveToolbarClass,
} from '../../utils/styles'

/**
 * Settings (frames 4428:90230 … 4428:90498): the title with "+ Add New" on
 * the Leave Types and Leave Policies tabs, and the inner tabs General Settings
 * | Leave Types | Leave Policies, each with an 18–20px icon, Poppins Medium 14
 * #17263A for the current one and Regular 14 #707070 for the rest. The
 * frames' own tab icons have no clean vector; the same file's gear, Leaves
 * and document icons stand in.
 */
const TABS = [
  {
    to: '/leaves/settings/general',
    label: 'General Settings',
    Icon: AttendanceSettingsMenuIcon,
    code: LEAVE_CODES.generalView,
  },
  {
    to: '/leaves/settings/leave-types',
    label: 'Leave Types',
    Icon: LeaveRequestIcon,
    code: LEAVE_CODES.typesView,
  },
  {
    to: '/leaves/settings/policies',
    label: 'Leave Policies',
    Icon: ResignationRequestIcon,
    code: LEAVE_CODES.policiesView,
  },
] as const

const addNewClass = cn(
  leaveToolbarClass,
  leaveNavyButtonClass,
  'inline-flex items-center px-7 text-xs outline-none',
)

/**
 * "+ Add New" opens the current list's popup through `?dialog=add`; on Leave Types,
 * "Allotment" opens the allotment / carry forward run (`?dialog=allotment`).
 */
function AddNewLink({ pathname }: { pathname: string }) {
  const canCreateType = useCan(LEAVE_CODES.typesCreate)
  const canAllot = useCan(LEAVE_CODES.allotment)
  const canCreatePolicy = useCan(LEAVE_CODES.policiesCreate)
  if (pathname.endsWith('/leave-types')) {
    return (
      <div className="flex flex-wrap gap-2.5">
        {canAllot && (
          <Link
            to="/leaves/settings/leave-types"
            search={(prev) => ({ ...prev, dialog: 'allotment' })}
            className={cn(
              leaveToolbarClass,
              leaveOutlineButtonClass,
              'inline-flex items-center px-5 outline-none',
            )}
          >
            Allotment
          </Link>
        )}
        {canCreateType && (
          <Link
            to="/leaves/settings/leave-types"
            search={(prev) => ({ ...prev, dialog: 'add' })}
            className={addNewClass}
          >
            + Add New
          </Link>
        )}
      </div>
    )
  }
  if (pathname.endsWith('/policies') && canCreatePolicy) {
    return (
      <Link
        to="/leaves/settings/policies"
        search={(prev) => ({ ...prev, dialog: 'add' })}
        className={addNewClass}
      >
        + Add New
      </Link>
    )
  }
  return null
}

function TabLink({ tab }: { tab: (typeof TABS)[number] }) {
  const allowed = useCan(tab.code)
  if (!allowed) return null
  const { to, label, Icon } = tab
  return (
    <Link
      to={to}
      className={cn(
        'flex h-8 items-center gap-2.5 rounded-sm text-sm whitespace-nowrap text-grey outline-none hover:text-title focus-visible:ring-2 focus-visible:ring-ring/50',
        'data-[status=active]:font-medium data-[status=active]:text-sidebar dark:data-[status=active]:text-heading',
      )}
    >
      <Icon className="size-5 shrink-0" />
      {label}
    </Link>
  )
}

export function LeaveSettingsLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  return (
    <div className="grid gap-6 px-4 pt-6 pb-5 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className={leaveTitleClass}>Settings</h1>
        <AddNewLink pathname={pathname} />
      </div>
      <nav aria-label="Leave settings" className="flex flex-wrap gap-x-7 gap-y-3">
        {TABS.map((tab) => (
          <TabLink key={tab.to} tab={tab} />
        ))}
      </nav>
      <Outlet />
    </div>
  )
}
