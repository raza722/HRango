import { useState } from 'react'
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
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/lib/api-error'
import { toDateValue } from '@/lib/date'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import {
  useDeleteRestDayRange,
  useDeleteSetting,
  useSaveSetting,
  useSettingsList,
  useSettingsRecord,
} from '../../hooks/use-attendance-settings'
import type { RestDayRule } from '../../types/settings.types'
import {
  navyButtonClass,
  poppinsDialogTitleClass,
  poppinsFieldsClass,
  settingsDialogButtonClass,
  stepDialogButtonClass,
  toolbarButtonClass,
} from '../../utils/settings-styles'
import { ReadOnlyField } from '../shared/attendance-dialog'
import { DateBox } from '../shared/date-box'
import { EmployeeMultiSelect } from './employee-select'
import { SettingsListCard } from './settings-list'

const PERMISSION = 'scheduling.settings.rest_days'

const longDate = (date: string) => format(parse(date, 'yyyy-MM-dd', new Date()), 'MMMM d, yyyy')
/** 1 = Monday … 7 = Sunday, as the API numbers them. */
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const dayNames = (weekdays: readonly number[]) =>
  [...weekdays]
    .sort((a, b) => a - b)
    .map((day) => DAYS[day - 1]?.toUpperCase() ?? String(day))
    .join(', ')
const repeatText = (rule: Pick<RestDayRule, 'repeatEveryWeeks' | 'step'>) =>
  rule.repeatEveryWeeks === 0
    ? 'Every Week'
    : `${rule.step} of every ${rule.repeatEveryWeeks} week${rule.repeatEveryWeeks === 1 ? '' : 's'}`

function DayChips({
  value,
  onChange,
}: {
  value: readonly number[]
  onChange?: (value: number[]) => void
}) {
  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
      {DAYS.map((day, index) => {
        const number = index + 1
        const on = value.includes(number)
        const className = cn(
          'flex h-8 items-center justify-center rounded-sm text-[0.8125rem] uppercase',
          on ? 'bg-sidebar text-white dark:bg-primary' : 'bg-muted text-grey',
        )
        return onChange ? (
          <button
            key={day}
            type="button"
            aria-pressed={on}
            onClick={() => {
              onChange(on ? value.filter((item) => item !== number) : [...value, number])
            }}
            className={className}
          >
            {day}
          </button>
        ) : (
          <span key={day} className={className}>
            {day}
          </span>
        )
      })}
    </div>
  )
}

