import { useId } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'

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
import { errorMessage, orNull } from './settings-helpers'
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

/**
 * "Payroll Configurations": the numbered options with their controls, one per key of
 * `GET/PUT /payroll/settings/general` (the whole object is saved with its `rowVersion`).
 */
function ConfigurationForm({ settings }: { settings: PayrollSettings }) {
  const save = useSavePayrollSettings()
  const baseId = useId()
  const form = useForm<PayrollSettings>({ defaultValues: settings })
  const submit = form.handleSubmit((values) => {
    save.mutate(cleaned(values), {
      onError: (error) => {
        toast.error(errorMessage(error, 'Could not save the settings.'))
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
                render={({ field }) => {
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
                      <Input
                        id={id}
                        inputMode="numeric"
                        value={typeof field.value === 'number' ? String(field.value) : ''}
                        onChange={(event) => {
                          const text = event.target.value.replace(/\D/g, '')
                          field.onChange(
                            text === '' ? null : Math.max(min, Math.min(max, Number(text))),
                          )
                        }}
                        className={valueText}
                      />
                    )
                  }
                  if (item.control.kind === 'text') {
                    return (
                      <Textarea
                        id={id}
                        rows={2}
                        value={typeof field.value === 'string' ? field.value : ''}
                        onChange={(event) => {
                          field.onChange(event.target.value)
                        }}
                        className={cn('min-h-10', valueText)}
                      />
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
  const form = useForm<PayrollSettings>({ defaultValues: settings })
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
          toast.error(errorMessage(error, 'Could not save the settings.'))
        },
      },
    )
  })
  const row = 'grid items-center gap-2 @xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] @xl:gap-6'

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
          render={({ field }) => (
            <Input
              id={ids.max}
              className={valueText}
              inputMode="numeric"
              value={field.value === null ? '' : String(field.value)}
              onChange={(event) => {
                const text = event.target.value.replace(/\D/g, '')
                field.onChange(text === '' ? null : Math.min(365, Number(text)))
              }}
            />
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
