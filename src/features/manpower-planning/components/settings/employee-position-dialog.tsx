import { type Control, Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { cn } from '@/lib/utils'

import { useSavePosition } from '../../hooks/use-manpower'
import { positionFormSchema, type PositionFormValues } from '../../schemas/dialog-forms.schema'
import type { EmployeePositionRow, ManpowerLookups } from '../../types/manpower.types'
import { showSaveError } from '../../utils/errors'
import { toAmount } from '../../utils/plan-math'
import { MpField, type MpOption, MpSelect } from '../shared/controls'
import { accent, dialogBoxClass, dialogButton } from '../shared/mp-styles'
import { MpDialog } from '../shared/popups'

const optionsOf = (list: readonly { id: string; name: string }[]): MpOption[] =>
  list.map((item) => ({ value: item.id, label: item.name }))

const FIELDS = [
  'code',
  'positionTitleId',
  'divisionId',
  'stationId',
  'departmentId',
  'subDepartmentId',
  'employeeGroupId',
  'costCenterId',
  'gradeId',
  'reportsToId',
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
 * The Employee Position popup in its two columns. Position Title, Cost Center and
 * Reports To are added to the drawn fields: the list shows the position's title and
 * the filters ask for the other two.
 */
export function EmployeePositionDialog({
  position,
  lookups,
  onClose,
}: {
  position: EmployeePositionRow | null
  lookups: ManpowerLookups
  onClose: () => void
}) {
  const save = useSavePosition()
  const form = useForm<PositionFormValues>({
    resolver: zodResolver(positionFormSchema),
    defaultValues: position
      ? {
          code: position.code,
          positionTitleId: position.positionTitleId,
          divisionId: position.divisionId ?? '',
          stationId: position.stationId ?? '',
          departmentId: position.departmentId ?? '',
          subDepartmentId: position.subDepartmentId ?? '',
          employeeGroupId: position.employeeGroupId,
          costCenterId: position.costCenterId ?? '',
          gradeId: position.gradeId ?? '',
          reportsToId: position.reportsToId ?? '',
          minSalary: String(position.minSalary),
          maxSalary: String(position.maxSalary),
        }
      : {
          code: '',
          positionTitleId: '',
          divisionId: '',
          stationId: '',
          departmentId: '',
          subDepartmentId: '',
          employeeGroupId: '',
          costCenterId: '',
          gradeId: '',
          reportsToId: '',
          minSalary: '',
          maxSalary: '',
        },
  })
  const { control, register, handleSubmit, formState, setError, setValue } = form
  const [divisionId, departmentId] = useWatch({ control, name: ['divisionId', 'departmentId'] })
  const departments = lookups.departments.filter(
    (item) => !divisionId || item.divisionId === divisionId,
  )
  const subDepartments = lookups.subDepartments.filter((item) => item.departmentId === departmentId)
  const titles = lookups.positionTitles
    .filter((item) => item.active || item.id === position?.positionTitleId)
    .map((item) => ({ value: item.id, label: item.title }))
  const orNull = (value: string) => (value === '' ? null : value)

  const submit = handleSubmit((values) => {
    save.mutate(
      {
        id: position?.id,
        input: {
          code: values.code.trim(),
          positionTitleId: values.positionTitleId,
          divisionId: orNull(values.divisionId),
          stationId: values.stationId,
          departmentId: orNull(values.departmentId),
          subDepartmentId: orNull(values.subDepartmentId),
          employeeGroupId: values.employeeGroupId,
          costCenterId: orNull(values.costCenterId),
          gradeId: orNull(values.gradeId),
          reportsToId: orNull(values.reportsToId),
          minSalary: values.minSalary.trim() === '' ? 0 : toAmount(values.minSalary),
          maxSalary: toAmount(values.maxSalary),
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
                placeholder="12212"
                className={cn(dialogBoxClass, 'w-full')}
              />
            )}
          </MpField>
          <SelectRow
            control={control}
            name="divisionId"
            label="Division"
            options={optionsOf(lookups.divisions)}
            onPicked={(value) => {
              const department = lookups.departments.find((item) => item.id === departmentId)
              if (value && department && department.divisionId !== value) {
                setValue('departmentId', '')
                setValue('subDepartmentId', '')
              }
            }}
          />
          <SelectRow
            control={control}
            name="stationId"
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
            name="positionTitleId"
            label="Position Title"
            required
            options={titles}
          />
          <SelectRow
            control={control}
            name="costCenterId"
            label="Cost Center"
            options={optionsOf(lookups.costCenters)}
          />
          <SelectRow
            control={control}
            name="reportsToId"
            label="Reports To"
            options={lookups.employees.map((person) => ({
              value: person.id,
              label: `${person.name}, ${person.jobTitle}`,
            }))}
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
