import { type ReactNode, useState } from 'react'

import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
import {
  DataTable,
  type DataTableColumn,
  Pagination,
  RowActionsMenu,
  rowMenuItemClass,
} from '@/components/layout'
import { activeCount, type FilterField, FiltersDialog, useFilters } from '@/features/payroll'
import { cn } from '@/lib/utils'
import type { Paginated } from '@/types/api'

import { REQUEST_PAGE_SIZE } from '../../../constants'
import { nowrap } from '../../standard-columns'
import {
  StandardCreateButton,
  StandardFilterButton,
  StandardPersonCell,
} from '../../standard-parts'
import { STANDARD_STATUS_META, standardTableClass } from '../../standard-styles'
import { useStandardLookups } from '../../use-standard'
import {
  useDeleteLoanSetting,
  useLoanCategories,
  useLoanRepayments,
  useLoanTypes,
  useSaveLoanCategory,
  useSaveLoanType,
} from './loan-advances.api'
import { categoryInput, listDay, pkrShort, typeInput } from './loan-advances.constants'
import type {
  LoanAdvanceLookups,
  LoanCategory,
  LoanRepayment,
  LoanType,
} from './loan-advances.types'
import {
  LoanCategoryDialog,
  LoanTypeDialog,
  type SettingsDialogMode,
} from './loan-advances-settings-dialogs'

interface SectionProps {
  /** The Types | Categories | Repayment pill. */
  pill: ReactNode
  page: number
  onPage: (page: number) => void
}

/** Settings chips: Poppins Medium 10, green for Active / Repaid as the Approved chip. */
function Chip({ tone, label }: { tone: 'completed' | 'rejected' | 'pending'; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex min-w-[4.25rem] items-center justify-center rounded-[3px] px-2.5 py-1 text-[0.625rem] leading-none font-medium whitespace-nowrap',
        STANDARD_STATUS_META[tone].className,
      )}
    >
      {label}
    </span>
  )
}

/** The title, Filter, + Create, the pill, "All (n)", then the list. */
function SettingsShell({
  pill,
  filterCount,
  onFilter,
  onCreate,
  total,
  children,
}: {
  pill: ReactNode
  filterCount: number
  onFilter: () => void
  onCreate?: () => void
  total: number | undefined
  children: ReactNode
}) {
  return (
    <div className="grid gap-4 px-4 pt-6 pb-5 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 id="loan-advances-heading" className="text-xl font-medium text-title">
          Loan &amp; Advances
        </h1>
        <div className="flex flex-wrap gap-2.5">
          <StandardFilterButton count={filterCount} onClick={onFilter} />
          {onCreate && <StandardCreateButton onClick={onCreate} />}
        </div>
      </div>
      <div>{pill}</div>
      {/* Drawn as a lone "All (8)" tab over each list. */}
      <p className="relative w-fit min-w-20 px-4 pb-2 text-sm font-medium text-sidebar dark:text-heading">
        All{total !== undefined && ` (${String(total)})`}
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-[2.5px] rounded-full bg-sidebar dark:bg-primary"
        />
      </p>
      {children}
    </div>
  )
}

function Pager<T>({
  page,
  disabled,
  onPage,
}: {
  page: Paginated<T> | undefined
  disabled: boolean
  onPage: (page: number) => void
}) {
  if (!page || page.meta.total === 0) return null
  return (
    <Pagination
      page={page.meta.page}
      totalPages={page.meta.totalPages}
      disabled={disabled}
      onPageChange={onPage}
      className="justify-end"
    />
  )
}

const STATUS_FILTER: FilterField = {
  kind: 'select',
  key: 'status',
  label: 'Status',
  placeholder: 'Select Status',
  options: [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ],
}

const NAME_FILTER: FilterField = { kind: 'text', key: 'name', label: 'Name', placeholder: 'Name' }

const nameCell = (name: string) => <span className="text-xs font-medium text-person">{name}</span>

type Dialog<T> =
  | { type: 'filters' }
  | { type: 'form'; mode: SettingsDialogMode; item: T | null }
  | { type: 'delete'; item: T }
  | null

