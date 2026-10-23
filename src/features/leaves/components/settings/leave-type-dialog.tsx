import { type ReactNode, useId } from 'react'
import {
  type Control,
  type FieldPathByValue,
  useController,
  useFieldArray,
  useForm,
  useWatch,
} from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { CheckboxField, SelectField, TextField } from '@/components/form'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  btn,
  footerButton,
  PayrollDialog,
  SectionTitle,
  TwoWaySwitchField,
} from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import {
  ATTACHMENT_RULE_LABELS,
  GENDER_RULE_LABELS,
  LEAVE_TYPE_SWITCHES,
  MARITAL_RULE_LABELS,
  SHORT_UNIT_LABELS,
  TENURE_LABELS,
} from '../../constants'
import { useSaveLeaveType } from '../../hooks/use-leaves'
import {
  EMPTY_LEAVE_TYPE,
  leaveTypeFormSchema,
  type LeaveTypeFormValues,
  leaveTypeToForm,
  leaveTypeToInput,
} from '../../schemas/leave-forms.schema'
import {
  ATTACHMENT_RULES,
  LEAVE_GENDER_RULES,
  LEAVE_MARITAL_RULES,
  LEAVE_TENURES,
  type LeaveType,
  SHORT_SLAB_UNITS,
} from '../../types/leaves.types'
import { slabAddButtonClass, slabInputClass, typeCheckboxesClass } from '../../utils/styles'
import { CancelCircleIcon } from '../leave-icons'

export type LeaveTypeDialogMode = 'create' | 'edit'

const TITLES: Record<LeaveTypeDialogMode, string> = {
  create: 'Add Leave Types',
  edit: 'Edit Leave Type',
}

type TextPath = FieldPathByValue<LeaveTypeFormValues, string>

/** The red asterisk of the slab headers (Inter Regular 18 #E50141). */
function Required() {
  return (
    <span aria-hidden="true" className="ml-1 font-inter text-lg leading-none text-[#E50141]">
      *
    </span>
  )
}

/** A slab table's box: Poppins 14 with 8px corners, as the frames draw them. */
function SlabInput({
  control,
  name,
  label,
  placeholder,
  disabled,
  inputMode,
}: {
  control: Control<LeaveTypeFormValues>
  name: TextPath
  label: string
  placeholder: string
  disabled: boolean
  inputMode?: 'numeric' | 'decimal'
}) {
  const {
    field: { ref, name: fieldName, value, onChange, onBlur },
    fieldState: { error },
  } = useController({ control, name })
  return (
    <>
      <input
        ref={ref}
        name={fieldName}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        disabled={disabled}
        aria-label={label}
        aria-invalid={Boolean(error)}
        placeholder={placeholder}
        inputMode={inputMode}
        className={slabInputClass}
      />
      {error && <p className="pt-1 text-xs text-destructive">{error.message}</p>}
    </>
  )
}

