import { type ReactNode, useId, useState } from 'react'
import { useController, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { getRouteApi } from '@tanstack/react-router'
import { z } from 'zod'

import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
import { CheckboxField, FormField, TextareaField, TextField } from '@/components/form'
import {
  DataTable,
  type DataTableColumn,
  Pagination,
  RowActionsMenu,
  rowMenuItemClass,
} from '@/components/layout'
import { Button } from '@/components/ui/button'
import { PayrollDialog, RsInput, SearchSelect, SearchSelectField } from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { REQUEST_PAGE_SIZE } from '../../../constants'
import { StandardCreateButton, StandardPill } from '../../standard-parts'
import type { StandardSearch } from '../../standard-search'
import {
  STANDARD_STATUS_META,
  standardButton,
  standardReadOnlyClass,
  standardTableClass,
} from '../../standard-styles'
import { money, parseAmount, toAmount } from './claims.utils'
import {
  useDeleteExpenseCategory,
  useExpenseCategories,
  useReimbursement,
  useReimbursementPayItems,
  useSaveExpenseCategory,
  useSaveReimbursement,
} from './expense.api'
import type { ExpenseCategory, ExpenseSettingsSection } from './expense.types'

const route = getRouteApi('/_app/requests/$type')

const SECTIONS: readonly { value: ExpenseSettingsSection; label: string }[] = [
  { value: 'categories', label: 'Expense Categories' },
  { value: 'reimbursement', label: 'Reimbursement' },
]

const sectionOf = (value: string | undefined): ExpenseSettingsSection =>
  SECTIONS.find((item) => item.value === value)?.value ?? 'categories'

function Chip({ active }: { active: boolean }) {
  const meta = STANDARD_STATUS_META[active ? 'completed' : 'rejected']
  return (
    <span
      className={cn(
        'inline-flex min-w-[4.25rem] items-center justify-center rounded-[3px] px-2.5 py-1 text-[0.625rem] leading-none font-medium whitespace-nowrap',
        meta.className,
      )}
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

function Shell({
  pill,
  action,
  children,
}: {
  pill: ReactNode
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="grid gap-4 px-4 pt-6 pb-5 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 id="expense-heading" className="text-xl font-medium text-title">
          Expense Settings
        </h1>
        {action}
      </div>
      <div>{pill}</div>
      {children}
    </div>
  )
}

const NoAccess = () => (
  <p className="py-10 text-center text-sm text-grey">You do not have access to these settings.</p>
)

// --- categories ----------------------------------------------------------------------------------

const categorySchema = z.object({
  name: z.string().trim().min(1, 'Enter the name').max(200, 'Keep it under 200 characters'),
  payItemId: z.string().nullable(),
  maxAmount: z.string().refine((value) => value.trim() === '' || (parseAmount(value) ?? 0) > 0, {
    message: 'Enter an amount above 0, or leave it empty',
  }),
  receiptRequired: z.boolean(),
  isActive: z.boolean(),
  description: z.string().trim().max(4000),
})
type CategoryValues = z.infer<typeof categorySchema>

type FormMode = 'create' | 'edit' | 'view'
const CATEGORY_TITLES: Record<FormMode, string> = {
  create: 'Expense Category Create',
  edit: 'Expense Category Edit',
  view: 'Expense Category View',
}

/** Name*, Reimbursement Pay Item, Max Amount Per Claim, Receipt Required, Active, Description. */
function CategoryDialog({
  mode,
  category,
  onClose,
}: {
  mode: FormMode
  category: ExpenseCategory | null
  onClose: () => void
}) {
  const formId = useId()
  const save = useSaveExpenseCategory()
  const payItems = useReimbursementPayItems()
  const readOnly = mode === 'view'
  const form = useForm<CategoryValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: category?.name ?? '',
      payItemId: category?.payItemId ?? null,
      maxAmount:
        category?.maxAmount === null || !category ? '' : String(toAmount(category.maxAmount)),
      receiptRequired: category?.receiptRequired ?? false,
      isActive: category?.isActive ?? true,
      description: category?.description ?? '',
    },
  })
  const maxAmount = useController({ control: form.control, name: 'maxAmount' })
  const options = [
    ...(payItems.data ?? []).map((item) => ({ value: item.id, label: item.name })),
    ...(category?.payItemId && !(payItems.data ?? []).some((item) => item.id === category.payItemId)
      ? [{ value: category.payItemId, label: category.payItemName ?? 'Pay item' }]
      : []),
  ]

  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({
        id: category?.id ?? null,
        input: {
          name: values.name.trim(),
          payItemId: values.payItemId,
          maxAmount: parseAmount(values.maxAmount),
          receiptRequired: values.receiptRequired,
          isActive: values.isActive,
          description: values.description.trim() || null,
          ...(category ? { rowVersion: category.rowVersion } : {}),
        },
      })
    } catch (failure) {
      if (failure instanceof ApiError) {
        let placed = false
        for (const [field, message] of Object.entries(failure.fieldErrors)) {
          if (field in values) {
            form.setError(field as keyof CategoryValues, { message })
            placed = true
          }
        }
        if (!placed) form.setError('root', { message: failure.message })
      }
      return
    }
    onClose()
  })

  return (
    <PayrollDialog
      title={CATEGORY_TITLES[mode]}
      onClose={onClose}
      formId={formId}
      readOnly={readOnly}
      pending={save.isPending}
      error={form.formState.errors.root?.message}
      className="max-w-2xl"
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event) => void submit(event)}
        className={cn('grid gap-5', readOnly && standardReadOnlyClass)}
      >
        <TextField
          control={form.control}
          name="name"
          label="Name"
          required
          maxLength={200}
          placeholder="Write here"
          disabled={readOnly}
        />
        <SearchSelectField
          control={form.control}
          name="payItemId"
          label="Reimbursement Pay Item"
          placeholder="Default expense pay item"
          clearable
          disabled={readOnly}
          options={options}
        />
        <FormField label="Max Amount Per Claim" error={maxAmount.fieldState.error?.message}>
          {(a11y) => (
            <RsInput
              {...a11y}
              value={maxAmount.field.value}
              onChange={maxAmount.field.onChange}
              disabled={readOnly}
            />
          )}
        </FormField>
        <CheckboxField
          control={form.control}
          name="receiptRequired"
          label="Receipt Required"
          disabled={readOnly}
        />
        <CheckboxField control={form.control} name="isActive" label="Active" disabled={readOnly} />
        <TextareaField
          control={form.control}
          name="description"
          label="Description"
          rows={3}
          maxLength={4000}
          placeholder="Write here"
          disabled={readOnly}
        />
      </form>
    </PayrollDialog>
  )
}