/** Settings → Types (frame 4190:100688). */
export function LoanTypesSection({ pill, page, onPage }: SectionProps) {
  const [filters, setFilters] = useFilters('loan-advances-types')
  const [dialog, setDialog] = useState<Dialog<LoanType>>(null)
  const list = useLoanTypes({ page, pageSize: REQUEST_PAGE_SIZE, ...filters })
  const save = useSaveLoanType()
  const remove = useDeleteLoanSetting('types')
  const close = () => {
    setDialog(null)
  }

  const columns: DataTableColumn<LoanType>[] = [
    { id: 'name', header: 'Name', mobile: 'heading', cell: (row) => nameCell(row.name) },
    {
      id: 'experience',
      header: 'Employee Experience',
      cell: (row) => String(row.experienceMonths),
    },
    {
      id: 'gap',
      header: 'Gap Between Requests (In Months)',
      cell: (row) => (row.requestGapMonths === null ? '—' : String(row.requestGapMonths)),
    },
    {
      id: 'status',
      header: 'Status',
      align: 'center',
      cell: (row) =>
        row.active ? (
          <Chip tone="completed" label="Active" />
        ) : (
          <Chip tone="rejected" label="Inactive" />
        ),
    },
  ]

  return (
    <SettingsShell
      pill={pill}
      filterCount={activeCount(filters)}
      onFilter={() => {
        setDialog({ type: 'filters' })
      }}
      onCreate={() => {
        setDialog({ type: 'form', mode: 'create', item: null })
      }}
      total={list.data?.meta.total}
    >
      <DataTable
        columns={columns}
        data={list.data?.data ?? []}
        getRowId={(row) => row.id}
        caption="Loan & Advances Types"
        className={standardTableClass}
        isLoading={list.isPending}
        isFetching={list.isFetching}
        rowActionsHeader="Actions"
        emptyState={
          <p className="py-10 text-center text-sm text-grey">
            {activeCount(filters) > 0 ? 'No types match.' : 'No types yet.'}
          </p>
        }
        rowActions={(row) => (
          <RowActionsMenu
            label={`Actions for ${row.name}`}
            itemClassName={rowMenuItemClass.poppins}
            actions={[
              {
                label: 'View',
                onSelect: () => {
                  setDialog({ type: 'form', mode: 'view', item: row })
                },
              },
              {
                label: 'Edit',
                onSelect: () => {
                  setDialog({ type: 'form', mode: 'edit', item: row })
                },
              },
              {
                label: row.active ? 'Inactivate' : 'Activate',
                disabled: save.isPending,
                onSelect: () => {
                  save.mutate({ id: row.id, input: { ...typeInput(row), active: !row.active } })
                },
              },
              {
                label: 'Delete',
                variant: 'destructive',
                onSelect: () => {
                  setDialog({ type: 'delete', item: row })
                },
              },
            ]}
          />
        )}
      />
      <Pager page={list.data} disabled={list.isFetching} onPage={onPage} />

      {dialog?.type === 'form' && (
        <LoanTypeDialog mode={dialog.mode} type={dialog.item} onClose={close} />
      )}
      {dialog?.type === 'filters' && (
        <FiltersDialog
          fields={[NAME_FILTER, STATUS_FILTER]}
          value={filters}
          preset="loan-advances-types"
          onApply={(next) => {
            setFilters(next)
            onPage(1)
          }}
          onClose={close}
        />
      )}
      <ConfirmDialog
        open={dialog?.type === 'delete'}
        onOpenChange={(open) => {
          if (!open) close()
        }}
        title={dialog?.type === 'delete' ? `Delete ${dialog.item.name}` : 'Delete'}
        description="Are you sure you want to Delete this?"
        confirmLabel="Yes"
        cancelLabel="No"
        variant="destructive"
        onConfirm={() => {
          if (dialog?.type === 'delete') remove.mutate(dialog.item.id, { onSettled: close })
        }}
      />
    </SettingsShell>
  )
}

