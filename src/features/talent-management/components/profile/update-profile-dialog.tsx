import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { SelectField, TextField } from '@/components/form'
import { useCan } from '@/lib/permissions'

import { MARITAL_LABELS, TM_CODES } from '../../constants'
import { useUpdateProfile } from '../../hooks/use-employees'
import {
  PROFILE_FIELD_OF,
  profileToForm,
  profileToInput,
  updateProfileSchema,
  type UpdateProfileValues,
} from '../../schemas/employee-forms.schema'
import { type Employee, MARITAL_STATUSES } from '../../types/employees.types'
import { showServerErrors } from '../../utils/form-errors'
import { FormDialog } from '../shared/form-dialog'

/**
 * Update Profile (2423:17134): Full Name, Email Address, Phone Number, Address, CNIC No, Date of
 * Birth and Marital Status, then Cancel / Update Profile. Saves the record (`PUT
 * /employees/{id}`) and, when the CNIC changed, `PUT …/identity`; without identity rights the
 * CNIC is read-only (or hidden when the API masks it).
 */
export function UpdateProfileDialog({
  employee,
  onClose,
}: {
  employee: Employee
  onClose: () => void
}) {
  const save = useUpdateProfile()
  const canIdentity = useCan(TM_CODES.identity)
  const form = useForm<UpdateProfileValues>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: profileToForm(employee),
  })

  const submit = form.handleSubmit(async (values) => {
    const { input, cnic } = profileToInput(values, employee)
    try {
      await save.mutateAsync({ employee, input, cnic: canIdentity ? cnic : undefined })
    } catch (error) {
      showServerErrors(error, form.setError, Object.keys(values), PROFILE_FIELD_OF)
      return
    }
    onClose()
  })

  return (
    <FormDialog
      title="Update Profile"
      description={`Update the profile of ${employee.name}.`}
      onClose={onClose}
      onSubmit={submit}
      saving={save.isPending}
      saveLabel="Update Profile"
      rootError={form.formState.errors.root?.message}
      dirty={form.formState.isDirty}
    >
      <div className="grid gap-4 @md:grid-cols-2">
        <TextField
          control={form.control}
          name="fullName"
          label="Full Name"
          placeholder="Enter Full Name"
          className="@md:col-span-2"
        />
        <TextField
          control={form.control}
          name="email"
          label="Email Address"
          type="email"
          placeholder="Enter Email Address"
        />
        <TextField
          control={form.control}
          name="phone"
          label="Phone Number"
          type="tel"
          placeholder="Enter Phone Number"
        />
        <TextField
          control={form.control}
          name="address"
          label="Address"
          placeholder="Enter Residence Address"
          className="@md:col-span-2"
        />
        {employee.canSeeIdentity && (
          <TextField
            control={form.control}
            name="cnic"
            label="CNIC No"
            placeholder="Enter CNIC No"
            disabled={!canIdentity}
            description={canIdentity ? undefined : 'You may not change the CNIC.'}
          />
        )}
        <TextField control={form.control} name="dateOfBirth" label="Date of Birth" type="date" />
        <SelectField
          control={form.control}
          name="maritalStatus"
          label="Marital Status"
          placeholder="Single"
          clearable
          options={MARITAL_STATUSES.map((value) => ({ value, label: MARITAL_LABELS[value] }))}
        />
      </div>
    </FormDialog>
  )
}
