import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'

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
import { cn } from '@/lib/utils'

import { OFFBOARDING_PAGE_SIZE } from '../../constants'
import { useChecklists } from '../../hooks/use-offboarding'
import type { OffboardingChecklist } from '../../types/offboarding.types'
import { ChecklistDialog } from './checklist-dialog'

const routeApi = getRouteApi('/_app/settings/off-boarding/checklist')

type Dialog =
  { type: 'create' | 'filters' } | { type: 'edit' | 'view'; row: OffboardingChecklist } | null

const columns: DataTableColumn<OffboardingChecklist>[] = [
  { id: 'code', header: 'Code', cell: (row) => row.code },
  { id: 'name', header: 'Name', mobile: 'heading', cell: (row) => row.name },
]

const fields: FilterField[] = [
  { kind: 'text', key: 'name', label: 'Name' },
  { kind: 'text', key: 'code', label: 'Code' },
]

/** Settings → Off Boarding Checklist: the checklists the End of Employment Checklist tab asks. */
export function OffBoardingChecklistPage() {
  const { page } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const [filters, setFilters] = useFilters('offboarding-checklist')
  const [dialog, setDialog] = useState<Dialog>(null)
  const list = useChecklists({
    page,
    pageSize: OFFBOARDING_PAGE_SIZE,
    name: filters.name,
    code: filters.code,
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
          <Button
            onClick={() => {
              setDialog({ type: 'create' })
            }}
            className={cn(toolbarButton, btn.blue, 'min-w-24')}
          >
            Create
          </Button>
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
              {
                label: 'Edit',
                onSelect: () => {
                  setDialog({ type: 'edit', row })
                },
              },
              {
                label: 'View',
                onSelect: () => {
                  setDialog({ type: 'view', row })
                },
              },
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
          preset="offboarding-checklist"
          onApply={(next) => {
            setFilters(next)
            goTo(1)
          }}
          onClose={close}
        />
      )}
    </PayrollCard>
  )
}
