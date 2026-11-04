import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Pencil, Plus } from 'lucide-react'

import { type DataTableColumn, RowActionsMenu } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { toDateValue } from '@/lib/date'

import { platformApi, type Subscription } from '../api/platform.api'
import { blank, formatDate, formatMoney, optionsOf } from '../format'
import {
  useListState,
  useOrganisationOptions,
  usePlanOptions,
  usePlatformList,
  usePlatformMutation,
} from '../hooks/use-platform'
import { ListPage, RecordDialog, StatusChip } from './shared'

const STATUSES = ['trial', 'active', 'past_due', 'cancelled']

function SubscriptionDialog({ row, onClose }: { row: Subscription | null; onClose: () => void }) {
  const organisations = useOrganisationOptions()
  const plans = usePlanOptions()
  const save = usePlatformMutation(
    (body: object) =>
      row
        ? platformApi.update(`subscriptions/${row.id}`, body)
        : platformApi.create('subscriptions', body),
    'Subscription saved',
  )
  return (
    <RecordDialog
      title={row ? `Change ${row.customerName}’s subscription` : 'Add subscription'}
      values={{
        customerId: row?.customerId ?? '',
        planId: row?.planId ?? '',
        billingCycle: row?.billingCycle ?? 'monthly',
        status: row?.status ?? 'active',
        amount: row ? String(row.amount) : '',
        startDate: row?.startDate ?? toDateValue(new Date()),
        renewsOn: row?.renewsOn ?? '',
      }}
      fields={[
        {
          name: 'customerId',
          label: 'Organisation',
          kind: 'select',
          options: organisations,
          required: true,
        },
        { name: 'planId', label: 'Plan', kind: 'select', options: plans, required: true },
        {
          name: 'billingCycle',
          label: 'Billing cycle',
          kind: 'select',
          options: optionsOf(['monthly', 'annual']),
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
          name: 'amount',
          label: 'Amount per cycle (PKR)',
          kind: 'number',
          description: 'Leave empty to use the plan’s price.',
        },
        { name: 'startDate', label: 'Start date', kind: 'date', required: true },
        { name: 'renewsOn', label: 'Renews on', kind: 'date' },
      ]}
      onSubmit={(form) =>
        save.mutateAsync({
          customerId: Number(form.customerId),
          planId: Number(form.planId),
          billingCycle: form.billingCycle,
          status: form.status,
          amount: form.amount ? Number(form.amount) : null,
          startDate: form.startDate,
          renewsOn: blank(form.renewsOn),
          rowVersion: row?.rowVersion ?? null,
        })
      }
      onClose={onClose}
    />
  )
}

export function SubscriptionsPage() {
  const list = useListState()
  const result = usePlatformList<Subscription>('subscriptions', {
    page: list.page,
    pageSize: list.pageSize,
    q: list.q || undefined,
    status: list.filter,
  })
  const [editing, setEditing] = useState<Subscription | 'new' | null>(null)

  const columns: DataTableColumn<Subscription>[] = [
    {
      id: 'organisation',
      header: 'Organisation',
      mobile: 'heading',
      cell: (row) => (
        <Link
          to="/platform/organisations/$id"
          params={{ id: row.customerId }}
          className="font-medium text-title hover:underline"
        >
          {row.customerName}
        </Link>
      ),
    },
    { id: 'plan', header: 'Plan', cell: (row) => row.planName },
    { id: 'cycle', header: 'Cycle', cell: (row) => optionsOf([row.billingCycle])[0]?.label },
    { id: 'amount', header: 'Amount', cell: (row) => formatMoney(row.amount) },
    { id: 'status', header: 'Status', cell: (row) => <StatusChip value={row.status} /> },
    { id: 'started', header: 'Started', cell: (row) => formatDate(row.startDate) },
    { id: 'renews', header: 'Renews', cell: (row) => formatDate(row.renewsOn) },
  ]

  return (
    <>
      <ListPage
        title="Subscriptions"
        description="Which plan each organisation is on. Amounts are in PKR."
        actions={
          <Button
            onClick={() => {
              setEditing('new')
            }}
          >
            <Plus /> Add subscription
          </Button>
        }
        caption="All subscriptions"
        columns={columns}
        result={result}
        list={list}
        search="Organisation"
        filter={{ label: 'Status', options: optionsOf(STATUSES) }}
        getRowId={(row) => row.id}
        rowActions={(row) => (
          <RowActionsMenu
            label={`Actions for ${row.customerName}`}
            actions={[
              {
                label: 'Change',
                icon: Pencil,
                onSelect: () => {
                  setEditing(row)
                },
              },
            ]}
          />
        )}
        emptyText="No subscriptions found."
      />
      {editing && (
        <SubscriptionDialog
          row={editing === 'new' ? null : editing}
          onClose={() => {
            setEditing(null)
          }}
        />
      )}
    </>
  )
}
