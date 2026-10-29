import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { getRouteApi } from '@tanstack/react-router'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
import { SwitchField, TextField } from '@/components/form'
import {
  DataTable,
  type DataTableColumn,
  type RowAction,
  RowActionsMenu,
  rowMenuItemClass,
} from '@/components/layout'
import { Button } from '@/components/ui/button'
import { btn, PayrollCard, payrollTableClass, StatusChip, toolbarButton } from '@/features/payroll'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { RC_CODES, TONE } from '../../constants'
import {
  useDeleteRejectionReason,
  useRejectionReasons,
  useSaveRejectionReason,
} from '../../hooks/use-recruitment'
import type { SettingsSearch } from '../../routing'
import {
  rejectionReasonFormSchema,
  type RejectionReasonFormValues,
  toNumber,
} from '../../schemas/recruitment-forms.schema'
import type { RejectionReason } from '../../types/recruitment.types'
import { showServerErrors } from '../../utils/form-errors'
import { FormDialog } from '../shared/dialog-parts'
import { FilterBar, FilterField, ListError, SearchBox } from '../shared/list-parts'

const routeApi = getRouteApi('/_app/recruitment/settings')

const ACTIVE = { label: 'Active', className: TONE.green }
const INACTIVE = { label: 'Inactive', className: TONE.grey }

function ReasonDialog({
  reason,
  nextOrder,
  onClose,
}: {
  reason: RejectionReason | undefined
  nextOrder: number
  onClose: () => void
}) {
  const save = useSaveRejectionReason()
  const form = useForm<RejectionReasonFormValues>({
    resolver: zodResolver(rejectionReasonFormSchema),
    defaultValues: {
      name: reason?.name ?? '',
      isActive: reason?.isActive ?? true,
      sortOrder: String(reason?.sortOrder ?? nextOrder),
    },
  })
  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({
        id: reason?.id,
        input: {
          name: values.name.trim(),
          isActive: values.isActive,
          sortOrder: toNumber(values.sortOrder),
          ...(reason ? { rowVersion: reason.rowVersion } : {}),
        },
      })
      onClose()
    } catch (error) {
      showServerErrors(error, form.setError, ['name', 'isActive', 'sortOrder'])
    }
  })
  return (
    <FormDialog
      title={reason ? 'Edit Rejection Reason' : 'New Rejection Reason'}
      description="Recruiters pick it when they reject an application."
      onClose={onClose}
      onSubmit={submit}
      saving={save.isPending}
      rootError={form.formState.errors.root?.message}
      className="max-w-xl"
    >
      <TextField control={form.control} name="name" label="Reason" required maxLength={200} />
      <TextField
        control={form.control}
        name="sortOrder"
        label="Order in the list"
        inputMode="numeric"
      />
      <SwitchField
        control={form.control}
        name="isActive"
        label="Active"
        stateLabel={(checked) => (checked ? 'Offered when rejecting' : 'Hidden when rejecting')}
      />
    </FormDialog>
  )
}

/**
 * Recruitment Settings → Rejection Reasons: the reasons a rejection names, in their order, with
 * whether they are offered (active) and how many rejections use them. New, Edit, switch on / off
 * and Delete (only when unused; a used one is switched off instead).
 */
