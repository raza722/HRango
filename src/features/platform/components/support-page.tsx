import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Pencil, Plus } from 'lucide-react'

import { type DataTableColumn, RowActionsMenu } from '@/components/layout'
import { Button } from '@/components/ui/button'

import { platformApi, type Ticket } from '../api/platform.api'
import { blank, formatDate, optionsOf } from '../format'
import {
  useListState,
  useOrganisationOptions,
  usePlatformList,
  usePlatformMutation,
  useStaffOptions,
} from '../hooks/use-platform'
import { ListPage, RecordDialog, StatusChip } from './shared'

const STATUSES = ['open', 'in_progress', 'resolved', 'closed']

function TicketDialog({ row, onClose }: { row: Ticket | null; onClose: () => void }) {
  const organisations = useOrganisationOptions()
  const staff = useStaffOptions()
  const save = usePlatformMutation(
    (body: object) =>
      row ? platformApi.update(`tickets/${row.id}`, body) : platformApi.create('tickets', body),
    'Ticket saved',
  )
  return (
    <RecordDialog
      title={row ? 'Edit ticket' : 'Add ticket'}
      values={{
        customerId: row?.customerId ?? '',
        subject: row?.subject ?? '',
        priority: row?.priority ?? 'normal',
        status: row?.status ?? 'open',
        assigneeStaffId: row?.assigneeStaffId ?? '',
        detail: row?.detail ?? '',
      }}
      fields={[
        {
          name: 'customerId',
          label: 'Organisation',
          kind: 'select',
          options: organisations,
          required: true,
        },
        { name: 'subject', label: 'Subject', required: true },
        {
          name: 'priority',
          label: 'Priority',
          kind: 'select',
          options: optionsOf(['low', 'normal', 'high', 'urgent']),
          required: true,
        },
        {
          name: 'status',
          label: 'Status',
          kind: 'select',
          options: optionsOf(STATUSES),
          required: true,
        },
        {
          name: 'assigneeStaffId',
          label: 'Assigned to',
          kind: 'select',
          options: staff,
          clearable: 'Nobody yet',
        },
        {
          name: 'detail',
          label: 'Detail',
          kind: 'textarea',
          description: 'Do not paste salaries, CNICs or other HR data here.',
        },
      ]}
      onSubmit={(form) =>
        save.mutateAsync({
          customerId: Number(form.customerId),
          subject: form.subject,
          priority: form.priority,
          status: form.status,
          assigneeStaffId: form.assigneeStaffId ? Number(form.assigneeStaffId) : null,
          detail: blank(form.detail),
          rowVersion: row?.rowVersion ?? null,
        })
      }
      onClose={onClose}
    />
  )
}

export function SupportPage() {
  const list = useListState()
  const result = usePlatformList<Ticket>('tickets', {
    page: list.page,
    pageSize: list.pageSize,
    q: list.q || undefined,
    status: list.filter,
  })
  const [editing, setEditing] = useState<Ticket | 'new' | null>(null)

  const columns: DataTableColumn<Ticket>[] = [
    {
      id: 'subject',
      header: 'Subject',
      mobile: 'heading',
      cell: (row) => <span className="font-medium text-title">{row.subject}</span>,
    },
    {
      id: 'organisation',
      header: 'Organisation',
      cell: (row) => (
        <Link
          to="/platform/organisations/$id"
          params={{ id: row.customerId }}
          className="hover:underline"
        >
          {row.customerName}
        </Link>
      ),
    },
    { id: 'priority', header: 'Priority', cell: (row) => <StatusChip value={row.priority} /> },
    { id: 'status', header: 'Status', cell: (row) => <StatusChip value={row.status} /> },
    { id: 'assigned', header: 'Assigned to', cell: (row) => row.assigneeName ?? '—' },
    { id: 'opened', header: 'Opened', cell: (row) => formatDate(row.createdAt) },
  ]

  return (
    <>
      <ListPage
        title="Support"
        description="Cases from organisations, most urgent first."
        actions={
          <Button
            onClick={() => {
              setEditing('new')
            }}
          >
            <Plus /> Add ticket
          </Button>
        }
        caption="All tickets"
        columns={columns}
        result={result}
        list={list}
        search="Subject or organisation"
        filter={{ label: 'Status', options: optionsOf(STATUSES) }}
        getRowId={(row) => row.id}
        rowActions={(row) => (
          <RowActionsMenu
            label={`Actions for ${row.subject}`}
            actions={[
              {
                label: 'Edit',
                icon: Pencil,
                onSelect: () => {
                  setEditing(row)
                },
              },
            ]}
          />
        )}
        emptyText="No tickets found."
      />
      {editing && (
        <TicketDialog
          row={editing === 'new' ? null : editing}
          onClose={() => {
            setEditing(null)
          }}
        />
      )}
    </>
  )
}
