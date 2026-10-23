import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { ErrorState } from '@/components/feedback/error-state'
import { DataTable, type DataTableColumn } from '@/components/layout'
import { Checkbox } from '@/components/ui/checkbox'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { cn } from '@/lib/utils'

import { DEFAULT_PAGE_SIZE } from '../../constants'
import { useBudgetDurations, useDeleteDuration, useSaveDuration } from '../../hooks/use-manpower'
import { durationFormSchema, type DurationFormValues } from '../../schemas/dialog-forms.schema'
import type { BudgetDuration } from '../../types/manpower.types'
import { showSaveError, toastError } from '../../utils/errors'
import { formatDay } from '../../utils/format'
import { StampCell } from '../shared/cells'
import { DateBox, MpField, MpListFooter, SearchBox, ShowEntries } from '../shared/controls'
import {
  AddIcon,
  CheckIcon,
  DeleteIcon,
  DeletePlanIcon,
  EditUnderlineIcon,
} from '../shared/mp-icons'
import {
  accent,
  dialogBoxClass,
  dialogButton,
  headerButton,
  mpTableClass,
} from '../shared/mp-styles'
import { CardBody, MpCard } from '../shared/page-shell'
import { ConfirmPopup, MpDialog } from '../shared/popups'
import { SettingsTabs } from './settings-tabs'

/** The flag's name as the design writes it ("Bduget" corrected). */
const CURRENT_LABEL = 'IsCurrentBudgetDurationPeriod'

const iconButton =
  'inline-flex size-8 items-center justify-center rounded-md outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-[#7469E8]/35'

/** Add Budget Duration (and Edit, laid out the same). */
function DurationDialog({
  duration,
  onClose,
}: {
  duration: BudgetDuration | null
  onClose: () => void
}) {
  const save = useSaveDuration()
  const form = useForm<DurationFormValues>({
    resolver: zodResolver(durationFormSchema),
    defaultValues: duration
      ? {
          name: duration.name,
          startDate: duration.startDate,
          endDate: duration.endDate,
          isCurrent: duration.isCurrent,
        }
      : { name: '', startDate: '', endDate: '', isCurrent: false },
  })
  const { control, register, handleSubmit, formState, setError } = form
  const submit = handleSubmit((values) => {
    save.mutate(
      { id: duration?.id, input: { ...values, name: values.name.trim() } },
      {
        onSuccess: onClose,
        onError: (error) => {
          showSaveError(
            error,
            setError,
            ['name', 'startDate', 'endDate'],
            'The budget duration could not be saved.',
          )
        },
      },
    )
  })
  return (
    <MpDialog title={duration ? 'Edit Budget Duration' : 'Add Budget Duration'} onClose={onClose}>
      <form noValidate onSubmit={(event) => void submit(event)} className="grid gap-6">
        <MpField
          label="Enter Budget Duration"
          required
          layout="inline"
          error={formState.errors.name?.message}
        >
          {(a11y) => (
            <input
              {...a11y}
              {...register('name')}
              placeholder="2024"
              className={cn(dialogBoxClass, 'w-full')}
            />
          )}
        </MpField>
        <Controller
          control={control}
          name="startDate"
          render={({ field, fieldState }) => (
            <MpField label="Select Start Date" layout="inline" error={fieldState.error?.message}>
              {(a11y) => (
                <DateBox
                  {...a11y}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="1 Jan 2024"
                  className={dialogBoxClass}
                />
              )}
            </MpField>
          )}
        />
        <Controller
          control={control}
          name="endDate"
          render={({ field, fieldState }) => (
            <MpField label="Select End Date" layout="inline" error={fieldState.error?.message}>
              {(a11y) => (
                <DateBox
                  {...a11y}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="30 Jan 2024"
                  className={dialogBoxClass}
                />
              )}
            </MpField>
          )}
        />
        <Controller
          control={control}
          name="isCurrent"
          render={({ field }) => (
            <label className="flex items-center gap-3.5 text-sm font-medium text-heading">
              <Checkbox
                checked={field.value}
                onCheckedChange={(checked) => {
                  field.onChange(checked === true)
                }}
                className="size-[1.0625rem] rounded-[2px] border-[#7469E8] data-[state=checked]:border-[#7469E8] data-[state=checked]:bg-[#7469E8]"
              />
              {CURRENT_LABEL}
            </label>
          )}
        />
        <button
          type="submit"
          disabled={save.isPending}
          className={cn(dialogButton, accent.bg, 'mt-6 w-[11.5625rem] justify-self-center')}
        >
          {duration ? 'Save Duration' : 'Add Duration'}
        </button>
      </form>
    </MpDialog>
  )
}

