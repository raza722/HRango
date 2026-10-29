import { useState } from 'react'
import { getRouteApi, Link } from '@tanstack/react-router'
import { ShieldCheck, UserX } from 'lucide-react'

import { ErrorState } from '@/components/feedback/error-state'
import { PageSpinner } from '@/components/feedback/spinner'
import { PageContainer } from '@/components/layout'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ApiError } from '@/lib/api-error'
import { useCan } from '@/lib/permissions'
import { cn, getInitials } from '@/lib/utils'

import { ACCESS_CODES } from '../../constants'
import { useFormerEmployees, useUser } from '../../hooks/use-access'
import { USER_TABS, type UserSearch, type UserTab } from '../../routing'
import type { UserDetail } from '../../types/access.types'
import { formatAgo, formatStamp } from '../../utils/format'
import {
  cardClass,
  dangerButtonClass,
  detailTabClass,
  linkClass,
  navyButtonClass,
  outlineButtonClass,
  pageTitleClass,
  toolbarButtonClass,
} from '../../utils/styles'
import { AuditList } from '../shared/audit-list'
import { BackLink, Chip, Facts, MockModeNote } from '../shared/parts'
import { useUserActions } from './use-user-actions'
import { UserFormDialog } from './user-form-dialog'
import { UserOverridesTab } from './user-overrides-tab'
import { UserPermissionsTab } from './user-permissions-tab'
import { UserRolesTab } from './user-roles-tab'
import { UserSessionsTab } from './user-sessions-tab'

const routeApi = getRouteApi('/_app/settings/system-users/$userId')

const TAB_LABELS: Record<UserTab, string> = {
  roles: 'Roles',
  permissions: 'Permissions',
  overrides: 'Overrides',
  sessions: 'Sessions',
  history: 'History',
}

/** Name, status, the linked employee and the account's buttons. */
function AccountHeader({
  user,
  isSelf,
  left,
  onEdit,
  actions,
}: {
  user: UserDetail
  isSelf: boolean
  left: boolean
  onEdit: (() => void) | null
  actions: ReturnType<typeof useUserActions>
}) {
  const employee = user.employeeId ? (
    <span className="flex flex-wrap items-center gap-1.5">
      <Link
        to="/talent-management/employees/$employeeId"
        params={{ employeeId: user.employeeId }}
        className={cn(linkClass, 'text-sm')}
      >
        {user.employeeCode ?? user.employeeId}
      </Link>
      {left && (
        <Chip tone="red" icon={<UserX aria-hidden="true" className="size-3" strokeWidth={2.2} />}>
          Has left the company
        </Chip>
      )}
    </span>
  ) : (
    'None (not an employee’s account)'
  )

  return (
    <header className={cn(cardClass, '@container grid gap-4 px-4 py-4 sm:px-6')}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-12">
            <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
          </Avatar>
          <div className="grid min-w-0 gap-1">
            <h1 className={cn(pageTitleClass, 'break-words')}>
              {user.name}
              {isSelf && <span className="text-sm font-normal text-grey"> (you)</span>}
            </h1>
            <span className="flex flex-wrap items-center gap-1.5">
              {user.isActive ? <Chip tone="green">Active</Chip> : <Chip tone="grey">Disabled</Chip>}
              {user.isSystemAdmin && (
                <Chip
                  tone="violet"
                  icon={<ShieldCheck aria-hidden="true" className="size-3" strokeWidth={2.2} />}
                >
                  System admin
                </Chip>
              )}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {onEdit && (
            <Button
              variant="outline"
              onClick={onEdit}
              className={cn(toolbarButtonClass, outlineButtonClass)}
            >
              Edit
            </Button>
          )}
          {(isSelf || actions.canPassword) && (
            <Button
              variant="outline"
              onClick={() => {
                actions.openPassword(user)
              }}
              className={cn(toolbarButtonClass, outlineButtonClass)}
            >
              {isSelf ? 'Change Password' : 'Set Password'}
            </Button>
          )}
          {actions.canDisable && !isSelf && (
            <Button
              onClick={() => {
                actions.openActive(user)
              }}
              className={cn(
                toolbarButtonClass,
                user.isActive ? dangerButtonClass : navyButtonClass,
              )}
            >
              {user.isActive ? 'Disable' : 'Enable'}
            </Button>
          )}
        </div>
      </div>
      <Facts
        label="Account"
        items={[
          { label: 'Email', value: <span className="break-all">{user.email}</span> },
          { label: 'Linked Employee', value: employee },
          {
            label: 'Last Login',
            value: user.lastLoginAt
              ? `${formatStamp(user.lastLoginAt)} (${formatAgo(user.lastLoginAt) ?? ''})`
              : 'Never signed in',
          },
          { label: 'Home Company', value: user.homeCompanyName ?? '—' },
          {
            label: 'Companies',
            value: user.companies.map((company) => company.name).join(', ') || '—',
          },
          {
            label: 'Created / Updated',
            value: `${formatStamp(user.createdAt)}${user.updatedAt ? ` · ${formatStamp(user.updatedAt)}` : ''}`,
          },
        ]}
      />
      {isSelf && <MockModeNote />}
    </header>
  )
}