type Dialog =
  | { type: 'form'; mode: FormMode; item: ExpenseCategory | null }
  | { type: 'delete'; item: ExpenseCategory }
  | null

/** Request Settings → Expense Categories: the claim form's categories and their rules. */
function CategoriesSection({
  pill,
  page,
  onPage,
}: {
  pill: ReactNode
  page: number
  onPage: (page: number) => void
}) {
  const canView = useCan('requests.settings.expense_categories.view')
  const canCreate = useCan('requests.settings.expense_categories.create')
  const canEdit = useCan('requests.settings.expense_categories.edit')
  const canDelete = useCan('requests.settings.expense_categories.delete')
  const [dialog, setDialog] = useState<Dialog>(null)
  const list = useExpenseCategories({ page, pageSize: REQUEST_PAGE_SIZE })
  const save = useSaveExpenseCategory()
  const remove = useDeleteExpenseCategory()
  const close = () => {
    setDialog(null)
  }

  const columns: DataTableColumn<ExpenseCategory>[] = [
    {
      id: 'name',
      header: 'Name',
      mobile: 'heading',
      cell: (row) => <span className="text-xs font-medium text-person">{row.name}</span>,
    },
    {
      id: 'payItem',
      header: 'Pay Item',
      cell: (row) => row.payItemName ?? 'Default',
    },
    { id: 'max', header: 'Max Amount Per Claim', cell: (row) => money(row.maxAmount) },
    {
      id: 'receipt',
      header: 'Receipt Required',
      cell: (row) => (row.receiptRequired ? 'Yes' : 'No'),
    },
    {
      id: 'status',
      header: 'Status',
      align: 'center',
      cell: (row) => <Chip active={row.isActive} />,
    },
  ]

  if (!canView) {
    return (
      <Shell pill={pill}>
        <NoAccess />
      </Shell>
    )
  }
  const meta = list.data?.meta
  return (
    <Shell
      pill={pill}
      action={
        canCreate && (
          <StandardCreateButton
            onClick={() => {
              setDialog({ type: 'form', mode: 'create', item: null })
            }}
          />
        )
      }
    >
      <DataTable
        columns={columns}
        data={list.data?.data ?? []}
        getRowId={(row) => row.id}
        caption="Expense Categories"
        className={standardTableClass}
        isLoading={list.isPending}
        isFetching={list.isFetching}
        rowActionsHeader="Actions"
        emptyState={<p className="py-10 text-center text-sm text-grey">No categories yet.</p>}
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
              ...(canEdit
                ? [
                    {
                      label: 'Edit',
                      onSelect: () => {
                        setDialog({ type: 'form', mode: 'edit', item: row })
                      },
                    },
                    {
                      label: row.isActive ? 'Inactivate' : 'Activate',
                      disabled: save.isPending,
                      onSelect: () => {
                        save.mutate({
                          id: row.id,
                          input: {
                            name: row.name,
                            payItemId: row.payItemId,
                            maxAmount: toAmount(row.maxAmount),
                            receiptRequired: row.receiptRequired,
                            isActive: !row.isActive,
                            description: row.description,
                            rowVersion: row.rowVersion,
                          },
                        })
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
                        setDialog({ type: 'delete', item: row })
                      },
                    },
                  ]
                : []),
            ]}
          />
        )}
      />
      {meta && meta.total > 0 && (
        <Pagination
          page={meta.page}
          totalPages={meta.totalPages}
          disabled={list.isFetching}
          onPageChange={onPage}
          className="justify-end"
        />
      )}
      {dialog?.type === 'form' && (
        <CategoryDialog mode={dialog.mode} category={dialog.item} onClose={close} />
      )}
      <ConfirmDialog
        open={dialog?.type === 'delete'}
        onOpenChange={(open) => {
          if (!open) close()
        }}
        title={dialog?.type === 'delete' ? `Delete ${dialog.item.name}` : 'Delete'}
        description="Are you sure you want to Delete this? A category with claims cannot be deleted; switch it off instead."
        confirmLabel="Yes"
        cancelLabel="No"
        variant="destructive"
        onConfirm={() => {
          if (dialog?.type === 'delete') {
            remove.mutate(
              { id: dialog.item.id, rowVersion: dialog.item.rowVersion },
              { onSettled: close },
            )
          }
        }}
      />
    </Shell>
  )
}

