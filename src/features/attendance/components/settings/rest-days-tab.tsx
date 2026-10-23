import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { format, parse } from 'date-fns'
import { toast } from 'sonner'

import { AppDialog } from '@/components/feedback/app-dialog'
import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
import {
  type DataTableColumn,
  EmployeeAvatar,
  RowActionsMenu,
  rowMenuItemClass,
} from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { RestDayDialog } from '@/features/scheduling'
import { toDateValue } from '@/lib/date'
import { cn } from '@/lib/utils'

import { attendanceKeys } from '../../api/attendance.api'
import {
  useDeleteRestDayBatch,
  useDeleteRestDayRange,
  useRestDayBatch,
  useRestDays,
} from '../../hooks/use-attendance-settings'
import type { RestDayRow } from '../../types/settings.types'
import {
  poppinsDialogTitleClass,
  poppinsFieldsClass,
  settingsDialogButtonClass,
  stepDialogButtonClass,
  toolbarButtonClass,
} from '../../utils/settings-styles'
import { ReadOnlyField } from '../shared/attendance-dialog'
import { DateBox } from '../shared/date-box'
import { SettingsListCard } from './settings-list'

const longDate = (date: string) => format(parse(date, 'yyyy-MM-dd', new Date()), 'MMMM d, yyyy')
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

