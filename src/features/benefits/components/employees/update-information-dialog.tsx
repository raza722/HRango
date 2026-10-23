import type { SyntheticEvent } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format, subDays } from 'date-fns'

import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import { MARITAL_STATUSES } from '../../constants'
import { useUpdateProfile } from '../../hooks/use-benefits'
import { profileFormSchema, type ProfileFormValues } from '../../schemas/benefits.schema'
import type { EmployeeRow } from '../../types/benefits.types'
import { accent, boxClass, buttonClass } from '../shared/benefit-styles'
import { BxSelect, DateBox, FieldRow } from '../shared/controls'
import { BxDialog } from '../shared/dialogs'

const COLUMNS = '@lg:grid-cols-[8.5rem_minmax(0,18rem)]'

/**
 * Update missing information (not drawn; laid out like the Edit Plan Year popup): the details
 * benefits enrollment needs from the person.
 */
export function UpdateInformationDialog({
  employee,
  onClose,
}: {
  employee: EmployeeRow
  onClose: () => void
}) {
  const update = useUpdateProfile()
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      dateOfBirth: employee.profile.dateOfBirth ?? '',
      maritalStatus: employee.profile.maritalStatus ?? '',
      homeAddress: employee.profile.homeAddress ?? '',
    },
  })
  const { errors } = form.formState

  const submit = form.handleSubmit(async (values) => {
    try {
      await update.mutateAsync({ id: employee.id, input: values })
      onClose()
    } catch (error) {
      const fields = error instanceof ApiError ? Object.entries(error.fieldErrors) : []
      if (fields.length > 0) {
        for (const [name, message] of fields) {
          if (name in values) form.setError(name as keyof ProfileFormValues, { message })
        }
      } else {
        form.setError('root', {
          message: error instanceof ApiError ? error.message : 'Could not save the information.',
        })
      }
    }
  })

  return (
    <BxDialog
      title="Update Information"
      description={`The benefit details of ${employee.name}.`}
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
          <span className="text-muted-foreground">{` · ${employee.jobTitle}`}</span>
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
                    options={MARITAL_STATUSES.map((status) => ({ value: status, label: status }))}
                  />
                )}
              </FieldRow>
            )}
          />
          <FieldRow
            label="Home Address"
            required
            columns={COLUMNS}
            error={errors.homeAddress?.message}
          >
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
            Save
          </button>
        </div>
      </form>
    </BxDialog>
  )
}
