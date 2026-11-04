import { useState } from 'react'
import { Building2, Pencil, Plus } from 'lucide-react'

import { type DataTableColumn, RowActionsMenu } from '@/components/layout'
import { Button } from '@/components/ui/button'

import { type Lead, platformApi } from '../api/platform.api'
import { blank, formatDate, formatMoney, labelOf, optionsOf } from '../format'
import {
  useListState,
  usePlatformList,
  usePlatformMutation,
  useStaffOptions,
} from '../hooks/use-platform'
import { RegisterDialog } from './organisations-page'
import { ListPage, RecordDialog, StatusChip } from './shared'

const STAGES = ['new', 'contacted', 'demo', 'proposal', 'won', 'lost']
const SOURCES = ['website', 'referral', 'event', 'outbound', 'other']

function LeadDialog({ row, onClose }: { row: Lead | null; onClose: () => void }) {
  const staff = useStaffOptions()
  const save = usePlatformMutation(
    (body: object) =>
      row ? platformApi.update(`leads/${row.id}`, body) : platformApi.create('leads', body),
    'Lead saved',
  )
  return (
    <RecordDialog
      title={row ? `Edit ${row.companyName}` : 'Add lead'}
      values={{
        companyName: row?.companyName ?? '',
        contactName: row?.contactName ?? '',
        contactEmail: row?.contactEmail ?? '',
        contactPhone: row?.contactPhone ?? '',
        source: row?.source ?? '',
        stage: row?.stage ?? 'new',
        employeeCount: row?.employeeCount ? String(row.employeeCount) : '',
        expectedMonthly: row?.expectedMonthly ? String(row.expectedMonthly) : '',
        nextFollowUp: row?.nextFollowUp ?? '',
        ownerStaffId: row?.ownerStaffId ?? '',
        notes: row?.notes ?? '',
      }}
      fields={[
        { name: 'companyName', label: 'Company', required: true },
        {
          name: 'stage',
          label: 'Stage',
          kind: 'select',
          options: optionsOf(STAGES),
          required: true,
        },
        { name: 'contactName', label: 'Contact name' },
        { name: 'contactEmail', label: 'Contact email', kind: 'email' },
        { name: 'contactPhone', label: 'Contact phone' },
        {
          name: 'source',
          label: 'Source',
          kind: 'select',
          options: optionsOf(SOURCES),
          clearable: true,
        },
        { name: 'employeeCount', label: 'Employees', kind: 'number' },
        { name: 'expectedMonthly', label: 'Expected a month (PKR)', kind: 'number' },
        { name: 'nextFollowUp', label: 'Next follow-up', kind: 'date' },
        {
          name: 'ownerStaffId',
          label: 'Owner',
          kind: 'select',
          options: staff,
          clearable: 'Nobody yet',
        },
        { name: 'notes', label: 'Notes', kind: 'textarea' },
      ]}
      onSubmit={(form) =>
        save.mutateAsync({
          companyName: form.companyName,
          contactName: blank(form.contactName),
          contactEmail: blank(form.contactEmail),
          contactPhone: blank(form.contactPhone),
          source: blank(form.source),
          stage: form.stage,
          employeeCount: form.employeeCount ? Number(form.employeeCount) : null,
          expectedMonthly: form.expectedMonthly ? Number(form.expectedMonthly) : null,
          nextFollowUp: blank(form.nextFollowUp),
          notes: blank(form.notes),
          ownerStaffId: form.ownerStaffId ? Number(form.ownerStaffId) : null,
          rowVersion: row?.rowVersion ?? null,
        })
      }
      onClose={onClose}
    />
  )
}

/** The pipeline. A lead that signs up becomes an organisation from here and closes as won. */
export function SalesPage() {
  const list = useListState()
  const result = usePlatformList<Lead>('leads', {
    page: list.page,
    pageSize: list.pageSize,
    q: list.q || undefined,
    stage: list.filter,
  })
  const [editing, setEditing] = useState<Lead | 'new' | null>(null)
  const [converting, setConverting] = useState<Lead | null>(null)

  const columns: DataTableColumn<Lead>[] = [
    {
      id: 'company',
      header: 'Company',
      mobile: 'heading',
      cell: (row) => <span className="font-medium text-title">{row.companyName}</span>,
    },
    { id: 'contact', header: 'Contact', cell: (row) => row.contactName ?? row.contactEmail ?? '—' },
    { id: 'source', header: 'Source', cell: (row) => (row.source ? labelOf(row.source) : '—') },
    { id: 'stage', header: 'Stage', cell: (row) => <StatusChip value={row.stage} /> },
    { id: 'employees', header: 'Employees', cell: (row) => row.employeeCount ?? '—' },
    {
      id: 'expected',
      header: 'Expected a month',
      cell: (row) => (row.expectedMonthly ? formatMoney(row.expectedMonthly) : '—'),
    },
    { id: 'follow', header: 'Follow-up', cell: (row) => formatDate(row.nextFollowUp) },
    { id: 'owner', header: 'Owner', cell: (row) => row.ownerName ?? '—' },
  ]

  return (
    <>
      <ListPage
        title="Sales"
        description="The pipeline, from first contact to a registered organisation."
        actions={
          <Button
            onClick={() => {
              setEditing('new')
            }}
          >
            <Plus /> Add lead
          </Button>
        }
        caption="All leads"
        columns={columns}
        result={result}
        list={list}
        search="Company or contact"
        filter={{ label: 'Stage', options: optionsOf(STAGES) }}
        getRowId={(row) => row.id}
        rowActions={(row) => (
          <RowActionsMenu
            label={`Actions for ${row.companyName}`}
            actions={[
              {
                label: 'Edit',
                icon: Pencil,
                onSelect: () => {
                  setEditing(row)
                },
              },
              ...(row.customerId || row.stage === 'lost'
                ? []
                : [
                    {
                      label: 'Register as organisation',
                      icon: Building2,
                      onSelect: () => {
                        setConverting(row)
                      },
                    },
                  ]),
            ]}
          />
        )}
        emptyText="No leads found."
      />
      {editing && (
        <LeadDialog
          row={editing === 'new' ? null : editing}
          onClose={() => {
            setEditing(null)
          }}
        />
      )}
      {converting && (
        <RegisterDialog
          leadId={converting.id}
          values={{
            name: converting.companyName,
            contactName: converting.contactName ?? '',
            contactEmail: converting.contactEmail ?? '',
            contactPhone: converting.contactPhone ?? '',
            ownerName: converting.contactName ?? '',
            ownerEmail: converting.contactEmail ?? '',
          }}
          onClose={() => {
            setConverting(null)
          }}
        />
      )}
    </>
  )
}