/** "Rest Day View": the batch's rule and people, with Delete. */
function RestDayView({ batchId, onClose }: { batchId: string; onClose: () => void }) {
  const batch = useRestDayBatch(batchId)
  const remove = useDeleteRestDayBatch()
  const [confirming, setConfirming] = useState(false)
  const data = batch.data
  return (
    <>
      <AppDialog
        title="Rest Day View"
        onRequestClose={onClose}
        className={cn('max-w-4xl', poppinsFieldsClass)}
        titleClassName={poppinsDialogTitleClass}
        footer={
          <>
            <Button
              variant="outline"
              size="lg"
              onClick={onClose}
              className={cn(settingsDialogButtonClass, 'text-sidebar dark:text-heading')}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="lg"
              disabled={!data || remove.isPending}
              onClick={() => {
                setConfirming(true)
              }}
              className={settingsDialogButtonClass}
            >
              Delete
            </Button>
          </>
        }
      >
        {!data ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div className="grid gap-6 @2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <div className="grid content-start gap-4">
              <ReadOnlyField label="Start Date" value={longDate(data.startDate)} />
              <ReadOnlyField
                label="Repeat"
                value={
                  data.repeat.everyWeeks === 1
                    ? 'Every Week'
                    : `Every ${data.repeat.everyWeeks} Week`
                }
              />
              <ReadOnlyField label="Step" value={String(data.repeat.step)} />
              <div className="grid grid-cols-2 gap-3">
                <ReadOnlyField label="From" value={longDate(data.repeat.from)} />
                <ReadOnlyField label="To" value={longDate(data.repeat.to)} />
              </div>
              <fieldset className="grid gap-2">
                <legend className="mb-2 text-sm text-title">Select Day</legend>
                <div className="grid grid-cols-4 gap-2">
                  {DAYS.map((day) => (
                    <span
                      key={day}
                      className={cn(
                        'flex h-8 items-center justify-center rounded-sm text-[0.8125rem] uppercase',
                        data.repeat.weekdays.includes(day)
                          ? 'bg-sidebar text-white dark:bg-primary'
                          : 'bg-muted text-grey',
                      )}
                    >
                      {day}
                    </span>
                  ))}
                </div>
              </fieldset>
              <p className="text-sm text-title">
                Is Rest Day Payable?{' '}
                <span className="font-medium text-title">{data.payable ? 'Yes' : 'No'}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {data.dates.length} day{data.dates.length === 1 ? '' : 's'}:{' '}
                {data.dates
                  .map((date) => format(parse(date, 'yyyy-MM-dd', new Date()), 'd MMM'))
                  .join(', ')}
              </p>
            </div>
            <section aria-label="Selected Employees" className="grid content-start gap-3">
              <h3 className="text-lg font-medium text-[#202020] dark:text-heading">
                Selected Employees
              </h3>
              <ul className="grid gap-2 @md:grid-cols-2">
                {data.employees.map((employee) => (
                  <li
                    key={employee.id}
                    className="flex items-center gap-2.5 rounded-md bg-muted px-3 py-2"
                  >
                    <EmployeeAvatar name={employee.name} className="size-8" />
                    <span className="min-w-0">
                      <span className="block truncate text-[0.6875rem] font-medium text-[#202020] dark:text-heading">
                        {employee.name}
                      </span>
                      <span className="block truncate text-[0.5625rem] text-grey">
                        ({employee.code}) {employee.designation}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </AppDialog>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Delete rest days"
        description="Are you sure you want to Delete this? The people get their roster's shifts back on these days."
        confirmLabel="Yes"
        cancelLabel="No"
        variant="destructive"
        onConfirm={() => {
          remove.mutate(batchId, {
            onSuccess: onClose,
            onError: () => {
              toast.error('Could not delete the rest days.')
            },
          })
        }}
      />
    </>
  )
}

/** The red Delete: rest days given by Create New Rest Day between two dates. */
function DeleteRangeDialog({ onClose }: { onClose: () => void }) {
  const remove = useDeleteRestDayRange()
  const today = toDateValue(new Date())
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [confirming, setConfirming] = useState(false)
  return (
    <>
      <AppDialog
        title="Delete Rest Days"
        description="Rest days given with Create New Rest Day in this range are removed; roster weekends stay."
        onRequestClose={onClose}
        className={cn('max-w-lg', poppinsFieldsClass)}
        titleClassName={poppinsDialogTitleClass}
        footer={
          <>
            <Button
              variant="outline"
              size="lg"
              onClick={onClose}
              className={cn(stepDialogButtonClass, 'text-sidebar dark:text-heading')}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="lg"
              disabled={to < from || remove.isPending}
              onClick={() => {
                setConfirming(true)
              }}
              className={stepDialogButtonClass}
            >
              Delete
            </Button>
          </>
        }
      >
        <div className="grid gap-4 @md:grid-cols-2">
          <DateBox
            label="From"
            variant="form"
            value={from}
            onChange={(value) => {
              setFrom(value)
              if (to < value) setTo(value)
            }}
          />
          <DateBox
            label="To"
            variant="form"
            value={to}
            minDate={parse(from, 'yyyy-MM-dd', new Date())}
            onChange={setTo}
          />
        </div>
      </AppDialog>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Delete rest days"
        description="Are you sure you want to Delete this?"
        confirmLabel="Yes"
        cancelLabel="No"
        variant="destructive"
        onConfirm={() => {
          remove.mutate({ from, to }, { onSuccess: onClose })
        }}
      />
    </>
  )
}

const columns: DataTableColumn<RestDayRow>[] = [
  {
    id: 'employee',
    header: 'Employees',
    cell: (row) => `${row.employee.name} - (${row.employee.code})`,
    mobile: 'heading',
  },
  {
    id: 'date',
    header: 'Date',
    cell: (row) => (
      <span>
        {longDate(row.date)}
        {row.payable && (
          <span className="ml-2 text-[0.625rem] font-medium text-[#51B969] dark:text-green-400">
            Payable
          </span>
        )}
      </span>
    ),
  },
]

/** Settings → Rest Days: rest days given with Create New Rest Day (the same as in Scheduling). */
export function RestDaysTab() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState<'create' | 'delete' | { batchId: string } | null>(null)
  const list = useRestDays({ page, pageSize: 10, ...(search ? { search } : {}) })
  const queryClient = useQueryClient()

  return (
    <>
      <SettingsListCard
        title="Rest Days"
        columns={columns}
        rows={list.data?.data ?? []}
        meta={list.data?.meta}
        getRowId={(row) => row.id}
        isLoading={list.isPending}
        isFetching={list.isFetching}
        searchLabel="Search rest days by employee"
        onSearch={(text) => {
          setSearch(text)
          setPage(1)
        }}
        onPageChange={setPage}
        actions={
          <Button
            variant="destructive"
            onClick={() => {
              setDialog('delete')
            }}
            className={cn(toolbarButtonClass, 'px-5')}
          >
            Delete
          </Button>
        }
        onCreate={() => {
          setDialog('create')
        }}
        emptyText="No rest days yet. Create gives people rest days on chosen weekdays."
        rowActions={(row) => (
          <RowActionsMenu
            itemClassName={rowMenuItemClass.poppins}
            label={`Actions for ${row.employee.name}, ${longDate(row.date)}`}
            actions={[
              {
                label: 'View',
                onSelect: () => {
                  setDialog({ batchId: row.batchId })
                },
              },
            ]}
          />
        )}
      />
      {dialog === 'create' && (
        <RestDayDialog
          onClose={() => {
            setDialog(null)
            // The dialog saves through Scheduling; this list and the time sheets follow.
            void queryClient.invalidateQueries({ queryKey: attendanceKeys.all })
          }}
        />
      )}
      {dialog === 'delete' && (
        <DeleteRangeDialog
          onClose={() => {
            setDialog(null)
          }}
        />
      )}
      {dialog !== null && typeof dialog === 'object' && (
        <RestDayView
          batchId={dialog.batchId}
          onClose={() => {
            setDialog(null)
          }}
        />
      )}
    </>
  )
}
