import { useState } from 'react'
import { getRouteApi, Link } from '@tanstack/react-router'
import { ArrowLeft, ArrowLeftRight, TrendingUp, Wallet } from 'lucide-react'

import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
import { ErrorState } from '@/components/feedback/error-state'
import { PageSpinner } from '@/components/feedback/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ApiError } from '@/lib/api-error'

import { isInactiveStatus, PROFILE_TAB_LABELS } from '../../constants'
import { useEmployee, useSetEmployeeActive } from '../../hooks/use-employees'
import { type Employee, PROFILE_TABS, type ProfileTab } from '../../types/employees.types'
import { formatDay } from '../../utils/format'
import { cardTitleClass, profileTabClass, sectionLinkClass } from '../../utils/styles'
import { EmployeeFormDialog } from '../list/employee-form-dialog'
import { BenefitsTab } from './benefits-tab'
import { DependentsTab } from './dependents-tab'
import { DocumentsTab } from './documents-tab'
import { LeaveTab } from './leave-tab'
import { PersonalTab } from './personal-tab'
import { ProfileHeader } from './profile-header'
import { SkillsTab } from './skills-tab'
import { UpdateProfileDialog } from './update-profile-dialog'
import { WorkTab } from './work-tab'

const routeApi = getRouteApi('/_app/talent-management/employees/$employeeId')

/**
 * "Personal Information" of the Profile Dashboard's left column (Reg #, Designation, Hire
 * Date …). The Job Title shows too when it is not the designation.
 */
