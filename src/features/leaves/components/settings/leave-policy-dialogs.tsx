import { useId, useState } from 'react'
import { type Control, useController, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { SelectField, TextField } from '@/components/form'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { EmployeeMultiSearchSelect, PayrollDialog, SearchSelect } from '@/features/payroll'
import { useEmployeeLookupSearch } from '@/hooks/use-employee-lookup'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import { LEAVE_CODES, POLICY_KIND_LABELS, POLICY_LEVEL_LABELS } from '../../constants'
import {
  useAllLeaveTypes,
  useEnrolledEmployees,
  useEnrollEmployees,
  useSaveLeavePolicy,
} from '../../hooks/use-leaves'
import {
  leavePolicyFormSchema,
  type LeavePolicyFormValues,
  leavePolicyToForm,
  leavePolicyToInput,
} from '../../schemas/leave-forms.schema'
import { type LeavePolicy, POLICY_KINDS, type PolicyLevel } from '../../types/leaves.types'
import {
  formSwitchClass,
  leaveSettingsFieldsClass,
  listSwitchClass,
  policyCancelButtonClass,
  policyDialogClass,
  policyDialogTitleClass,
  policySaveButtonClass,
  slabAddButtonClass,
  slabInputClass,
} from '../../utils/styles'
import { CancelCircleIcon } from '../leave-icons'

export type PolicyDialogMode = 'create' | 'edit'

/** The design's sentence for the company level; the employee level gets the matching one. */
const LEVEL_HELP: Record<PolicyLevel, string> = {
  company: 'Company level Policy will apply to all the employees of your company.',
  employee: 'Employee level Policy will apply to the employees you enroll in it.',
}

/**
 * "Select Policy level?": Company Level Policy and Employee Level Policy as two
 * switches of which one is on (the frame draws the chosen one navy, the other
 * grey), with the chosen level's sentence under them.
 */
function PolicyLevelField({ control }: { control: Control<LeavePolicyFormValues> }) {
  const {
    field: { value, onChange },
  } = useController({ control, name: 'policyLevel' })
  return (
    <fieldset className="grid gap-3">
      <legend className="pb-3 text-base font-medium text-[#202020] dark:text-heading">
        Select Policy level?
      </legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {(['company', 'employee'] as const).map((level) => {
          const on = value === level
          return (
            <label key={level} className="flex items-center gap-3 text-[0.8125rem] text-grey">
              <Switch
                checked={on}
                aria-label={POLICY_LEVEL_LABELS[level]}
                onCheckedChange={(checked) => {
                  onChange(checked ? level : level === 'company' ? 'employee' : 'company')
                }}
                className={cn(listSwitchClass, 'data-[state=unchecked]:bg-grey')}
              />
              {POLICY_LEVEL_LABELS[level]}
            </label>
          )
        })}
      </div>
      <p className="text-xs font-medium text-[#202020] dark:text-heading">{LEVEL_HELP[value]}</p>
    </fieldset>
  )
}

/** "Allow half day leave" / "Allow short day leave": the question, then the navy switch. */
function PolicySwitch({
  control,
  name,
  label,
}: {
  control: Control<LeavePolicyFormValues>
  name: 'allowHalfDay' | 'allowShortLeave'
  label: string
}) {
  const id = useId()
  const {
    field: { ref, value, onChange, onBlur },
  } = useController({ control, name })
  return (
    <div className="grid grid-cols-[minmax(0,18rem)_auto] items-center gap-4">
      <label htmlFor={id} className="text-sm text-grey">
        {label}
      </label>
      <Switch
        id={id}
        ref={ref}
        checked={value}
        onCheckedChange={onChange}
        onBlur={onBlur}
        className={formSwitchClass}
      />
    </div>
  )
}

/** One leave type of a distribution policy: the type and its allowance (days). */
function PolicyTypeRow({
  control,
  index,
  options,
  onRemove,
}: {
  control: Control<LeavePolicyFormValues>
  index: number
  options: { value: string; label: string; hint?: string }[]
  onRemove: () => void
}) {
  const type = useController({ control, name: `types.${index}.leaveTypeId` })
  const {
    field: { ref, name, value, onChange, onBlur },
    fieldState: { error: allowanceError },
  } = useController({ control, name: `types.${index}.allowance` })
  const label = `Leave type ${String(index + 1)}`
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_7rem_auto] items-start gap-3">
      <div>
        <SearchSelect
          value={type.field.value || null}
          onChange={(next) => {
            type.field.onChange(next ?? '')
          }}
          options={options}
          placeholder="Select Leave Type"
          aria-label={label}
          aria-invalid={Boolean(type.fieldState.error)}
        />
        {type.fieldState.error && (
          <p className="pt-1 text-xs text-destructive">{type.fieldState.error.message}</p>
        )}
      </div>
      <div>
        <input
          ref={ref}
          name={name}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          aria-label={`${label} allowance`}
          aria-invalid={Boolean(allowanceError)}
          placeholder="Allowance"
          inputMode="decimal"
          className={slabInputClass}
        />
        {allowanceError && (
          <p className="pt-1 text-xs text-destructive">{allowanceError.message}</p>
        )}
      </div>
      <button
        type="button"
        aria-label={`Remove ${label.toLowerCase()}`}
        onClick={onRemove}
        className="mt-1 inline-flex size-[1.875rem] items-center justify-center rounded-full text-[#D83838] outline-none hover:bg-[#D83838]/10 focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <CancelCircleIcon className="size-[1.875rem]" />
      </button>
    </div>
  )
}

