import { type ReactNode, useState } from 'react'

import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
import {
  type DataTableColumn,
  PaginatedTableCard,
  type RowAction,
  RowActionsMenu,
} from '@/components/layout'
import { PAGE_SIZE_OPTIONS } from '@/lib/constants'
import { useCan } from '@/lib/permissions'

import { POLICY_NAME_LABELS } from '../../constants'
import { useDeleteWarningPenalty, useWarningPenalties } from '../../hooks/use-warning-penalties'
import {
  DEDUCTION_LABELS,
  ordinal,
  PENALTY_PERIOD_LABELS,
  penaltyLabel,
} from '../../penalty-constants'
import { isPageSize, usePolicyTablePrefs } from '../../store/policy-table-prefs.store'
import { useWarningViewPrefs, visibleColumns } from '../../store/warning-view-prefs.store'
import type { WarningPenalty } from '../../types/warning-penalty.types'
import { warningType } from '../type-styles'

interface PenaltyTableProps {
  page: number
  onPageChange: (page: number) => void
  /** Opens the penalty's policy in the penalty form. */
  onEdit: (penalty: WarningPenalty) => void
  /** Fires as soon as a delete is confirmed. */
  onDelete?: (penalty: WarningPenalty) => void
  actions?: ReactNode
  collapsible?: boolean
}

/**
 * "Penalty" list: every penalty rule with its policy (`GET /warning/penalties`). Edit opens the
 * policy's penalties; Delete saves the policy's penalties without this one.
 */
export function PenaltyTable({
  page,
  onPageChange,
  onEdit,
  onDelete,
  actions,
  collapsible = false,
}: PenaltyTableProps) {
  const pageSize = usePolicyTablePrefs((state) => state.pageSize)
  const setPageSize = usePolicyTablePrefs((state) => state.setPageSize)
  const hidden = useWarningViewPrefs((state) => state.hiddenColumns.penalty)
  const collapsed = useWarningViewPrefs((state) => state.collapsed.penalty)
  const setCollapsed = useWarningViewPrefs((state) => state.setCollapsed)
  const query = useWarningPenalties({ page, pageSize })
  const deleteMutation = useDeleteWarningPenalty()
  const [pendingDelete, setPendingDelete] = useState<WarningPenalty | null>(null)
  const canEdit = useCan('warning.settings.penalties.edit')

  const meta = query.data?.meta
  const offset = ((meta?.page ?? page) - 1) * (meta?.pageSize ?? pageSize)
  const columns: DataTableColumn<WarningPenalty>[] = [
    {
      id: 'sr',
      header: 'Sr#',
      cell: (_penalty, index) => offset + index + 1,
      className: 'w-16 pl-4 sm:pl-5',
      mobile: 'hidden',
    },
    {
      id: 'policyName',
      header: 'Policy Name',
      align: 'center',
      // Phones: the policy heads the card.
      mobile: 'heading',
      cell: (penalty) => (
        <span
          className="block break-words md:mx-auto md:max-w-[14rem] md:truncate"
          title={penalty.policyTitle}
        >
          {penalty.policyTitle}
          <span className="sr-only md:not-sr-only md:block md:text-xs md:text-muted-foreground">
            {' '}
            ({POLICY_NAME_LABELS[penalty.appliesTo]})
          </span>
        </span>
      ),
    },
    {
      id: 'rule',
      header: 'Warning Count',
      align: 'center',
      cell: (penalty) =>
        `${ordinal(penalty.afterCount)} / ${PENALTY_PERIOD_LABELS[penalty.period]}`,
    },
    {
      id: 'penaltyType',
      header: 'Penalty Type',
      align: 'center',
      cell: (penalty) => penaltyLabel(penalty),
    },
    {
      id: 'deduction',
      header: 'Deduction',
      align: 'center',
      cell: (penalty) =>
        `${DEDUCTION_LABELS[penalty.deduction]}${penalty.leaveTypeTitle ? ` (${penalty.leaveTypeTitle})` : ''}`,
    },
  ]

  const rowActions = (penalty: WarningPenalty) => {
    if (!canEdit) return null
    const items: RowAction[] = [
      {
        label: 'Edit',
        onSelect: () => {
          onEdit(penalty)
        },
      },
      {
        label: 'Delete',
        variant: 'destructive',
        onSelect: () => {
          setPendingDelete(penalty)
        },
      },
    ]
    return (
      <RowActionsMenu
        actions={items}
        label={`Actions for ${penalty.policyTitle} penalty ${penalty.afterCount}`}
        itemClassName={warningType.rowMenuItem}
      />
    )
  }

  return (
    <>
      <PaginatedTableCard
        title="Penalty"
        className={warningType.listCard}
        actions={actions}
        open={collapsible ? !collapsed : undefined}
        onOpenChange={(open) => {
          setCollapsed('penalty', !open)
        }}
        caption="Penalties"
        columns={visibleColumns(columns, hidden)}
        result={query}
        page={page}
        pageSize={pageSize}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        onPageChange={onPageChange}
        onPageSizeChange={(next) => {
          if (!isPageSize(next)) return
          setPageSize(next)
          onPageChange(1)
        }}
        getRowId={(penalty) => penalty.id}
        rowActions={canEdit ? rowActions : undefined}
        emptyState="No penalties yet. Use “Add Form” to set a policy's penalties."
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        title="Delete this penalty?"
        description={
          pendingDelete
            ? `The ${ordinal(pendingDelete.afterCount)} warning in a ${PENALTY_PERIOD_LABELS[pendingDelete.period].toLowerCase()} of “${pendingDelete.policyTitle}” will no longer cost ${penaltyLabel(pendingDelete).toLowerCase()}. Warnings already raised keep their penalty.`
            : ''
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          if (!pendingDelete) return
          onDelete?.(pendingDelete)
          deleteMutation.mutate(pendingDelete)
          setPendingDelete(null)
        }}
      />
    </>
  )
}
