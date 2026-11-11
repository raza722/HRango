import type { ReactNode } from 'react'
import { type Control, useForm } from 'react-hook-form'
import { AlertCircle, Search } from 'lucide-react'

import { AppDialog, dialogButtonClass } from '@/components/feedback/app-dialog'
import {
  DatePickerField,
  SelectField,
  type SelectOption,
  TextareaField,
  TextField,
} from '@/components/form'
import type { DataTableColumn, PaginatedResult } from '@/components/layout'
import { PageContainer, PageHeader, PaginatedTableCard } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Chip } from '@/features/access/components/shared/parts'
import { useSearchAsYouType } from '@/hooks/use-search-as-you-type'
import { ApiError } from '@/lib/api-error'

import { labelOf } from '../format'
import type { useListState } from '../hooks/use-platform'

const TONES: Record<string, 'green' | 'amber' | 'red' | 'grey' | 'violet'> = {
  active: 'green',
  paid: 'green',
  won: 'green',
  resolved: 'green',
  trial: 'violet',
  demo: 'violet',
  proposal: 'violet',
  in_progress: 'violet',
  contacted: 'violet',
  new: 'amber',
  open: 'amber',
  issued: 'amber',
  high: 'amber',
  past_due: 'red',
  overdue: 'red',
  suspended: 'red',
  urgent: 'red',
}

export function StatusChip({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground">—</span>
  return <Chip tone={TONES[value] ?? 'grey'}>{labelOf(value)}</Chip>
}

interface FieldSpec {
  name: string
  label: string
  kind?: 'text' | 'email' | 'password' | 'number' | 'textarea' | 'select' | 'date'
  options?: readonly SelectOption[]
  required?: boolean
  description?: string
  clearable?: boolean | string
}

export type FormValues = Record<string, string>

function Field({ spec, control }: { spec: FieldSpec; control: Control<FormValues> }) {
  const common = {
    control,
    name: spec.name,
    label: spec.label,
    required: spec.required ?? false,
    ...(spec.description ? { description: spec.description } : {}),
  }
  if (spec.kind === 'select') {
    return (
      <SelectField {...common} options={spec.options ?? []} clearable={spec.clearable ?? false} />
    )
  }
  if (spec.kind === 'date') return <DatePickerField {...common} />
  if (spec.kind === 'textarea') return <TextareaField {...common} className="@xl:col-span-2" />
  return <TextField {...common} type={spec.kind ?? 'text'} />
}

/** A form in a dialog, from a list of fields. Values are strings; the page turns them into a body. */
export function RecordDialog({
  title,
  description,
  fields,
  values,
  submitLabel = 'Save',
  onSubmit,
  onClose,
}: {
  title: string
  description?: string
  fields: readonly FieldSpec[]
  values?: Partial<FormValues>
  submitLabel?: string
  onSubmit: (values: FormValues) => Promise<unknown>
  onClose: () => void
}) {
  const form = useForm<FormValues>({
    defaultValues: Object.fromEntries(
      fields.map((field) => [field.name, values?.[field.name] ?? '']),
    ),
  })
  const serverError = form.formState.errors.root?.server?.message

  const submit = form.handleSubmit(async (formValues) => {
    const missing = fields.filter((field) => field.required && !formValues[field.name]?.trim())
    if (missing.length > 0) {
      missing.forEach((field) => {
        form.setError(field.name, { message: `Enter ${field.label.toLowerCase()}` })
      })
      return
    }
    try {
      await onSubmit(formValues)
      onClose()
    } catch (error) {
      if (error instanceof ApiError) {
        const known = Object.entries(error.fieldErrors).filter(([field]) =>
          fields.some((spec) => spec.name === field),
        )
        known.forEach(([field, message]) => {
          form.setError(field, { message })
        })
        if (known.length > 0) return
      }
      form.setError('root.server', {
        message: error instanceof Error ? error.message : 'Could not save. Please try again.',
      })
    }
  })

  return (
    <AppDialog
      title={title}
      {...(description ? { description } : {})}
      className="max-w-3xl"
      onRequestClose={onClose}
      footer={
        <>
          <Button variant="outline" className={dialogButtonClass} onClick={onClose}>
            Cancel
          </Button>
          <Button
            className={dialogButtonClass}
            disabled={form.formState.isSubmitting}
            onClick={() => void submit()}
          >
            {submitLabel}
          </Button>
        </>
      }
    >
      <form
        noValidate
        className="grid grid-cols-[minmax(0,1fr)] gap-4 @xl:grid-cols-2"
        onSubmit={(event) => {
          void submit(event)
        }}
      >
        {serverError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive @xl:col-span-2"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {serverError}
          </div>
        )}
        {fields.map((spec) => (
          <Field key={spec.name} spec={spec} control={form.control} />
        ))}
      </form>
    </AppDialog>
  )
}

const ALL = '__all__'

/** A list screen: title card, search, one filter, and the org app's paginated table. */
export function ListPage<T>({
  title,
  description,
  actions,
  caption,
  columns,
  result,
  list,
  search,
  filter,
  getRowId,
  rowActions,
  emptyText,
}: {
  title: string
  description: string
  actions?: ReactNode
  caption: string
  columns: readonly DataTableColumn<T>[]
  result: PaginatedResult<T>
  list: ReturnType<typeof useListState>
  search?: string
  filter?: { label: string; options: readonly SelectOption[] }
  getRowId: (row: T) => string
  rowActions?: (row: T) => ReactNode
  emptyText: string
}) {
  // Searches as you type (a pause after the last key); Enter searches at once.
  const textSearch = useSearchAsYouType({
    value: list.q || undefined,
    onSearch: (q) => {
      list.setSearch(q ?? '')
    },
  })
  return (
    <PageContainer>
      <PageHeader title={title} description={description} actions={actions} />
      <PaginatedTableCard
        title={caption}
        titleAs="h2"
        caption={caption}
        columns={columns}
        result={result}
        page={list.page}
        pageSize={list.pageSize}
        pageSizeOptions={[10, 25, 50]}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        getRowId={getRowId}
        {...(rowActions ? { rowActions } : {})}
        emptyState={<p className="py-8 text-center text-sm text-muted-foreground">{emptyText}</p>}
        toolbar={
          <>
            {search && (
              <form
                role="search"
                className="relative w-full max-w-xs"
                onSubmit={(event) => {
                  event.preventDefault()
                  textSearch.flush()
                }}
              >
                <Search
                  aria-hidden="true"
                  className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  aria-label={search}
                  placeholder={search}
                  {...textSearch.inputProps}
                  className="pl-9!"
                />
              </form>
            )}
            {filter && (
              <Select
                value={list.filter ?? ALL}
                onValueChange={(value) => {
                  list.setFilter(value === ALL ? undefined : value)
                }}
              >
                <SelectTrigger aria-label={filter.label} className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All</SelectItem>
                  {filter.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </>
        }
      />
    </PageContainer>
  )
}