/**
 * "Add Policy" (frame 4428:90498): a 667px Poppins popup with Policy * and
 * Title * side by side, "Select Policy level?", Allow half day leave, Allow
 * short day leave, then Cancel and Add Policy on the left. Edit keeps the
 * layout with Save (and Delete).
 */
export function LeavePolicyDialog({
  mode,
  policy,
  onClose,
  onDelete,
}: {
  mode: PolicyDialogMode
  policy: LeavePolicy | null
  onClose: () => void
  onDelete?: () => void
}) {
  const formId = useId()
  const save = useSaveLeavePolicy()
  const form = useForm<LeavePolicyFormValues>({
    resolver: zodResolver(leavePolicyFormSchema),
    defaultValues: leavePolicyToForm(policy),
  })
  const errors = form.formState.errors
  const kind = useWatch({ control: form.control, name: 'policyKind' })
  const typeRows = useFieldArray({ control: form.control, name: 'types' })
  const leaveTypes = useAllLeaveTypes()
  const typeOptions = (leaveTypes.data?.data ?? []).map((type) => ({
    value: type.id,
    label: type.title,
    hint: `${type.shortCode} · ${String(type.allowance ?? 0)} days`,
  }))

  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({ id: policy?.id, input: leavePolicyToInput(values, policy) })
    } catch (failure) {
      if (failure instanceof ApiError) {
        const { title, policyLevel, policyKind, types } = failure.fieldErrors
        if (title) form.setError('title', { message: title })
        else if (policyLevel) form.setError('policyLevel', { message: policyLevel })
        else if (policyKind) form.setError('policyKind', { message: policyKind })
        else if (types) form.setError('types', { message: types })
        else form.setError('root', { message: failure.message })
      }
      return
    }
    onClose()
  })
  const typesError = errors.types?.message ?? errors.types?.root?.message

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent showClose={false} className={cn(policyDialogClass, leaveSettingsFieldsClass)}>
        <DialogTitle className={policyDialogTitleClass}>
          {mode === 'create' ? 'Add Policy' : 'Edit Policy'}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {mode === 'create' ? 'Add a leave policy.' : `Edit ${policy?.title ?? 'the policy'}.`}
        </DialogDescription>
        <form
          id={formId}
          noValidate
          onSubmit={(event) => void submit(event)}
          className="grid gap-6 pt-6"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              control={form.control}
              name="policyKind"
              label="Policy *"
              placeholder="Select"
              options={POLICY_KINDS.map((value) => ({ value, label: POLICY_KIND_LABELS[value] }))}
            />
            <TextField
              control={form.control}
              name="title"
              label="Title *"
              placeholder="Enter"
              maxLength={80}
            />
          </div>
          <PolicyLevelField control={form.control} />
          {errors.policyLevel && (
            <p role="alert" className="-mt-4 text-xs text-destructive">
              {errors.policyLevel.message}
            </p>
          )}
          {kind === 'distribution' && (
            <fieldset className="grid gap-3">
              <legend className="pb-3 text-base font-medium text-[#202020] dark:text-heading">
                Leave Types
              </legend>
              <p className="-mt-2 text-xs text-muted-foreground">
                The leave types this policy gives. Allowance left empty: the type's own No of Leaves
                Allowed.
              </p>
              {typeRows.fields.map((row, index) => (
                <PolicyTypeRow
                  key={row.id}
                  control={form.control}
                  index={index}
                  options={typeOptions}
                  onRemove={() => {
                    typeRows.remove(index)
                  }}
                />
              ))}
              {typesError && (
                <p role="alert" className="text-xs text-destructive">
                  {typesError}
                </p>
              )}
              <div>
                <Button
                  type="button"
                  onClick={() => {
                    typeRows.append({ leaveTypeId: '', allowance: '' })
                  }}
                  className={slabAddButtonClass}
                >
                  Add Leave Type
                </Button>
              </div>
            </fieldset>
          )}
          <div className="grid gap-4">
            <PolicySwitch control={form.control} name="allowHalfDay" label="Allow half day leave" />
            <PolicySwitch
              control={form.control}
              name="allowShortLeave"
              label="Allow short day leave"
            />
          </div>
          <div className="flex flex-wrap items-center gap-5 pt-4">
            <Button type="button" onClick={onClose} className={policyCancelButtonClass}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending} className={policySaveButtonClass}>
              {mode === 'create' ? 'Add Policy' : 'Save'}
            </Button>
            {onDelete && (
              <Button
                type="button"
                variant="outline"
                onClick={onDelete}
                className="h-12 rounded-lg px-7 text-[0.9375rem] font-medium"
              >
                Delete
              </Button>
            )}
            {errors.root && (
              <p role="alert" className="basis-full text-sm text-destructive">
                {errors.root.message}
              </p>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * "Enroll Employee" (no frame; opened from the Enroll Employee count of an employee-level
 * policy): the people enrolled now (`GET /leaves/policies/{id}/employees`) and a picker of
 * the people you may enroll (`GET /employees/lookup?permission=leaves.settings.policies.enroll`).
 * Saving enrols the added people (`POST …/employees`) and removes the dropped ones
 * (`DELETE …/employees/{employeeId}`).
 */
/** Whom the Enroll picker offers (searched on the server, paged). */
const ENROLL_FILTERS = { permission: LEAVE_CODES.policiesEnroll }

export function EnrollEmployeesDialog({
  policy,
  onClose,
}: {
  policy: LeavePolicy
  onClose: () => void
}) {
  const enrolled = useEnrolledEmployees(policy.id)
  // Names of the people picked from `GET /employees/lookup` (any page the picker read).
  const lookup = useEmployeeLookupSearch(ENROLL_FILTERS, { enabled: false })
  const enroll = useEnrollEmployees()
  const [picked, setPicked] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fieldId = useId()
  const current = enrolled.data?.data.map((row) => row.employeeId)
  const chosen = picked ?? current ?? []
  const names = new Map<string, { name: string; hint: string }>()
  for (const row of enrolled.data?.data ?? []) {
    names.set(row.employeeId, {
      name: row.employeeName,
      hint: [row.employeeCode, row.departmentName].filter(Boolean).join(' · '),
    })
  }
  for (const id of chosen) {
    const person = lookup.find(id)
    if (person) {
      names.set(id, {
        name: person.name,
        hint: [person.code, person.departmentName].filter(Boolean).join(' · '),
      })
    }
  }
  const known = [...names.entries()].map(([value, person]) => ({
    value,
    label: person.name,
    hint: person.hint,
  }))

  return (
    <PayrollDialog
      title="Enroll Employee"
      onClose={onClose}
      saveLabel="Enroll"
      pending={enroll.isPending || !current}
      error={error ?? enrolled.error?.message}
      onSave={() => {
        const before = new Set(current ?? [])
        const after = new Set(chosen)
        enroll.mutate(
          {
            id: policy.id,
            add: chosen.filter((id) => !before.has(id)),
            remove: [...before].filter((id) => !after.has(id)),
          },
          {
            onSuccess: onClose,
            onError: (failure) => {
              setError(failure.message)
            },
          },
        )
      }}
      className="max-w-2xl"
      layout="vertical"
    >
      <div className="grid gap-5">
        <p className="font-inter text-sm text-heading">
          <span className="font-medium">{policy.title}</span> ·{' '}
          {POLICY_KIND_LABELS[policy.policyKind]}
          {' · '}
          {POLICY_LEVEL_LABELS[policy.policyLevel]}
        </p>
        <div className="grid gap-2">
          <label htmlFor={fieldId} className="font-inter text-sm text-heading @xl:text-base">
            Employees
          </label>
          <EmployeeMultiSearchSelect
            id={fieldId}
            value={chosen}
            onChange={setPicked}
            filters={ENROLL_FILTERS}
            known={known}
            hint={(person) => [person.code, person.departmentName].filter(Boolean).join(' · ')}
            placeholder="Select Employees"
          />
          <p className="text-xs text-muted-foreground">
            {chosen.length === 0
              ? 'Nobody is enrolled: the company level policy of this kind applies to them.'
              : `${String(chosen.length)} enrolled. Someone already in another active employee level policy of this kind is refused.`}
          </p>
        </div>
        {chosen.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Enrolled employees">
            {chosen.map((id) => {
              const person = names.get(id)
              return (
                <li
                  key={id}
                  className="flex items-center gap-1 rounded-full bg-sidebar/[0.07] px-3 py-1 font-inter text-xs text-heading dark:bg-muted"
                >
                  {person?.name ?? id}
                  <button
                    type="button"
                    aria-label={`Remove ${person?.name ?? id}`}
                    onClick={() => {
                      setPicked(chosen.filter((item) => item !== id))
                    }}
                    className="ml-1 rounded-full px-1 text-field-value hover:text-destructive"
                  >
                    ×
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </PayrollDialog>
  )
}