/** Settings → Categories (frame 4195:106914). */
export function LoanCategoriesSection({ pill, page, onPage }: SectionProps) {
  const [filters, setFilters] = useFilters('loan-advances-categories')
  const [dialog, setDialog] = useState<Dialog<LoanCategory>>(null)
  const list = useLoanCategories({ page, pageSize: REQUEST_PAGE_SIZE, ...filters })
  const save = useSaveLoanCategory()
  const remove = useDeleteLoanSetting('categories')
  const close = () => {
    setDialog(null)
  }

  const columns: DataTableColumn<LoanCategory>[] = [
    { id: 'name', header: 'Name', mobile: 'heading', cell: (row) => nameCell(row.name) },
    {
      id: 'description',
      header: 'Description',
      className: 'min-w-48 whitespace-normal',
      cell: (row) => row.description || '—',
    },
    {
      id: 'status',
      header: 'Status',
      align: 'center',
      cell: (row) =>
        row.active ? (
          <Chip tone="completed" label="Active" />
        ) : (
          <Chip tone="rejected" label="Inactive" />
        ),
    },
  ]

  return (
    <SettingsShell
      pill={pill}
      filterCount={activeCount(filters)}
      onFilter={() => {
        setDialog({ type: 'filters' })
      }}
      onCreate={() => {
        setDialog({ type: 'form', mode: 'create', item: null })
      }}
      total={list.data?.meta.total}
    >
      <DataTable
        columns={columns}
        data={list.data?.data ?? []}
        getRowId={(row) => row.id}
        caption="Loan & Advances Categories"
        className={standardTableClass}
        isLoading={list.isPending}
        isFetching={list.isFetching}
        rowActionsHeader="Actions"
        emptyState={
          <p className="py-10 text-center text-sm text-grey">
            {activeCount(filters) > 0 ? 'No categories match.' : 'No categories yet.'}
          </p>
        }
        rowActions={(row) => (
          <RowActionsMenu
            label={`Actions for ${row.name}`}
            itemClassName={rowMenuItemClass.poppins}
            actions={[
              {
                label: 'View',
                onSelect: () => {
                  setDialog({ type: 'form', mode: 'view', item: row })
                },
              },
              {
                label: 'Edit',
                onSelect: () => {
                  setDialog({ type: 'form', mode: 'edit', item: row })
                },
              },
              {
                label: row.active ? 'Inactivate' : 'Activate',
                disabled: save.isPending,
                onSelect: () => {
                  save.mutate({ id: row.id, input: { ...categoryInput(row), active: !row.active } })
                },
              },
              {
                label: 'Delete',
                variant: 'destructive',
                onSelect: () => {
                  setDialog({ type: 'delete', item: row })
                },
              },
            ]}
          />
        )}
      />
      <Pager page={list.data} disabled={list.isFetching} onPage={onPage} />

      {dialog?.type === 'form' && (
        <LoanCategoryDialog mode={dialog.mode} category={dialog.item} onClose={close} />
      )}
      {dialog?.type === 'filters' && (
        <FiltersDialog
          fields={[NAME_FILTER, STATUS_FILTER]}
          value={filters}
          preset="loan-advances-categories"
          onApply={(next) => {
            setFilters(next)
            onPage(1)
          }}
          onClose={close}
        />
      )}
      <ConfirmDialog
        open={dialog?.type === 'delete'}
        onOpenChange={(open) => {
          if (!open) close()
        }}
        title={dialog?.type === 'delete' ? `Delete ${dialog.item.name}` : 'Delete'}
        description="Are you sure you want to Delete this?"
        confirmLabel="Yes"
        cancelLabel="No"
        variant="destructive"
        onConfirm={() => {
          if (dialog?.type === 'delete') remove.mutate(dialog.item.id, { onSettled: close })
        }}
      />
    </SettingsShell>
  )
}

/**
 * Settings → Repayment (frame 4195:108102): every installment of the approved
 * loans, with its date and amount, and whether payroll has deducted it.
 */
