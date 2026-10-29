import type { ReactNode } from 'react'
import { type Control, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { ErrorState } from '@/components/feedback/error-state'
import { Spinner } from '@/components/feedback/spinner'
import { DatePickerField, SelectField, TextField } from '@/components/form'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { EmployeeSearchSelectField, SearchSelectField } from '@/features/payroll'
import { cn } from '@/lib/utils'

import {
  EMPLOYEE_STATUS_META,
  GENDER_LABELS,
  MARITAL_LABELS,
  SALARY_FREQUENCY_LABELS,
  TM_CODES,
} from '../../constants'
import { useEmployee, useOrgLookups, useSaveEmployee } from '../../hooks/use-employees'
import {
  employeeFormSchema,
  employeeFormToInput,
  type EmployeeFormValues,
  employeeToForm,
} from '../../schemas/employee-forms.schema'
import {
  type Employee,
  EMPLOYEE_STATUSES,
  GENDERS,
  MARITAL_STATUSES,
  ORG_LOOKUP_KINDS,
  type OrgLookupKind,
  SALARY_FREQUENCIES,
} from '../../types/employees.types'
import { showServerErrors } from '../../utils/form-errors'
import { dialogClass, dialogTitleClass, wideDialogClass } from '../../utils/styles'
import { FormDialog } from '../shared/form-dialog'

type OrgField = Extract<
  keyof EmployeeFormValues,
  | 'branchId'
  | 'locationId'
  | 'areaId'
  | 'departmentId'
  | 'divisionId'
  | 'costCenterId'
  | 'designationId'
  | 'jobTitleId'
  | 'gradeId'
  | 'jobLevelId'
  | 'employeeGroupId'
  | 'employmentTypeId'
>

/** The organisation pickers: field, label, and the lookup kind that fills it. */
const ORG_FIELDS: readonly { name: OrgField; label: string; kind: OrgLookupKind }[] = [
  { name: 'branchId', label: 'Branch', kind: 'branches' },
  { name: 'locationId', label: 'Location', kind: 'locations' },
  { name: 'areaId', label: 'Area', kind: 'areas' },
  { name: 'departmentId', label: 'Department', kind: 'departments' },
  { name: 'divisionId', label: 'Division', kind: 'divisions' },
  { name: 'costCenterId', label: 'Cost Center', kind: 'cost-centers' },
  { name: 'designationId', label: 'Designation', kind: 'designations' },
  { name: 'jobTitleId', label: 'Job Title', kind: 'job-titles' },
  { name: 'gradeId', label: 'Grade', kind: 'grades' },
  { name: 'jobLevelId', label: 'Job Level', kind: 'job-levels' },
  { name: 'employeeGroupId', label: 'Employee Group', kind: 'employee-groups' },
  { name: 'employmentTypeId', label: 'Employment Type', kind: 'employment-types' },
]

/** Server field names that are form fields as they are. */
const FORM_FIELDS = Object.keys(employeeToForm(null))

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-4">
      <legend className="pb-3 text-base font-medium text-[#202020] dark:text-heading">
        {title}
      </legend>
      <div className="grid gap-4 @md:grid-cols-2 @3xl:grid-cols-3">{children}</div>
    </fieldset>
  )
}

/** A picker of `GET /organisation/lookups/{kind}` (searchable; optional ones can be cleared). */
function OrgPicker({
  control,
  name,
  label,
  rows,
  required = false,
  onValueChange,
}: {
  control: Control<EmployeeFormValues>
  name: OrgField
  label: string
  rows: readonly { id: string; name: string }[]
  required?: boolean
  onValueChange?: ((value: string | null) => void) | undefined
}) {
  return (
    <SearchSelectField
      control={control}
      name={name}
      label={label}
      required={required}
      {...(onValueChange ? { onValueChange } : {})}
      options={rows.map((row) => ({ value: row.id, label: row.name }))}
      placeholder={`Select ${label}`}
      clearable={!required}
    />
  )
}

