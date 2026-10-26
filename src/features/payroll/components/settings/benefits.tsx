import { useId, useState } from 'react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { XCircle } from 'lucide-react'
import { z } from 'zod'

import {
  CheckboxField,
  FieldLayoutContext,
  SelectField,
  TextareaField,
  TextField,
} from '@/components/form'
import { type DataTableColumn, RowActionsMenu, rowMenuItemClass } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

import { BENEFIT_TYPE_LABELS, INFO_TYPE_LABELS } from '../../constants'
import {
  useDeleteResource,
  useOrganisationLookup,
  useResource,
  useResourceList,
  useResourceLookup,
  useSaveResource,
} from '../../hooks/use-payroll'
import { personHint } from '../../hooks/use-payroll-records'
import {
  type Benefit,
  BENEFIT_TYPES,
  type BenefitField,
  INFO_TYPES,
} from '../../types/payroll.types'
import { btn, toolbarButton } from '../../utils/styles'
import { EmployeeSearchSelect } from '../shared/employee-search-select'
import { NoRecord } from '../shared/no-record'
import { PayrollDialog } from '../shared/payroll-dialog'
import { SearchSelect, SearchSelectField } from '../shared/search-select'
import { CreateButton, DeleteConfirm, SettingsRowMenu } from './settings-common'
import {
  applyApiError,
  type DialogState,
  numberText,
  optionalNumberText,
  orNull,
  sectionHeading,
  toOptionalNumber,
  yesNo,
} from './settings-helpers'
import { SettingsTable, ViewHeader } from './settings-list'
import { SETTINGS_PAGE_SIZE } from './settings-nav'
import { rowMenuHandlers, useSettingsCan } from './settings-permissions'

let counter = 0
/** Whom a benefit's employee members come from (former staff too, as on the list). */
const PEOPLE = { permission: 'payroll.settings.rewards.view', includeInactive: true }

const localKey = (prefix: string) => {
  counter += 1
  return `${prefix}_${Date.now().toString(36)}_${counter}`
}

/** A field in the dialog's list (the key only lives in the browser). */
type FieldRow = Omit<BenefitField, 'id'> & { key: string }

// --- Additional Information Create ---------------------------------------------------------

const infoSchema = z
  .object({
    name: z.string().trim().min(1, 'Enter a name').max(200, 'Keep it under 200 characters'),
    type: z.string().min(1, 'Choose the type'),
    required: z.boolean(),
    min: optionalNumberText,
    max: optionalNumberText,
    fieldValue: z.string().trim().max(2000),
  })
  .refine(
    (value) => {
      const min = toOptionalNumber(value.min)
      const max = toOptionalNumber(value.max)
      return min === null || max === null || max >= min
    },
    { message: 'The maximum must be at least the minimum', path: ['max'] },
  )
  .superRefine((value, context) => {
    const text = value.fieldValue
    const fail = (message: string) => {
      context.addIssue({ code: 'custom', message, path: ['fieldValue'] })
    }
    if (text === '') {
      if (value.required) fail('Enter the value')
      return
    }
    const min = toOptionalNumber(value.min)
    const max = toOptionalNumber(value.max)
    if (value.type === 'number') {
      const number = Number(text)
      if (!Number.isFinite(number)) fail('Enter a number')
      else if ((min !== null && number < min) || (max !== null && number > max)) {
        fail('The value is outside the allowed range')
      }
    }
    if (
      value.type === 'string' &&
      ((min !== null && text.length < min) || (max !== null && text.length > max))
    ) {
      fail('The value is not the allowed length')
    }
  })
type InfoValues = z.infer<typeof infoSchema>

const conditionText = (item: FieldRow) => {
  if (item.fieldType === 'number' && (item.minValue !== null || item.maxValue !== null)) {
    return `${item.minValue ?? '…'} – ${item.maxValue ?? '…'}`
  }
  if (item.fieldType === 'string' && (item.minLength !== null || item.maxLength !== null)) {
    return `Length ${item.minLength ?? '…'} – ${item.maxLength ?? '…'}`
  }
  return '—'
}

