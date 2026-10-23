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
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import { BENEFIT_TYPE_LABELS, INFO_TYPE_LABELS } from '../../constants'
import {
  useDeleteResource,
  usePayrollLookups,
  useResourceList,
  useSaveResource,
} from '../../hooks/use-payroll'
import {
  type AdditionalInfo,
  type Benefit,
  BENEFIT_TYPES,
  INFO_TYPES,
} from '../../types/payroll.types'
import { btn, toolbarButton } from '../../utils/styles'
import { NoRecord } from '../shared/no-record'
import { PayrollDialog } from '../shared/payroll-dialog'
import { SearchSelect, SearchSelectField } from '../shared/search-select'
import { CreateButton, DeleteConfirm, SettingsRowMenu } from './settings-common'
import {
  applyApiError,
  type DialogState,
  numberText,
  optionalNumberText,
  sectionHeading,
  toOptionalNumber,
  yesNo,
} from './settings-helpers'
import { SettingsTable, ViewHeader } from './settings-list'
import { SETTINGS_PAGE_SIZE } from './settings-nav'

let counter = 0
const localId = (prefix: string) => {
  counter += 1
  return `${prefix}_${Date.now().toString(36)}_${counter}`
}

// --- Additional Information Create ---------------------------------------------------------

const infoSchema = z
  .object({
    name: z.string().trim().min(1, 'Enter a name').max(80, 'Keep it under 80 characters'),
    type: z.string().min(1, 'Choose the type'),
    required: z.boolean(),
    min: optionalNumberText,
    max: optionalNumberText,
  })
  .refine(
    (value) => {
      const min = toOptionalNumber(value.min)
      const max = toOptionalNumber(value.max)
      return min === null || max === null || max >= min
    },
    { message: 'The maximum must be at least the minimum', path: ['max'] },
  )
type InfoValues = z.infer<typeof infoSchema>

/** "Additional Information Create": Name, Type, Required and its Conditions. */
function AdditionalInfoDialog({
  info,
  onSave,
  onClose,
}: {
  info: AdditionalInfo | null
  onSave: (info: AdditionalInfo) => void
  onClose: () => void
}) {
  const form = useForm<InfoValues>({
    resolver: zodResolver(infoSchema),
    defaultValues: {
      name: info?.name ?? '',
      type: info?.type ?? '',
      required: info?.required ?? false,
      min: numberText(info?.min),
      max: numberText(info?.max),
    },
  })
  const type = useWatch({ control: form.control, name: 'type' })
  const submit = form.handleSubmit((values) => {
    const picked = INFO_TYPES.find((item) => item === values.type)
    if (!picked) return
    onSave({
      id: info?.id ?? localId('ai'),
      name: values.name,
      type: picked,
      required: values.required,
      min: picked === 'boolean' ? null : toOptionalNumber(values.min),
      max: picked === 'boolean' ? null : toOptionalNumber(values.max),
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
      </form>
    </PayrollDialog>
  )
}

// --- Benefit Create ------------------------------------------------------------------------------

const memberSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1, 'Enter a name').max(80),
  formulaId: z.string().nullable(),
})

const schema = z
  .object({
    name: z.string().trim().min(1, 'Enter a name').max(80, 'Keep it under 80 characters'),
    type: z.string().min(1, 'Choose the type'),
    payItemId: z.string().min(1, 'Choose the pay item'),
    group: z.boolean(),
    accumulative: z.boolean(),
    description: z.string().trim().max(500),
    members: z.array(memberSchema).max(100),
  })
  .refine((value) => !value.group || value.members.length > 0, {
    message: 'Add at least one member to a group benefit',
    path: ['members'],
  })
type Values = z.infer<typeof schema>