export function RejectionReasonsPage() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const canCreate = useCan(RC_CODES.reasonsCreate)
  const canEdit = useCan(RC_CODES.reasonsEdit)
  const canDelete = useCan(RC_CODES.reasonsDelete)
  const list = useRejectionReasons({ q: search.q })
  const save = useSaveRejectionReason()
  const remove = useDeleteRejectionReason()
  const [deleting, setDeleting] = useState<RejectionReason | null>(null)
  const update = (patch: Partial<SettingsSearch>) => {
    void navigate({ search: (prev) => ({ ...prev, ...patch }) })
  }
  const rows = list.data ?? []
  const editing = search.edit ? rows.find((row) => row.id === search.edit) : undefined
  const nextOrder = rows.reduce((max, row) => Math.max(max, row.sortOrder), 0) + 1

  const actionsFor = (reason: RejectionReason): RowAction[] => [
    ...(canEdit
      ? [
          {
            label: 'Edit',
            onSelect: () => {
              update({ edit: reason.id })
            },
          },
          {
            label: reason.isActive ? 'Switch Off' : 'Switch On',
            onSelect: () => {
              save.mutate(
                {
                  id: reason.id,
                  input: {
                    name: reason.name,
                    isActive: !reason.isActive,
                    sortOrder: reason.sortOrder,
                    rowVersion: reason.rowVersion,
                  },
                },
                {
                  onError: (error) => {
                    toast.error(error.message)
                  },
                },
              )
            },
          },
        ]
      : []),
    ...(canDelete && reason.usageCount === 0
      ? [
          {
            label: 'Delete',
            variant: 'destructive' as const,
            onSelect: () => {
              setDeleting(reason)
            },
          },
        ]
      : []),
  ]

  const columns: DataTableColumn<RejectionReason>[] = [
    { id: 'order', header: 'Order', className: 'w-20', cell: (row) => row.sortOrder },
    {
      id: 'name',
      header: 'Reason',
      mobile: 'heading',
      className: 'min-w-48 whitespace-normal',
      cell: (row) => row.name,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <StatusChip {...(row.isActive ? ACTIVE : INACTIVE)} />,
    },
    {
      id: 'used',
      header: 'Used By',
      align: 'center',
      cell: (row) => `${String(row.usageCount)} rejection${row.usageCount === 1 ? '' : 's'}`,
    },
  ]

  return (
    <PayrollCard
      title="Recruitment Settings"
      actions={
        canCreate && (
          <Button
            onClick={() => {
              update({ dialog: 'create', edit: undefined })
            }}
            className={cn(toolbarButton, btn.navy)}
          >
            + New Reason
          </Button>
        )
      }
    >
      <div className="grid gap-1">
        <h2 className="text-base font-medium text-heading">Rejection Reasons</h2>
        <p className="text-sm text-muted-foreground">
          The reasons a recruiter chooses from when rejecting an application. Inactive ones stay on
          past rejections but are not offered.
        </p>
      </div>
      <FilterBar
        label="Filter rejection reasons"
        active={search.q ? 1 : 0}
        onClear={() => {
          update({ q: undefined })
        }}
      >
        <FilterField label="Search" className="@4xl:col-span-2">
          {(id) => (
            <SearchBox
              key={search.q ?? ''}
              id={id}
              value={search.q}
              label="Search rejection reasons"
              placeholder="Reason"
              onSearch={(q) => {
                update({ q })
              }}
            />
          )}
        </FilterField>
      </FilterBar>
      {list.isError ? (
        <ListError
          error={list.error}
          what="rejection reasons"
          onRetry={() => void list.refetch()}
        />
      ) : (
        <div className="relative min-w-0 overflow-x-auto">
          <DataTable
            columns={columns}
            data={rows}
            getRowId={(row) => row.id}
            caption="Rejection reasons"
            isLoading={list.isPending}
            isFetching={list.isFetching}
            className={payrollTableClass}
            emptyState={
              search.q
                ? 'No reason matches the search.'
                : 'No rejection reasons yet. New Reason adds one.'
            }
            rowActionsHeader="Actions"
            rowActions={(row) => {
              const items = actionsFor(row)
              return items.length > 0 ? (
                <RowActionsMenu
                  label={`Actions for ${row.name}`}
                  itemClassName={rowMenuItemClass.inter}
                  actions={items}
                />
              ) : null
            }}
          />
        </div>
      )}

      {(search.dialog === 'create' || (search.edit && editing)) && (
        <ReasonDialog
          reason={editing}
          nextOrder={nextOrder}
          onClose={() => {
            update({ dialog: undefined, edit: undefined })
          }}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title="Delete rejection reason"
        description={`Delete “${deleting?.name ?? ''}”? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          if (deleting) remove.mutate(deleting)
          setDeleting(null)
        }}
      />
    </PayrollCard>
  )
}
