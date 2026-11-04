import { useState } from 'react'
import { Pencil, Plus } from 'lucide-react'

import { ErrorState } from '@/components/feedback/error-state'
import { DataTable, PageContainer, PageHeader, RowActionsMenu } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Widget } from '@/features/dashboard/components/widget'
import { usePlatformStore } from '@/stores/platform-store'

import { type Plan, platformApi } from '../api/platform.api'
import { blank, formatMoney, optionsOf } from '../format'
import { usePlatformGet, usePlatformMutation } from '../hooks/use-platform'
import { isAdmin } from '../platform-nav'
import { RecordDialog, StatusChip } from './shared'

function PlanDialog({ row, onClose }: { row: Plan | null; onClose: () => void }) {
  const save = usePlatformMutation(
    (body: object) =>
      row ? platformApi.update(`plans/${row.id}`, body) : platformApi.create('plans', body),
    'Plan saved',
  )
  return (
    <RecordDialog
      title={row ? `Edit ${row.name}` : 'Add plan'}
      values={{
        name: row?.name ?? '',
        description: row?.description ?? '',
        priceMonthly: row ? String(row.priceMonthly) : '',
        priceAnnual: row ? String(row.priceAnnual) : '',
        employeeLimit: row?.employeeLimit ? String(row.employeeLimit) : '',
        isActive: row?.isActive === false ? 'no' : 'yes',
      }}
      fields={[
        { name: 'name', label: 'Name', required: true },
        {
          name: 'isActive',
          label: 'Offered to new organisations',
          kind: 'select',
          options: optionsOf(['yes', 'no']),
          required: true,
        },
        { name: 'priceMonthly', label: 'Monthly price (PKR)', kind: 'number', required: true },
        { name: 'priceAnnual', label: 'Annual price (PKR)', kind: 'number', required: true },
        {
          name: 'employeeLimit',
          label: 'Employee limit',
          kind: 'number',
          description: 'Empty means no limit.',
        },
        { name: 'description', label: 'Description', kind: 'textarea' },
      ]}
      onSubmit={(form) =>
        save.mutateAsync({
          name: form.name,
          description: blank(form.description),
          priceMonthly: Number(form.priceMonthly),
          priceAnnual: Number(form.priceAnnual),
          employeeLimit: form.employeeLimit ? Number(form.employeeLimit) : null,
          isActive: form.isActive === 'yes',
          rowVersion: row?.rowVersion ?? null,
        })
      }
      onClose={onClose}
    />
  )
}

export function PlansPage() {
  const role = usePlatformStore((state) => state.staff?.role)
  const plans = usePlatformGet<Plan[]>('plans')
  const [editing, setEditing] = useState<Plan | 'new' | null>(null)

  return (
    <PageContainer>
      <PageHeader
        title="Plans"
        description="What organisations can buy."
        actions={
          isAdmin(role) && (
            <Button
              onClick={() => {
                setEditing('new')
              }}
            >
              <Plus /> Add plan
            </Button>
          )
        }
      />
      <Widget title="All plans">
        {plans.isError ? (
          <ErrorState
            message={plans.error.message}
            onRetry={() => {
              void plans.refetch()
            }}
            className="shadow-none"
          />
        ) : (
          <DataTable
            caption="All plans"
            data={plans.data ?? []}
            isLoading={plans.isPending}
            getRowId={(row) => row.id}
            emptyState={
              <p className="py-6 text-center text-sm text-muted-foreground">No plans yet.</p>
            }
            columns={[
              { id: 'name', header: 'Plan', mobile: 'heading', cell: (row) => row.name },
              { id: 'description', header: 'Includes', cell: (row) => row.description ?? '—' },
              { id: 'monthly', header: 'Monthly', cell: (row) => formatMoney(row.priceMonthly) },
              { id: 'annual', header: 'Annual', cell: (row) => formatMoney(row.priceAnnual) },
              {
                id: 'limit',
                header: 'Employees',
                cell: (row) => row.employeeLimit ?? 'No limit',
              },
              { id: 'count', header: 'Subscriptions', cell: (row) => row.subscriptionCount },
              {
                id: 'status',
                header: 'Status',
                cell: (row) => <StatusChip value={row.isActive ? 'active' : 'retired'} />,
              },
            ]}
            {...(isAdmin(role)
              ? {
                  rowActions: (row: Plan) => (
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
                      ]}
                    />
                  ),
                }
              : {})}
          />
        )}
      </Widget>
      {editing && (
        <PlanDialog
          row={editing === 'new' ? null : editing}
          onClose={() => {
            setEditing(null)
          }}
        />
      )}
    </PageContainer>
  )
}