/** "Additional Information Create": Name, Type, Required, its Conditions and the value (checked against them). */
function AdditionalInfoDialog({
  info,
  onSave,
  onClose,
}: {
  info: FieldRow | null
  onSave: (info: FieldRow) => void
  onClose: () => void
}) {
  const form = useForm<InfoValues>({
    resolver: zodResolver(infoSchema),
    defaultValues: {
      name: info?.name ?? '',
      type: info?.fieldType ?? '',
      required: info?.isRequired ?? false,
      min: numberText(info?.fieldType === 'string' ? info.minLength : info?.minValue),
      max: numberText(info?.fieldType === 'string' ? info.maxLength : info?.maxValue),
      fieldValue: info?.fieldValue ?? '',
    },
  })
  const type = useWatch({ control: form.control, name: 'type' })
  const submit = form.handleSubmit((values) => {
    const picked = INFO_TYPES.find((item) => item === values.type)
    if (!picked) return
    const min = toOptionalNumber(values.min)
    const max = toOptionalNumber(values.max)
    onSave({
      key: info?.key ?? localKey('bf'),
      name: values.name,
      fieldType: picked,
      isRequired: values.required,
      minValue: picked === 'number' ? min : null,
      maxValue: picked === 'number' ? max : null,
      minLength: picked === 'string' && min !== null ? Math.max(0, Math.round(min)) : null,
      maxLength: picked === 'string' && max !== null ? Math.max(0, Math.round(max)) : null,
      fieldValue: values.fieldValue || null,
    })
    onClose()
  })
  return (
    <PayrollDialog
      title={info ? 'Additional Information Edit' : 'Additional Information Create'}
      onClose={onClose}
      formId="additional-info-form"
      className="max-w-2xl"
    >
      <form
        id="additional-info-form"
        noValidate
        onSubmit={(event) => void submit(event)}
        className="grid gap-5"
      >
        <TextField
          control={form.control}
          name="name"
          label="Name"
          required
          placeholder="Enter name"
        />
        <SelectField
          control={form.control}
          name="type"
          label="Type"
          placeholder="Select Type"
          options={INFO_TYPES.map((value) => ({ value, label: INFO_TYPE_LABELS[value] }))}
        />
        <CheckboxField control={form.control} name="required" label="Required" />
        {(type === 'number' || type === 'string') && (
          <section aria-label="Conditions" className="grid gap-4">
            <h3 className={sectionHeading}>Conditions</h3>
            <TextField
              control={form.control}
              name="min"
              label={type === 'number' ? 'Min' : 'Min Length'}
              inputMode="numeric"
            />
            <TextField
              control={form.control}
              name="max"
              label={type === 'number' ? 'Max' : 'Max Length'}
              inputMode="numeric"
            />
          </section>
        )}
        <TextField
          control={form.control}
          name="fieldValue"
          label="Value"
          description="The benefit's value for this field (required fields need one)."
        />
      </form>
    </PayrollDialog>
  )
}

// --- Benefit Create ------------------------------------------------------------------------------

const memberSchema = z.object({
  key: z.string(),
  kind: z.enum(['employee', 'group']),
  refId: z.string().min(1, 'Choose who'),
})

const schema = z
  .object({
    name: z.string().trim().min(1, 'Enter a name').max(200, 'Keep it under 200 characters'),
    type: z.string().min(1, 'Choose the type'),
    payItemId: z.string().min(1, 'Choose the pay item'),
    formulaId: z.string().nullable(),
    group: z.boolean(),
    accumulative: z.boolean(),
    description: z.string().trim().max(2000),
    members: z.array(memberSchema).max(5000),
  })
  .refine((value) => !value.group || value.members.length > 0, {
    message: 'Add at least one member to a group benefit',
    path: ['members'],
  })
type Values = z.infer<typeof schema>

/**
 * "Benefit Create". Members and Additional Information only come with the benefit itself
 * (`GET /benefits/{id}`), so editing or viewing loads it first.
 */
function BenefitDialog({
  state,
  onClose,
}: {
  state: Exclude<DialogState<Benefit>, null>
  onClose: () => void
}) {
  const detail = useResource('benefits', state.mode === 'create' ? null : state.record.id)
  if (state.mode !== 'create' && !detail.data) {
    return (
      <PayrollDialog
        title="Benefit"
        onClose={onClose}
        formId="benefit-form"
        readOnly
        className="max-w-5xl"
      >
        <p className="text-sm text-muted-foreground">
          {detail.isError ? 'The benefit could not be loaded.' : 'Loading…'}
        </p>
      </PayrollDialog>
    )
  }
  return (
    <BenefitForm
      mode={state.mode}
      record={state.mode === 'create' ? undefined : detail.data}
      onClose={onClose}
    />
  )
}