// --- reimbursement -------------------------------------------------------------------------------

/** The pay items approved claims are paid under through payroll (opening balances). */
function ReimbursementSection({ pill }: { pill: ReactNode }) {
  const canView = useCan('requests.settings.reimbursement.view')
  const canEdit = useCan('requests.settings.reimbursement.edit')
  const setting = useReimbursement(canView)
  const payItems = useReimbursementPayItems()
  const save = useSaveReimbursement()
  const [draft, setDraft] = useState<{ expense: string | null; air: string | null } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const expenseId = useId()
  const airId = useId()

  if (!canView) {
    return (
      <Shell pill={pill}>
        <NoAccess />
      </Shell>
    )
  }
  const current = setting.data
  const value = draft ?? {
    expense: current?.expensePayItemId ?? null,
    air: current?.airTicketPayItemId ?? null,
  }
  const options = [...(payItems.data ?? []).map((item) => ({ value: item.id, label: item.name }))]
  for (const [id, name] of [
    [current?.expensePayItemId, current?.expensePayItemName],
    [current?.airTicketPayItemId, current?.airTicketPayItemName],
  ] as const) {
    if (id && !options.some((option) => option.value === id))
      options.push({ value: id, label: name ?? 'Pay item' })
  }
  const submit = async () => {
    setError(null)
    try {
      await save.mutateAsync({ expensePayItemId: value.expense, airTicketPayItemId: value.air })
      setDraft(null)
    } catch (failure) {
      if (failure instanceof ApiError) setError(failure.message)
    }
  }
  return (
    <Shell pill={pill}>
      <div className="grid max-w-2xl gap-5">
        <p className="text-sm text-grey">
          Approved expense and air ticket claims are paid through payroll as opening balances under
          these reimbursement pay items (a category may name its own).
        </p>
        <div className="grid gap-2 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-center">
          <label htmlFor={expenseId} className="font-inter text-sm text-heading">
            Expense Pay Item
          </label>
          <SearchSelect
            id={expenseId}
            value={value.expense}
            onChange={(next) => {
              setDraft({ ...value, expense: next })
            }}
            options={options}
            placeholder="Select"
            clearable
            disabled={!canEdit}
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-center">
          <label htmlFor={airId} className="font-inter text-sm text-heading">
            Air Ticket Pay Item
          </label>
          <SearchSelect
            id={airId}
            value={value.air}
            onChange={(next) => {
              setDraft({ ...value, air: next })
            }}
            options={options}
            placeholder="Select"
            clearable
            disabled={!canEdit}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {canEdit && (
          <div>
            <Button
              type="button"
              disabled={save.isPending || draft === null}
              onClick={() => void submit()}
              className={cn('h-10 min-w-24 rounded-[4px] px-5', standardButton.green)}
            >
              Save
            </Button>
          </div>
        )}
      </div>
    </Shell>
  )
}

/**
 * Expense → Settings: Expense Categories and Reimbursement in the pill. The
 * sub page is the URL's `section` (Categories is the default and is left out).
 */
export function ExpenseSettings() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const section = sectionOf(search.section)
  const go = (patch: Partial<StandardSearch>) => {
    void navigate({ search: (previous) => ({ ...previous, ...patch }) })
  }
  const pill = (
    <StandardPill
      label="Settings"
      items={SECTIONS}
      value={section}
      onChange={(next) => {
        go({ section: next === 'categories' ? undefined : next, page: 1 })
      }}
    />
  )
  if (section === 'reimbursement') return <ReimbursementSection pill={pill} />
  return (
    <CategoriesSection
      pill={pill}
      page={search.page}
      onPage={(page) => {
        go({ page })
      }}
    />
  )
}