function EmployeeForm({ employee, onClose }: { employee: Employee | null; onClose: () => void }) {
  const save = useSaveEmployee()
  const { lists } = useOrgLookups(ORG_LOOKUP_KINDS)
  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: employeeToForm(employee),
  })
  // A branch sits in one location (the branch lookup gives it as `parentId`): with a branch
  // chosen, Location offers that one.
  const branchId = useWatch({ control: form.control, name: 'branchId' })
  const locationOf = (id: string | null) =>
    lists.branches.find((row) => row.id === id)?.parentId ?? null
  const branchLocation = locationOf(branchId)
  const known = (id: string | null, name: string | null) =>
    id && name ? [{ value: id, label: name }] : undefined

  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({ id: employee?.id, input: employeeFormToInput(values, employee) })
    } catch (error) {
      showServerErrors(error, form.setError, FORM_FIELDS)
      return
    }
    onClose()
  })

  const orgRows = (field: (typeof ORG_FIELDS)[number]) => {
    const listed = lists[field.kind]
    const rows =
      field.name === 'locationId' && branchLocation
        ? listed.filter((row) => row.id === branchLocation)
        : listed
    // The record's own value stays nameable even when the lookup does not list it.
    const id = employee?.[field.name]
    const nameKey = field.name.replace(/Id$/, 'Name') as keyof Employee
    const name = employee?.[nameKey]
    return id && typeof name === 'string' && !rows.some((row) => row.id === id)
      ? [{ id, name }, ...rows]
      : rows
  }

  return (
    <FormDialog
      wide
      title={employee ? 'Edit Employee' : 'Add New Employee'}
      description={employee ? `Edit ${employee.name}.` : 'Add an employee record.'}
      onClose={onClose}
      onSubmit={submit}
      saving={save.isPending}
      saveLabel={employee ? 'Save' : 'Add Employee'}
      rootError={form.formState.errors.root?.message}
      dirty={form.formState.isDirty}
    >
      <Group title="Personal">
        <TextField
          control={form.control}
          name="firstName"
          label="First Name"
          required
          placeholder="Enter First Name"
        />
        <TextField
          control={form.control}
          name="lastName"
          label="Last Name"
          required
          placeholder="Enter Last Name"
        />
        <TextField
          control={form.control}
          name="parentName"
          label="Father / Husband Name"
          placeholder="Enter Name"
        />
        <SelectField
          control={form.control}
          name="gender"
          label="Gender"
          placeholder="Select Gender"
          clearable
          options={GENDERS.map((value) => ({ value, label: GENDER_LABELS[value] }))}
        />
        <SelectField
          control={form.control}
          name="maritalStatus"
          label="Marital Status"
          placeholder="Select Marital Status"
          clearable
          options={MARITAL_STATUSES.map((value) => ({ value, label: MARITAL_LABELS[value] }))}
        />
        <TextField control={form.control} name="dateOfBirth" label="Date of Birth" type="date" />
        <TextField
          control={form.control}
          name="religion"
          label="Religion"
          placeholder="Enter Religion"
        />
        <TextField
          control={form.control}
          name="nationality"
          label="Nationality"
          placeholder="Enter Nationality"
        />
        {(!employee || employee.canSeeIdentity) && (
          <TextField
            control={form.control}
            name="cnic"
            label="CNIC No"
            placeholder="Enter CNIC No"
            disabled={employee !== null}
            description={employee ? 'Change it with Update Profile on the profile.' : undefined}
          />
        )}
      </Group>

      <Group title="Contact">
        <TextField
          control={form.control}
          name="email"
          label="Email Address"
          type="email"
          placeholder="Enter Email Address"
        />
        <TextField
          control={form.control}
          name="phone1"
          label="Phone Number"
          placeholder="Enter Phone Number"
        />
        <TextField
          control={form.control}
          name="phone2"
          label="Other Phone Number"
          placeholder="Enter Phone Number"
        />
        <TextField
          control={form.control}
          name="homeAddress"
          label="Address"
          placeholder="Enter Residence Address"
          className="@md:col-span-2 @3xl:col-span-3"
        />
      </Group>

      <Group title="Organisation">
        <TextField
          control={form.control}
          name="code"
          label="Reg. #"
          placeholder="Next number"
          description={employee ? undefined : 'Leave blank for the next number.'}
        />
        {ORG_FIELDS.map((field) => (
          <OrgPicker
            key={field.name}
            control={form.control}
            name={field.name}
            label={field.label}
            rows={orgRows(field)}
            required={field.name === 'branchId'}
            onValueChange={
              field.name === 'branchId'
                ? (next) => {
                    const location = locationOf(next)
                    if (location) form.setValue('locationId', location, { shouldDirty: true })
                  }
                : undefined
            }
          />
        ))}
        <EmployeeSearchSelectField
          control={form.control}
          name="lineManagerId"
          label="Line Manager"
          placeholder="Select Line Manager"
          filters={{ permission: TM_CODES.view }}
          known={known(employee?.lineManagerId ?? null, employee?.lineManagerName ?? null)}
          include={(row) => row.id !== employee?.id}
          clearable
        />
        <EmployeeSearchSelectField
          control={form.control}
          name="finalAuthorityId"
          label="Final Authority"
          placeholder="Select Final Authority"
          filters={{ permission: TM_CODES.view }}
          known={known(employee?.finalAuthorityId ?? null, employee?.finalAuthorityName ?? null)}
          include={(row) => row.id !== employee?.id}
          clearable
        />
      </Group>

      <Group title="Employment">
        <SelectField
          control={form.control}
          name="status"
          label="Status"
          options={EMPLOYEE_STATUSES.map((value) => ({
            value,
            label: EMPLOYEE_STATUS_META[value].label,
          }))}
        />
        <DatePickerField control={form.control} name="joiningDate" label="Joining Date" />
        <DatePickerField
          control={form.control}
          name="probationEndDate"
          label="Probation End Date"
        />
        <DatePickerField control={form.control} name="confirmationDate" label="Confirmation Date" />
        <SelectField
          control={form.control}
          name="salaryFrequency"
          label="Salary Frequency"
          options={SALARY_FREQUENCIES.map((value) => ({
            value,
            label: SALARY_FREQUENCY_LABELS[value],
          }))}
        />
      </Group>
    </FormDialog>
  )
}

/**
 * "+ Add New" and the row menu's Edit: the `EmployeeIn` fields in four groups (Personal,
 * Contact, Organisation, Employment). Edit reads the record first, for its `rowVersion`.
 */
export function EmployeeFormDialog({
  employeeId,
  onClose,
}: {
  /** null: Add New. */
  employeeId: string | null
  onClose: () => void
}) {
  const record = useEmployee(employeeId)
  if (employeeId === null) return <EmployeeForm employee={null} onClose={onClose} />
  if (record.data) return <EmployeeForm employee={record.data} onClose={onClose} />
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className={cn(record.isError ? dialogClass : wideDialogClass, 'p-6')}>
        <DialogTitle className={dialogTitleClass}>Edit Employee</DialogTitle>
        <DialogDescription className="sr-only">Loading the employee.</DialogDescription>
        {record.isError ? (
          <ErrorState
            message={record.error.message}
            onRetry={() => {
              void record.refetch()
            }}
            className="shadow-none"
          />
        ) : (
          <div className="flex justify-center py-16">
            <Spinner label="Loading the employee" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
