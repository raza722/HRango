import { useState } from 'react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
import { ErrorState } from '@/components/feedback/error-state'
import {
  DataTable,
  type DataTableColumn,
  RowActionsMenu,
  rowMenuItemClass,
} from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCan } from '@/lib/permissions'

import { useDeleteOvertimePolicy, useOvertimePolicies } from '../../hooks/use-overtime'
import { OVERTIME_POLICY_PERIODS, type OvertimePolicy } from '../../types/overtime.types'
import { createdLabel, OVERTIME_POLICY_PERIOD_LABELS } from '../../utils/overtime-format'
import { overtimeNavyButtonClass, policyTableClass } from '../../utils/overtime-styles'
import { FilterSelect } from '../shared/filter-select'
import type { OvertimeTabProps } from './overtime-page'
import {
  OvertimeEmpty,
  OvertimeFilterButton,
  OvertimeFilterPanel,
  OvertimeListFooter,
  OvertimeTitleRow,
} from './overtime-parts'
import { PolicyDialog, type PolicyDialogMode } from './policy-dialog'

const PAGE_SIZE = 10

type Dialog =
  | { type: 'policy'; mode: PolicyDialogMode; policy: OvertimePolicy | null }
  | { type: 'delete'; policy: OvertimePolicy }
  | null

const columns: DataTableColumn<OvertimePolicy>[] = [
  {
    id: 'name',
    header: 'Name',
    mobile: 'heading',
    cell: (row) => (
      <span className="flex flex-wrap items-center gap-2">
        {row.name}
        {!row.isActive && (
          <span className="rounded-[3px] bg-grey/15 px-2 py-0.5 text-[0.625rem] font-medium text-grey">
            Inactive
          </span>
        )}
      </span>
    ),
  },
  { id: 'type', header: 'Type', cell: (row) => OVERTIME_POLICY_PERIOD_LABELS[row.period] },
  {
    id: 'created',
    header: 'Created',
    cell: (row) => <span className="whitespace-nowrap">{createdLabel(row.createdAt)}</span>,
  },
]

/**
 * Overtime Policy (frames 4207:75070 … 4207:75672): the policies
 * (`GET /attendance/settings/overtime-policies?q&period&page&pageSize`) with Filter and
 * "+ Create"; Actions opens View, Edit and Delete (`DELETE …/{id}?rowVersion`; a refusal is
 * shown as the API words it). Buttons follow `attendance.settings.overtime_policies.*`.
 */
export function PolicyTab({ search, update }: OvertimeTabProps) {
  const [dialog, setDialog] = useState<Dialog>(null)
  const [filtersOpen, setFiltersOpen] = useState(Boolean(search.q))
  const [text, setText] = useState(search.q ?? '')
  const canCreate = useCan('attendance.settings.overtime_policies.create')
  const canEdit = useCan('attendance.settings.overtime_policies.edit')
  const canDelete = useCan('attendance.settings.overtime_policies.delete')
  const list = useOvertimePolicies({
    page: search.page,
    pageSize: PAGE_SIZE,
    ...(search.q ? { q: search.q } : {}),
    ...(search.period ? { period: search.period } : {}),
  })
  const remove = useDeleteOvertimePolicy()
  const meta = list.data?.meta
  const close = () => {
    setDialog(null)
  }

  return (
    <>
      <OvertimeTitleRow title="Overtime Policy" titleId="overtime-policy-title">
        <OvertimeFilterButton
          open={filtersOpen}
          onClick={() => {
            setFiltersOpen((value) => !value)
          }}
        />
        {canCreate && (
          <Button
            onClick={() => {
              setDialog({ type: 'policy', mode: 'create', policy: null })
            }}
            className={overtimeNavyButtonClass}
          >
            + Create
          </Button>
        )}
      </OvertimeTitleRow>

      {filtersOpen && (
        <OvertimeFilterPanel>
          <form
            className="grid gap-1.5"
            onSubmit={(event) => {
              event.preventDefault()
              update({ q: text.trim() || undefined })
            }}
          >
            <label htmlFor="overtime-policy-search" className="text-sm font-medium text-heading">
              Name
            </label>
            <Input
              id="overtime-policy-search"
              type="search"
              placeholder="Search policies"
              value={text}
              onChange={(event) => {
                setText(event.target.value)
              }}
              onBlur={() => {
                update({ q: text.trim() || undefined })
              }}
            />
          </form>
          <FilterSelect
            label="Type"
            showLabel
            allLabel="All types"
            options={OVERTIME_POLICY_PERIODS.map((item) => ({
              value: item,
              label: OVERTIME_POLICY_PERIOD_LABELS[item],
            }))}
            value={search.period}
            onChange={(picked) => {
              update({ period: OVERTIME_POLICY_PERIODS.find((item) => item === picked) })
            }}
          />
        </OvertimeFilterPanel>
      )}

      {list.isError ? (
        <ErrorState
          title="Could not load the overtime policies"
          message={list.error.message}
          onRetry={() => void list.refetch()}
          className="shadow-none"
        />
      ) : (
        <DataTable
          columns={columns}
          data={list.data?.data ?? []}
          getRowId={(row) => row.id}
          caption="Overtime Policy"
          isLoading={list.isPending}
          isFetching={list.isFetching}
          className={policyTableClass}
          rowActionsHeader="Actions"
          emptyState={<OvertimeEmpty>No Record Found</OvertimeEmpty>}
          rowActions={(row) => (
            <RowActionsMenu
              label={`Actions for ${row.name}`}
              itemClassName={rowMenuItemClass.poppins}
              actions={[
                {
                  label: 'View',
                  onSelect: () => {
                    setDialog({ type: 'policy', mode: 'view', policy: row })
                  },
                },
                ...(canEdit
                  ? [
                      {
                        label: 'Edit',
                        onSelect: () => {
                          setDialog({ type: 'policy', mode: 'edit', policy: row })
                        },
                      },
                    ]
                  : []),
                ...(canDelete
                  ? [
                      {
                        label: 'Delete',
                        variant: 'destructive' as const,
                        onSelect: () => {
                          setDialog({ type: 'delete', policy: row })
                        },
                      },
                    ]
                  : []),
              ]}
            />
          )}
        />
      )}

      <OvertimeListFooter
        meta={meta}
        noun="policies"
        disabled={list.isFetching}
        onPageChange={(page) => {
          update({ page })
        }}
      />

      {dialog?.type === 'policy' && (
        <PolicyDialog mode={dialog.mode} policy={dialog.policy} onClose={close} />
      )}
      <ConfirmDialog
        open={dialog?.type === 'delete'}
        onOpenChange={(open) => {
          if (!open) close()
        }}
        title={dialog?.type === 'delete' ? `Delete ${dialog.policy.name}` : 'Delete'}
        description="Are you sure you want to Delete this?"
        confirmLabel="Yes"
        cancelLabel="No"
        variant="destructive"
        onConfirm={() => {
          if (dialog?.type === 'delete') {
            remove.mutate(
              { id: dialog.policy.id, rowVersion: dialog.policy.rowVersion },
              {
                onError: (failure) => {
                  toast.error(failure.message)
                },
              },
            )
          }
        }}
      />
    </>
  )
}
