import { type ReactNode, useId, useState } from 'react'
import { format, parse } from 'date-fns'
import { toast } from 'sonner'

import { AppDialog } from '@/components/feedback/app-dialog'
import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
import { type DataTableColumn, RowActionsMenu, rowMenuItemClass } from '@/components/layout'
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
import { Textarea } from '@/components/ui/textarea'
import { ApiError } from '@/lib/api-error'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { RELIGIONS } from '../../constants'
import {
  useCities,
  useCountries,
  useDeleteSetting,
  useEmployeeLookup,
  useOrgLookup,
  useSaveSetting,
  useSettingsList,
  useSettingsRecord,
  useStates,
} from '../../hooks/use-attendance-settings'
import {
  type Holiday,
  HOLIDAY_RULE_TYPES,
  HOLIDAY_TYPES,
  type HolidayRule,
  type HolidayRuleInput,
  type HolidayRuleType,
  type HolidayType,
} from '../../types/settings.types'
import {
  compactTableClass,
  navyButtonClass,
  poppinsDialogTitleClass,
  poppinsFieldsClass,
  settingsDialogButtonClass,
} from '../../utils/settings-styles'
import { DateBox } from '../shared/date-box'
import { EmployeeMultiSelect } from './employee-select'
import { SettingsListCard } from './settings-list'

const PERMISSION = 'scheduling.settings.holidays'

const RULE_TYPE_LABELS: Record<HolidayRuleType, string> = {
  religion: 'Religion',
  geo_location: 'Geo Location',
  org_structure: 'Organization Structure',
  employee: 'Employee',
}

const HOLIDAY_TYPE_LABELS: Record<HolidayType, string> = { public: 'Public', local: 'Local' }

const longDate = (date: string) => format(parse(date, 'yyyy-MM-dd', new Date()), 'MMMM d, yyyy')

/** The id of a field's message, for the control's `aria-describedby`. */
const errorIdOf = (id: string) => `${id}-error`