export function LoanRepaymentSection({ pill, page, onPage }: SectionProps) {
  const [filters, setFilters] = useFilters('loan-advances-repayments')
  const [filtering, setFiltering] = useState(false)
  const lookups = useStandardLookups<LoanAdvanceLookups>('loan-advances')
  const list = useLoanRepayments({ page, pageSize: REQUEST_PAGE_SIZE, ...filters })

  const columns: DataTableColumn<LoanRepayment>[] = [
    { id: 'code', header: 'Code', mobile: 'heading', cell: (row) => nowrap(row.code) },
    {
      id: 'employee',
      header: 'Employees',
      className: 'min-w-36',
      cell: (row) => <StandardPersonCell person={row.employee} />,
    },
    {
      id: 'department',
      header: 'Department',
      className: 'min-w-24 whitespace-normal',
      cell: (row) => row.employee.department,
    },
    { id: 'type', header: 'Loan Type', cell: (row) => row.typeName },
    {
      id: 'approved',
      header: 'Approved Amount',
      cell: (row) => nowrap(pkrShort(row.approvedAmount)),
    },
    {
      id: 'installment',
      header: 'Installment',
      cell: (row) => nowrap(`${String(row.installment)} of ${String(row.installments)}`),
    },
    { id: 'date', header: 'Repayment Date', cell: (row) => listDay(row.date) },
    {
      id: 'amount',
      header: 'Repayment Amount',
      cell: (row) => nowrap(pkrShort(row.amount)),
    },
    { id: 'payitem', header: 'Deduction Payitem', cell: (row) => row.deductionPayitem ?? '—' },
    {
      id: 'status',
      header: 'Status',
      align: 'center',
      cell: (row) =>
        row.status === 'repaid' ? (
          <Chip tone="completed" label="Repaid" />
        ) : (
          <Chip tone="pending" label="Due" />
        ),
    },
  ]

  const fields: FilterField[] = [
    {
      kind: 'select',
      key: 'employeeId',
      label: 'Employees',
      placeholder: 'Select Employees',
      options: (lookups.data?.employees ?? []).map((person) => ({
        value: person.id,
        label: person.name,
        hint: person.code,
      })),
    },
    {
      kind: 'select',
      key: 'department',
      label: 'Department',
      placeholder: 'Select Department',
      options: (lookups.data?.departments ?? []).map((name) => ({ value: name, label: name })),
    },
    {
      kind: 'select',
      key: 'typeId',
      label: 'Advance Loan Type',
      placeholder: 'Select Advance Loan Type',
      options: (lookups.data?.extra.types ?? []).map((type) => ({
        value: type.id,
        label: type.name,
      })),
    },
    {
      kind: 'select',
      key: 'status',
      label: 'Status',
      placeholder: 'Select Status',
      options: [
        { value: 'repaid', label: 'Repaid' },
        { value: 'due', label: 'Due' },
      ],
    },
    { kind: 'text', key: 'code', label: 'Code', placeholder: 'Code' },
    { kind: 'date', key: 'from', label: 'From' },
    { kind: 'date', key: 'to', label: 'To' },
  ]

  return (
    <SettingsShell
      pill={pill}
      filterCount={activeCount(filters)}
      onFilter={() => {
        setFiltering(true)
      }}
      total={list.data?.meta.total}
    >
      <DataTable
        columns={columns}
        data={list.data?.data ?? []}
        getRowId={(row) => row.id}
        caption="Loan & Advances Repayment"
        className={standardTableClass}
        isLoading={list.isPending}
        isFetching={list.isFetching}
        emptyState={
          <p className="py-10 text-center text-sm text-grey">
            {activeCount(filters) > 0
              ? 'No repayments match.'
              : 'No repayments yet: they appear when a loan is approved.'}
          </p>
        }
      />
      <Pager page={list.data} disabled={list.isFetching} onPage={onPage} />
      {filtering && (
        <FiltersDialog
          fields={fields}
          value={filters}
          preset="loan-advances-repayments"
          onApply={(next) => {
            setFilters(next)
            onPage(1)
          }}
          onClose={() => {
            setFiltering(false)
          }}
        />
      )}
    </SettingsShell>
  )
}