function PersonalInformation({ employee }: { employee: Employee }) {
  const jobTitle =
    employee.jobTitleName && employee.jobTitleName !== employee.designationName
      ? employee.jobTitleName
      : null
  const rows: [string, string][] = [
    ['Reg #:', employee.code],
    ['Designation:', employee.designationName ?? employee.jobTitleName ?? '—'],
    ...(jobTitle ? ([['Job Title:', jobTitle]] as [string, string][]) : []),
    ['Hire Date:', formatDay(employee.joiningDate) || '—'],
    ['Department:', employee.departmentName ?? '—'],
    ['Line Manager:', employee.lineManagerName ?? '—'],
  ]
  return (
    <section aria-labelledby="personal-information" className="rounded-xl bg-card p-4 shadow-xs">
      <h2 id="personal-information" className={cardTitleClass}>
        Personal Information
      </h2>
      <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-xs">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-grey">{label}</dt>
            <dd className="break-words text-title">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/** The other modules' screens that act on this person. */
function RelatedLinks() {
  const linkClass =
    'flex items-center gap-2.5 rounded-md px-2 py-2 text-xs font-medium text-title outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50'
  return (
    <nav aria-label="Related screens" className="rounded-xl bg-card p-4 shadow-xs">
      <h2 className={cardTitleClass}>Related</h2>
      <ul className="mt-2 grid gap-1">
        <li>
          <Link to="/requests/transfer" className={linkClass}>
            <ArrowLeftRight aria-hidden="true" className="size-4 text-sidebar dark:text-heading" />
            Transfer
          </Link>
        </li>
        <li>
          <Link to="/payroll/salary-revision" className={linkClass}>
            <TrendingUp aria-hidden="true" className="size-4 text-sidebar dark:text-heading" />
            Salary Revision
          </Link>
        </li>
        <li>
          <Link to="/payroll/balances/employee-accounts" className={linkClass}>
            <Wallet aria-hidden="true" className="size-4 text-sidebar dark:text-heading" />
            Employee Accounts
          </Link>
        </li>
      </ul>
    </nav>
  )
}

function TabBody({ tab, employee }: { tab: ProfileTab; employee: Employee }) {
  switch (tab) {
    case 'personal':
      return <PersonalTab employee={employee} />
    case 'work':
      return <WorkTab employee={employee} />
    case 'documents':
      return <DocumentsTab employee={employee} />
    case 'dependents':
      return <DependentsTab employee={employee} />
    case 'benefits':
      return <BenefitsTab employee={employee} />
    case 'leave':
      return <LeaveTab employee={employee} />
    case 'skills':
      return <SkillsTab employee={employee} />
  }
}

/**
 * The employee profile. The content follows the mobile profile frames (2423:17024 …: the tabs
 * Personal, Work, Documents, Dependents, Benefits, Leave, Skills and their popups); the desktop
 * layout the Profile Dashboard (765:234): the photo card, Personal Information and links on the
 * left, the tabbed details on the right. `?tab=` keeps the open tab.
 */
export function EmployeeProfilePage() {
  const { employeeId } = routeApi.useParams()
  const { tab } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const record = useEmployee(employeeId)
  const setActive = useSetEmployeeActive()
  const [dialog, setDialog] = useState<'profile' | 'edit' | 'active' | null>(null)
  const close = () => {
    setDialog(null)
  }

  const back = (
    <Link
      to="/talent-management/employees"
      className={`${sectionLinkClass} inline-flex w-fit items-center gap-1.5 text-sm`}
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      Employee Record
    </Link>
  )

  if (record.isPending) return <PageSpinner label="Loading the employee" />
  if (record.isError) {
    const missing = record.error instanceof ApiError && record.error.isNotFound
    return (
      <>
        {back}
        <ErrorState
          title={missing ? 'Employee not found' : 'Something went wrong'}
          message={missing ? 'This employee does not exist or was removed.' : record.error.message}
          {...(missing
            ? {}
            : {
                onRetry: () => {
                  void record.refetch()
                },
              })}
        />
      </>
    )
  }
  const employee = record.data
  const inactive = isInactiveStatus(employee.status)

  return (
    <>
      {back}
      {/* Two columns from a 56rem page (a 1280px window with the sidebar open). */}
      <div className="grid items-start gap-4 sm:gap-5 @[56rem]/page:grid-cols-[16.5rem_minmax(0,1fr)] @[72rem]/page:grid-cols-[18rem_minmax(0,1fr)] @[90rem]/page:grid-cols-[20rem_minmax(0,1fr)]">
        <div className="grid gap-4 sm:gap-5">
          <ProfileHeader
            employee={employee}
            onUpdateProfile={() => {
              setDialog('profile')
            }}
            onEdit={() => {
              setDialog('edit')
            }}
            onToggleActive={() => {
              setDialog('active')
            }}
          />
          <PersonalInformation employee={employee} />
          <RelatedLinks />
        </div>

        <Tabs
          value={tab}
          onValueChange={(next) => {
            const picked = PROFILE_TABS.find((item) => item === next)
            if (picked) void navigate({ search: { tab: picked }, replace: true })
          }}
          className="min-w-0 gap-0 overflow-hidden rounded-xl bg-card shadow-xs"
        >
          <TabsList
            aria-label="Employee details"
            className="flex scrollbar-thin h-auto w-full max-w-none justify-start gap-6 overflow-x-auto rounded-none border-b bg-transparent px-4 py-0 sm:px-6"
          >
            {PROFILE_TABS.map((item) => (
              <TabsTrigger key={item} value={item} className={profileTabClass}>
                {PROFILE_TAB_LABELS[item]}
              </TabsTrigger>
            ))}
          </TabsList>
          {/* Only the open tab mounts (and reads its data); the others keep their ids for the triggers. */}
          {PROFILE_TABS.map((item) => (
            <TabsContent key={item} value={item} className="p-4 sm:p-6">
              <TabBody tab={item} employee={employee} />
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {dialog === 'profile' && <UpdateProfileDialog employee={employee} onClose={close} />}
      {dialog === 'edit' && <EmployeeFormDialog employeeId={employee.id} onClose={close} />}
      {dialog === 'active' && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) close()
          }}
          title={inactive ? 'Reactivate employee' : 'Deactivate employee'}
          description={
            inactive
              ? `Reactivate ${employee.name}? Their record becomes active again.`
              : `Deactivate ${employee.name}? Their record is switched off with their sign-in accounts.`
          }
          confirmLabel={inactive ? 'Reactivate' : 'Deactivate'}
          variant={inactive ? 'default' : 'destructive'}
          onConfirm={() => {
            setActive.mutate({ employee, active: inactive })
            close()
          }}
        />
      )}
    </>
  )
}