/**
 * One account: the header (status, linked employee, companies, Edit, Set / Change Password,
 * Enable / Disable) and the tabs Roles, Permissions (what it holds and where from), Overrides,
 * Sessions and History. `?tab=` keeps the open tab; the tabs' search and pages are in the URL.
 */
export function UserDetailPage() {
  const { userId } = routeApi.useParams()
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const record = useUser(userId)
  const former = useFormerEmployees()
  const canEdit = useCan(ACCESS_CODES.usersEdit)
  const actions = useUserActions()
  const [editing, setEditing] = useState(false)

  const update = (patch: Partial<UserSearch>) => {
    void navigate({ search: (current) => ({ ...current, ...patch }), replace: true })
  }

  const back = <BackLink to="/settings/system-users" label="System Users" />

  if (record.isPending) {
    return (
      <PageContainer>
        {back}
        <PageSpinner label="Loading the account" />
      </PageContainer>
    )
  }
  if (record.isError) {
    const missing = record.error instanceof ApiError && record.error.isNotFound
    return (
      <PageContainer>
        {back}
        <ErrorState
          title={missing ? 'Account not found' : 'Could not load the account'}
          message={missing ? 'This account does not exist.' : record.error.message}
          {...(missing ? {} : { onRetry: () => void record.refetch() })}
        />
      </PageContainer>
    )
  }

  const user = record.data
  const isSelf = actions.isSelf(user)
  const left = user.employeeId ? (former.data?.has(user.employeeId) ?? false) : false

  return (
    <PageContainer>
      {back}
      <AccountHeader
        user={user}
        isSelf={isSelf}
        left={left}
        onEdit={
          canEdit
            ? () => {
                setEditing(true)
              }
            : null
        }
        actions={actions}
      />
      <Tabs
        value={search.tab}
        onValueChange={(next) => {
          const tab = USER_TABS.find((item) => item === next)
          if (tab) update({ tab })
        }}
        className="min-w-0 gap-0 overflow-hidden rounded-xl bg-card shadow-xs"
      >
        <TabsList
          aria-label="Account details"
          className="relative flex scrollbar-thin h-auto w-full max-w-none justify-start gap-6 overflow-x-auto rounded-none border-b bg-transparent px-4 py-0 sm:px-6"
        >
          {USER_TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab} className={detailTabClass}>
              {TAB_LABELS[tab]}
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="@container min-w-0 p-4 sm:p-6">
          <TabsContent value="roles">
            <UserRolesTab user={user} />
          </TabsContent>
          <TabsContent value="permissions">
            <UserPermissionsTab
              user={user}
              q={search.q}
              onSearch={(q) => {
                update({ q })
              }}
            />
          </TabsContent>
          <TabsContent value="overrides">
            <UserOverridesTab user={user} />
          </TabsContent>
          <TabsContent value="sessions">
            <UserSessionsTab
              user={user}
              isSelf={isSelf}
              showEnded={search.ended === true}
              page={search.sessionsPage}
              onChange={(patch) => {
                update(patch)
              }}
            />
          </TabsContent>
          <TabsContent value="history">
            <AuditList
              entity="user"
              entityId={user.id}
              page={search.historyPage}
              onPageChange={(historyPage) => {
                update({ historyPage })
              }}
            />
          </TabsContent>
        </div>
      </Tabs>

      {editing && (
        <UserFormDialog
          id={user.id}
          onClose={() => {
            setEditing(false)
          }}
        />
      )}
      {actions.dialogs}
    </PageContainer>
  )
}
