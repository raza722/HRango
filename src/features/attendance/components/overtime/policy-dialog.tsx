import { useId, useState } from 'react'
import { type Control, useController, useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { FieldLayoutContext, FormField, TextareaField, TextField } from '@/components/form'
import {
  DataTable,
  type DataTableColumn,
  RowActionsMenu,
  rowMenuItemClass,
} from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { NoRecord } from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import { useSaveOvertimePolicy } from '../../hooks/use-overtime'
import {
  overtimePolicySchema,
  type OvertimePolicyValues,
  POLICY_DEFAULTS,
  policyToValues,
  type SlabValues,
  toPolicyInput,
} from '../../schemas/overtime.schema'
import type { OvertimePolicy } from '../../types/overtime.types'
import { slabEncashmentLabel } from '../../utils/overtime-format'
import {
  overtimeNavyButtonClass,
  policyTypeSwitchClass,
  slabTableClass,
} from '../../utils/overtime-styles'
import { OvertimeDialog } from './overtime-parts'
import { SlabDialog, type SlabDialogMode } from './slab-dialog'

export type PolicyDialogMode = 'create' | 'edit' | 'view'

const TITLES: Record<PolicyDialogMode, string> = {
  create: 'Overtime Policy Create',
  edit: 'Overtime Policy Edit',
  view: 'Overtime Policy',
}

/** "Monthly ◯ Daily" as drawn (the API's `period`): the chosen side #202020, the other #707070, a grey switch. */
function PolicyTypeField({
  control,
  disabled,
}: {
  control: Control<OvertimePolicyValues>
  disabled: boolean
}) {
  const { field } = useController({ control, name: 'period' })
  const daily = field.value === 'daily'
  const side = (on: boolean) =>
    cn('font-sans text-sm font-medium', on ? 'text-[#202020] dark:text-heading' : 'text-grey')
  return (
    <FormField label="Type">
      {(a11y) => (
        <span className="flex min-h-10 items-center gap-6">
          <span className={side(!daily)}>Monthly</span>
          <Switch
            id={a11y.id}
            checked={daily}
            disabled={disabled}
            aria-label={`Type: ${daily ? 'Daily' : 'Monthly'}`}
            onCheckedChange={(checked) => {
              field.onChange(checked ? 'daily' : 'monthly')
            }}
            onBlur={field.onBlur}
            className={policyTypeSwitchClass}
          />
          <span className={side(daily)}>Daily</span>
        </span>
      )}
    </FormField>
  )
}

/** Not drawn: the API's `isActive` (an inactive policy is kept but not applied). */
function ActiveField({
  control,
  disabled,
}: {
  control: Control<OvertimePolicyValues>
  disabled: boolean
}) {
  const { field } = useController({ control, name: 'isActive' })
  return (
    <FormField label="Active">
      {(a11y) => (
        <span className="flex min-h-10 items-center">
          <Switch
            id={a11y.id}
            checked={field.value}
            disabled={disabled}
            onCheckedChange={field.onChange}
            onBlur={field.onBlur}
            className="h-[1.125rem] w-[2.375rem] data-[state=checked]:bg-sidebar dark:data-[state=checked]:bg-primary"
          />
        </span>
      )}
    </FormField>
  )
}

type SlabDialogState = { mode: SlabDialogMode; index: number | null } | null

/**
 * "Overtime Policy Create" (frames 4207:75070 … 4212:76217) and its Edit / View: Name, Type
 * (Monthly / Daily), Active, Description, then Slabs with "+ Create" (the Slab Create popup),
 * each slab's row menu opening Slab View / Slab Edit / Remove, and "No Record Found" while
 * there is none; Cancel and Save at the bottom left. Slabs may not overlap. Saves
 * `POST|PUT /attendance/settings/overtime-policies[/{id}]` with the slabs whole.
 */
export function PolicyDialog({
  mode,
  policy,
  onClose,
}: {
  mode: PolicyDialogMode
  policy: OvertimePolicy | null
  onClose: () => void
}) {
  const formId = useId()
  const readOnly = mode === 'view'
  const save = useSaveOvertimePolicy()
  const [slabDialog, setSlabDialog] = useState<SlabDialogState>(null)
  const form = useForm<OvertimePolicyValues>({
    resolver: zodResolver(overtimePolicySchema),
    defaultValues: policy ? policyToValues(policy) : POLICY_DEFAULTS,
  })
  const slabs = useFieldArray({ control: form.control, name: 'slabs' })
  const slabsError =
    form.formState.errors.slabs?.message ?? form.formState.errors.slabs?.root?.message

  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({
        id: policy?.id,
        input: toPolicyInput(values, policy?.rowVersion ?? null),
      })
    } catch (failure) {
      if (failure instanceof ApiError) {
        const { name } = failure.fieldErrors
        // `slabs` or a slab's own field (`slabs.0.leaveTypeId`).
        const slabsMessage = Object.entries(failure.fieldErrors).find(([key]) =>
          key.startsWith('slabs'),
        )?.[1]
        if (name) form.setError('name', { message: name })
        else if (slabsMessage) form.setError('slabs', { message: slabsMessage })
        else form.setError('root', { message: failure.message })
      }
      return
    }
    onClose()
  })

  const rows = slabs.fields.map((field, index) => ({ ...field, index }))
  type Row = (typeof rows)[number]
  const columns: DataTableColumn<Row>[] = [
    { id: 'serial', header: 'Sr#', mobile: 'hidden', cell: (row) => String(row.index + 1) },
    { id: 'min', header: 'Minimum Minutes', mobile: 'heading', cell: (row) => row.minMinutes },
    { id: 'max', header: 'Maximum Minutes', cell: (row) => row.maxMinutes },
    {
      id: 'encashment',
      header: 'Encashment Type',
      cell: (row) =>
        slabEncashmentLabel({
          encashmentType: row.fullDay ? 'full_day' : 'leave',
          leaveTypeName: row.leaveTypeName || null,
        }),
    },
  ]

  return (
    <OvertimeDialog
      title={TITLES[mode]}
      description={policy ? policy.name : 'A new overtime policy with its slabs.'}
      tone="inter"
      onClose={onClose}
      formId={formId}
      submitLabel="Save"
      readOnly={readOnly}
      pending={save.isPending}
      error={form.formState.errors.root?.message}
      className="max-w-[63.5rem]"
    >
      <FieldLayoutContext value="horizontal">
        <form
          id={formId}
          noValidate
          onSubmit={(event) => void submit(event)}
          className="grid gap-6"
        >
          <TextField
            control={form.control}
            name="name"
            label="Name"
            placeholder="Policy name"
            maxLength={200}
            disabled={readOnly}
          />
          <PolicyTypeField control={form.control} disabled={readOnly} />
          <ActiveField control={form.control} disabled={readOnly} />
          <TextareaField
            control={form.control}
            name="description"
            label="Description"
            rows={6}
            maxLength={4000}
            disabled={readOnly}
            textareaClassName="min-h-[11.5rem]"
          />

          <section aria-labelledby={`${formId}-slabs`} className="grid gap-4 pt-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3
                id={`${formId}-slabs`}
                className="font-inter text-xl font-medium text-heading sm:text-2xl"
              >
                Slabs
              </h3>
              {!readOnly && (
                <Button
                  type="button"
                  onClick={() => {
                    setSlabDialog({ mode: 'create', index: null })
                  }}
                  className={overtimeNavyButtonClass}
                >
                  + Create
                </Button>
              )}
            </div>
            {rows.length === 0 ? (
              <NoRecord className="py-6 text-[1.4375rem]" />
            ) : (
              <DataTable
                columns={columns}
                data={rows}
                getRowId={(row) => row.id}
                caption="Slabs"
                className={slabTableClass}
                rowActionsHeader="Actions"
                rowActions={(row) => (
                  <RowActionsMenu
                    label={`Actions for slab ${row.index + 1}`}
                    itemClassName={rowMenuItemClass.inter}
                    actions={[
                      {
                        label: 'View',
                        onSelect: () => {
                          setSlabDialog({ mode: 'view', index: row.index })
                        },
                      },
                      ...(readOnly
                        ? []
                        : [
                            {
                              label: 'Edit',
                              onSelect: () => {
                                setSlabDialog({ mode: 'edit', index: row.index })
                              },
                            },
                            {
                              label: 'Remove',
                              variant: 'destructive' as const,
                              onSelect: () => {
                                slabs.remove(row.index)
                              },
                            },
                          ]),
                    ]}
                  />
                )}
              />
            )}
            {slabsError && (
              <p role="alert" className="text-sm text-destructive">
                {slabsError}
              </p>
            )}
          </section>
        </form>
      </FieldLayoutContext>

      {slabDialog && (
        <SlabDialog
          mode={slabDialog.mode}
          slab={
            slabDialog.index === null ? null : slabValues(form.getValues('slabs')[slabDialog.index])
          }
          onSave={(values) => {
            form.clearErrors('slabs')
            if (slabDialog.index === null) slabs.append(values)
            else slabs.update(slabDialog.index, values)
          }}
          onClose={() => {
            setSlabDialog(null)
          }}
        />
      )}
    </OvertimeDialog>
  )
}

/** A stored slab's form values (without the field array's own id). */
function slabValues(slab: SlabValues | undefined): SlabValues | null {
  if (!slab) return null
  return {
    fullDay: slab.fullDay,
    minMinutes: slab.minMinutes,
    maxMinutes: slab.maxMinutes,
    leaveTypeId: slab.leaveTypeId,
    leaveTypeName: slab.leaveTypeName,
  }
}