/** E-Budget Settings → Budget Duration: the plan years, one of them current. */
export function BudgetDurationsTab({
  page,
  goTo,
  filtersOpen,
}: {
  page: number
  goTo: (page: number) => void
  filtersOpen: boolean
}) {
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search.trim())
  const [dialog, setDialog] = useState<{ duration: BudgetDuration | null } | null>(null)
  const [deleting, setDeleting] = useState<BudgetDuration | null>(null)
  const remove = useDeleteDuration()
  const list = useBudgetDurations({ page, pageSize, search: debounced })
  const offset = (page - 1) * pageSize

  const columns: DataTableColumn<BudgetDuration>[] = [
    { id: 'sr', header: 'Sr#', cell: (_row, index) => offset + index + 1 },
    { id: 'name', header: 'Budget Duration', mobile: 'heading', cell: (row) => row.name },
    { id: 'start', header: 'Start Date', cell: (row) => formatDay(row.startDate) },
    { id: 'end', header: 'End Date', cell: (row) => formatDay(row.endDate) },
    { id: 'added', header: 'Added On', cell: (row) => <StampCell stamp={row.added} /> },
    {
      id: 'current',
      header: CURRENT_LABEL,
      align: 'center',
      cell: (row) =>
        row.isCurrent ? (
          <span className={cn('inline-flex pt-1', accent.text)}>
            <CheckIcon aria-hidden="true" className="h-3.5 w-[1.1875rem]" />
            <span className="sr-only">Current</span>
          </span>
        ) : (
          <span className="sr-only">No</span>
        ),
    },
  ]

  return (
    <MpCard
      title="Employee Budget Settings"
      actions={
        filtersOpen ? undefined : (
          <button
            type="button"
            onClick={() => {
              setDialog({ duration: null })
            }}
            className={cn(headerButton, accent.bg, 'min-w-[12.75rem]')}
          >
            <AddIcon aria-hidden="true" className="size-[0.8125rem]" />
            Add Budget Duration
          </button>
        )
      }
    >
      {filtersOpen && (
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <ShowEntries
            value={pageSize}
            onChange={(size) => {
              setPageSize(size)
              goTo(1)
            }}
          />
          <div className="flex flex-wrap items-center gap-3.5">
            <button
              type="button"
              onClick={() => {
                setDialog({ duration: null })
              }}
              className={cn(headerButton, accent.bg, 'min-w-[12.75rem]')}
            >
              <AddIcon aria-hidden="true" className="size-[0.8125rem]" />
              Add Budget Duration
            </button>
            <SearchBox
              label="Search budget durations"
              value={search}
              onChange={(value) => {
                setSearch(value)
                goTo(1)
              }}
            />
          </div>
        </CardBody>
      )}
      <div className="grid gap-0">
        <SettingsTabs current="budget-duration" />
        {list.isError ? (
          <ErrorState
            message="The budget durations could not be loaded."
            onRetry={() => void list.refetch()}
            className="mx-4 shadow-none sm:mx-6"
          />
        ) : (
          <DataTable
            columns={columns}
            data={list.data?.data ?? []}
            getRowId={(row) => row.id}
            caption="Budget durations"
            isLoading={list.isPending}
            isFetching={list.isFetching}
            className={cn(mpTableClass, '[&_td]:py-5')}
            emptyState={
              debounced ? 'No budget duration matches your search.' : 'No budget durations yet.'
            }
            rowActionsHeader="Action"
            rowActions={(row) => (
              <span className="inline-flex gap-3">
                <button
                  type="button"
                  aria-label={`Edit ${row.name}`}
                  onClick={() => {
                    setDialog({ duration: row })
                  }}
                  className={cn(iconButton, 'text-[#0081F9]')}
                >
                  <EditUnderlineIcon className="h-[1.32rem] w-[1.25rem]" />
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${row.name}`}
                  onClick={() => {
                    setDeleting(row)
                  }}
                  className={cn(iconButton, 'text-[#C2420B]')}
                >
                  <DeleteIcon className="h-[1.055rem] w-[0.9375rem]" />
                </button>
              </span>
            )}
          />
        )}
      </div>
      <MpListFooter meta={list.data?.meta} disabled={list.isFetching} onPageChange={goTo} />

      {dialog && (
        <DurationDialog
          duration={dialog.duration}
          onClose={() => {
            setDialog(null)
          }}
        />
      )}
      <ConfirmPopup
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title="Delete Budget Duration"
        icon={DeletePlanIcon}
        message="Are you sure you want to Delete this budget duration?"
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleting) {
            remove.mutate(deleting.id, {
              onError: toastError('The budget duration could not be deleted.'),
            })
          }
        }}
      />
    </MpCard>
  )
}
