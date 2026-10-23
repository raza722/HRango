import { useId, useState } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import {
  useDeleteSetting,
  useSaveSetting,
  useSettingsList,
  useSettingsLookups,
} from '../../hooks/use-attendance-settings'
import {
  type Holiday,
  HOLIDAY_RULE_TYPES,
  type HolidayRule,
  type HolidayRuleType,
  type SettingsLookups,
} from '../../types/settings.types'
import {
  compactTableClass,
  navyButtonClass,
  poppinsDialogTitleClass,
  poppinsFieldsClass,
  settingsDialogButtonClass,
} from '../../utils/settings-styles'
import { DateBox } from '../shared/date-box'
import { MultiSelect } from './multi-select'
import { SettingsListCard } from './settings-list'

const RULE_TYPE_LABELS: Record<HolidayRuleType, string> = {
  religion: 'Religion',
  'geo-location': 'Geo Location',
  organization: 'Organization Structure',
  employee: 'Employee',
}

const longDate = (date: string) => format(parse(date, 'yyyy-MM-dd', new Date()), 'MMMM d, yyyy')

function Field({
  label,
  required,
  children,
  id,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
  id: string
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
    </div>
  )
}

function Choice({
  id,
  value,
  onChange,
  options,
  placeholder,
}: {
  id: string
  value: string | null
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  placeholder: string
}) {
  return (
    <Select value={value ?? ''} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full">
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

/** Who a rule takes in, in words ("Parsi", "Dubai, United Arab Emirates"…). */
function appliesTo(rule: HolidayRule, lookups: SettingsLookups | undefined): string {
  if (!lookups) return ''
  switch (rule.type) {
    case 'religion':
      return rule.religion ?? ''
    case 'geo-location':
      return [
        lookups.cities.find((item) => item.id === rule.cityId)?.name,
        lookups.regions.find((item) => item.code === rule.regionCode)?.name,
        lookups.countries.find((item) => item.code === rule.countryCode)?.name,
      ]
        .filter(Boolean)
        .join(', ')
    case 'organization':
      return [
        lookups.locations.find((item) => item.id === rule.locationId)?.name,
        lookups.branches.find((item) => item.id === rule.branchId)?.name,
      ]
        .filter(Boolean)
        .join(' · ')
    case 'employee':
      return lookups.employees
        .filter((item) => rule.employeeIds.includes(item.id))
        .map((item) => item.name)
        .join(', ')
  }
}

const emptyRule = (): HolidayRule => ({
  id: `hr_${Date.now().toString(36)}`,
  name: '',
  type: 'religion',
  religion: null,
  countryCode: null,
  regionCode: null,
  cityId: null,
  locationId: null,
  branchId: null,
  employeeIds: [],
})

/** "Holiday Rule Create": Name, Type, and the type's fields. */
function HolidayRuleDialog({
  rule,
  onSave,
  onClose,
}: {
  rule: HolidayRule | null
  onSave: (rule: HolidayRule) => void
  onClose: () => void
}) {
  const lookups = useSettingsLookups()
  const ids = { name: useId(), type: useId(), a: useId(), b: useId(), c: useId() }
  const [draft, setDraft] = useState<HolidayRule>(() => rule ?? emptyRule())
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<HolidayRule>) => {
    setDraft((current) => ({ ...current, ...patch }))
    setError(null)
  }
  const data = lookups.data

  const submit = () => {
    const missing = !draft.name.trim()
      ? 'Enter a name'
      : draft.type === 'religion' && !draft.religion
        ? 'Choose a religion'
        : draft.type === 'geo-location' &&
            (!draft.countryCode || !draft.regionCode || !draft.cityId)
          ? 'Choose the country, state and city'
          : draft.type === 'organization' && (!draft.locationId || !draft.branchId)
            ? 'Choose the location and branch'
            : draft.type === 'employee' && draft.employeeIds.length === 0
              ? 'Choose the employees'
              : null
    if (missing) {
      setError(missing)
      return
    }
    onSave({ ...draft, name: draft.name.trim() })
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
        <Field label="Name" required id={ids.name}>
          <Input
            id={ids.name}
            value={draft.name}
            placeholder="Enter name"
            maxLength={80}
            onChange={(event) => {
              set({ name: event.target.value })
            }}
          />
        </Field>
        <Field label="Type" required id={ids.type}>
          <Choice
            id={ids.type}
            value={draft.type}
            placeholder="Select"
            options={HOLIDAY_RULE_TYPES.map((type) => ({
              value: type,
              label: RULE_TYPE_LABELS[type],
            }))}
            onChange={(value) => {
              const type = HOLIDAY_RULE_TYPES.find((item) => item === value) ?? 'religion'
              set({ ...emptyRule(), id: draft.id, name: draft.name, type })
            }}
          />
        </Field>
        <h3 className="text-lg font-medium text-[#202020] dark:text-heading">Fields</h3>
        {draft.type === 'religion' && (
          <Field label="Religion" required id={ids.a}>
            <Choice
              id={ids.a}
              value={draft.religion}
              placeholder="Select Religion"
              options={(data?.religions ?? []).map((value) => ({ value, label: value }))}
              onChange={(religion) => {
                set({ religion })
              }}
            />
          </Field>
        )}
        {draft.type === 'geo-location' && (
          <>
            <Field label="Country" required id={ids.a}>
              <Choice
                id={ids.a}
                value={draft.countryCode}
                placeholder="Select Country"
                options={(data?.countries ?? []).map((item) => ({
                  value: item.code,
                  label: item.name,
                }))}
                onChange={(countryCode) => {
                  set({ countryCode, regionCode: null, cityId: null })
                }}
              />
            </Field>
            <Field label="State" required id={ids.b}>
              <Choice
                id={ids.b}
                value={draft.regionCode}
                placeholder="Select State"
                options={(data?.regions ?? [])
                  .filter((item) => item.countryCode === draft.countryCode)
                  .map((item) => ({ value: item.code, label: item.name }))}
                onChange={(regionCode) => {
                  set({ regionCode, cityId: null })
                }}
              />
            </Field>
            <Field label="City" required id={ids.c}>
              <Choice
                id={ids.c}
                value={draft.cityId}
                placeholder="Select City"
                options={(data?.cities ?? [])
                  .filter((item) => item.regionCode === draft.regionCode)
                  .map((item) => ({ value: item.id, label: item.name }))}
                onChange={(cityId) => {
                  set({ cityId })
                }}
              />
            </Field>
          </>
        )}
        {draft.type === 'organization' && (
          <>
            <Field label="Location" required id={ids.a}>
              <Choice
                id={ids.a}
                value={draft.locationId}
                placeholder="Select Location"
                options={(data?.locations ?? []).map((item) => ({
                  value: item.id,
                  label: item.name,
                }))}
                onChange={(locationId) => {
                  set({ locationId })
                }}
              />
            </Field>
            <Field label="Branch" required id={ids.b}>
              <Choice
                id={ids.b}
                value={draft.branchId}
                placeholder="Select Branch"
                options={(data?.branches ?? []).map((item) => ({
                  value: item.id,
                  label: item.name,
                }))}
                onChange={(branchId) => {
                  set({ branchId })
                }}
              />
            </Field>
          </>
        )}
        {draft.type === 'employee' && (
          <MultiSelect
            label="Employees"
            options={(data?.employees ?? []).map((item) => ({
              value: item.id,
              label: `${item.name} (${item.code})`,
            }))}
            value={draft.employeeIds}
            onChange={(employeeIds) => {
              set({ employeeIds })
            }}
          />
        )}
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
    </AppDialog>
  )
}

/** "Create Holiday": exempt or not, name, dates, description and the rules. */
function HolidayDialog({ record, onClose }: { record: Holiday | null; onClose: () => void }) {
  const save = useSaveSetting('holidays')
  const lookups = useSettingsLookups()
  const ids = { name: useId(), description: useId() }
  const [exempt, setExempt] = useState(record?.attendanceExempt ?? true)
  const [name, setName] = useState(record?.name ?? '')
  const [startDate, setStartDate] = useState(record?.startDate ?? '')
  const [endDate, setEndDate] = useState(record?.endDate ?? '')
  const [description, setDescription] = useState(record?.description ?? '')
  const [rules, setRules] = useState<HolidayRule[]>(record?.rules ?? [])
  const [ruleDialog, setRuleDialog] = useState<{ rule: HolidayRule | null } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    const problem = !name.trim()
      ? 'Enter the holiday name.'
      : !startDate || !endDate
        ? 'Choose the start and end dates.'
        : endDate < startDate
          ? 'End Date must be on or after Start Date.'
          : null
    if (problem) {
      setError(problem)
      return
    }
    try {
      await save.mutateAsync({
        id: record?.id,
        input: {
          name: name.trim(),
          startDate,
          endDate,
          description: description.trim(),
          attendanceExempt: exempt,
          rules,
        },
      })
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : 'Could not save.')
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
            <Button
              size="lg"
              disabled={save.isPending}
              onClick={() => void submit()}
              className={cn(settingsDialogButtonClass, navyButtonClass)}
            >
              {record ? 'Save Changes' : 'Create'}
            </Button>
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
          <div className="grid gap-4 @2xl:grid-cols-3">
            <Field label="Name" required id={ids.name}>
              <Input
                id={ids.name}
                value={name}
                maxLength={80}
                placeholder="Enter name"
                onChange={(event) => {
                  setName(event.target.value)
                  setError(null)
                }}
              />
            </Field>
            <DateBox
              label="Start Date"
              variant="form"
              required
              value={startDate}
              onChange={(value) => {
                setStartDate(value)
                if (!endDate || endDate < value) setEndDate(value)
              }}
            />
            <DateBox
              label="End Date"
              variant="form"
              required
              value={endDate}
              minDate={startDate ? parse(startDate, 'yyyy-MM-dd', new Date()) : undefined}
              onChange={setEndDate}
            />
          </div>
          <Field label="Description" id={ids.description}>
            <Textarea
              id={ids.description}
              rows={3}
              maxLength={500}
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
                      <th scope="col">Name</th>
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
                        <td>{rule.name}</td>
                        <td>{RULE_TYPE_LABELS[rule.type]}</td>
                        <td>{appliesTo(rule, lookups.data)}</td>
                        <td className="text-center">
                          <RowActionsMenu
                            itemClassName={rowMenuItemClass.poppins}
                            label={`Actions for rule ${rule.name}`}
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
            setRules((current) =>
              current.some((item) => item.id === next.id)
                ? current.map((item) => (item.id === next.id ? next : item))
                : [...current, next],
            )
          }}
        />
      )}
    </>
  )
}

