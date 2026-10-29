import { Link } from '@tanstack/react-router'
import { ShieldCheck } from 'lucide-react'

import { DataTable, type DataTableColumn, Pagination } from '@/components/layout'
import { cn } from '@/lib/utils'

import { useUserList } from '../../hooks/use-access'
import type { RoleDetail, User } from '../../types/access.types'
import { formatStamp, plural } from '../../utils/format'
import { linkClass, tableClass } from '../../utils/styles'
import { Chip, LoadError, SectionCard } from '../shared/parts'

const PAGE_SIZE = 10

/** Who holds the role (`GET /access/users?roleId`), ten at a time, each linking to the account. */
export function RoleUsersTab({
  role,
  page,
  onPageChange,
}: {
  role: RoleDetail
  page: number
  onPageChange: (page: number) => void
}) {
  const users = useUserList({ roleId: role.id, page, pageSize: PAGE_SIZE })
  const meta = users.data?.meta

  const columns: DataTableColumn<User>[] = [
    {
      id: 'user',
      header: 'User',
      mobile: 'heading',
      className: 'min-w-52 whitespace-normal',
      cell: (row) => (
        <span className="grid gap-0.5">
          <Link
            to="/settings/system-users/$userId"
            params={{ userId: row.id }}
            className={cn(linkClass, 'text-xs')}
          >
            {row.name}
          </Link>
          <span className="text-[0.6875rem] break-all text-grey">{row.email}</span>
        </span>
      ),
    },
    {
      id: 'employee',
      header: 'Employee Code',
      cell: (row) => row.employeeCode ?? '—',
    },
    {
      id: 'roles',
      header: 'Other Roles',
      className: 'min-w-40 whitespace-normal',
      cell: (row) => {
        const others = row.roleNames.filter((name) => name !== role.name)
        return (
          <span className="flex flex-wrap gap-1">
            {row.isSystemAdmin && (
              <Chip
                tone="violet"
                icon={<ShieldCheck aria-hidden="true" className="size-3" strokeWidth={2.2} />}
              >
                System admin
              </Chip>
            )}
            {others.length === 0 && !row.isSystemAdmin
              ? '—'
              : others.map((name) => (
                  <Chip key={name} tone="navy">
                    {name}
                  </Chip>
                ))}
          </span>
        )
      },
    },
    { id: 'lastLogin', header: 'Last Login', cell: (row) => formatStamp(row.lastLoginAt) },
    {
      id: 'status',
      header: 'Status',
      cell: (row) =>
        row.isActive ? <Chip tone="green">Active</Chip> : <Chip tone="grey">Disabled</Chip>,
    },
  ]

  return (
    <SectionCard
      title={meta ? `People with ${role.name} (${String(meta.total)})` : `People with ${role.name}`}
      as="h3"
    >
      {users.isError && !users.data ? (
        <LoadError error={users.error} what="the people" onRetry={() => void users.refetch()} />
      ) : (
        <div className="grid gap-3">
          {!role.isActive && meta && meta.total > 0 && (
            <p className="rounded-lg bg-muted px-3 py-2 text-xs text-field-foreground">
              The role is retired: {plural(meta.total, 'person', 'people')} still{' '}
              {meta.total === 1 ? 'holds' : 'hold'} it but get nothing from it.
            </p>
          )}
          <DataTable
            caption={`People with ${role.name}`}
            columns={columns}
            data={users.data?.data ?? []}
            getRowId={(row) => row.id}
            isLoading={users.isPending}
            isFetching={users.isFetching}
            className={tableClass}
            loadingRowCount={3}
            emptyState={`Nobody holds ${role.name} yet. Give it to people in System Users.`}
          />
          {meta && meta.totalPages > 1 && (
            <div className="flex justify-center">
              <Pagination
                page={meta.page}
                totalPages={meta.totalPages}
                onPageChange={onPageChange}
                disabled={users.isFetching}
              />
            </div>
          )}
        </div>
      )}
    </SectionCard>
  )
}
