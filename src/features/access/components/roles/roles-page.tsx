import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'

import {
  type DataTableColumn,
  PageContainer,
  PaginatedTableCard,
  RowActionsMenu,
  rowMenuItemClass,
} from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

import { ACCESS_PAGE_SIZES } from '../../constants'
import { useRole, useRoleList } from '../../hooks/use-access'
import type { RolesSearch } from '../../routing'
import type { Role } from '../../types/access.types'
import { formatDay } from '../../utils/format'
import { linkClass, navyButtonClass, tableClass, toolbarButtonClass } from '../../utils/styles'
import { Chip, MockModeNote, PageHeaderCard, SearchBox } from '../shared/parts'
import { RoleFormDialog } from './role-dialogs'
import { useRoleActions } from './use-role-actions'

const routeApi = getRouteApi('/_app/settings/user-group-permissions/')

/**
 * Settings → User Group Permissions: the roles, each a set of permission ticks with a scope,
 * with how many people hold it and how many permissions it has; system roles are marked.
 * Search and "Include retired" filter it; ⋮ has Open, Edit, Copy, Retire / Restore, Delete.
 */
export function RolesPage() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const goTo = useNavigate()
  const update = (patch: Partial<RolesSearch>) => {
    void navigate({ search: (current) => ({ ...current, ...patch }) })
  }
  const actions = useRoleActions({
    onEdit: (role) => {
      update({ edit: role.id, dialog: undefined })
    },
  })
  const list = useRoleList({
    q: search.q,
    includeRetired: search.retired,
    page: search.page,
    pageSize: search.pageSize,
  })
  const onPage = search.edit ? list.data?.data.find((role) => role.id === search.edit) : undefined
  // An `edit=` link to a role on another page reads that role.
  const detail = useRole(search.edit && !onPage && list.data ? search.edit : null)
  const editing = search.edit ? (onPage ?? detail.data ?? null) : null

  const columns: DataTableColumn<Role>[] = [
    {
      id: 'role',
      header: 'Role',
      mobile: 'heading',
      className: 'min-w-60 whitespace-normal',
      cell: (row) => (
        <span className="grid gap-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <Link
              to="/settings/user-group-permissions/$roleId"
              params={{ roleId: row.id }}
              className={cn(linkClass, 'text-xs')}
            >
              {row.name}
            </Link>
            {row.isSystem && <Chip tone="navy">System</Chip>}
            {!row.isActive && <Chip tone="grey">Retired</Chip>}
          </span>
          {row.description && (
            <span className="text-[0.625rem] leading-snug text-grey">{row.description}</span>
          )}
        </span>
      ),
    },
    {
      id: 'users',
      header: 'Users',
      align: 'right',
      cell: (row) => row.userCount.toLocaleString('en-US'),
    },
    {
      id: 'permissions',
      header: 'Permissions',
      align: 'right',
      cell: (row) => row.permissionCount.toLocaleString('en-US'),
    },
    {
      id: 'updated',
      header: 'Updated',
      className: 'min-w-28',
      cell: (row) => formatDay(row.updatedAt ?? row.createdAt),
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
              label: 'Open',
              onSelect: () => {
                void goTo({
                  to: '/settings/user-group-permissions/$roleId',
                  params: { roleId: row.id },
                })
              },
            },
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
        title="User Group Permissions"
        description="Roles group what people may do: each is a set of permissions, every one with a scope. Give roles to people in System Users."
        actions={
          actions.canCreate && (
            <Button
              onClick={() => {
                update({ dialog: 'create', edit: undefined })
              }}
              className={cn(toolbarButtonClass, navyButtonClass, 'px-5')}
            >
              + Add Role
            </Button>
          )
        }
      >
        <MockModeNote />
      </PageHeaderCard>

      <PaginatedTableCard
        title={total === undefined ? 'Roles' : `Roles (${String(total)})`}
        titleAs="h2"
        caption="Roles"
        className={tableClass}
        toolbar={
          <>
            <SearchBox
              key={search.q ?? ''}
              value={search.q}
              label="Search roles"
              placeholder="Name or description"
              onSearch={(q) => {
                update({ q, page: 1 })
              }}
            />
            <label className="flex h-9 cursor-pointer items-center gap-2 text-xs text-title">
              <Checkbox
                tone="navy"
                checked={search.retired === true}
                onCheckedChange={(checked) => {
                  update({ retired: checked === true ? true : undefined, page: 1 })
                }}
              />
              Include retired
            </label>
          </>
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
          search.q ? 'No roles match the search.' : 'No roles yet. + Add Role adds the first one.'
        }
      />

      {search.dialog === 'create' && (
        <RoleFormDialog
          role={null}
          onClose={() => {
            update({ dialog: undefined })
          }}
          onSaved={(role) => {
            void goTo({
              to: '/settings/user-group-permissions/$roleId',
              params: { roleId: role.id },
            })
          }}
        />
      )}
      {editing && (
        <RoleFormDialog
          key={editing.rowVersion}
          role={editing}
          onClose={() => {
            update({ edit: undefined })
          }}
        />
      )}
      {actions.dialogs}
    </PageContainer>
  )
}