function Field({
  label,
  required,
  children,
  id,
  error,
}: {
  label: string
  required?: boolean
  children: ReactNode
  id: string
  /** Shown under the field until it changes. */
  error?: string | undefined
}) {
  return (
    <div className="grid min-w-0 gap-2">
      <label htmlFor={id} className="text-sm leading-none text-title">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-1 text-destructive">
            *
          </span>
        )}
      </label>
      {children}
      {error && (
        <p id={errorIdOf(id)} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

/** Every problem of a form at once, by field; a field's message goes when it changes. */
function useFieldErrors<F extends string>() {
  const [errors, setErrors] = useState<Partial<Record<F, string>>>({})
  const clear = (...fields: F[]) => {
    setErrors((current) => {
      if (!fields.some((field) => current[field])) return current
      return Object.fromEntries(
        Object.entries(current).filter(([key]) => !(fields as string[]).includes(key)),
      ) as Partial<Record<F, string>>
    })
  }
  return { errors, setErrors, clear }
}

/** `aria-invalid` / `aria-describedby` of a control with a message. */
const invalidProps = (id: string, error: string | undefined) =>
  error ? { 'aria-invalid': true, 'aria-describedby': errorIdOf(id) } : {}

function Choice({
  id,
  value,
  onChange,
  options,
  placeholder,
  error,
}: {
  id: string
  value: string | null
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  placeholder: string
  error?: string | undefined
}) {
  return (
    <Select value={value ?? ''} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full" {...invalidProps(id, error)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Who a rule takes in, in words ("Parsi", "Lahore, Punjab, Pakistan"…). */
function appliesTo(rule: HolidayRule): string {
  switch (rule.ruleType) {
    case 'religion':
      return rule.religion ?? ''
    case 'geo_location':
      return [rule.cityName, rule.stateName, rule.countryName].filter(Boolean).join(', ')
    case 'org_structure':
      return [rule.locationName, rule.branchName].filter(Boolean).join(' · ')
    case 'employee':
      return rule.employeeName ?? ''
  }
}

let ruleCounter = 0
const localRuleId = () => {
  ruleCounter += 1
  return `new_${ruleCounter}`
}

const blankRule = (ruleType: HolidayRuleType): HolidayRule => ({
  id: localRuleId(),
  ruleType,
  employeeId: null,
  employeeName: null,
  locationId: null,
  locationName: null,
  branchId: null,
  branchName: null,
  countryId: null,
  countryName: null,
  stateId: null,
  stateName: null,
  cityId: null,
  cityName: null,
  religion: null,
})

const toRuleInput = (rule: HolidayRule): HolidayRuleInput => ({
  ruleType: rule.ruleType,
  employeeId: rule.employeeId,
  locationId: rule.locationId,
  branchId: rule.branchId,
  countryId: rule.countryId,
  stateId: rule.stateId,
  cityId: rule.cityId,
  religion: rule.religion,
})

/** The rule fields a message can stand under. */
type RuleField =
  'religion' | 'countryId' | 'stateId' | 'cityId' | 'locationId' | 'branchId' | 'employeeId'

type HolidayField = 'name' | 'startDate' | 'endDate'

/**
 * "Holiday Rule Create": the type and its fields. One rule names one employee, so choosing
 * several employees adds a rule for each. Every missing field is marked at once.
 */
function HolidayRuleDialog({
  rule,
  onSave,
  onClose,
}: {
  rule: HolidayRule | null
  onSave: (rules: HolidayRule[]) => void
  onClose: () => void
}) {
  const ids = { type: useId(), a: useId(), b: useId(), c: useId() }
  const [draft, setDraft] = useState<HolidayRule>(() => rule ?? blankRule('religion'))
  const [employeeIds, setEmployeeIds] = useState<string[]>(
    rule?.employeeId ? [rule.employeeId] : [],
  )
  const { errors, setErrors, clear } = useFieldErrors<RuleField>()
  const set = (patch: Partial<HolidayRule>) => {
    setDraft((current) => ({ ...current, ...patch }))
    clear(...(Object.keys(patch) as RuleField[]))
  }
  const isGeo = draft.ruleType === 'geo_location'
  const isOrg = draft.ruleType === 'org_structure'
  const countries = useCountries(isGeo)
  const states = useStates(isGeo ? draft.countryId : null)
  const cities = useCities(isGeo ? draft.stateId : null)
  const locations = useOrgLookup('locations', isOrg)
  const branches = useOrgLookup('branches', isOrg)
  // Names the picked people from any page the employee picker has read.
  const employees = useEmployeeLookup(`${PERMISSION}.view`, '', draft.ruleType === 'employee')
  const branchOptions = (branches.data ?? []).filter(
    (item) => !item.parentId || !draft.locationId || item.parentId === draft.locationId,
  )

  const submit = () => {
    const missing: Partial<Record<RuleField, string>> = {}
    if (draft.ruleType === 'religion' && !draft.religion) missing.religion = 'Choose a religion'
    if (isGeo && !draft.countryId) missing.countryId = 'Choose the country'
    if (isGeo && !draft.stateId) missing.stateId = 'Choose the state'
    if (isGeo && !draft.cityId) missing.cityId = 'Choose the city'
    if (isOrg && !draft.locationId) missing.locationId = 'Choose the location'
    if (isOrg && !draft.branchId) missing.branchId = 'Choose the branch'
    if (draft.ruleType === 'employee' && employeeIds.length === 0) {
      missing.employeeId = 'Choose the employees'
    }
    if (Object.keys(missing).length > 0) {
      setErrors(missing)
      return
    }
    if (draft.ruleType === 'employee') {
      onSave(
        employeeIds.map((employeeId, index) => {
          const found = employees.find(employeeId)
          return {
            ...blankRule('employee'),
            ...(index === 0 && rule ? { id: rule.id } : {}),
            employeeId,
            employeeName: found
              ? found.name
              : employeeId === rule?.employeeId
                ? rule.employeeName
                : null,
          }
        }),
      )
    } else {
      onSave([
        {
          ...draft,
          countryName: countries.data?.find((item) => item.id === draft.countryId)?.name ?? null,
          stateName: states.data?.find((item) => item.id === draft.stateId)?.name ?? null,
          cityName: cities.data?.find((item) => item.id === draft.cityId)?.name ?? null,
          locationName: locations.data?.find((item) => item.id === draft.locationId)?.name ?? null,
          branchName: branches.data?.find((item) => item.id === draft.branchId)?.name ?? null,
        },
      ])
    }
    onClose()
  }

  return (
    <AppDialog
      title={rule ? 'Holiday Rule' : 'Holiday Rule Create'}
      onRequestClose={onClose}
      className={cn('max-w-md', poppinsFieldsClass)}
      titleClassName={poppinsDialogTitleClass}
      footer={
        <>
          <Button
            variant="destructive"
            size="lg"
            onClick={onClose}
            className={cn(settingsDialogButtonClass, 'flex-1')}
          >
            Cancel
          </Button>
          <Button
            size="lg"
            onClick={submit}
            className={cn(settingsDialogButtonClass, navyButtonClass, 'flex-1')}
          >
            {rule ? 'Save' : 'Create'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Type" required id={ids.type}>
          <Choice
            id={ids.type}
            value={draft.ruleType}
            placeholder="Select"
            options={HOLIDAY_RULE_TYPES.map((type) => ({
              value: type,
              label: RULE_TYPE_LABELS[type],
            }))}
            onChange={(value) => {
              const type = HOLIDAY_RULE_TYPES.find((item) => item === value) ?? 'religion'
              set({ ...blankRule(type), id: draft.id })
            }}
          />
        </Field>
        <h3 className="text-lg font-medium text-[#202020] dark:text-heading">Fields</h3>
        {draft.ruleType === 'religion' && (
          <Field label="Religion" required id={ids.a} error={errors.religion}>
            <Choice
              id={ids.a}
              error={errors.religion}
              value={draft.religion}
              placeholder="Select Religion"
              options={RELIGIONS.map((value) => ({ value, label: value }))}
              onChange={(religion) => {
                set({ religion })
              }}
            />
          </Field>
        )}
        {isGeo && (
          <>
            <Field label="Country" required id={ids.a} error={errors.countryId}>
              <Choice
                id={ids.a}
                error={errors.countryId}
                value={draft.countryId}
                placeholder="Select Country"
                options={(countries.data ?? []).map((item) => ({
                  value: item.id,
                  label: item.name,
                }))}
                onChange={(countryId) => {
                  set({ countryId, stateId: null, cityId: null })
                }}
              />
            </Field>
            <Field label="State" required id={ids.b} error={errors.stateId}>
              <Choice
                id={ids.b}
                error={errors.stateId}
                value={draft.stateId}
                placeholder="Select State"
                options={(states.data ?? []).map((item) => ({ value: item.id, label: item.name }))}
                onChange={(stateId) => {
                  set({ stateId, cityId: null })
                }}
              />
            </Field>
            <Field label="City" required id={ids.c} error={errors.cityId}>
              <Choice
                id={ids.c}
                error={errors.cityId}
                value={draft.cityId}
                placeholder="Select City"
                options={(cities.data ?? []).map((item) => ({ value: item.id, label: item.name }))}
                onChange={(cityId) => {
                  set({ cityId })
                }}
              />
            </Field>
          </>
        )}
        {isOrg && (
          <>
            <Field label="Location" required id={ids.a} error={errors.locationId}>
              <Choice
                id={ids.a}
                error={errors.locationId}
                value={draft.locationId}
                placeholder="Select Location"
                options={(locations.data ?? []).map((item) => ({
                  value: item.id,
                  label: item.name,
                }))}
                onChange={(locationId) => {
                  set({ locationId, branchId: null })
                }}
              />
            </Field>
            <Field label="Branch" required id={ids.b} error={errors.branchId}>
              <Choice
                id={ids.b}
                error={errors.branchId}
                value={draft.branchId}
                placeholder="Select Branch"
                options={branchOptions.map((item) => ({ value: item.id, label: item.name }))}
                onChange={(branchId) => {
                  set({ branchId })
                }}
              />
            </Field>
          </>
        )}
        {draft.ruleType === 'employee' && (
          <EmployeeMultiSelect
            permission={`${PERMISSION}.view`}
            value={employeeIds}
            onChange={(next) => {
              setEmployeeIds(next)
              clear('employeeId')
            }}
            known={
              rule?.employeeId
                ? [{ id: rule.employeeId, label: rule.employeeName ?? rule.employeeId }]
                : []
            }
          />
        )}
        {draft.ruleType === 'employee' && errors.employeeId && (
          <p className="-mt-2 text-xs text-destructive">{errors.employeeId}</p>
        )}
      </div>
    </AppDialog>
  )
}

/** "Create Holiday": type, exempt or not, name, dates, description and the rules. */
function HolidayForm({ record, onClose }: { record: Holiday | null; onClose: () => void }) {
  const save = useSaveSetting('holidays')
  const canSave = useCan(`${PERMISSION}.${record ? 'edit' : 'create'}`)
  const ids = { name: useId(), description: useId(), type: useId() }
  const [holidayType, setHolidayType] = useState<HolidayType>(record?.holidayType ?? 'public')
  const [exempt, setExempt] = useState(record?.attendanceExempt ?? true)
  const [name, setName] = useState(record?.name ?? '')
  const [startDate, setStartDate] = useState(record?.startDate ?? '')
  const [endDate, setEndDate] = useState(record?.endDate ?? '')
  const [description, setDescription] = useState(record?.description ?? '')
  const [rules, setRules] = useState<HolidayRule[]>(record?.rules ?? [])
  const [ruleDialog, setRuleDialog] = useState<{ rule: HolidayRule | null } | null>(null)
  const { errors, setErrors, clear } = useFieldErrors<HolidayField>()
  // What the server refused that no field shows.
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    const problems: Partial<Record<HolidayField, string>> = {}
    if (!name.trim()) problems.name = 'Enter the holiday name'
    if (!startDate) problems.startDate = 'Choose the start date'
    if (!endDate) problems.endDate = 'Choose the end date'
    else if (startDate && endDate < startDate) {
      problems.endDate = 'Choose the start date or a later day'
    }
    setError(null)
    if (Object.keys(problems).length > 0) {
      setErrors(problems)
      return
    }
    try {
      await save.mutateAsync({
        id: record?.id,
        input: {
          name: name.trim(),
          holidayType,
          startDate,
          endDate,
          description: description.trim() || null,
          attendanceExempt: exempt,
          rules: rules.map(toRuleInput),
          rowVersion: record?.rowVersion ?? null,
        },
      })
    } catch (failure) {
      if (!(failure instanceof ApiError)) {
        setError('Could not save.')
        return
      }
      // The server's field messages go under their fields; the rest above the buttons.
      const placed: Partial<Record<HolidayField, string>> = {}
      for (const [key, message] of Object.entries(failure.fieldErrors)) {
        if (key === 'name' || key === 'startDate' || key === 'endDate') placed[key] = message
      }
      setErrors(placed)
      if (Object.keys(placed).length === 0) setError(failure.message)
      return
    }
    onClose()
  }

  return (
    <>
      <AppDialog
        title={record ? 'Holiday' : 'Create Holiday'}
        onRequestClose={onClose}
        className={cn('max-w-4xl', poppinsFieldsClass)}
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
            {canSave && (
              <Button
                size="lg"
                disabled={save.isPending}
                onClick={() => void submit()}
                className={cn(settingsDialogButtonClass, navyButtonClass)}
              >
                {record ? 'Save Changes' : 'Create'}
              </Button>
            )}
          </>
        }
      >
        <div className="grid gap-5">
          <label className="flex w-fit items-center gap-2 text-[0.8125rem] font-medium text-[#202020] dark:text-heading">
            <Checkbox
              checked={exempt}
              onCheckedChange={(checked) => {
                setExempt(checked === true)
              }}
            />
            Attendance Exempt
          </label>
          <div className="grid gap-4 @2xl:grid-cols-2 @4xl:grid-cols-4">
            <Field label="Name" required id={ids.name} error={errors.name}>
              <Input
                id={ids.name}
                value={name}
                maxLength={200}
                placeholder="Enter name"
                {...invalidProps(ids.name, errors.name)}
                onChange={(event) => {
                  setName(event.target.value)
                  clear('name')
                }}
              />
            </Field>
            <Field label="Type" required id={ids.type}>
              <Choice
                id={ids.type}
                value={holidayType}
                placeholder="Select"
                options={HOLIDAY_TYPES.map((type) => ({
                  value: type,
                  label: HOLIDAY_TYPE_LABELS[type],
                }))}
                onChange={(value) => {
                  setHolidayType(value === 'local' ? 'local' : 'public')
                }}
              />
            </Field>
            <DateBox
              label="Start Date"
              variant="form"
              required
              value={startDate}
              error={errors.startDate}
              onChange={(value) => {
                setStartDate(value)
                clear('startDate')
                if (!endDate || endDate < value) {
                  setEndDate(value)
                  clear('endDate')
                }
              }}
            />
            <DateBox
              label="End Date"
              variant="form"
              required
              value={endDate}
              error={errors.endDate}
              minDate={startDate ? parse(startDate, 'yyyy-MM-dd', new Date()) : undefined}
              onChange={(value) => {
                setEndDate(value)
                clear('endDate')
              }}
            />
          </div>
          <Field label="Description" id={ids.description}>
            <Textarea
              id={ids.description}
              rows={3}
              maxLength={2000}
              placeholder="Write here"
              value={description}
              onChange={(event) => {
                setDescription(event.target.value)
              }}
            />
          </Field>

          <section aria-labelledby={`${ids.name}-rules`} className="grid gap-3 border-t pt-4">
            <div className="flex items-center justify-between gap-3">
              <h3
                id={`${ids.name}-rules`}
                className="text-lg font-medium text-[#202020] dark:text-heading"
              >
                Add Holiday Rule
              </h3>
              <Button
                onClick={() => {
                  setRuleDialog({ rule: null })
                }}
                className={cn('h-8 px-5 text-sm font-medium', navyButtonClass)}
              >
                Add
              </Button>
            </div>
            {rules.length === 0 ? (
              <p className="rounded-md bg-muted/60 px-3 py-2.5 text-sm text-muted-foreground">
                No rules: the holiday is for everyone. Add a rule to give it to some people only.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className={cn('w-full', compactTableClass)}>
                  <thead>
                    <tr className="text-left">
                      <th scope="col">Type</th>
                      <th scope="col">Applies to</th>
                      <th scope="col" className="w-16 text-center">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rules.map((rule) => (
                      <tr key={rule.id} className="border-b">
                        <td>{RULE_TYPE_LABELS[rule.ruleType]}</td>
                        <td>{appliesTo(rule)}</td>
                        <td className="text-center">
                          <RowActionsMenu
                            itemClassName={rowMenuItemClass.poppins}
                            label={`Actions for rule ${RULE_TYPE_LABELS[rule.ruleType]} ${appliesTo(rule)}`}
                            actions={[
                              {
                                label: 'Edit',
                                onSelect: () => {
                                  setRuleDialog({ rule })
                                },
                              },
                              {
                                label: 'Remove',
                                variant: 'destructive',
                                onSelect: () => {
                                  setRules((current) =>
                                    current.filter((item) => item.id !== rule.id),
                                  )
                                },
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </AppDialog>
      {ruleDialog && (
        <HolidayRuleDialog
          rule={ruleDialog.rule}
          onClose={() => {
            setRuleDialog(null)
          }}
          onSave={(next) => {
            setRules((current) => {
              const replaced = current.flatMap((item) =>
                item.id === ruleDialog.rule?.id ? next : [item],
              )
              return ruleDialog.rule && current.some((item) => item.id === ruleDialog.rule?.id)
                ? replaced
                : [...current, ...next]
            })
          }}
        />
      )}
    </>
  )
}

/** Loads the whole holiday (the list leaves its rules out), then shows the form. */
function HolidayDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const record = useSettingsRecord('holidays', id)
  if (id === null) return <HolidayForm record={null} onClose={onClose} />
  if (!record.data) {
    return (
      <AppDialog
        title="Holiday"
        onRequestClose={onClose}
        className="max-w-4xl"
        titleClassName={poppinsDialogTitleClass}
      >
        {record.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {record.error.message}
          </p>
        ) : (
          <Skeleton className="h-64 w-full" />
        )}
      </AppDialog>
    )
  }
  return <HolidayForm record={record.data} onClose={onClose} />
}

const columns: DataTableColumn<Holiday>[] = [
  { id: 'name', header: 'Name', cell: (row) => row.name, mobile: 'heading' },
  { id: 'type', header: 'Type', cell: (row) => HOLIDAY_TYPE_LABELS[row.holidayType] },
  { id: 'start', header: 'Start Date', cell: (row) => longDate(row.startDate) },
  { id: 'end', header: 'End Date', cell: (row) => longDate(row.endDate) },
  {
    id: 'description',
    header: 'Description',
    cell: (row) => (
      <span className="line-clamp-1 max-w-72 whitespace-normal">
        {row.description ?? '—'}
        {(row.ruleCount ?? 0) > 0 && (
          <span className="text-muted-foreground">
            {' '}
            · {row.ruleCount} rule{row.ruleCount === 1 ? '' : 's'}
          </span>
        )}
        {!row.attendanceExempt && (
          <span className="text-muted-foreground"> · still a working day</span>
        )}
      </span>
    ),
  },
]

/** Settings → Holidays: the year's holidays, for everyone or by rule. */
export function HolidaysTab() {
  const thisYear = String(new Date().getFullYear())
  const [year, setYear] = useState(thisYear)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState<{ id: string | null } | null>(null)
  const [deleting, setDeleting] = useState<Holiday | null>(null)
  const yearId = useId()
  const list = useSettingsList('holidays', {
    page,
    pageSize: 10,
    year,
    ...(search ? { q: search } : {}),
  })
  const remove = useDeleteSetting('holidays')
  const canCreate = useCan(`${PERMISSION}.create`)
  const canEdit = useCan(`${PERMISSION}.edit`)
  const canDelete = useCan(`${PERMISSION}.delete`)

  return (
    <>
      <SettingsListCard
        title="Holidays"
        columns={columns}
        rows={list.data?.data ?? []}
        meta={list.data?.meta}
        getRowId={(row) => row.id}
        isLoading={list.isPending}
        isFetching={list.isFetching}
        searchLabel="Search holidays"
        onSearch={(text) => {
          setSearch(text)
          setPage(1)
        }}
        filters={
          <div className="grid gap-1.5">
            <label htmlFor={yearId} className="text-xs text-label">
              Year
            </label>
            <Select
              value={year}
              onValueChange={(value) => {
                setYear(value)
                setPage(1)
              }}
            >
              <SelectTrigger id={yearId} className="h-9 w-28 bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[-1, 0, 1].map((offset) => {
                  const value = String(Number(thisYear) + offset)
                  return (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
        }
        onPageChange={setPage}
        {...(canCreate
          ? {
              onCreate: () => {
                setDialog({ id: null })
              },
            }
          : {})}
        emptyText={`No holidays in ${year}.`}
        rowActions={(row) => (
          <RowActionsMenu
            itemClassName={rowMenuItemClass.poppins}
            label={`Actions for ${row.name}`}
            actions={[
              {
                label: canEdit ? 'View / Edit' : 'View',
                onSelect: () => {
                  setDialog({ id: row.id })
                },
              },
              ...(canDelete
                ? [
                    {
                      label: 'Delete',
                      variant: 'destructive' as const,
                      onSelect: () => {
                        setDeleting(row)
                      },
                    },
                  ]
                : []),
            ]}
          />
        )}
      />
      {dialog && (
        <HolidayDialog
          id={dialog.id}
          onClose={() => {
            setDialog(null)
          }}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title={`Delete ${deleting?.name ?? 'holiday'}`}
        description="Are you sure you want to Delete this? The day becomes a working day again."
        confirmLabel="Yes"
        cancelLabel="No"
        variant="destructive"
        onConfirm={() => {
          if (deleting) {
            remove.mutate(
              { id: deleting.id, rowVersion: deleting.rowVersion },
              {
                onError: (error) => {
                  toast.error(
                    error instanceof ApiError ? error.message : 'Could not delete the holiday.',
                  )
                },
              },
            )
          }
        }}
      />
    </>
  )
}
