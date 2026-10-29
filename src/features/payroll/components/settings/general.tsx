import { useId } from 'react'
import { Controller, type Path, useForm, type UseFormSetError, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { CONFIGURATION_ITEMS, PAYROLL_CODES } from '../../constants'
import {
  useLeaveTypeLookup,
  usePayrollSettings,
  useSavePayrollSettings,
} from '../../hooks/use-payroll'
import type { PayrollSettings } from '../../types/payroll.types'
import { btn, toolbarButton } from '../../utils/styles'
import { SearchSelect } from '../shared/search-select'
import { applyApiError, errorMessage, orNull } from './settings-helpers'
import { ViewHeader } from './settings-list'
import type { SettingsView } from './settings-nav'

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const NONE = '__none__'

/**
 * The settings pages' own form type (Figma, Payroll Settings): section titles
 * Poppins Medium 20 #303030, labels Poppins Regular 14 #303030, values Poppins
 * Regular 14 #585858 and placeholders Poppins Regular 14 #A4A4A4.
 */
const heading = 'text-lg font-medium text-title sm:text-xl'
const labelText = 'text-sm text-title'
const valueText = 'font-sans text-[#585858] dark:text-field-foreground'
const selectText = cn(
  valueText,
  'data-[placeholder]:text-[#A4A4A4] dark:data-[placeholder]:text-label [&_[data-placeholder]]:text-[#A4A4A4] dark:[&_[data-placeholder]]:text-label',
)

function SaveChanges({ pending }: { pending: boolean }) {
  const canEdit = useCan(`${PAYROLL_CODES.general}.edit`)
  if (!canEdit) return null
  return (
    <div className="flex justify-end">
      <Button
        type="submit"
        disabled={pending}
        className={cn(toolbarButton, btn.navy, 'h-10 px-5 text-base font-normal')}
      >
        Save Changes
      </Button>
    </div>
  )
}

/** Blank text boxes go to the API as `null`. */
const cleaned = (values: PayrollSettings): PayrollSettings => ({
  ...values,
  revisionFixedDate: orNull(values.revisionFixedDate),
  payslipColor: orNull(values.payslipColor),
  notesEnglish: orNull(values.notesEnglish),
  notesOtherLanguage: orNull(values.notesOtherLanguage),
})

/** Days in each month; 29 February is allowed, it comes round in leap years. */
const MONTH_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

/** "07-01" → "1 July"; null when it is not a month and day. */
function monthDayLabel(value: string): string | null {
  const match = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.exec(value.trim())
  if (!match) return null
  const month = Number(match[1])
  const day = Number(match[2])
  if (day > (MONTH_DAYS[month - 1] ?? 0)) return null
  return `${String(day)} ${MONTH_NAMES[month - 1] ?? ''}`
}

const HEX_COLOUR = /^#[0-9A-Fa-f]{6}$/

/**
 * What the settings form refuses before saving (the API refuses the same): numbers outside
 * their range, a revision date that is not a month and day, a colour that is not `#RRGGBB`.
 */
const settingsSchema = z.custom<PayrollSettings>().superRefine((values, ctx) => {
  for (const item of CONFIGURATION_ITEMS) {
    const value = values[item.key]
    if (item.control.kind === 'number' && value !== null) {
      const { min, max } = item.control
      if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
        ctx.addIssue({
          code: 'custom',
          path: [item.key],
          message: `Enter a whole number from ${String(min)} to ${String(max)}`,
        })
      }
    }
  }
  const date = orNull(values.revisionFixedDate)
  if (date !== null && monthDayLabel(date) === null) {
    ctx.addIssue({
      code: 'custom',
      path: ['revisionFixedDate'],
      message: 'Enter a month and day as MM-DD, e.g. 07-01 for 1 July',
    })
  }
  const colour = orNull(values.payslipColor)
  if (colour !== null && !HEX_COLOUR.test(colour)) {
    ctx.addIssue({
      code: 'custom',
      path: ['payslipColor'],
      message: 'Choose a colour, or type one like #17263A',
    })
  }
  const cpl = values.maxEarnedCpl
  if (cpl !== null && (!Number.isInteger(cpl) || cpl < 0 || cpl > 365)) {
    ctx.addIssue({
      code: 'custom',
      path: ['maxEarnedCpl'],
      message: 'Enter a whole number from 0 to 365',
    })
  }
})