function BenefitDialog({
  state,
  onClose,
}: {
  state: Exclude<DialogState<Benefit>, null>
  onClose: () => void
}) {
  const record = state.mode === 'create' ? undefined : state.record
  const readOnly = state.mode === 'view'
  const save = useSaveResource('benefits')
  const lookups = usePayrollLookups()
  const headingId = useId()
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<AdditionalInfo[]>(record?.additionalInfo ?? [])
  const [infoDialog, setInfoDialog] = useState<{ info: AdditionalInfo | null } | null>(null)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: record?.name ?? '',
      type: record?.type ?? '',
      payItemId: record?.payItemId ?? '',
      group: record?.group ?? false,
      accumulative: record?.accumulative ?? false,
      description: record?.description ?? '',
      members: record?.members ?? [],
    },
  })
  const members = useFieldArray({ control: form.control, name: 'members', keyName: 'key' })
  const group = useWatch({ control: form.control, name: 'group' })
  const formulas = (lookups.data?.formulas ?? []).map((item) => ({
    value: item.id,
    label: item.name,
  }))

  const submit = form.handleSubmit(async (values) => {
    setError(null)
    const type = BENEFIT_TYPES.find((item) => item === values.type)
    if (!type) return
    try {
      await save.mutateAsync({
        id: record?.id,
        input: {
          ...values,
          type,
          additionalInfo: info,
          members: values.group ? values.members : [],
        },
      })
      onClose()
    } catch (failure) {
      setError(applyApiError(failure, form.setError, ['name', 'payItemId', 'members']))
    }
  })
  const title =
    state.mode === 'create'
      ? 'Benefit Create'
      : state.mode === 'edit'
        ? 'Benefit Edit'
        : 'Benefit View'

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
            options={(lookups.data?.payItems ?? []).map((item) => ({
              value: item.id,
              label: item.name,
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
                        key={item.id}
                        className="border-b text-[0.6875rem] text-grey last:border-b-0"
                      >
                        <td className="px-3 py-2.5">{item.name}</td>
                        <td className="px-3 py-2.5">{INFO_TYPE_LABELS[item.type]}</td>
                        <td className="px-3 py-2.5">{yesNo(item.required)}</td>
                        <td className="px-3 py-2.5">
                          {item.type === 'boolean'
                            ? '—'
                            : `${item.type === 'string' ? 'Length ' : ''}${item.min ?? '…'} – ${item.max ?? '…'}`}
                        </td>
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
                                      current.filter((entry) => entry.id !== item.id),
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
                      members.append({ id: localId('bm'), name: '', formulaId: null })
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
                  <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)_4rem] gap-4 px-2 text-sm text-[#303030] sm:grid dark:text-heading">
                    <span>Name</span>
                    <span>Formula</span>
                    <span className="text-center">Actions</span>
                  </div>
                  {members.fields.map((member, index) => (
                    <div
                      key={member.key}
                      className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_4rem] sm:items-start sm:gap-4"
                    >
                      <Controller
                        control={form.control}
                        name={`members.${index}.name`}
                        render={({ field, fieldState }) => (
                          <div className="grid gap-1">
                            <Input
                              {...field}
                              aria-label={`Member ${index + 1} name`}
                              aria-invalid={Boolean(fieldState.error)}
                              placeholder="Enter name"
                              disabled={readOnly}
                            />
                            {fieldState.error && (
                              <span className="text-xs text-destructive">
                                {fieldState.error.message}
                              </span>
                            )}
                          </div>
                        )}
                      />
                      <Controller
                        control={form.control}
                        name={`members.${index}.formulaId`}
                        render={({ field }) => (
                          <SearchSelect
                            aria-label={`Member ${index + 1} formula`}
                            value={field.value}
                            onChange={field.onChange}
                            options={formulas}
                            placeholder="Select Formula"
                            disabled={readOnly}
                            clearable
                          />
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
                  ))}
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
              current.some((entry) => entry.id === next.id)
                ? current.map((entry) => (entry.id === next.id ? next : entry))
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
  { id: 'code', header: 'Code', cell: (row) => row.code },
  { id: 'name', header: 'Name', cell: (row) => row.name, mobile: 'heading' },
  {
    id: 'description',
    header: 'Description',
    cell: (row) => (
      <span className="line-clamp-2 max-w-72 whitespace-normal">{row.description || '—'}</span>
    ),
  },
]

/** Rewards → Benefits: allowances and reimbursements, for everyone or a group. */
export function BenefitsView() {
  const [page, setPage] = useState(1)
  const [dialog, setDialog] = useState<DialogState<Benefit>>(null)
  const [deleting, setDeleting] = useState<Benefit | null>(null)
  const list = useResourceList('benefits', { page, pageSize: SETTINGS_PAGE_SIZE })
  const remove = useDeleteResource('benefits')

  return (
    <>
      <ViewHeader
        tab="rewards"
        view="benefits"
        actions={
          <CreateButton
            onClick={() => {
              setDialog({ mode: 'create' })
            }}
          />
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
            onEdit={() => {
              setDialog({ mode: 'edit', record: row })
            }}
            onView={() => {
              setDialog({ mode: 'view', record: row })
            }}
            onDelete={() => {
              setDeleting(row)
            }}
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
        idOf={(row) => row.id}
      />
    </>
  )
}