/** "Select Type" of a short leave slab. */
function SlabUnitSelect({
  control,
  index,
  disabled,
}: {
  control: Control<LeaveTypeFormValues>
  index: number
  disabled: boolean
}) {
  const {
    field: { value, onChange },
  } = useController({ control, name: `shortLeaveSlabs.${index}.unit` })
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        aria-label={`Short leave ${String(index + 1)} type`}
        className="h-10 rounded-lg border-[#CFCFCF] font-sans! text-title dark:border-input"
      >
        <SelectValue placeholder="Select Type" />
      </SelectTrigger>
      <SelectContent>
        {SHORT_SLAB_UNITS.map((unit) => (
          <SelectItem key={unit} value={unit}>
            {SHORT_UNIT_LABELS[unit]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function SlabTable({
  title,
  headers,
  error,
  onAdd,
  readOnly,
  children,
}: {
  title: string
  headers: ReactNode[]
  error: string | undefined
  onAdd: () => void
  readOnly: boolean
  children: ReactNode
}) {
  return (
    <div className="grid gap-3">
      <SectionTitle>{title}</SectionTitle>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr className="font-sans text-sm text-title [&_th]:pr-4 [&_th]:pb-1.5 [&_th]:font-normal">
              {headers.map((header, index) => (
                <th key={index} scope="col">
                  {header}
                </th>
              ))}
              <th scope="col" className="w-16">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="[&_td]:pr-4 [&_td]:pb-3 [&_td]:align-top">{children}</tbody>
        </table>
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {!readOnly && (
        <div className="flex justify-end">
          <Button type="button" onClick={onAdd} className={slabAddButtonClass}>
            Add
          </Button>
        </div>
      )}
    </div>
  )
}

function RemoveSlabButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="mt-1 inline-flex size-[1.875rem] items-center justify-center rounded-full text-[#D83838] outline-none hover:bg-[#D83838]/10 focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <CancelCircleIcon className="size-[1.875rem]" />
    </button>
  )
}

/**
 * "Add Leave Types" (frames 4428:90632, 4428:90731, 4428:90852): a 1078px
 * Inter popup with the labels on the left. Title, Short Code and No of Leaves
 * Allowed; the checkboxes in the frames' order, each dependent field right
 * under its box (Back Date Leave Limit in Days, Do When Attachment is
 * Required, Encashment Min / Max Limit); Pre Condition (Gender, Marital
 * Status, Can Apply in Probation, Pro Rated, Minimum Experience to Apply,
 * Maximum Application in Employment, Gap Between Application in Months);
 * Balance Settings (Tenure, Balance According to Flat / Experience,
 * Accumulative Count); Experience Slabs with Balance According to =
 * Experience, Short Leave Slabs with Short Leave; Save and Cancel.
 */
export function LeaveTypeDialog({
  mode,
  type,
  onClose,
  onDelete,
}: {
  mode: LeaveTypeDialogMode
  type: LeaveType | null
  onClose: () => void
  /** Edit only: Delete in the footer (refused by the server while the type is in use). */
  onDelete?: () => void
}) {
  const formId = useId()
  const save = useSaveLeaveType()
  const form = useForm<LeaveTypeFormValues>({
    resolver: zodResolver(leaveTypeFormSchema),
    defaultValues: type ? leaveTypeToForm(type) : EMPTY_LEAVE_TYPE,
  })
  const [backDate, attachmentRequired, encashment, shortLeave, balanceBasis] = useWatch({
    control: form.control,
    name: ['backDate', 'attachmentRequired', 'encashment', 'shortLeave', 'balanceBasis'],
  })
  const experienceSlabs = useFieldArray({ control: form.control, name: 'experienceSlabs' })
  const shortSlabs = useFieldArray({ control: form.control, name: 'shortLeaveSlabs' })
  const errors = form.formState.errors
  const slabsError =
    errors.experienceSlabs?.message ?? errors.experienceSlabs?.root?.message ?? undefined

  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({ id: type?.id, input: leaveTypeToInput(values) })
    } catch (failure) {
      if (failure instanceof ApiError) {
        let placed = false
        for (const [field, message] of Object.entries(failure.fieldErrors)) {
          if (field in values) {
            form.setError(field as keyof LeaveTypeFormValues, { message })
            placed = true
          }
        }
        if (!placed) form.setError('root', { message: failure.message })
      }
      return
    }
    onClose()
  })

  /** A checkbox row, then the fields it reveals. */
  const box = (name: (typeof LEAVE_TYPE_SWITCHES)[number]['name'], label: string) => (
    <CheckboxField key={name} control={form.control} name={name} label={label} tone="navy" />
  )

  return (
    <PayrollDialog
      title={TITLES[mode]}
      onClose={onClose}
      formId={formId}
      pending={save.isPending}
      error={errors.root?.message}
      layout="horizontal"
      className="max-w-[67.375rem]"
      actions={
        onDelete && (
          <Button type="button" onClick={onDelete} className={cn(footerButton, btn.outline)}>
            Delete
          </Button>
        )
      }
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event) => void submit(event)}
        className={cn('grid gap-5', typeCheckboxesClass)}
      >
        <TextField control={form.control} name="title" label="Title" maxLength={60} />
        <TextField control={form.control} name="shortCode" label="Short Code" maxLength={10} />
        <TextField
          control={form.control}
          name="leavesAllowed"
          label="No of Leaves Allowed"
          inputMode="decimal"
        />

        {LEAVE_TYPE_SWITCHES.map(({ name, label }) => {
          switch (name) {
            case 'backDate':
              return (
                <div key={name} className="contents">
                  {box(name, label)}
                  {backDate && (
                    <TextField
                      control={form.control}
                      name="backDateLimitDays"
                      label="Back Date Leave Limit in Days"
                      required
                      inputMode="numeric"
                    />
                  )}
                </div>
              )
            case 'attachmentRequired':
              return (
                <div key={name} className="contents">
                  {box(name, label)}
                  {attachmentRequired && (
                    <SelectField
                      control={form.control}
                      name="attachmentRule"
                      label="Do When Attachment is Required"
                      required
                      placeholder="Select"
                      options={ATTACHMENT_RULES.map((value) => ({
                        value,
                        label: ATTACHMENT_RULE_LABELS[value],
                      }))}
                    />
                  )}
                </div>
              )
            case 'encashment':
              return (
                <div key={name} className="contents">
                  {box(name, label)}
                  {encashment && (
                    <>
                      <TextField
                        control={form.control}
                        name="encashmentMin"
                        label="Encashment Min Limit"
                        required
                        inputMode="decimal"
                      />
                      <TextField
                        control={form.control}
                        name="encashmentMax"
                        label="Encashment Max Limit"
                        required
                        inputMode="decimal"
                      />
                    </>
                  )}
                </div>
              )
            default:
              return box(name, label)
          }
        })}

        <SectionTitle>Pre Condition</SectionTitle>
        <SelectField
          control={form.control}
          name="gender"
          label="Gender"
          required
          options={LEAVE_GENDER_RULES.map((value) => ({ value, label: GENDER_RULE_LABELS[value] }))}
        />
        <SelectField
          control={form.control}
          name="maritalStatus"
          label="Marital Status"
          placeholder="Select Marital Status"
          options={LEAVE_MARITAL_RULES.map((value) => ({
            value,
            label: MARITAL_RULE_LABELS[value],
          }))}
        />
        <CheckboxField
          control={form.control}
          name="applyInProbation"
          label="Can Apply in Probation"
          tone="navy"
        />
        <CheckboxField control={form.control} name="proRated" label="Pro Rated" tone="navy" />
        <TextField
          control={form.control}
          name="minExperienceMonths"
          label="Minimum Experience to Apply"
          inputMode="numeric"
        />
        <TextField
          control={form.control}
          name="maxApplications"
          label="Maximum Application in Employment"
          inputMode="numeric"
        />
        <TextField
          control={form.control}
          name="gapMonths"
          label="Gap Between Application in Months"
          inputMode="numeric"
        />

        <SectionTitle>Balance Settings</SectionTitle>
        <SelectField
          control={form.control}
          name="tenure"
          label="Tenure"
          required
          placeholder="Select Tenure"
          options={LEAVE_TENURES.map((value) => ({ value, label: TENURE_LABELS[value] }))}
        />
        <TwoWaySwitchField
          control={form.control}
          name="balanceBasis"
          label="Balance According to"
          ariaLabel="Balance According to"
          options={[
            { value: 'flat', label: 'Flat' },
            { value: 'experience', label: 'Experience' },
          ]}
          offClassName="text-[#585858] dark:text-grey"
        />
        <TextField
          control={form.control}
          name="accumulativeCount"
          label="Accumulative Count"
          inputMode="numeric"
        />

        {balanceBasis === 'experience' && (
          <SlabTable
            title="Experience Slabs"
            headers={[
              <>
                Minimum Months
                <Required />
              </>,
              <>
                Maximum Months
                <Required />
              </>,
              <>
                Balance
                <Required />
              </>,
            ]}
            error={slabsError}
            readOnly={false}
            onAdd={() => {
              experienceSlabs.append({ minMonths: '', maxMonths: '', balance: '' })
            }}
          >
            {experienceSlabs.fields.map((slab, index) => (
              <tr key={slab.id}>
                <td>
                  <SlabInput
                    control={form.control}
                    name={`experienceSlabs.${index}.minMonths`}
                    label={`Slab ${String(index + 1)} minimum months`}
                    placeholder="Minimum Months"
                    inputMode="numeric"
                    disabled={false}
                  />
                </td>
                <td>
                  <SlabInput
                    control={form.control}
                    name={`experienceSlabs.${index}.maxMonths`}
                    label={`Slab ${String(index + 1)} maximum months`}
                    placeholder="Maximum Months"
                    inputMode="numeric"
                    disabled={false}
                  />
                </td>
                <td>
                  <SlabInput
                    control={form.control}
                    name={`experienceSlabs.${index}.balance`}
                    label={`Slab ${String(index + 1)} balance`}
                    placeholder="Balances"
                    inputMode="decimal"
                    disabled={false}
                  />
                </td>
                <td>
                  <RemoveSlabButton
                    label={`Remove slab ${String(index + 1)}`}
                    onClick={() => {
                      experienceSlabs.remove(index)
                    }}
                  />
                </td>
              </tr>
            ))}
          </SlabTable>
        )}

        {shortLeave && (
          <SlabTable
            title="Short Leave Slabs"
            headers={[
              <>
                Name
                <Required />
              </>,
              'Balance',
              'Type',
              'Value',
            ]}
            error={undefined}
            readOnly={false}
            onAdd={() => {
              shortSlabs.append({ name: '', balance: '', unit: 'hours', value: '' })
            }}
          >
            {shortSlabs.fields.map((slab, index) => (
              <tr key={slab.id}>
                <td>
                  <SlabInput
                    control={form.control}
                    name={`shortLeaveSlabs.${index}.name`}
                    label={`Short leave ${String(index + 1)} name`}
                    placeholder="Name"
                    disabled={false}
                  />
                </td>
                <td>
                  <SlabInput
                    control={form.control}
                    name={`shortLeaveSlabs.${index}.balance`}
                    label={`Short leave ${String(index + 1)} balance`}
                    placeholder="Balance"
                    inputMode="decimal"
                    disabled={false}
                  />
                </td>
                <td>
                  <SlabUnitSelect control={form.control} index={index} disabled={false} />
                </td>
                <td>
                  <SlabInput
                    control={form.control}
                    name={`shortLeaveSlabs.${index}.value`}
                    label={`Short leave ${String(index + 1)} value`}
                    placeholder="Value"
                    inputMode="numeric"
                    disabled={false}
                  />
                </td>
                <td>
                  <RemoveSlabButton
                    label={`Remove short leave ${String(index + 1)}`}
                    onClick={() => {
                      shortSlabs.remove(index)
                    }}
                  />
                </td>
              </tr>
            ))}
          </SlabTable>
        )}
      </form>
    </PayrollDialog>
  )
}