/** A typed number box's value: `null` when empty, otherwise the number (checked by the schema). */
const numberValue = (text: string) => (text.trim() === '' ? null : Number(text))

/** Every settings key: where an API field error can go. */
const SETTINGS_FIELDS = [
  ...CONFIGURATION_ITEMS.map((item) => item.key),
  'maxEarnedCpl',
  'cplLeaveTypeId',
  'fiscalYearStartMonth',
] as const satisfies readonly Path<PayrollSettings>[]

/** Field errors of a refused save go on their fields; anything else is a toast. */
function onSaveError(error: unknown, setError: UseFormSetError<PayrollSettings>) {
  const rest = applyApiError(error, setError, SETTINGS_FIELDS)
  if (rest) toast.error(errorMessage(error, rest))
}

/** A control's error line under it. */
function FieldError({ id, message }: { id: string; message: string | undefined }) {
  return message ? (
    <p id={id} className="text-xs text-destructive @xl:col-start-2">
      {message}
    </p>
  ) : null
}

/**
 * "Payroll Configurations": the numbered options with their controls, one per key of
 * `GET/PUT /payroll/settings/general` (the whole object is saved with its `rowVersion`).
 */
function ConfigurationForm({ settings }: { settings: PayrollSettings }) {
  const save = useSavePayrollSettings()
  const baseId = useId()
  const form = useForm<PayrollSettings>({
    defaultValues: settings,
    resolver: zodResolver(settingsSchema),
  })
  const submit = form.handleSubmit((values) => {
    save.mutate(cleaned(values), {
      onError: (error) => {
        onSaveError(error, form.setError)
      },
    })
  })

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="grid gap-5">
      <h2 className={heading}>Payroll Configurations</h2>
      <ol className="grid gap-3">
        {CONFIGURATION_ITEMS.map((item, index) => {
          const id = `${baseId}-${index}`
          const label = `${index + 1}. ${item.label}`
          return (
            <li
              key={`${item.key}-${index}`}
              className="grid items-center gap-2 @xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] @xl:gap-6"
            >
              <label htmlFor={id} className={labelText}>
                {label}
              </label>
              <Controller
                control={form.control}
                name={item.key}
                render={({ field, fieldState }) => {
                  const errorId = `${id}-error`
                  const a11y = {
                    'aria-invalid': fieldState.invalid || undefined,
                    'aria-describedby': fieldState.error ? errorId : undefined,
                  }
                  const error = <FieldError id={errorId} message={fieldState.error?.message} />
                  if (item.control.kind === 'checkbox') {
                    return (
                      <span className="flex h-6 items-center">
                        <Checkbox
                          id={id}
                          checked={field.value === true}
                          onCheckedChange={(checked) => {
                            field.onChange(checked === true)
                          }}
                        />
                      </span>
                    )
                  }
                  if (item.control.kind === 'number') {
                    const { min, max } = item.control
                    return (
                      <>
                        <Input
                          id={id}
                          {...a11y}
                          type="number"
                          inputMode="numeric"
                          min={min}
                          max={max}
                          step={1}
                          placeholder={`${String(min)} to ${String(max)}`}
                          value={typeof field.value === 'number' ? String(field.value) : ''}
                          onChange={(event) => {
                            field.onChange(numberValue(event.target.value))
                          }}
                          onBlur={field.onBlur}
                          className={valueText}
                        />
                        {error}
                      </>
                    )
                  }
                  if (item.control.kind === 'monthDay') {
                    const text = typeof field.value === 'string' ? field.value : ''
                    const readable = monthDayLabel(text)
                    const hintId = `${id}-hint`
                    return (
                      <>
                        <Input
                          id={id}
                          {...a11y}
                          aria-describedby={cn(hintId, fieldState.error && errorId)}
                          inputMode="numeric"
                          maxLength={5}
                          placeholder="MM-DD, e.g. 07-01"
                          value={text}
                          onChange={(event) => {
                            field.onChange(event.target.value)
                          }}
                          onBlur={field.onBlur}
                          className={valueText}
                        />
                        <p id={hintId} className="text-xs text-muted-foreground @xl:col-start-2">
                          {readable
                            ? `Every year on ${readable}`
                            : 'Month, then day: 07-01 is 1 July'}
                        </p>
                        {error}
                      </>
                    )
                  }
                  if (item.control.kind === 'color') {
                    const text = typeof field.value === 'string' ? field.value : ''
                    return (
                      <>
                        <span className="flex items-center gap-2">
                          <input
                            type="color"
                            aria-label={`${label}, colour picker`}
                            value={HEX_COLOUR.test(text) ? text.toLowerCase() : '#17263a'}
                            onChange={(event) => {
                              field.onChange(event.target.value.toUpperCase())
                            }}
                            className="h-10 w-12 shrink-0 cursor-pointer rounded-md border border-input bg-card p-1"
                          />
                          <Input
                            id={id}
                            {...a11y}
                            maxLength={7}
                            placeholder="#17263A (default)"
                            value={text}
                            onChange={(event) => {
                              field.onChange(event.target.value)
                            }}
                            onBlur={field.onBlur}
                            className={valueText}
                          />
                        </span>
                        {error}
                      </>
                    )
                  }
                  if (item.control.kind === 'text') {
                    return (
                      <>
                        <Textarea
                          id={id}
                          {...a11y}
                          rows={2}
                          maxLength={1000}
                          value={typeof field.value === 'string' ? field.value : ''}
                          onChange={(event) => {
                            field.onChange(event.target.value)
                          }}
                          className={cn('min-h-10', valueText)}
                        />
                        {error}
                      </>
                    )
                  }
                  const { options, labels } = item.control
                  return (
                    <Select
                      value={typeof field.value === 'string' ? field.value : NONE}
                      onValueChange={(next) => {
                        field.onChange(next === NONE ? null : next)
                      }}
                    >
                      <SelectTrigger
                        id={id}
                        className={cn(
                          'w-full',
                          selectText,
                          // "Select" (nothing chosen) is drawn as a placeholder.
                          typeof field.value !== 'string' && 'text-[#A4A4A4] dark:text-label',
                        )}
                      >
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE} className="text-muted-foreground">
                          Select
                        </SelectItem>
                        {options.map((option) => (
                          <SelectItem key={option} value={option}>
                            {labels[option] ?? option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )
                }}
              />
            </li>
          )
        })}
      </ol>
      <SaveChanges pending={save.isPending} />
    </form>
  )
}

/** The year's last month: December for a calendar year, the month before the start for a fiscal one. */
const endMonthOf = (fiscal: boolean, start: number) => (fiscal ? ((start + 10) % 12) + 1 : 12)

const LEAVE_DEDUCTIONS = [
  ['deductCasualLeaves', 'Casual Leaves'],
  ['deductSickLeaves', 'Sick Leaves'],
] as const

/** "Leave Configuration": CPL, the order leave is deducted in, and the leave year. */
function LeaveForm({ settings }: { settings: PayrollSettings }) {
  const save = useSavePayrollSettings()
  const leaveTypes = useLeaveTypeLookup()
  const ids = {
    cpl: useId(),
    max: useId(),
    start: useId(),
    end: useId(),
    deductCasualLeaves: useId(),
    deductSickLeaves: useId(),
  }
  const form = useForm<PayrollSettings>({
    defaultValues: settings,
    resolver: zodResolver(settingsSchema),
  })
  const [fiscalYear, startMonth] = useWatch({
    control: form.control,
    name: ['leaveYearBasis', 'fiscalYearStartMonth'],
  })
  const fiscal = fiscalYear === 'fiscal'
  const submit = form.handleSubmit((values) => {
    const isFiscal = values.leaveYearBasis === 'fiscal'
    const start = isFiscal ? (values.fiscalYearStartMonth ?? 7) : null
    save.mutate(
      cleaned({
        ...values,
        fiscalYearStartMonth: start,
        fiscalYearEndMonth: start === null ? null : endMonthOf(true, start),
      }),
      {
        onError: (error) => {
          onSaveError(error, form.setError)
        },
      },
    )
  })
  const row = 'grid items-center gap-2 @xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] @xl:gap-6'
  const maxError = `${ids.max}-error`

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="grid gap-5">
      <h2 className={heading}>CPL</h2>
      <div className={row}>
        <label htmlFor={ids.cpl} className={labelText}>
          Leave Type for CPL
        </label>
        <Controller
          control={form.control}
          name="cplLeaveTypeId"
          render={({ field }) => (
            <SearchSelect
              id={ids.cpl}
              value={field.value}
              onChange={(next) => {
                field.onChange(next)
              }}
              options={(leaveTypes.data ?? []).map((type) => ({
                value: type.id,
                label: type.name,
              }))}
              placeholder="Select"
              clearable
              className={selectText}
            />
          )}
        />
      </div>
      <div className={row}>
        <label htmlFor={ids.max} className={labelText}>
          Maximum Earned CPL
        </label>
        <Controller
          control={form.control}
          name="maxEarnedCpl"
          render={({ field, fieldState }) => (
            <>
              <Input
                id={ids.max}
                className={valueText}
                type="number"
                inputMode="numeric"
                min={0}
                max={365}
                step={1}
                placeholder="0 to 365"
                aria-invalid={fieldState.invalid || undefined}
                aria-describedby={fieldState.error ? maxError : undefined}
                value={field.value === null ? '' : String(field.value)}
                onChange={(event) => {
                  field.onChange(numberValue(event.target.value))
                }}
                onBlur={field.onBlur}
              />
              <FieldError id={maxError} message={fieldState.error?.message} />
            </>
          )}
        />
      </div>

      <h2 className={heading}>Leave Deduction (Leave Type Order)</h2>
      {LEAVE_DEDUCTIONS.map(([key, text]) => (
        <div key={key} className={row}>
          <label htmlFor={ids[key]} className={labelText}>
            {text}
          </label>
          <Controller
            control={form.control}
            name={key}
            render={({ field }) => (
              <span className="flex h-6 items-center">
                <Checkbox
                  id={ids[key]}
                  checked={field.value}
                  onCheckedChange={(checked) => {
                    field.onChange(checked === true)
                  }}
                />
              </span>
            )}
          />
        </div>
      ))}

      <h2 className={heading}>Leave Fiscal Year (Leave Type Order)</h2>
      <Controller
        control={form.control}
        name="leaveYearBasis"
        render={({ field }) => (
          <div className="flex flex-wrap items-center gap-x-16 gap-y-3 text-sm text-title">
            <label className="flex items-center gap-6">
              Calendar Year
              <Switch
                checked={field.value === 'calendar'}
                onCheckedChange={(checked) => {
                  field.onChange(checked ? 'calendar' : 'fiscal')
                }}
                className="data-[state=checked]:bg-[#17263A] dark:data-[state=checked]:bg-primary"
              />
            </label>
            <label className="flex items-center gap-6">
              Fiscal Year
              <Switch
                checked={field.value === 'fiscal'}
                onCheckedChange={(checked) => {
                  field.onChange(checked ? 'fiscal' : 'calendar')
                }}
                className="data-[state=checked]:bg-[#17263A] dark:data-[state=checked]:bg-primary"
              />
            </label>
          </div>
        )}
      />
      <div className={row}>
        <label htmlFor={ids.start} className={labelText}>
          Company Year Start
        </label>
        <Controller
          control={form.control}
          name="fiscalYearStartMonth"
          render={({ field }) => (
            <SearchSelect
              id={ids.start}
              value={fiscal ? String(field.value ?? 7) : '1'}
              onChange={(next) => {
                if (next) field.onChange(Number(next))
              }}
              disabled={!fiscal}
              options={MONTH_NAMES.map((label, index) => ({ value: String(index + 1), label }))}
              placeholder="Select month"
              className={selectText}
            />
          )}
        />
      </div>
      <div className={row}>
        <label htmlFor={ids.end} className={labelText}>
          Company Year End
        </label>
        <Input
          id={ids.end}
          readOnly
          value={MONTH_NAMES[endMonthOf(fiscal, fiscal ? (startMonth ?? 7) : 1) - 1] ?? ''}
          className={cn('bg-muted', valueText)}
        />
      </div>
      <SaveChanges pending={save.isPending} />
    </form>
  )
}

/** General: Payroll Configuration and Leave Configuration. */
export function GeneralView({ view }: { view: SettingsView | null }) {
  const settings = usePayrollSettings()
  return (
    <>
      <ViewHeader tab="general" view={view} />
      {!settings.data ? (
        <div className="grid gap-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-8 w-full" />
          ))}
        </div>
      ) : view === 'leave-configuration' ? (
        <LeaveForm key={settings.data.rowVersion ?? 'new'} settings={settings.data} />
      ) : (
        <ConfigurationForm key={settings.data.rowVersion ?? 'new'} settings={settings.data} />
      )}
    </>
  )
}
