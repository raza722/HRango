import { type Control, Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { EmployeeSearchSelect } from '@/features/payroll'
import { cn } from '@/lib/utils'

import { useSavePosition } from '../../hooks/use-manpower'
import { positionFormSchema, type PositionFormValues } from '../../schemas/dialog-forms.schema'
import type { EmployeePosition, ManpowerLookups } from '../../types/manpower.types'
import { showSaveError } from '../../utils/errors'
import { toAmount } from '../../utils/plan-math'
import { MpField, type MpOption, MpSelect } from '../shared/controls'
import { accent, dialogBoxClass, dialogButton } from '../shared/mp-styles'
import { MpDialog } from '../shared/popups'

const optionsOf = (list: readonly { id: string; name: string }[]): MpOption[] =>
  list.map((item) => ({ value: item.id, label: item.name }))

const FIELDS = [
  'code',
  'jobTitleId',
  'divisionId',
  'branchId',
  'departmentId',
  'subDepartmentId',
  'employeeGroupId',
  'costCenterId',
  'gradeId',
  'reportsToId',
  'employeeId',
  'minSalary',
  'maxSalary',
] as const

const fieldGrid = '@md:grid-cols-[8rem_minmax(0,1fr)] @md:items-center @md:gap-x-3'

function SelectRow({
  control,
  name,
  label,
  required,
  options,
  disabled,
  onPicked,
}: {
  control: Control<PositionFormValues>
  name: (typeof FIELDS)[number]
  label: string
  required?: boolean
  options: readonly MpOption[]
  disabled?: boolean
  onPicked?: (value: string) => void
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <MpField
          label={label}
          required={required}
          error={fieldState.error?.message}
          className={fieldGrid}
        >
          {(a11y) => (
            <MpSelect
              {...a11y}
              value={field.value}
              onChange={(value) => {
                field.onChange(value)
                onPicked?.(value)
              }}
              noneLabel={required ? undefined : 'Select'}
              noneTone="placeholder"
              disabled={disabled}
              options={options}
              className={dialogBoxClass}
            />
          )}
        </MpField>
      )}
    />
  )
}

/**
 * The Employee Position popup in its two columns. Position Title, Cost Center, Reports To and
 * Held By are added to the drawn fields: the list shows the position's title, and the API keeps
 * the cost centre, the position it reports to and the person in the seat.
 */
