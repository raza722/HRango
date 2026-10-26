import { type ReactNode, useState } from 'react'

import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
import {
  type DataTableColumn,
  PaginatedTableCard,
  type RowAction,
  RowActionsMenu,
} from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { PAGE_SIZE_OPTIONS } from '@/lib/constants'
import { useCan } from '@/lib/permissions'

import { POLICY_NAME_LABELS, TIME_SPAN_TABLE_LABELS } from '../constants'
import { useWarningPolicies } from '../hooks/use-warning-policies'
import { useDeleteWarningPolicy } from '../hooks/use-warning-policy-mutations'
import { isPageSize, usePolicyTablePrefs } from '../store/policy-table-prefs.store'
import { useWarningViewPrefs, visibleColumns } from '../store/warning-view-prefs.store'
import type { WarningPolicy } from '../types/warning-policy.types'
import { warningType } from './type-styles'

interface PolicyTableProps {
  /** 1-based page from the URL. */
  page: number
  onPageChange: (page: number) => void
  /** Omit to leave "View" out of the row menu (the overview design shows Edit / Delete only). */
  onView?: (policy: WarningPolicy) => void
  onEdit: (policy: WarningPolicy) => void
  /** Fires as soon as a delete is confirmed (before the server answers). */
  onDelete?: (policy: WarningPolicy) => void
  /** Header buttons, e.g. "+ Add Form". */
  actions?: ReactNode
  /** Show the collapse chevron (state kept in the view preferences). */
  collapsible?: boolean
}

/**
 * "Warning Policy" list: paginated table with row actions. Columns follow the
 * user's Column Preferences.
 */
export function PolicyTable({
  page,
  onPageChange,
  onView,
  onEdit,
  onDelete,
  actions,
  collapsible = false,
}: PolicyTableProps) {
  const pageSize = usePolicyTablePrefs((state) => state.pageSize)
  const setPageSize = usePolicyTablePrefs((state) => state.setPageSize)
  const hidden = useWarningViewPrefs((state) => state.hiddenColumns.policy)
  const collapsed = useWarningViewPrefs((state) => state.collapsed.policy)
  const setCollapsed = useWarningViewPrefs((state) => state.setCollapsed)
  const query = useWarningPolicies({ page, pageSize })
  const deleteMutation = useDeleteWarningPolicy()
  const [pendingDelete, setPendingDelete] = useState<WarningPolicy | null>(null)
  const canEdit = useCan('warning.settings.policies.edit')
  const canDelete = useCan('warning.settings.policies.delete')

  const meta = query.data?.meta
  const offset = ((meta?.page ?? page) - 1) * (meta?.pageSize ?? pageSize)
  const columns: DataTableColumn<WarningPolicy>[] = [
    {
      id: 'sr',
      header: 'Sr#',
      cell: (_policy, index) => offset + index + 1,
      className: 'w-16 pl-4 sm:pl-5',
      mobile: 'hidden',
    },
    {
      id: 'policyName',
      header: 'Policy Name',
      align: 'center',
      cell: (policy) => POLICY_NAME_LABELS[policy.appliesTo],
    },
    {
      id: 'timeSpan',
      header: 'Time Span',
      align: 'center',
      cell: (policy) => TIME_SPAN_TABLE_LABELS[policy.period],
    },
    {
      id: 'title',
      header: 'Title of Warning Policy',
      align: 'center',
      // Card title on phones (wraps); one truncated line in the wide table.
      mobile: 'heading',
      cell: (policy) => (
        <span
          className="block break-words md:mx-auto md:max-w-[16rem] md:truncate"
          title={policy.title}
        >
          {policy.title}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      align: 'center',
      cell: (policy) => (
        <Badge variant={policy.isActive ? 'secondary' : 'outline'}>
          {policy.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ]

  const rowActions = (policy: WarningPolicy) => {
    const items: RowAction[] = [
      ...(onView
        ? [
            {
              label: 'View',
              onSelect: () => {
                onView(policy)
              },
            },
          ]
        : []),
      ...(canEdit
        ? [
            {
              label: 'Edit',
              onSelect: () => {
                onEdit(policy)
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
                setPendingDelete(policy)
              },
            },
          ]
        : []),
    ]
    if (items.length === 0) return null
    return (
      <RowActionsMenu
        actions={items}
        label={`Actions for ${policy.title}`}
        itemClassName={warningType.rowMenuItem}
      />
    )
  }

  return (
    <>
      <PaginatedTableCard
        title="Warning Policy"
        className={warningType.listCard}
        actions={actions}
        open={collapsible ? !collapsed : undefined}
        onOpenChange={(open) => {
          setCollapsed('policy', !open)
        }}
        caption="Warning policies"
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
        getRowId={(policy) => policy.id}
        rowActions={rowActions}
        emptyState="No warning policies yet. Use “Add Form” to create one."
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        title="Delete this policy?"
        description={
          pendingDelete
            ? pendingDelete.warningCount > 0
              ? `Warnings have been raised under “${pendingDelete.title}”, so it cannot be deleted. Make it inactive instead.`
              : `“${pendingDelete.title}” (${POLICY_NAME_LABELS[pendingDelete.appliesTo]}) and its penalties will be removed. This cannot be undone.`
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