/** "Create New Rest Day" / edit: people, dates, weekdays, repeat, step and payable. */
function RestDayRuleForm({ rule, onClose }: { rule: RestDayRule | null; onClose: () => void }) {
  const save = useSaveSetting('restDays')
  const today = toDateValue(new Date())
  const [employeeIds, setEmployeeIds] = useState<string[]>(
    rule?.employees.map((item) => item.employeeId) ?? [],
  )
  const [fromDate, setFromDate] = useState(rule?.fromDate ?? today)
  const [toDate, setToDate] = useState(rule?.toDate ?? today)
  const [weekdays, setWeekdays] = useState<number[]>(rule?.weekdays ?? [6, 7])
  const [repeat, setRepeat] = useState(String(rule?.repeatEveryWeeks ?? 0))
  const [step, setStep] = useState(String(rule?.step ?? 1))
  const [payable, setPayable] = useState(rule?.isPayable ?? false)
  const [error, setError] = useState<string | null>(null)
  const repeatWeeks = Number(repeat)

  const submit = async () => {
    const problem =
      employeeIds.length === 0
        ? 'Select at least one employee.'
        : toDate < fromDate
          ? 'To must be on or after From.'
          : weekdays.length === 0
            ? 'Pick at least one day.'
            : repeatWeeks > 0 && Number(step) > repeatWeeks
              ? 'Step is between 1 and the number of weeks in the repeat.'
              : null
    if (problem) {
      setError(problem)
      return
    }
    try {
      await save.mutateAsync({
        id: rule?.id,
        input: {
          fromDate,
          toDate,
          weekdays: [...weekdays].sort((a, b) => a - b),
          repeatEveryWeeks: repeatWeeks,
          step: repeatWeeks === 0 ? 1 : Number(step),
          isPayable: payable,
          employeeIds,
          rowVersion: rule?.rowVersion ?? null,
        },
      })
    } catch (failure) {
      setError(
        failure instanceof ApiError
          ? (Object.values(failure.fieldErrors)[0] ?? failure.message)
          : 'Could not save.',
      )
      return
    }
    onClose()
  }

  return (
    <AppDialog
      title={rule ? 'Edit Rest Day' : 'Create New Rest Day'}
      onRequestClose={onClose}
      className={cn('max-w-3xl', poppinsFieldsClass)}
      titleClassName={poppinsDialogTitleClass}
      footer={
        <>
          {error && (
            <p role="alert" className="mr-auto self-center text-sm text-destructive">
              {error}
            </p>
          )}
          <Button
            variant="destructive"
            size="lg"
            onClick={onClose}
            className={settingsDialogButtonClass}
          >
            Cancel
          </Button>
          <Button
            size="lg"
            disabled={save.isPending}
            onClick={() => void submit()}
            className={cn(settingsDialogButtonClass, navyButtonClass)}
          >
            {rule ? 'Save Changes' : 'Create'}
          </Button>
        </>
      }
    >
      <div className="grid gap-5">
        <EmployeeMultiSelect
          permission={`${PERMISSION}.view`}
          value={employeeIds}
          onChange={(next) => {
            setEmployeeIds(next)
            setError(null)
          }}
          known={rule?.employees.map((item) => ({
            id: item.employeeId,
            label: `${item.employeeName} (${item.employeeCode})`,
          }))}
        />
        <div className="grid gap-4 @md:grid-cols-2">
          <DateBox
            label="From"
            variant="form"
            required
            value={fromDate}
            onChange={(value) => {
              setFromDate(value)
              if (toDate < value) setToDate(value)
            }}
          />
          <DateBox
            label="To"
            variant="form"
            required
            value={toDate}
            minDate={parse(fromDate, 'yyyy-MM-dd', new Date())}
            onChange={setToDate}
          />
        </div>
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm text-title">Select Day</legend>
          <DayChips
            value={weekdays}
            onChange={(next) => {
              setWeekdays(next)
              setError(null)
            }}
          />
        </fieldset>
        <div className="grid gap-4 @md:grid-cols-3">
          <div className="grid gap-2">
            <span className="text-sm leading-none text-title">Repeat</span>
            <Select value={repeat} onValueChange={setRepeat}>
              <SelectTrigger aria-label="Repeat" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Every Week</SelectItem>
                {Array.from({ length: 8 }, (_, index) => (
                  <SelectItem key={index + 1} value={String(index + 1)}>
                    {`Cycle of ${index + 1} week${index === 0 ? '' : 's'}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <span className="text-sm leading-none text-title">Step</span>
            <Select value={step} onValueChange={setStep} disabled={repeatWeeks === 0}>
              <SelectTrigger aria-label="Step" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: Math.max(repeatWeeks, 1) }, (_, index) => (
                  <SelectItem key={index + 1} value={String(index + 1)}>
                    {`${index + 1} week${index === 0 ? '' : 's'} on`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-title">
            <Checkbox
              checked={payable}
              onCheckedChange={(checked) => {
                setPayable(checked === true)
              }}
            />
            Is Rest Day Payable?
          </label>
        </div>
      </div>
    </AppDialog>
  )
}

/** "Rest Day View": the rule and its people, with Edit and Delete. */
function RestDayView({
  id,
  onEdit,
  onClose,
}: {
  id: string
  onEdit: (rule: RestDayRule) => void
  onClose: () => void
}) {
  const rule = useSettingsRecord('restDays', id)
  const remove = useDeleteSetting('restDays')
  const canEdit = useCan(`${PERMISSION}.edit`)
  const canDelete = useCan(`${PERMISSION}.delete`)
  const [confirming, setConfirming] = useState(false)
  const data = rule.data
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
            {canEdit && (
              <Button
                size="lg"
                disabled={!data}
                onClick={() => {
                  if (data) onEdit(data)
                }}
                className={cn(settingsDialogButtonClass, navyButtonClass)}
              >
                Edit
              </Button>
            )}
            {canDelete && (
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
            )}
          </>
        }
      >
        {!data ? (
          rule.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {rule.error.message}
            </p>
          ) : (
            <Skeleton className="h-64 w-full" />
          )
        ) : (
          <div className="grid gap-6 @2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <div className="grid content-start gap-4">
              <div className="grid grid-cols-2 gap-3">
                <ReadOnlyField label="From" value={longDate(data.fromDate)} />
                <ReadOnlyField label="To" value={longDate(data.toDate)} />
              </div>
              <ReadOnlyField label="Repeat" value={repeatText(data)} />
              <fieldset className="grid gap-2">
                <legend className="mb-2 text-sm text-title">Select Day</legend>
                <DayChips value={data.weekdays} />
              </fieldset>
              <p className="text-sm text-title">
                Is Rest Day Payable?{' '}
                <span className="font-medium text-title">{data.isPayable ? 'Yes' : 'No'}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {data.restDayCount} rest day{data.restDayCount === 1 ? '' : 's'} given.
              </p>
            </div>
            <section aria-label="Selected Employees" className="grid content-start gap-3">
              <h3 className="text-lg font-medium text-[#202020] dark:text-heading">
                Selected Employees
              </h3>
              <ul className="grid gap-2 @md:grid-cols-2">
                {data.employees.map((employee) => (
                  <li
                    key={employee.employeeId}
                    className="flex items-center gap-2.5 rounded-md bg-muted px-3 py-2"
                  >
                    <EmployeeAvatar name={employee.employeeName} className="size-8" />
                    <span className="min-w-0">
                      <span className="block truncate text-[0.6875rem] font-medium text-[#202020] dark:text-heading">
                        {employee.employeeName}
                      </span>
                      <span className="block truncate text-[0.5625rem] text-grey">
                        ({employee.employeeCode}) {employee.designationName ?? ''}
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
        description="Are you sure you want to Delete this? The rule's rest days are removed and the people work their shifts on those days."
        confirmLabel="Yes"
        cancelLabel="No"
        variant="destructive"
        onConfirm={() => {
          if (!data) return
          remove.mutate(
            { id: data.id, rowVersion: data.rowVersion },
            {
              onSuccess: onClose,
              onError: (error) => {
                toast.error(
                  error instanceof ApiError ? error.message : 'Could not delete the rest days.',
                )
              },
            },
          )
        }}
      />
    </>
  )
}

/** The red Delete: rest days between two dates, for everyone or some people. */
function DeleteRangeDialog({ onClose }: { onClose: () => void }) {
  const remove = useDeleteRestDayRange()
  const today = toDateValue(new Date())
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [everyone, setEveryone] = useState(true)
  const [employeeIds, setEmployeeIds] = useState<string[]>([])
  const [confirming, setConfirming] = useState(false)
  return (
    <>
      <AppDialog
        title="Delete Rest Days"
        description="Rest days in this range are removed; the people work their shifts on those days."
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
              disabled={to < from || (!everyone && employeeIds.length === 0) || remove.isPending}
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
        <div className="grid gap-4">
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
          <label className="flex w-fit items-center gap-2 text-sm text-title">
            <Checkbox
              checked={everyone}
              onCheckedChange={(checked) => {
                setEveryone(checked === true)
              }}
            />
            All Employees
          </label>
          {!everyone && (
            <EmployeeMultiSelect
              permission={`${PERMISSION}.view`}
              value={employeeIds}
              onChange={setEmployeeIds}
            />
          )}
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
          remove.mutate(
            {
              startDate: from,
              endDate: to,
              allEmployees: everyone,
              employeeIds: everyone ? [] : employeeIds,
            },
            {
              onSuccess: onClose,
              onError: (error) => {
                toast.error(error instanceof ApiError ? error.message : 'Could not delete.')
              },
            },
          )
        }}
      />
    </>
  )
}

const columns: DataTableColumn<RestDayRule>[] = [
  {
    id: 'employees',
    header: 'Employees',
    cell: (row) => `${row.employeeCount} employee${row.employeeCount === 1 ? '' : 's'}`,
    mobile: 'heading',
  },
  {
    id: 'dates',
    header: 'Dates',
    cell: (row) => `${longDate(row.fromDate)} – ${longDate(row.toDate)}`,
  },
  { id: 'days', header: 'Days', cell: (row) => dayNames(row.weekdays) },
  { id: 'repeat', header: 'Repeat', cell: repeatText },
  {
    id: 'count',
    header: 'Rest Days',
    cell: (row) => (
      <span>
        {row.restDayCount}
        {row.isPayable && (
          <span className="ml-2 text-[0.625rem] font-medium text-[#51B969] dark:text-green-400">
            Payable
          </span>
        )}
      </span>
    ),
  },
]

type Dialog = 'create' | 'delete' | { view: string } | { edit: RestDayRule }

/** Settings → Rest Days: rules that give people rest days on chosen weekdays. */
export function RestDaysTab() {
  const [page, setPage] = useState(1)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const list = useSettingsList('restDays', {
    page,
    pageSize: 10,
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  })
  const canCreate = useCan(`${PERMISSION}.create`)
  const canDelete = useCan(`${PERMISSION}.delete`)
  const close = () => {
    setDialog(null)
  }

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
        filters={
          <div className="grid gap-3 sm:grid-cols-2">
            <DateBox
              label="From"
              value={from}
              onChange={(value) => {
                setFrom(value)
                setPage(1)
              }}
            />
            <DateBox
              label="To"
              value={to}
              onChange={(value) => {
                setTo(value)
                setPage(1)
              }}
            />
          </div>
        }
        onPageChange={setPage}
        {...(canDelete
          ? {
              actions: (
                <Button
                  variant="destructive"
                  onClick={() => {
                    setDialog('delete')
                  }}
                  className={cn(toolbarButtonClass, 'px-5')}
                >
                  Delete
                </Button>
              ),
            }
          : {})}
        {...(canCreate
          ? {
              onCreate: () => {
                setDialog('create')
              },
            }
          : {})}
        emptyText="No rest days yet. Create gives people rest days on chosen weekdays."
        rowActions={(row) => (
          <RowActionsMenu
            itemClassName={rowMenuItemClass.poppins}
            label={`Actions for rest days ${longDate(row.fromDate)} to ${longDate(row.toDate)}`}
            actions={[
              {
                label: 'View',
                onSelect: () => {
                  setDialog({ view: row.id })
                },
              },
            ]}
          />
        )}
      />
      {dialog === 'create' && <RestDayRuleForm rule={null} onClose={close} />}
      {dialog === 'delete' && <DeleteRangeDialog onClose={close} />}
      {dialog !== null && typeof dialog === 'object' && 'view' in dialog && (
        <RestDayView
          id={dialog.view}
          onClose={close}
          onEdit={(rule) => {
            setDialog({ edit: rule })
          }}
        />
      )}
      {dialog !== null && typeof dialog === 'object' && 'edit' in dialog && (
        <RestDayRuleForm rule={dialog.edit} onClose={close} />
      )}
    </>
  )
}