export function EmployeePositionDialog({
  position,
  lookups,
  onClose,
}: {
  position: EmployeePosition | null
  lookups: ManpowerLookups
  onClose: () => void
}) {
  const save = useSavePosition()
  const form = useForm<PositionFormValues>({
    resolver: zodResolver(positionFormSchema),
    defaultValues: position
      ? {
          code: position.code,
          jobTitleId: position.jobTitleId,
          divisionId: position.divisionId ?? '',
          branchId: position.branchId,
          departmentId: position.departmentId ?? '',
          subDepartmentId: position.subDepartmentId ?? '',
          employeeGroupId: position.employeeGroupId,
          costCenterId: position.costCenterId ?? '',
          gradeId: position.gradeId ?? '',
          reportsToId: position.reportsToId ?? '',
          employeeId: position.employeeId ?? '',
          minSalary: position.minSalary === null ? '' : String(position.minSalary),
          maxSalary: position.maxSalary === null ? '' : String(position.maxSalary),
        }
      : {
          code: '',
          jobTitleId: '',
          divisionId: '',
          branchId: '',
          departmentId: '',
          subDepartmentId: '',
          employeeGroupId: '',
          costCenterId: '',
          gradeId: '',
          reportsToId: '',
          employeeId: '',
          minSalary: '',
          maxSalary: '',
        },
  })
  const { control, register, handleSubmit, formState, setError, setValue } = form
  const departmentId = useWatch({ control, name: 'departmentId' })
  const departments = lookups.departments.filter((item) => item.parentId === null)
  const subDepartments = lookups.departments.filter((item) => item.parentId === departmentId)
  const reportsTo = lookups.positions
    .filter((item) => item.id !== position?.id)
    .map((item) => ({ value: item.id, label: `${item.jobTitleName} (${item.code})` }))
  // The person in the seat keeps their name before the lookup reads them.
  const heldBy = position?.employeeId
    ? [{ value: position.employeeId, label: position.employeeName ?? position.employeeId }]
    : undefined
  const orNull = (value: string) => (value === '' ? null : value)

  const submit = handleSubmit((values) => {
    save.mutate(
      {
        id: position?.id,
        input: {
          code: values.code.trim() || null,
          jobTitleId: values.jobTitleId,
          divisionId: orNull(values.divisionId),
          branchId: values.branchId,
          departmentId: orNull(values.departmentId),
          subDepartmentId: orNull(values.subDepartmentId),
          employeeGroupId: values.employeeGroupId,
          costCenterId: orNull(values.costCenterId),
          gradeId: orNull(values.gradeId),
          reportsToId: orNull(values.reportsToId),
          employeeId: orNull(values.employeeId),
          status: position?.status ?? 'active',
          minSalary: values.minSalary.trim() === '' ? 0 : toAmount(values.minSalary),
          maxSalary: toAmount(values.maxSalary),
          ...(position ? { rowVersion: position.rowVersion } : {}),
        },
      },
      {
        onSuccess: onClose,
        onError: (error) => {
          showSaveError(error, setError, FIELDS, 'The employee position could not be saved.')
        },
      },
    )
  })

  return (
    <MpDialog title="Employee Position" onClose={onClose} className="max-w-[47.3125rem]">
      <form noValidate onSubmit={(event) => void submit(event)} className="grid gap-6">
        <div className="grid gap-x-8 gap-y-4 @2xl:grid-cols-2">
          <MpField
            label="Position Code"
            error={formState.errors.code?.message}
            className={fieldGrid}
          >
            {(a11y) => (
              <input
                {...a11y}
                {...register('code')}
                placeholder="Next number"
                className={cn(dialogBoxClass, 'w-full')}
              />
            )}
          </MpField>
          <SelectRow
            control={control}
            name="divisionId"
            label="Division"
            options={optionsOf(lookups.divisions)}
          />
          <SelectRow
            control={control}
            name="branchId"
            label="Station"
            required
            options={optionsOf(lookups.stations)}
          />
          <SelectRow
            control={control}
            name="departmentId"
            label="Department"
            options={optionsOf(departments)}
            onPicked={() => {
              setValue('subDepartmentId', '')
            }}
          />
          <SelectRow
            control={control}
            name="subDepartmentId"
            label="Sub Department"
            disabled={!departmentId}
            options={optionsOf(subDepartments)}
          />
          <SelectRow
            control={control}
            name="employeeGroupId"
            label="Employee Group"
            required
            options={optionsOf(lookups.employeeGroups)}
          />
          <SelectRow
            control={control}
            name="gradeId"
            label="Grade"
            options={optionsOf(lookups.grades)}
          />
          <MpField
            label="Minimum Salary"
            error={formState.errors.minSalary?.message}
            className={fieldGrid}
          >
            {(a11y) => (
              <input
                {...a11y}
                {...register('minSalary')}
                inputMode="decimal"
                className={cn(dialogBoxClass, 'w-full')}
              />
            )}
          </MpField>
          <MpField
            label="Maximum Salary"
            required
            error={formState.errors.maxSalary?.message}
            className={fieldGrid}
          >
            {(a11y) => (
              <input
                {...a11y}
                {...register('maxSalary')}
                inputMode="decimal"
                className={cn(dialogBoxClass, 'w-full')}
              />
            )}
          </MpField>
          <SelectRow
            control={control}
            name="jobTitleId"
            label="Position Title"
            required
            options={optionsOf(lookups.jobTitles)}
          />
          <SelectRow
            control={control}
            name="costCenterId"
            label="Cost Center"
            options={optionsOf(lookups.costCenters)}
          />
          <SelectRow control={control} name="reportsToId" label="Reports To" options={reportsTo} />
          <Controller
            control={control}
            name="employeeId"
            render={({ field, fieldState }) => (
              <MpField label="Held By" error={fieldState.error?.message} className={fieldGrid}>
                {(a11y) => (
                  <EmployeeSearchSelect
                    {...a11y}
                    value={field.value || null}
                    onChange={(value) => {
                      field.onChange(value ?? '')
                    }}
                    filters={{ permission: 'manpower.settings.positions.view' }}
                    known={heldBy}
                    hint={(row) => [row.code, row.jobTitleName].filter(Boolean).join(' · ')}
                    placeholder="Select Employee"
                    clearable
                    className={dialogBoxClass}
                  />
                )}
              </MpField>
            )}
          />
        </div>
        <div className="flex flex-wrap justify-center gap-5">
          <button type="button" onClick={onClose} className={cn(dialogButton, accent.outline)}>
            Cancel
          </button>
          <button type="submit" disabled={save.isPending} className={cn(dialogButton, accent.bg)}>
            Save Position
          </button>
        </div>
      </form>
    </MpDialog>
  )
}
