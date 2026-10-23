import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Filter } from 'lucide-react'
import { z } from 'zod'

import { TextField } from '@/components/form'
import type { DataTableColumn } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { ACCOUNT_CATEGORY_LABELS } from '../../constants'
import { useDeleteResource, useResourceList, useSaveResource } from '../../hooks/use-payroll'
import { ACCOUNT_CATEGORIES, type AccountType } from '../../types/payroll.types'
import type { FilterValues } from '../../utils/filters'
import { btn } from '../../utils/styles'
import { FiltersDialog } from '../shared/filters-dialog'
import { PayrollDialog } from '../shared/payroll-dialog'
import { SearchSelectField } from '../shared/search-select'
import { CreateButton, DeleteConfirm, SettingsRowMenu } from './settings-common'
import { applyApiError, type DialogState } from './settings-helpers'
import { SettingsTable, ViewHeader } from './settings-list'
import { SETTINGS_PAGE_SIZE } from './settings-nav'

const LEAVE_TYPES = ['Sick Leave', 'Casual Leaves']

const schema = z
  .object({
    category: z.string().min(1, 'Choose the account category'),
    name: z.string().trim().max(80),
  })
  .refine((value) => value.category === '' || value.name.length > 0, {
    message: 'Choose the account type',
    path: ['name'],
  })
type Values = z.infer<typeof schema>

const categoryOptions = ACCOUNT_CATEGORIES.map((value) => ({
  value,
  label: ACCOUNT_CATEGORY_LABELS[value],
}))

/** "Account Type Create": the category, then what it is (a benefit, a leave type, a name). */
function AccountTypeDialog({
  state,
  onClose,
}: {
  state: Exclude<DialogState<AccountType>, null>
  onClose: () => void
}) {
  const record = state.mode === 'create' ? undefined : state.record
  const readOnly = state.mode === 'view'
  const save = useSaveResource('accountTypes')
  const benefits = useResourceList('benefits', { page: 1, pageSize: 100 })
  const [error, setError] = useState<string | null>(null)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { category: record?.category ?? '', name: record?.name ?? '' },
  })
  const category = useWatch({ control: form.control, name: 'category' })
  const benefitNames = [
    ...new Set(['Medical', ...(benefits.data?.data ?? []).map((item) => item.name)]),
  ]

  const submit = form.handleSubmit(async (values) => {
    setError(null)
    const picked = ACCOUNT_CATEGORIES.find((item) => item === values.category)
    if (!picked) return
    try {
      await save.mutateAsync({ id: record?.id, input: { category: picked, name: values.name } })
      onClose()
    } catch (failure) {
      setError(applyApiError(failure, form.setError, ['name', 'category']))
    }
  })

  return (
    <PayrollDialog
      title={state.mode === 'view' ? 'Account Type View' : 'Account Type Create'}
      onClose={onClose}
      formId="account-type-form"
      readOnly={readOnly}
      pending={save.isPending}
      error={error}
      className="max-w-3xl"
    >
      <form
        id="account-type-form"
        noValidate
        onSubmit={(event) => void submit(event)}
        className="grid gap-5"
      >
        <SearchSelectField
          control={form.control}
          name="category"
          label="Account Category"
          placeholder="Select Account Category"
          options={categoryOptions}
          disabled={readOnly}
          onValueChange={() => {
            form.setValue('name', '')
          }}
        />
        {category === 'benefit' && (
          <SearchSelectField
            control={form.control}
            name="name"
            label="Benefit"
            placeholder="Select Benefit"
            options={benefitNames.map((value) => ({ value, label: value }))}
            disabled={readOnly}
          />
        )}
        {category === 'leave-quotas' && (
          <SearchSelectField
            control={form.control}
            name="name"
            label="Benefit"
            placeholder="Select Leave Type"
            options={LEAVE_TYPES.map((value) => ({ value, label: value }))}
            disabled={readOnly}
          />
        )}
        {category === 'custom-pay-item' && (
          <TextField
            control={form.control}
            name="name"
            label="Name"
            placeholder="Enter name"
            disabled={readOnly}
          />
        )}
      </form>
    </PayrollDialog>
  )
}

const columns: DataTableColumn<AccountType>[] = [
  {
    id: 'category',
    header: 'Account Category',
    cell: (row) => ACCOUNT_CATEGORY_LABELS[row.category],
    mobile: 'heading',
  },
  { id: 'type', header: 'Account Type', cell: (row) => row.name },
]

/** Settings → Account Type: the accounts employee balances are kept in. */
export function AccountTypesView() {
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<FilterValues>({})
  const [filtering, setFiltering] = useState(false)
  const [dialog, setDialog] = useState<DialogState<AccountType>>(null)
  const [deleting, setDeleting] = useState<AccountType | null>(null)
  const list = useResourceList('accountTypes', {
    page,
    pageSize: SETTINGS_PAGE_SIZE,
    ...(filters.category ? { search: filters.category } : {}),
  })
  const remove = useDeleteResource('accountTypes')

  return (
    <>
      <ViewHeader
        tab="account-type"
        view={null}
        actions={
          <>
            <Button
              size="icon"
              aria-label={filters.category ? 'Filters (1 set)' : 'Filters'}
              onClick={() => {
                setFiltering(true)
              }}
              className={cn('size-9 rounded-[5px]', btn.navy)}
            >
              <Filter aria-hidden="true" className="size-4 fill-current" />
            </Button>
            <CreateButton
              onClick={() => {
                setDialog({ mode: 'create' })
              }}
            />
          </>
        }
      />
      <SettingsTable
        caption="Account Types"
        columns={columns}
        page={list.data}
        getRowId={(row) => row.id}
        isLoading={list.isPending}
        isFetching={list.isFetching}
        onPageChange={setPage}
        rowActions={(row) => (
          <SettingsRowMenu
            label={`Actions for ${row.name}`}
            onView={() => {
              setDialog({ mode: 'view', record: row })
            }}
            onDelete={() => {
              setDeleting(row)
            }}
          />
        )}
      />
      {filtering && (
        <FiltersDialog
          preset="account-types"
          fields={[
            {
              kind: 'select',
              key: 'category',
              label: 'Account Category',
              placeholder: 'Select Account Category',
              options: categoryOptions,
            },
          ]}
          value={filters}
          onApply={(next) => {
            setFilters(next)
            setPage(1)
          }}
          onClose={() => {
            setFiltering(false)
          }}
        />
      )}
      {dialog && (
        <AccountTypeDialog
          state={dialog}
          onClose={() => {
            setDialog(null)
          }}
        />
      )}
      <DeleteConfirm
        record={deleting}
        onClose={() => {
          setDeleting(null)
        }}
        remove={remove}
        idOf={(row) => row.id}
      />
    </>
  )
}
