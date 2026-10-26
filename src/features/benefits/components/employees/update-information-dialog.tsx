import type { SyntheticEvent } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format, subDays } from 'date-fns'

import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import { MARITAL_STATUSES } from '../../constants'
import { useRequestProfileUpdate } from '../../hooks/use-benefits'
import { profileFormSchema, type ProfileFormValues } from '../../schemas/benefits.schema'
import type { BenefitEmployee, ProfileChanges } from '../../types/benefits.types'
import { accent, boxClass, buttonClass } from '../shared/benefit-styles'
import { BxSelect, DateBox, FieldRow } from '../shared/controls'
import { BxDialog } from '../shared/dialogs'

const COLUMNS = '@lg:grid-cols-[8.5rem_minmax(0,18rem)]'

/** The API's field names (`changes.dateOfBirth` …) → this form's. */
const fieldOf = (path: string) => path.replace(/^changes\./, '')

/**
 * Update missing information (not drawn; laid out like the Edit Plan Year popup): the details
 * benefits enrollment needs from the person. They belong to the Employees module, so saving
 * sends an Update Information request that HR approves; the details change then.
 */
export function UpdateInformationDialog({
  employee,
  onClose,
}: {
  employee: BenefitEmployee
  onClose: () => void
}) {
  const update = useRequestProfileUpdate()
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      dateOfBirth: employee.dateOfBirth ?? '',
      maritalStatus: employee.maritalStatus ?? '',
      homeAddress: '',
    },
  })
  const { errors } = form.formState

  const submit = form.handleSubmit(async (values) => {
    // Only what changes is asked for.
    const changes: ProfileChanges = {}
    if (values.dateOfBirth !== (employee.dateOfBirth ?? ''))
      changes.dateOfBirth = values.dateOfBirth
    if (values.maritalStatus !== (employee.maritalStatus ?? '')) {
      changes.maritalStatus = values.maritalStatus as NonNullable<ProfileChanges['maritalStatus']>
    }
    if (values.homeAddress) changes.homeAddress = values.homeAddress
    if (Object.keys(changes).length === 0) {
      onClose()
      return
    }
    try {
      await update.mutateAsync({ id: employee.id, changes })
      onClose()
    } catch (error) {
      const fields = error instanceof ApiError ? Object.entries(error.fieldErrors) : []
      const known = fields.filter(([name]) => fieldOf(name) in values)
      if (known.length > 0) {
        for (const [name, message] of known) {
          form.setError(fieldOf(name) as keyof ProfileFormValues, { message })
        }
      } else {
        form.setError('root', {
          message: error instanceof ApiError ? error.message : 'Could not send the update.',
        })
      }
    }
  })

  return (
    <BxDialog
      title="Update Information"
      description={`The benefit details of ${employee.name ?? ''}.`}
      onClose={onClose}
      className="max-w-[36rem]"
    >
      <form
        noValidate
        onSubmit={(event: SyntheticEvent) => void submit(event)}
        className="@container flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-3 pb-5 sm:px-[1.375rem]"
      >
        <p className="text-sm text-[#292929] dark:text-heading">
          {employee.name}
          {employee.jobTitleName && (
            <span className="text-muted-foreground">{` · ${employee.jobTitleName}`}</span>
          )}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          HR approves the change before it shows here.
        </p>
        <div className="mt-5 grid gap-[1.1rem]">
          <Controller
            control={form.control}
            name="dateOfBirth"
            render={({ field, fieldState }) => (
              <FieldRow
                label="Date of Birth"
                required
                columns={COLUMNS}
                error={fieldState.error?.message}
              >
                {(a11y) => (
                  <DateBox
                    {...a11y}
                    value={field.value}
                    onChange={field.onChange}
                    maxDate={format(subDays(new Date(), 1), 'yyyy-MM-dd')}
                    yearPicker
                  />
                )}
              </FieldRow>
            )}
          />
          <Controller
            control={form.control}
            name="maritalStatus"
            render={({ field, fieldState }) => (
              <FieldRow
                label="Marital Status"
                required
                columns={COLUMNS}
                error={fieldState.error?.message}
              >
                {(a11y) => (
                  <BxSelect
                    {...a11y}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Select Marital Status"
                    options={MARITAL_STATUSES}
                  />
                )}
              </FieldRow>
            )}
          />
          <FieldRow label="Home Address" columns={COLUMNS} error={errors.homeAddress?.message}>
            {(a11y) => (
              <input
                {...a11y}
                {...form.register('homeAddress')}
                placeholder="Enter Home Address"
                autoComplete="off"
                className={boxClass}
              />
            )}
          </FieldRow>
        </div>
        {errors.root?.message && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {errors.root.message}
          </p>
        )}
        <div className="mt-7 flex flex-wrap justify-end gap-3.5">
          <button
            type="button"
            onClick={onClose}
            className={cn(buttonClass, accent.outline, 'min-w-[8.4375rem]')}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={update.isPending}
            className={cn(buttonClass, accent.bg, 'min-w-[8.4375rem]')}
          >
            Send to HR
          </button>
        </div>
      </form>
    </BxDialog>
  )
}
