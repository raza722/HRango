import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { ShieldCheck, UserX } from 'lucide-react'

import {
  type DataTableColumn,
  PageContainer,
  PaginatedTableCard,
  RowActionsMenu,
  rowMenuItemClass,
} from '@/components/layout'
import { Button } from '@/components/ui/button'
import { SearchSelect } from '@/features/payroll'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { ACCESS_CODES, ACCESS_PAGE_SIZES } from '../../constants'
import { useFormerEmployees, useRoleOptions, useUserList } from '../../hooks/use-access'
import type { UsersSearch } from '../../routing'
import type { User } from '../../types/access.types'
import { formatAgo, formatStamp } from '../../utils/format'
import { linkClass, navyButtonClass, tableClass, toolbarButtonClass } from '../../utils/styles'
import {
  Chip,
  ChipToggle,
  ClearFilters,
  MockModeNote,
  PageHeaderCard,
  SearchBox,
} from '../shared/parts'
import { useUserActions } from './use-user-actions'
import { UserFormDialog } from './user-form-dialog'

const routeApi = getRouteApi('/_app/settings/system-users/')

const STATUS_OPTIONS = [
  { value: undefined, label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'disabled', label: 'Disabled' },
] as const

const EMPLOYEE_OPTIONS = [
  { value: 'left', label: 'Employee has left' },
  { value: 'none', label: 'No employee linked' },
]

/** The person, their email under, and a link to the account. */
function UserCell({ user, isSelf }: { user: User; isSelf: boolean }) {
  return (
    <span className="grid min-w-0 gap-0.5">
      <Link
        to="/settings/system-users/$userId"
        params={{ userId: user.id }}
        className={cn(linkClass, 'text-xs break-words')}
      >
        {user.name}
        {isSelf && <span className="font-normal text-grey"> (you)</span>}
      </Link>
      <span className="text-[0.6875rem] break-all text-grey">{user.email}</span>
    </span>
  )
}

/**
 * Settings → System Users: every account that can sign in, with its linked employee, roles,
 * last sign-in and status. Search, Active / Disabled, a role and "Employee has left" / "No
 * employee linked" filter it; ⋮ has View, Edit, Set Password and Disable / Enable. Accounts are
 * never deleted. Search, filters, page and the open form live in the URL.
 */
