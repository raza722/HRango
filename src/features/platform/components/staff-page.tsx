import { useState } from 'react'
import { KeyRound, Pencil, Plus } from 'lucide-react'

import { type DataTableColumn, RowActionsMenu } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/lib/date'
import { usePlatformStore } from '@/stores/platform-store'

import { platformApi, type StaffRow } from '../api/platform.api'
import { blank, optionsOf } from '../format'
import { useListState, usePlatformList, usePlatformMutation } from '../hooks/use-platform'
import { ROLE_LABELS } from '../platform-nav'
import { ListPage, RecordDialog, StatusChip } from './shared'

const ROLE_OPTIONS = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))

function StaffDialog({ row, onClose }: { row: StaffRow | null; onClose: () => void }) {
  const save = usePlatformMutation(
    (body: object) =>
      row ? platformApi.update(`staff/${row.id}`, body) : platformApi.create('staff', body),
    'Staff member saved',
  )
  return (
    <RecordDialog
      title={row ? `Edit ${row.displayName}` : 'Add staff member'}
      values={{
        displayName: row?.displayName ?? '',
        email: row?.email ?? '',
        role: row?.role ?? 'support',
        isActive: row?.isActive === false ? 'no' : 'yes',
      }}
      fields={[
        { name: 'displayName', label: 'Name', required: true },
        { name: 'email', label: 'Email', kind: 'email', required: true },
        { name: 'role', label: 'Role', kind: 'select', options: ROLE_OPTIONS, required: true },
        {
          name: 'isActive',
          label: 'Can sign in',
          kind: 'select',
          options: optionsOf(['yes', 'no']),
          required: true,
        },
        ...(row
          ? []
          : [
              {
                name: 'password',
                label: 'Password',
                kind: 'password' as const,
                required: true,
                description: 'At least 12 characters with letters and digits.',
              },
            ]),
      ]}
      onSubmit={(form) =>
        save.mutateAsync({
          displayName: form.displayName,
          email: form.email,
          role: form.role,
          isActive: form.isActive === 'yes',
          password: blank(form.password),
          rowVersion: row?.rowVersion ?? null,
        })
      }
      onClose={onClose}
    />
  )
}

function PasswordDialog({ row, onClose }: { row: StaffRow; onClose: () => void }) {
  const save = usePlatformMutation(
    (password: string) => platformApi.setStaffPassword(row.id, password),
    'Password set',
  )
  return (
    <RecordDialog
      title={`Set a password for ${row.displayName}`}
      description="They are signed out everywhere."
      submitLabel="Set password"
      fields={[
        {
          name: 'password',
          label: 'New password',
          kind: 'password',
          required: true,
          description: 'At least 12 characters with letters and digits.',
        },
      ]}
      onSubmit={(form) => save.mutateAsync(form.password ?? '')}
      onClose={onClose}
    />
  )
}

export function StaffPage() {
  const isSuperAdmin = usePlatformStore((state) => state.staff?.role === 'super_admin')
  const list = useListState()
  const result = usePlatformList<StaffRow>('staff', {
    page: list.page,
    pageSize: list.pageSize,
    q: list.q || undefined,
  })
  const [editing, setEditing] = useState<StaffRow | 'new' | null>(null)
  const [password, setPassword] = useState<StaffRow | null>(null)

  const columns: DataTableColumn<StaffRow>[] = [
    {
      id: 'name',
      header: 'Name',
      mobile: 'heading',
      cell: (row) => <span className="font-medium text-title">{row.displayName}</span>,
    },
    { id: 'email', header: 'Email', cell: (row) => row.email },
    { id: 'role', header: 'Role', cell: (row) => ROLE_LABELS[row.role] },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <StatusChip value={row.isActive ? 'active' : 'disabled'} />,
    },
    {
      id: 'login',
      header: 'Last sign-in',
      cell: (row) => (row.lastLoginAt ? formatDateTime(row.lastLoginAt) : 'Never'),
    },
  ]

  return (
    <>
      <ListPage
        title="Staff"
        description="hRango’s own team. Only a Super Admin adds or changes staff."
        actions={
          isSuperAdmin && (
            <Button
              onClick={() => {
                setEditing('new')
              }}
            >
              <Plus /> Add staff member
            </Button>
          )
        }
        caption="All staff"
        columns={columns}
        result={result}
        list={list}
        search="Name or email"
        getRowId={(row) => row.id}
        {...(isSuperAdmin
          ? {
              rowActions: (row: StaffRow) => (
                <RowActionsMenu
                  label={`Actions for ${row.displayName}`}
                  actions={[
                    {
                      label: 'Edit',
                      icon: Pencil,
                      onSelect: () => {
                        setEditing(row)
                      },
                    },
                    {
                      label: 'Set password',
                      icon: KeyRound,
                      onSelect: () => {
                        setPassword(row)
                      },
                    },
                  ]}
                />
              ),
            }
          : {})}
        emptyText="No staff found."
      />
      {editing && (
        <StaffDialog
          row={editing === 'new' ? null : editing}
          onClose={() => {
            setEditing(null)
          }}
        />
      )}
      {password && (
        <PasswordDialog
          row={password}
          onClose={() => {
            setPassword(null)
          }}
        />
      )}
    </>
  )
}