const columns: DataTableColumn<Holiday>[] = [
  { id: 'name', header: 'Name', cell: (row) => row.name, mobile: 'heading' },
  { id: 'start', header: 'Start Date', cell: (row) => longDate(row.startDate) },
  { id: 'end', header: 'End Date', cell: (row) => longDate(row.endDate) },
  {
    id: 'description',
    header: 'Description',
    cell: (row) => (
      <span className="line-clamp-1 max-w-72 whitespace-normal">
        {row.description || '—'}
        {row.rules.length > 0 && (
          <span className="text-muted-foreground">
            {' '}
            · {row.rules.length} rule{row.rules.length === 1 ? '' : 's'}
          </span>
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
  const [dialog, setDialog] = useState<{ record: Holiday | null } | null>(null)
  const [deleting, setDeleting] = useState<Holiday | null>(null)
  const yearId = useId()
  const list = useSettingsList('holidays', {
    page,
    pageSize: 10,
    year,
    ...(search ? { search } : {}),
  })
  const remove = useDeleteSetting('holidays')

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
        onCreate={() => {
          setDialog({ record: null })
        }}
        emptyText={`No holidays in ${year}.`}
        rowActions={(row) => (
          <RowActionsMenu
            itemClassName={rowMenuItemClass.poppins}
            label={`Actions for ${row.name}`}
            actions={[
              {
                label: 'View / Edit',
                onSelect: () => {
                  setDialog({ record: row })
                },
              },
              {
                label: 'Delete',
                variant: 'destructive',
                onSelect: () => {
                  setDeleting(row)
                },
              },
            ]}
          />
        )}
      />
      {dialog && (
        <HolidayDialog
          record={dialog.record}
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
            remove.mutate(deleting.id, {
              onError: () => {
                toast.error('Could not delete the holiday.')
              },
            })
          }
        }}
      />
    </>
  )
}
