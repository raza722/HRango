import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { toast } from 'sonner'

import {
  DataTable,
  type DataTableColumn,
  RowActionsMenu,
  rowMenuItemClass,
} from '@/components/layout'
import { Button } from '@/components/ui/button'
import {
  activeCount,
  btn,
  ConfirmAction,
  type FilterField,
  FiltersButton,
  FiltersDialog,
  ListFooter,
  NoRecord,
  PayrollCard,
  payrollTableClass,
  toolbarButton,
  useFilters,
} from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { OFFBOARDING_PAGE_SIZE } from '../../constants'
import { useChecklists, useDeleteChecklist } from '../../hooks/use-offboarding'
import type { OffboardingChecklist } from '../../types/offboarding.types'
import { ChecklistDialog } from './checklist-dialog'

const routeApi = getRouteApi('/_app/settings/off-boarding/checklist')

type Dialog =
  | { type: 'create' | 'filters' }
  | { type: 'edit' | 'view' | 'delete'; row: OffboardingChecklist }
  | null

const columns: DataTableColumn<OffboardingChecklist>[] = [
  { id: 'code', header: 'Code', cell: (row) => row.code },
  { id: 'name', header: 'Name', mobile: 'heading', cell: (row) => row.name },
]

const fields: FilterField[] = [
  { kind: 'text', key: 'q', label: 'Search', placeholder: 'Name or code' },
  {
    kind: 'select',
    key: 'status',
    label: 'Status',
    placeholder: 'Select Status',
    options: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Deactive' },
    ],
  },
]

/** Settings → Off Boarding Checklist: the checklists the End of Employment Checklist tab asks. */
export function OffBoardingChecklistPage() {
  const { page } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const [filters, setFilters] = useFilters('offboarding-checklist-v2')
  const canCreate = useCan('offboarding.settings.checklist.create')
  const canEdit = useCan('offboarding.settings.checklist.edit')
  const canDelete = useCan('offboarding.settings.checklist.delete')
  const [dialog, setDialog] = useState<Dialog>(null)
  const remove = useDeleteChecklist()
  const list = useChecklists({
    page,
    pageSize: OFFBOARDING_PAGE_SIZE,
    q: filters.q,
    isActive: filters.status ? filters.status === 'active' : undefined,
  })
  const goTo = (next: number) => {
    void navigate({ search: (prev) => ({ ...prev, page: next }) })
  }
  const close = () => {
    setDialog(null)
  }

  return (
    <PayrollCard
      title="Off Boarding Checklist"
      actions={
        <>
          {canCreate && (
            <Button
              onClick={() => {
                setDialog({ type: 'create' })
              }}
              className={cn(toolbarButton, btn.blue, 'min-w-24')}
            >
              Create
            </Button>
          )}
          <FiltersButton
            count={activeCount(filters)}
            onClick={() => {
              setDialog({ type: 'filters' })
            }}
          />
        </>
      }
    >
      <DataTable
        columns={columns}
        data={list.data?.data ?? []}
        getRowId={(row) => row.id}
        caption="Off boarding checklists"
        isLoading={list.isPending}
        isFetching={list.isFetching}
        // Figma: this list's cells are Poppins Regular 16 #000000.
        className={cn(payrollTableClass, '[&_td]:text-base [&_td]:text-heading')}
        emptyState={<NoRecord />}
        rowActions={(row) => (
          <RowActionsMenu
            itemClassName={rowMenuItemClass.inter}
            label={`Actions for ${row.code}, ${row.name}`}
            actions={[
              ...(canEdit
                ? [
                    {
                      label: 'Edit',
                      onSelect: () => {
                        setDialog({ type: 'edit', row })
                      },
                    },
                  ]
                : []),
              {
                label: 'View',
                onSelect: () => {
                  setDialog({ type: 'view', row })
                },
              },
              ...(canDelete
                ? [
                    {
                      label: 'Delete',
                      variant: 'destructive' as const,
                      onSelect: () => {
                        setDialog({ type: 'delete', row })
                      },
                    },
                  ]
                : []),
            ]}
          />
        )}
      />
      <ListFooter
        meta={list.data?.meta}
        noun="checklists"
        disabled={list.isFetching}
        onPageChange={goTo}
      />

      {dialog?.type === 'create' && <ChecklistDialog id={null} mode="create" onClose={close} />}
      {(dialog?.type === 'edit' || dialog?.type === 'view') && (
        <ChecklistDialog id={dialog.row.id} mode={dialog.type} onClose={close} />
      )}
      {dialog?.type === 'filters' && (
        <FiltersDialog
          fields={fields}
          value={filters}
          preset="offboarding-checklist-v2"
          onApply={(next) => {
            setFilters(next)
            goTo(1)
          }}
          onClose={close}
        />
      )}
      <ConfirmAction
        open={dialog?.type === 'delete'}
        onOpenChange={(open) => {
          if (!open) close()
        }}
        title="Delete checklist"
        message="Are you sure you want to Delete this?"
        onConfirm={() => {
          if (dialog?.type !== 'delete') return
          remove.mutate(dialog.row, {
            onError: (error) => {
              toast.error(
                error instanceof ApiError ? error.message : 'Could not delete the checklist.',
              )
            },
          })
        }}
      />
    </PayrollCard>
  )
}
