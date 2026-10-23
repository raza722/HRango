import { useId, useState } from 'react'
import { type Control, useController, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { SelectField, TextField } from '@/components/form'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { MultiSearchSelect, PayrollDialog } from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import { POLICY_KIND_LABELS, POLICY_LEVEL_LABELS } from '../../constants'
import { useEnrollEmployees, useLeavesLookups, useSaveLeavePolicy } from '../../hooks/use-leaves'
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
} from '../../utils/styles'

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
  } = useController({ control, name: 'level' })
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

  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({ id: policy?.id, input: leavePolicyToInput(values, policy) })
    } catch (failure) {
      if (failure instanceof ApiError) {
        const { title, level } = failure.fieldErrors
        if (title) form.setError('title', { message: title })
        else if (level) form.setError('level', { message: level })
        else form.setError('root', { message: failure.message })
      }
      return
    }
    onClose()
  })

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
              name="kind"
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
          {errors.level && (
            <p role="alert" className="-mt-4 text-xs text-destructive">
              {errors.level.message}
            </p>
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
 * "Enroll Employee" (no frame; opened from the Enroll Employee count of an
 * employee-level policy): pick the people; saving replaces who is enrolled.
 */
export function EnrollEmployeesDialog({
  policy,
  onClose,
}: {
  policy: LeavePolicy
  onClose: () => void
}) {
  const lookups = useLeavesLookups()
  const enroll = useEnrollEmployees()
  const [ids, setIds] = useState<string[]>(() => policy.enrolled.map((person) => person.id))
  const [error, setError] = useState<string | null>(null)
  const fieldId = useId()
  const people = (lookups.data?.employees ?? []).filter(
    (person) => person.active || ids.includes(person.id),
  )

  return (
    <PayrollDialog
      title="Enroll Employee"
      onClose={onClose}
      saveLabel="Enroll"
      pending={enroll.isPending}
      error={error}
      onSave={() => {
        enroll.mutate(
          { id: policy.id, employeeIds: ids },
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
          <span className="font-medium">{policy.title}</span> · {POLICY_KIND_LABELS[policy.kind]}
          {' · '}
          {POLICY_LEVEL_LABELS[policy.level]}
        </p>
        <div className="grid gap-2">
          <label htmlFor={fieldId} className="font-inter text-sm text-heading @xl:text-base">
            Employees
          </label>
          <MultiSearchSelect
            id={fieldId}
            value={ids}
            onChange={setIds}
            options={people.map((person) => ({
              value: person.id,
              label: person.name,
              hint: `${person.code} · ${person.department}`,
            }))}
            placeholder="Select Employees"
          />
          <p className="text-xs text-muted-foreground">
            {ids.length === 0
              ? 'Nobody is enrolled: the company level policy applies to everyone.'
              : `${String(ids.length)} enrolled. Someone already in another employee level policy of this kind moves to this one.`}
          </p>
        </div>
        {ids.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Enrolled employees">
            {ids.map((id) => {
              const person = people.find((item) => item.id === id)
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
                      setIds((current) => current.filter((item) => item !== id))
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
