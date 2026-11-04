import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Pencil, Plus } from 'lucide-react'

import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
import { type DataTableColumn, RowActionsMenu } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { usePlatformStore } from '@/stores/platform-store'

import { type Organisation, platformApi } from '../api/platform.api'
import { blank, formatDate, optionsOf } from '../format'
import {
  useListState,
  usePlanOptions,
  usePlatformList,
  usePlatformMutation,
} from '../hooks/use-platform'
import { type OrganisationStatus, statusActions, type StatusChange } from '../organisation-status'
import { canRegister, isAdmin } from '../platform-nav'
import { type FormValues, ListPage, RecordDialog, StatusChip } from './shared'

const CONTACT_FIELDS = [
  { name: 'name', label: 'Organisation name', required: true },
  { name: 'contactName', label: 'Contact name' },
  { name: 'contactEmail', label: 'Contact email', kind: 'email', required: true },
  { name: 'contactPhone', label: 'Contact phone' },
  { name: 'country', label: 'Country' },
] as const

const contactBody = (values: FormValues) => ({
  name: values.name,
  contactName: blank(values.contactName),
  contactEmail: values.contactEmail,
  contactPhone: blank(values.contactPhone),
  country: blank(values.country),
  notes: blank(values.notes),
})

/** Creates the company, its roles and its Account Owner, who signs in on the normal page. */
export function RegisterDialog({
  values,
  leadId,
  onClose,
}: {
  values?: Partial<FormValues>
  leadId?: string
  onClose: () => void
}) {
  const plans = usePlanOptions()
  const register = usePlatformMutation(
    (body: object) => platformApi.create('organisations', body),
    'Organisation registered',
  )
  return (
    <RecordDialog
      title="Register organisation"
      description="Creates a working company with its default roles. The Account Owner signs in on the normal page."
      submitLabel="Register"
      {...(values ? { values } : {})}
      fields={[
        ...CONTACT_FIELDS,
        {
          name: 'planId',
          label: 'Plan (starts a 14-day trial)',
          kind: 'select',
          options: plans,
          clearable: 'No plan yet',
        },
        { name: 'ownerName', label: 'Account Owner name', required: true },
        { name: 'ownerEmail', label: 'Account Owner email', kind: 'email', required: true },
        {
          name: 'ownerPassword',
          label: 'Account Owner password',
          kind: 'password',
          required: true,
          description: 'At least 8 characters. Share it with them safely.',
        },
        { name: 'notes', label: 'Notes', kind: 'textarea' },
      ]}
      onSubmit={(form) =>
        register.mutateAsync({
          ...contactBody(form),
          ownerName: form.ownerName,
          ownerEmail: form.ownerEmail,
          ownerPassword: form.ownerPassword,
          planId: form.planId ? Number(form.planId) : null,
          leadId: leadId ? Number(leadId) : null,
        })
      }
      onClose={onClose}
    />
  )
}

export function EditOrganisationDialog({
  row,
  onClose,
}: {
  row: Organisation
  onClose: () => void
}) {
  const save = usePlatformMutation(
    (body: object) => platformApi.update(`organisations/${row.id}`, body),
    'Organisation saved',
  )
  return (
    <RecordDialog
      title={`Edit ${row.name}`}
      values={{
        name: row.name,
        contactName: row.contactName ?? '',
        contactEmail: row.contactEmail,
        contactPhone: row.contactPhone ?? '',
        country: row.country ?? '',
        notes: row.notes ?? '',
      }}
      fields={[...CONTACT_FIELDS, { name: 'notes', label: 'Notes', kind: 'textarea' }]}
      onSubmit={(form) => save.mutateAsync({ ...contactBody(form), rowVersion: row.rowVersion })}
      onClose={onClose}
    />
  )
}