function BenefitForm({
  mode,
  record,
  onClose,
}: {
  mode: 'create' | 'edit' | 'view'
  record: Benefit | undefined
  onClose: () => void
}) {
  const readOnly = mode === 'view'
  const save = useSaveResource('benefits')
  const payItems = useResourceLookup('payItems')
  const formulaList = useResourceLookup('formulas')
  const groups = useOrganisationLookup('employee-groups')
  const headingId = useId()
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<FieldRow[]>(
    (record?.fields ?? []).map(({ id, ...field }) => ({ ...field, key: id ?? localKey('bf') })),
  )
  const [infoDialog, setInfoDialog] = useState<{ info: FieldRow | null } | null>(null)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: record?.name ?? '',
      type: record?.benefitType ?? '',
      payItemId: record?.payItemId ?? '',
      formulaId: record?.formulaId ?? '',
      group: record?.isGroup ?? false,
      accumulative: record?.isAccumulative ?? false,
      description: record?.description ?? '',
      members: (record?.members ?? []).map((member) => ({
        key: member.id,
        kind: member.employeeGroupId ? ('group' as const) : ('employee' as const),
        refId: member.employeeGroupId ?? member.employeeId ?? '',
      })),
    },
  })
  const members = useFieldArray({ control: form.control, name: 'members', keyName: 'rowKey' })
  const group = useWatch({ control: form.control, name: 'group' })
  const memberKinds = useWatch({ control: form.control, name: 'members' })
  // Members' names until the employee picker has read them.
  const knownPeople = (record?.members ?? []).flatMap((member) =>
    member.employeeId && member.employeeName
      ? [{ value: member.employeeId, label: member.employeeName }]
      : [],
  )
  const groupOptions = (groups.data ?? []).map((item) => ({ value: item.id, label: item.name }))

  const submit = form.handleSubmit(async (values) => {
    setError(null)
    const benefitType = BENEFIT_TYPES.find((item) => item === values.type)
    if (!benefitType) return
    try {
      await save.mutateAsync({
        id: record?.id,
        input: {
          name: values.name,
          benefitType,
          payItemId: values.payItemId,
          formulaId: orNull(values.formulaId),
          isGroup: values.group,
          isAccumulative: values.accumulative,
          description: values.description || null,
          members: values.group
            ? values.members.map((member) =>
                member.kind === 'group'
                  ? { employeeId: null, employeeGroupId: member.refId }
                  : { employeeId: member.refId, employeeGroupId: null },
              )
            : [],
          fields: info.map(({ key: _key, ...field }) => field),
          rowVersion: record?.rowVersion ?? null,
        },
      })
      onClose()
    } catch (failure) {
      setError(applyApiError(failure, form.setError, ['name', 'payItemId', 'formulaId', 'members']))
    }
  })
  const title =
    mode === 'create' ? 'Benefit Create' : mode === 'edit' ? 'Benefit Edit' : 'Benefit View'

  return (
    <>
      <PayrollDialog
        title={title}
        onClose={onClose}
        formId="benefit-form"
        readOnly={readOnly}
        pending={save.isPending}
        error={error}
        className="max-w-5xl"
      >
        <form
          id="benefit-form"
          noValidate
          onSubmit={(event) => void submit(event)}
          className="grid gap-5"
        >
          <TextField control={form.control} name="name" label="Name" required disabled={readOnly} />
          <SearchSelectField
            control={form.control}
            name="type"
            label="Type"
            placeholder="Select Type"
            required
            disabled={readOnly}
            options={BENEFIT_TYPES.map((value) => ({ value, label: BENEFIT_TYPE_LABELS[value] }))}
          />
          <SearchSelectField
            control={form.control}
            name="payItemId"
            label="Payitem"
            placeholder="Select Payitem"
            required
            disabled={readOnly}
            options={(payItems.data?.data ?? []).map((item) => ({
              value: item.id,
              label: item.name,
            }))}
          />
          <SearchSelectField
            control={form.control}
            name="formulaId"
            label="Formula"
            placeholder="Select Formula"
            clearable
            disabled={readOnly}
            options={(formulaList.data?.data ?? []).map((item) => ({
              value: item.id,
              label: item.name,
              hint: item.expression,
            }))}
          />
          <FieldLayoutContext value="vertical">
            <div className="flex flex-wrap items-center gap-x-10 gap-y-3">
              <Controller
                control={form.control}
                name="group"
                render={({ field }) => (
                  <label className="flex items-center gap-3 font-inter text-sm text-heading sm:text-base">
                    Group
                    <Checkbox
                      checked={field.value}
                      disabled={readOnly}
                      onCheckedChange={(checked) => {
                        field.onChange(checked === true)
                      }}
                    />
                  </label>
                )}
              />
              <Controller
                control={form.control}
                name="accumulative"
                render={({ field }) => (
                  <label className="flex items-center gap-3 font-inter text-sm text-heading sm:text-base">
                    Accumulative
                    <Checkbox
                      checked={field.value}
                      disabled={readOnly}
                      onCheckedChange={(checked) => {
                        field.onChange(checked === true)
                      }}
                    />
                  </label>
                )}
              />
            </div>
          </FieldLayoutContext>
          <TextareaField
            control={form.control}
            name="description"
            label="Description"
            disabled={readOnly}
          />

          <section aria-labelledby={`${headingId}-info`} className="grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <h3 id={`${headingId}-info`} className={sectionHeading}>
                Additional Information
              </h3>
              {!readOnly && (
                <Button
                  type="button"
                  onClick={() => {
                    setInfoDialog({ info: null })
                  }}
                  className={cn(toolbarButton, btn.navy, 'min-w-[6.625rem]')}
                >
                  +Add
                </Button>
              )}
            </div>
            {info.length === 0 ? (
              <NoRecord />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[32rem] text-left text-sm">
                  <caption className="sr-only">Additional Information</caption>
                  <thead>
                    <tr className="bg-[#17263A]/[0.06] text-[0.6875rem] text-title dark:bg-muted">
                      <th scope="col" className="rounded-l-md px-3 py-2.5 font-medium">
                        Name
                      </th>
                      <th scope="col" className="px-3 py-2.5 font-medium">
                        Type
                      </th>
                      <th scope="col" className="px-3 py-2.5 font-medium">
                        Required
                      </th>
                      <th scope="col" className="px-3 py-2.5 font-medium">
                        Conditions
                      </th>
                      <th scope="col" className="rounded-r-md px-3 py-2.5 text-center font-medium">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {info.map((item) => (
                      <tr
                        key={item.key}
                        className="border-b text-[0.6875rem] text-grey last:border-b-0"
                      >
                        <td className="px-3 py-2.5">{item.name}</td>
                        <td className="px-3 py-2.5">{INFO_TYPE_LABELS[item.fieldType]}</td>
                        <td className="px-3 py-2.5">{yesNo(item.isRequired)}</td>
                        <td className="px-3 py-2.5">{conditionText(item)}</td>
                        <td className="px-3 py-2.5 text-center">
                          {!readOnly && (
                            <RowActionsMenu
                              itemClassName={rowMenuItemClass.inter}
                              label={`Actions for ${item.name}`}
                              actions={[
                                {
                                  label: 'Edit',
                                  onSelect: () => {
                                    setInfoDialog({ info: item })
                                  },
                                },
                                {
                                  label: 'Delete',
                                  variant: 'destructive',
                                  onSelect: () => {
                                    setInfo((current) =>
                                      current.filter((entry) => entry.key !== item.key),
                                    )
                                  },
                                },
                              ]}
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {group && (
            <section aria-labelledby={`${headingId}-members`} className="grid gap-3">
              <div className="flex items-center justify-between gap-3">
                <h3 id={`${headingId}-members`} className={sectionHeading}>
                  Members
                  <span aria-hidden="true" className="ml-1 align-super text-base text-[#E50141]">
                    *
                  </span>
                </h3>
                {!readOnly && (
                  <Button
                    type="button"
                    onClick={() => {
                      members.append({ key: localKey('bm'), kind: 'employee', refId: '' })
                    }}
                    className={cn(toolbarButton, btn.navy, 'min-w-[6.625rem]')}
                  >
                    +Add
                  </Button>
                )}
              </div>
              {members.fields.length === 0 ? (
                <NoRecord />
              ) : (
                <div className="grid gap-3">
                  <div className="hidden grid-cols-[10rem_minmax(0,1fr)_4rem] gap-4 px-2 text-sm text-[#303030] sm:grid dark:text-heading">
                    <span>Member</span>
                    <span>Employee / Group</span>
                    <span className="text-center">Actions</span>
                  </div>
                  {members.fields.map((member, index) => {
                    const kind = memberKinds[index]?.kind ?? member.kind
                    return (
                      <div
                        key={member.rowKey}
                        className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)_4rem] sm:items-start sm:gap-4"
                      >
                        <Controller
                          control={form.control}
                          name={`members.${index}.kind`}
                          render={({ field }) => (
                            <SearchSelect
                              aria-label={`Member ${index + 1} kind`}
                              value={field.value}
                              onChange={(value) => {
                                field.onChange(value === 'group' ? 'group' : 'employee')
                                form.setValue(`members.${index}.refId`, '')
                              }}
                              options={[
                                { value: 'employee', label: 'Employee' },
                                { value: 'group', label: 'Employee Group' },
                              ]}
                              placeholder="Select"
                              disabled={readOnly}
                            />
                          )}
                        />
                        <Controller
                          control={form.control}
                          name={`members.${index}.refId`}
                          render={({ field, fieldState }) => (
                            <div className="grid gap-1">
                              {kind === 'group' ? (
                                <SearchSelect
                                  aria-label={`Member ${index + 1} group`}
                                  value={field.value}
                                  onChange={(value) => {
                                    field.onChange(value ?? '')
                                  }}
                                  options={groupOptions}
                                  placeholder="Select Employee Group"
                                  disabled={readOnly}
                                  aria-invalid={Boolean(fieldState.error)}
                                />
                              ) : (
                                <EmployeeSearchSelect
                                  aria-label={`Member ${index + 1} employee`}
                                  value={field.value || null}
                                  onChange={(value) => {
                                    field.onChange(value ?? '')
                                  }}
                                  filters={PEOPLE}
                                  known={knownPeople}
                                  hint={personHint}
                                  placeholder="Select Employee"
                                  disabled={readOnly}
                                  aria-invalid={Boolean(fieldState.error)}
                                />
                              )}
                              {fieldState.error && (
                                <span className="text-xs text-destructive">
                                  {fieldState.error.message}
                                </span>
                              )}
                            </div>
                          )}
                        />
                        <div className="flex justify-center">
                          <button
                            type="button"
                            disabled={readOnly}
                            aria-label={`Remove member ${index + 1}`}
                            onClick={() => {
                              members.remove(index)
                            }}
                            className="inline-flex size-10 items-center justify-center rounded-full text-[#E50141] hover:bg-[#E50141]/10 disabled:opacity-40"
                          >
                            <XCircle aria-hidden="true" className="size-5" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              {form.formState.errors.members?.message && (
                <p className="text-xs text-destructive">{form.formState.errors.members.message}</p>
              )}
            </section>
          )}
        </form>
      </PayrollDialog>
      {infoDialog && (
        <AdditionalInfoDialog
          info={infoDialog.info}
          onSave={(next) => {
            setInfo((current) =>
              current.some((entry) => entry.key === next.key)
                ? current.map((entry) => (entry.key === next.key ? next : entry))
                : [...current, next],
            )
          }}
          onClose={() => {
            setInfoDialog(null)
          }}
        />
      )}
    </>
  )
}

const columns: DataTableColumn<Benefit>[] = [
  { id: 'name', header: 'Name', cell: (row) => row.name, mobile: 'heading' },
  { id: 'type', header: 'Type', cell: (row) => BENEFIT_TYPE_LABELS[row.benefitType] },
  { id: 'payItem', header: 'Payitem', cell: (row) => row.payItemName },
  {
    id: 'members',
    header: 'Members',
    cell: (row) => (row.isGroup ? row.memberCount : 'Everyone'),
  },
  {
    id: 'description',
    header: 'Description',
    cell: (row) => (
      <span className="line-clamp-2 max-w-72 whitespace-normal">{row.description ?? '—'}</span>
    ),
  },
]

/** Rewards → Benefits: allowances, bonuses and rewards, for everyone or a group. */
export function BenefitsView() {
  const [page, setPage] = useState(1)
  const [dialog, setDialog] = useState<DialogState<Benefit>>(null)
  const [deleting, setDeleting] = useState<Benefit | null>(null)
  const list = useResourceList('benefits', { page, pageSize: SETTINGS_PAGE_SIZE })
  const remove = useDeleteResource('benefits')
  const may = useSettingsCan('rewards')

  return (
    <>
      <ViewHeader
        tab="rewards"
        view="benefits"
        actions={
          may.create && (
            <CreateButton
              onClick={() => {
                setDialog({ mode: 'create' })
              }}
            />
          )
        }
      />
      <SettingsTable
        caption="Benefits"
        columns={columns}
        page={list.data}
        getRowId={(row) => row.id}
        isLoading={list.isPending}
        isFetching={list.isFetching}
        onPageChange={setPage}
        rowActions={(row) => (
          <SettingsRowMenu
            label={`Actions for ${row.name}`}
            {...rowMenuHandlers(may, row, setDialog, setDeleting)}
          />
        )}
      />
      {dialog && (
        <BenefitDialog
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
      />
    </>
  )
}
