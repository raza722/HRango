import { type ReactNode, useState } from 'react'

import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
import {
  type DataTableColumn,
  PaginatedTableCard,
  type RowAction,
  RowActionsMenu,
} from '@/components/layout'
import { PAGE_SIZE_OPTIONS } from '@/lib/constants'

import { POLICY_NAME_LABELS } from '../../constants'
import { useDeleteWarningPenalty, useWarningPenalties } from '../../hooks/use-warning-penalties'
import {
  BADGE_COLOR_LABELS,
  BADGE_COLOR_VALUES,
  PENALTY_TYPE_LABELS,
  SCALE_TYPE_LABELS,
} from '../../penalty-constants'
import { isPageSize, usePolicyTablePrefs } from '../../store/policy-table-prefs.store'
import { useWarningViewPrefs, visibleColumns } from '../../store/warning-view-prefs.store'
import type { WarningPenalty } from '../../types/warning-penalty.types'
import { warningType } from '../type-styles'

interface PenaltyTableProps {
  page: number
  onPageChange: (page: number) => void
  onEdit: (penalty: WarningPenalty) => void
  /** Fires as soon as a delete is confirmed. */
  onDelete?: (penalty: WarningPenalty) => void
  actions?: ReactNode
  collapsible?: boolean
}

/** Penalty Type cell: the first rule's type with its badge colour, plus "+N" for more rules. */
function PenaltyTypeCell({ penalty }: { penalty: WarningPenalty }) {
  const [first, ...rest] = penalty.rules
  if (!first) return <span className="text-muted-foreground">—</span>
  return (
    <span className="inline-flex items-center gap-2 md:justify-center">
      <span
        aria-hidden="true"
        className="size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: BADGE_COLOR_VALUES[first.badgeColor] }}
      />
      <span>{PENALTY_TYPE_LABELS[first.penaltyType]}</span>
      <span className="sr-only">, {BADGE_COLOR_LABELS[first.badgeColor]} badge</span>
      {rest.length > 0 && (
        <span className="rounded-sm bg-secondary px-1.5 text-xs text-secondary-foreground">
          +{rest.length}
        </span>
      )}
    </span>
  )
}

/** "Penalty" list with Edit / Delete row actions, following Column Preferences. */
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
      // Phones: the policy name heads the card, the title follows as a line.
      mobile: 'heading',
      cell: (penalty) => POLICY_NAME_LABELS[penalty.policyName],
    },
    {
      id: 'scaleType',
      header: 'Type of Scale',
      align: 'center',
      cell: (penalty) => SCALE_TYPE_LABELS[penalty.scaleType],
    },
    {
      id: 'penaltyType',
      header: 'Penalty Type',
      align: 'center',
      cell: (penalty) => <PenaltyTypeCell penalty={penalty} />,
    },
  ]

  const rowActions = (penalty: WarningPenalty) => {
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
        label={`Actions for ${penalty.title}`}
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
        rowActions={rowActions}
        emptyState="No penalties yet. Use “Add Form” to create one."
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        title="Delete this penalty?"
        description={
          pendingDelete
            ? `“${pendingDelete.title}” (${POLICY_NAME_LABELS[pendingDelete.policyName]}) and its ${pendingDelete.rules.length} rule${pendingDelete.rules.length === 1 ? '' : 's'} will be removed. This cannot be undone.`
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