const STATUS_WORDS = {
  suspended: {
    title: 'Suspend',
    text: 'Its people are signed out at once and cannot sign in until you reactivate it. Nothing is deleted.',
  },
  cancelled: {
    title: 'Cancel',
    text: 'Its people are signed out at once and cannot sign in. Nothing is deleted.',
  },
  active: { title: 'Reactivate', text: 'Its people can sign in again.' },
} as const

export function StatusConfirm({
  row,
  status,
  onClose,
}: {
  row: Organisation
  status: OrganisationStatus
  onClose: () => void
}) {
  const words = STATUS_WORDS[status]
  const change = usePlatformMutation(
    () =>
      platformApi.patch(`organisations/${row.id}/status`, { status, rowVersion: row.rowVersion }),
    `${row.name}: ${status}`,
  )
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={`${words.title} ${row.name}?`}
      description={words.text}
      confirmLabel={words.title}
      variant={status === 'active' ? 'default' : 'destructive'}
      onConfirm={() => {
        change.mutate(undefined)
        onClose()
      }}
    />
  )
}

export function OrganisationsPage() {
  const role = usePlatformStore((state) => state.staff?.role)
  const list = useListState()
  const result = usePlatformList<Organisation>('organisations', {
    page: list.page,
    pageSize: list.pageSize,
    q: list.q || undefined,
    status: list.filter,
  })
  const [registering, setRegistering] = useState(false)
  const [editing, setEditing] = useState<Organisation | null>(null)
  const [changing, setChanging] = useState<StatusChange | null>(null)

  const columns: DataTableColumn<Organisation>[] = [
    {
      id: 'name',
      header: 'Organisation',
      mobile: 'heading',
      cell: (row) => (
        <Link
          to="/platform/organisations/$id"
          params={{ id: row.id }}
          className="font-medium text-title hover:underline"
        >
          {row.name}
        </Link>
      ),
    },
    { id: 'contact', header: 'Contact', cell: (row) => row.contactName ?? row.contactEmail },
    { id: 'plan', header: 'Plan', cell: (row) => row.planName ?? '—' },
    {
      id: 'subscription',
      header: 'Subscription',
      cell: (row) => <StatusChip value={row.subscriptionStatus} />,
    },
    { id: 'employees', header: 'Employees', cell: (row) => row.employeeCount },
    { id: 'status', header: 'Status', cell: (row) => <StatusChip value={row.status} /> },
    { id: 'registered', header: 'Registered', cell: (row) => formatDate(row.createdAt) },
  ]

  return (
    <>
      <ListPage
        title="Organisations"
        description="Everyone who uses hRango. Head counts only: no HR data shows here."
        actions={
          canRegister(role) && (
            <Button
              onClick={() => {
                setRegistering(true)
              }}
            >
              <Plus /> Register organisation
            </Button>
          )
        }
        caption="All organisations"
        columns={columns}
        result={result}
        list={list}
        search="Name or email"
        filter={{
          label: 'Status',
          options: optionsOf(['active', 'suspended', 'cancelled']),
        }}
        getRowId={(row) => row.id}
        {...(canRegister(role)
          ? {
              rowActions: (row: Organisation) => (
                <RowActionsMenu
                  label={`Actions for ${row.name}`}
                  actions={[
                    {
                      label: 'Edit',
                      icon: Pencil,
                      onSelect: () => {
                        setEditing(row)
                      },
                    },
                    ...(isAdmin(role) ? statusActions(row, setChanging) : []),
                  ]}
                />
              ),
            }
          : {})}
        emptyText="No organisations found."
      />
      {registering && (
        <RegisterDialog
          onClose={() => {
            setRegistering(false)
          }}
        />
      )}
      {editing && (
        <EditOrganisationDialog
          row={editing}
          onClose={() => {
            setEditing(null)
          }}
        />
      )}
      {changing && (
        <StatusConfirm
          {...changing}
          onClose={() => {
            setChanging(null)
          }}
        />
      )}
    </>
  )
}