export function SystemUsersPage() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const goTo = useNavigate()
  const canCreate = useCan(ACCESS_CODES.usersCreate)
  const canEdit = useCan(ACCESS_CODES.usersEdit)
  const actions = useUserActions()
  const roles = useRoleOptions()
  const former = useFormerEmployees()

  const update = (patch: Partial<UsersSearch>) => {
    void navigate({ search: (current) => ({ ...current, ...patch }) })
  }
  const filter = (patch: Partial<UsersSearch>) => {
    update({ ...patch, page: 1 })
  }
  const list = useUserList({
    q: search.q,
    isActive: search.status === undefined ? undefined : search.status === 'active',
    roleId: search.roleId,
    employee: search.employee,
    page: search.page,
    pageSize: search.pageSize,
  })
  const filterCount = [search.q, search.status, search.roleId, search.employee].filter(
    Boolean,
  ).length

  const roleOptions = (roles.data?.data ?? []).map((role) => ({
    value: role.id,
    label: role.isActive ? role.name : `${role.name} (retired)`,
  }))

  const columns: DataTableColumn<User>[] = [
    {
      id: 'user',
      header: 'User',
      mobile: 'heading',
      className: 'min-w-52 whitespace-normal',
      cell: (row) => <UserCell user={row} isSelf={actions.isSelf(row)} />,
    },
    {
      id: 'employee',
      header: 'Linked Employee',
      className: 'min-w-32 whitespace-normal',
      cell: (row) => {
        if (!row.employeeId) return <span className="text-grey">None</span>
        const left = former.data?.get(row.employeeId)
        return (
          <span className="flex flex-wrap items-center gap-1.5">
            <span>{row.employeeCode ?? row.employeeId}</span>
            {left && (
              <Chip
                tone="red"
                icon={<UserX aria-hidden="true" className="size-3" strokeWidth={2.2} />}
              >
                Left
              </Chip>
            )}
          </span>
        )
      },
    },
    {
      id: 'roles',
      header: 'Roles',
      className: 'min-w-44 whitespace-normal',
      cell: (row) => (
        <span className="flex flex-wrap gap-1">
          {row.isSystemAdmin && (
            <Chip
              tone="violet"
              icon={<ShieldCheck aria-hidden="true" className="size-3" strokeWidth={2.2} />}
            >
              System admin
            </Chip>
          )}
          {row.roleNames.length === 0 && !row.isSystemAdmin ? (
            <span className="text-grey">No roles</span>
          ) : (
            row.roleNames.map((name) => (
              <Chip key={name} tone="navy">
                {name}
              </Chip>
            ))
          )}
        </span>
      ),
    },
    {
      id: 'lastLogin',
      header: 'Last Login',
      className: 'min-w-32 whitespace-normal',
      cell: (row) =>
        row.lastLoginAt ? (
          <span className="grid gap-0.5">
            <time dateTime={row.lastLoginAt}>{formatStamp(row.lastLoginAt)}</time>
            <span className="text-[0.625rem] text-grey">{formatAgo(row.lastLoginAt)}</span>
          </span>
        ) : (
          <span className="text-grey">Never</span>
        ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) =>
        row.isActive ? <Chip tone="green">Active</Chip> : <Chip tone="grey">Disabled</Chip>,
    },
    {
      id: 'action',
      header: 'Action',
      align: 'center',
      className: 'w-16',
      cell: (row) => (
        <RowActionsMenu
          label={`Actions for ${row.name}`}
          itemClassName={rowMenuItemClass.poppins}
          actions={[
            {
              label: 'View',
              onSelect: () => {
                void goTo({ to: '/settings/system-users/$userId', params: { userId: row.id } })
              },
            },
            ...(canEdit
              ? [
                  {
                    label: 'Edit',
                    onSelect: () => {
                      update({ edit: row.id, dialog: undefined })
                    },
                  },
                ]
              : []),
            ...actions.actionsFor(row),
          ]}
        />
      ),
    },
  ]

  const total = list.data?.meta.total

  return (
    <PageContainer>
      <PageHeaderCard
        title="System Users"
        description="Who can sign in, and with which roles. Accounts are never deleted: disable them instead."
        actions={
          canCreate && (
            <Button
              onClick={() => {
                update({ dialog: 'create', edit: undefined })
              }}
              className={cn(toolbarButtonClass, navyButtonClass, 'px-5')}
            >
              + Add User
            </Button>
          )
        }
      >
        <MockModeNote />
      </PageHeaderCard>

      <PaginatedTableCard
        title={total === undefined ? 'Accounts' : `Accounts (${String(total)})`}
        titleAs="h2"
        caption="System users"
        className={tableClass}
        toolbar={
          <div className="grid w-full gap-3">
            <SearchBox
              key={search.q ?? ''}
              value={search.q}
              label="Search users"
              placeholder="Name, email or employee code"
              onSearch={(q) => {
                filter({ q })
              }}
            />
            <div className="flex flex-wrap items-center gap-3">
              <ChipToggle
                label="Status"
                options={STATUS_OPTIONS}
                value={search.status}
                onChange={(status) => {
                  filter({ status })
                }}
              />
              <SearchSelect
                aria-label="Role"
                value={search.roleId ?? null}
                onChange={(roleId) => {
                  filter({ roleId: roleId ?? undefined })
                }}
                options={roleOptions}
                placeholder="All roles"
                clearable
                loading={roles.isPending}
                className="h-9 w-full min-w-0 sm:w-56"
              />
              <SearchSelect
                aria-label="Employee"
                value={search.employee ?? null}
                onChange={(employee) => {
                  filter({
                    employee: employee === 'left' || employee === 'none' ? employee : undefined,
                  })
                }}
                options={EMPLOYEE_OPTIONS}
                placeholder="Any employee"
                clearable
                className="h-9 w-full min-w-0 sm:w-56"
              />
              <ClearFilters
                count={filterCount}
                onClear={() => {
                  filter({
                    q: undefined,
                    status: undefined,
                    roleId: undefined,
                    employee: undefined,
                  })
                }}
              />
            </div>
          </div>
        }
        columns={columns}
        result={list}
        page={search.page}
        pageSize={search.pageSize}
        pageSizeOptions={ACCESS_PAGE_SIZES}
        onPageChange={(next) => {
          update({ page: next })
        }}
        onPageSizeChange={(size) => {
          update({ pageSize: size, page: 1 })
        }}
        getRowId={(row) => row.id}
        emptyState={
          filterCount > 0
            ? 'No accounts match the search or filters.'
            : 'No accounts yet. + Add User adds the first one.'
        }
      />

      {(search.dialog === 'create' || search.edit) && (
        <UserFormDialog
          id={search.edit ?? null}
          onClose={() => {
            update({ dialog: undefined, edit: undefined })
          }}
          onSaved={(saved) => {
            if (search.edit) update({ edit: undefined })
            else void goTo({ to: '/settings/system-users/$userId', params: { userId: saved.id } })
          }}
        />
      )}
      {actions.dialogs}
    </PageContainer>
  )
}
