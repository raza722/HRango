import type { ReactNode } from 'react'
import {
  type Control,
  Controller,
  type FieldPathByValue,
  type UseFormSetValue,
  useWatch,
} from 'react-hook-form'

import { cn } from '@/lib/utils'

import type { PlanFormValues } from '../../schemas/plan-form.schema'
import type { ManpowerLookups } from '../../types/manpower.types'
import { formatAmount } from '../../utils/format'
import { amountOr0, existingLineAnnual, newLineMonthly } from '../../utils/plan-math'
import { DateBox, MonthBox, MpSelect } from '../shared/controls'
import { DeleteIcon } from '../shared/mp-icons'
import { cellBoxClass, headText } from '../shared/mp-styles'

type StringPath = FieldPathByValue<PlanFormValues, string>

const errorText = 'mt-1 block max-w-[8rem] text-[0.6875rem] leading-tight text-destructive'

/** One box of a line, bound to the form, with its error under it. */
function CellControl({
  control,
  name,
  render,
}: {
  control: Control<PlanFormValues>
  name: StringPath
  render: (props: {
    value: string
    onChange: (value: string) => void
    'aria-invalid': boolean
  }) => ReactNode
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <>
          {render({
            value: field.value,
            onChange: field.onChange,
            'aria-invalid': Boolean(fieldState.error),
          })}
          {fieldState.error && (
            <span role="alert" className={errorText}>
              {fieldState.error.message}
            </span>
          )}
        </>
      )}
    />
  )
}

function AmountInput({
  value,
  onChange,
  label,
  className,
  ...rest
}: {
  value: string
  onChange: (value: string) => void
  label: string
  className?: string
  'aria-invalid': boolean
}) {
  return (
    <input
      {...rest}
      aria-label={label}
      inputMode="decimal"
      value={value}
      onChange={(event) => {
        onChange(event.target.value)
      }}
      className={cn(cellBoxClass, 'w-full px-2 text-sm sm:text-sm', className)}
    />
  )
}

const readBox = cn(
  cellBoxClass,
  'flex w-full min-w-[4rem] items-center bg-muted/40 text-sm sm:text-sm',
)

const deleteButton =
  'inline-flex size-8 items-center justify-center rounded-md text-[#C2420B] outline-none hover:bg-[#C2420B]/10 focus-visible:ring-[3px] focus-visible:ring-[#C2420B]/30 disabled:opacity-40'

function TableHead({ heads }: { heads: readonly { label: ReactNode; className?: string }[] }) {
  return (
    <thead>
      <tr className="border-y border-[#EBEFF8] dark:border-border">
        {heads.map((head, index) => (
          <th
            key={index}
            scope="col"
            className={cn('h-12 px-1 py-1 text-left align-middle', headText, head.className)}
          >
            {head.label}
          </th>
        ))}
      </tr>
    </thead>
  )
}

const optionsOf = (list: readonly { id: string; name: string }[]) =>
  list.map((item) => ({ value: item.id, label: item.name }))

// --- Plan for New Positions ---------------------------------------------------------------------

/** The live Total Salary of a line (max salary + allowance). */
function NewLineTotal({ control, index }: { control: Control<PlanFormValues>; index: number }) {
  const [max, allowance] = useWatch({
    control,
    name: [`newPositions.${index}.maxSalary`, `newPositions.${index}.totalAllowance`],
  })
  return (
    <span aria-label={`Total salary, line ${String(index + 1)}`} className={readBox}>
      {formatAmount(
        newLineMonthly({ maxSalary: amountOr0(max), totalAllowance: amountOr0(allowance) }),
      )}
    </span>
  )
}

/** Department and Sub-Department of a line, each narrowed by the box before it. */
function OrgCells({
  control,
  prefix,
  lookups,
  index,
  setValue,
}: {
  control: Control<PlanFormValues>
  prefix: `newPositions.${number}`
  lookups: ManpowerLookups
  index: number
  setValue: UseFormSetValue<PlanFormValues>
}) {
  const [divisionId, departmentId] = useWatch({
    control,
    name: [`${prefix}.divisionId`, `${prefix}.departmentId`],
  })
  const line = `line ${String(index + 1)}`
  const departments = lookups.departments.filter(
    (item) => !divisionId || item.divisionId === divisionId,
  )
  const subDepartments = lookups.subDepartments.filter((item) => item.departmentId === departmentId)
  return (
    <>
      <td className="px-1 py-3 align-top">
        <CellControl
          control={control}
          name={`${prefix}.divisionId`}
          render={(props) => (
            <MpSelect
              {...props}
              onChange={(value) => {
                props.onChange(value)
                const department = lookups.departments.find((item) => item.id === departmentId)
                if (value && department && department.divisionId !== value) {
                  setValue(`${prefix}.departmentId`, '')
                  setValue(`${prefix}.subDepartmentId`, '')
                }
              }}
              aria-label={`Division, ${line}`}
              noneLabel="Select"
              options={optionsOf(lookups.divisions)}
              className={cn(cellBoxClass, 'w-[4.5rem]')}
            />
          )}
        />
      </td>
      <td className="px-1 py-3 align-top">
        <CellControl
          control={control}
          name={`${prefix}.stationId`}
          render={(props) => (
            <MpSelect
              {...props}
              aria-label={`Station, ${line}`}
              noneLabel="Select"
              options={optionsOf(lookups.stations)}
              className={cn(cellBoxClass, 'w-[4.5rem]')}
            />
          )}
        />
      </td>
      <td className="px-1 py-3 align-top">
        <CellControl
          control={control}
          name={`${prefix}.departmentId`}
          render={(props) => (
            <MpSelect
              {...props}
              onChange={(value) => {
                props.onChange(value)
                setValue(`${prefix}.subDepartmentId`, '')
              }}
              aria-label={`Department, ${line}`}
              noneLabel="Select"
              options={optionsOf(departments)}
              className={cn(cellBoxClass, 'w-[5rem]')}
            />
          )}
        />
      </td>
      <td className="px-1 py-3 align-top">
        <CellControl
          control={control}
          name={`${prefix}.subDepartmentId`}
          render={(props) => (
            <MpSelect
              {...props}
              aria-label={`Sub-Department, ${line}`}
              noneLabel="Select"
              disabled={!departmentId}
              options={optionsOf(subDepartments)}
              className={cn(cellBoxClass, 'w-[5rem]')}
            />
          )}
        />
      </td>
    </>
  )
}

export function NewPositionsTable({
  control,
  setValue,
  fields,
  lookups,
  defaultYear,
  readOnly,
  onRemove,
}: {
  control: Control<PlanFormValues>
  setValue: UseFormSetValue<PlanFormValues>
  fields: readonly { fieldKey: string }[]
  lookups: ManpowerLookups
  defaultYear: number | undefined
  readOnly: boolean
  onRemove: (index: number) => void
}) {
  const positionOptions = lookups.positions
    .filter((position) => position.active)
    .map((position) => ({ value: position.id, label: `${position.title} (${position.code})` }))
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[57rem] text-sm">
        <caption className="sr-only">Plan for new positions</caption>
        <TableHead
          heads={[
            { label: 'Sr#', className: 'pl-4 sm:pl-2.5' },
            { label: 'Position' },
            { label: 'Plan Date' },
            { label: 'Division' },
            { label: 'Station' },
            { label: 'Department' },
            { label: 'Sub- Department', className: 'max-w-[5.5rem]' },
            { label: 'Employee Group', className: 'max-w-[4.5rem]' },
            { label: 'Min Salary' },
            { label: 'Max Salary' },
            { label: 'Total Allowance', className: 'max-w-[4.75rem]' },
            { label: 'Total Salary', className: 'max-w-[4rem]' },
            { label: <span className="sr-only">Remove</span> },
          ]}
        />
        <tbody>
          {fields.length === 0 ? (
            <tr>
              <td colSpan={13} className="px-4 py-6 text-center text-sm text-[#707070]">
                No new positions yet. Add one, or import the plan's employee positions.
              </td>
            </tr>
          ) : (
            fields.map((field, index) => {
              const prefix = `newPositions.${index}` as const
              const line = `line ${String(index + 1)}`
              return (
                <tr key={field.fieldKey}>
                  <td className="pt-5 pr-1.5 pl-4 align-top text-xs font-medium text-heading sm:pl-5">
                    {index + 1}
                  </td>
                  <td className="px-1 py-3 align-top">
                    <CellControl
                      control={control}
                      name={`${prefix}.positionId`}
                      render={(props) => (
                        <MpSelect
                          {...props}
                          onChange={(value) => {
                            props.onChange(value)
                            const position = lookups.positions.find((item) => item.id === value)
                            if (!position) return
                            setValue(`${prefix}.divisionId`, position.divisionId ?? '')
                            setValue(`${prefix}.stationId`, position.stationId ?? '')
                            setValue(`${prefix}.departmentId`, position.departmentId ?? '')
                            setValue(`${prefix}.subDepartmentId`, position.subDepartmentId ?? '')
                            setValue(`${prefix}.employeeGroupId`, position.employeeGroupId)
                            setValue(`${prefix}.minSalary`, String(position.minSalary))
                            setValue(`${prefix}.maxSalary`, String(position.maxSalary))
                          }}
                          aria-label={`Position, ${line}`}
                          options={positionOptions}
                          className={cn(cellBoxClass, 'w-[5.4rem]')}
                        />
                      )}
                    />
                  </td>
                  <td className="px-1 py-3 align-top">
                    <div className="grid gap-1.5">
                      <CellControl
                        control={control}
                        name={`${prefix}.fromMonth`}
                        render={(props) => (
                          <MonthBox
                            {...props}
                            aria-label={`Plan from, ${line}`}
                            defaultYear={defaultYear}
                            className="w-[5.9rem] px-1.5 sm:px-1.5"
                          />
                        )}
                      />
                      <CellControl
                        control={control}
                        name={`${prefix}.toMonth`}
                        render={(props) => (
                          <MonthBox
                            {...props}
                            aria-label={`Plan to, ${line}`}
                            defaultYear={defaultYear}
                            className="w-[5.9rem] px-1.5 sm:px-1.5"
                          />
                        )}
                      />
                    </div>
                  </td>
                  <OrgCells
                    control={control}
                    prefix={prefix}
                    lookups={lookups}
                    index={index}
                    setValue={setValue}
                  />
                  <td className="px-1 py-3 align-top">
                    <CellControl
                      control={control}
                      name={`${prefix}.employeeGroupId`}
                      render={(props) => (
                        <MpSelect
                          {...props}
                          aria-label={`Employee group, ${line}`}
                          noneLabel="Select"
                          options={optionsOf(lookups.employeeGroups)}
                          className={cn(cellBoxClass, 'w-[3.6rem] text-sm sm:text-sm')}
                        />
                      )}
                    />
                  </td>
                  <td className="px-1 py-3 align-top">
                    <CellControl
                      control={control}
                      name={`${prefix}.minSalary`}
                      render={(props) => (
                        <AmountInput
                          {...props}
                          label={`Min salary, ${line}`}
                          className="w-[4.9rem]"
                        />
                      )}
                    />
                  </td>
                  <td className="px-1 py-3 align-top">
                    <CellControl
                      control={control}
                      name={`${prefix}.maxSalary`}
                      render={(props) => (
                        <AmountInput
                          {...props}
                          label={`Max salary, ${line}`}
                          className="w-[4.9rem]"
                        />
                      )}
                    />
                  </td>
                  <td className="px-1 py-3 align-top">
                    <CellControl
                      control={control}
                      name={`${prefix}.totalAllowance`}
                      render={(props) => (
                        <AmountInput
                          {...props}
                          label={`Total allowance, ${line}`}
                          className="w-[4rem]"
                        />
                      )}
                    />
                  </td>
                  <td className="px-1 py-3 align-top">
                    <NewLineTotal control={control} index={index} />
                  </td>
                  <td className="py-3 pr-4 pl-1.5 align-top sm:pr-5">
                    <button
                      type="button"
                      aria-label={`Remove new position ${String(index + 1)}`}
                      disabled={readOnly}
                      onClick={() => {
                        onRemove(index)
                      }}
                      className={deleteButton}
                    >
                      <DeleteIcon className="h-[1.055rem] w-[0.9375rem]" />
                    </button>
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}

// --- Plan for Existing Positions --------------------------------------------------------------

function ExistingLineFacts({
  control,
  index,
  lookups,
  part,
}: {
  control: Control<PlanFormValues>
  index: number
  lookups: ManpowerLookups
  part: 'position' | 'department' | 'station' | 'annual'
}) {
  const [employeeId, startDate, endDate, monthlySalary, totalAllowance] = useWatch({
    control,
    name: [
      `existingPositions.${index}.employeeId`,
      `existingPositions.${index}.startDate`,
      `existingPositions.${index}.endDate`,
      `existingPositions.${index}.monthlySalary`,
      `existingPositions.${index}.totalAllowance`,
    ],
  })
  const person = lookups.employees.find((item) => item.id === employeeId)
  if (part === 'annual') {
    return (
      <span aria-label={`Annual gross salary, line ${String(index + 1)}`} className={readBox}>
        {startDate && endDate
          ? formatAmount(
              existingLineAnnual({
                monthlySalary: amountOr0(monthlySalary),
                totalAllowance: amountOr0(totalAllowance),
                startDate,
                endDate,
              }),
            )
          : ''}
      </span>
    )
  }
  const text =
    part === 'position'
      ? person?.jobTitle
      : part === 'department'
        ? lookups.departments.find((item) => item.id === person?.departmentId)?.name
        : lookups.stations.find((item) => item.id === person?.stationId)?.name
  return <span className="block max-w-[6rem] pt-2 text-xs text-heading">{text ?? '—'}</span>
}

export function ExistingPositionsTable({
  control,
  setValue,
  fields,
  lookups,
  range,
  readOnly,
  onRemove,
}: {
  control: Control<PlanFormValues>
  setValue: UseFormSetValue<PlanFormValues>
  fields: readonly { fieldKey: string }[]
  lookups: ManpowerLookups
  range: { startDate: string; endDate: string } | undefined
  readOnly: boolean
  onRemove: (index: number) => void
}) {
  const employeeOptions = lookups.employees.map((person) => ({
    value: person.id,
    label: person.name,
  }))
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[57rem] text-sm">
        <caption className="sr-only">Plan for existing positions</caption>
        <TableHead
          heads={[
            { label: 'Sr#', className: 'pl-4 sm:pl-6' },
            { label: 'Employee' },
            { label: 'Position' },
            { label: 'Start Date' },
            { label: 'End Date' },
            { label: 'Department' },
            { label: 'Station' },
            { label: 'Monthly Salary', className: 'min-w-[5.5rem]' },
            { label: 'Annual Gross Salary', className: 'min-w-[6.5rem]' },
            { label: 'Total Allowance', className: 'min-w-[5.5rem]' },
            { label: <span className="sr-only">Remove</span> },
          ]}
        />
        <tbody>
          {fields.length === 0 ? (
            <tr>
              <td colSpan={11} className="px-4 py-6 text-center text-sm text-[#707070]">
                No existing positions yet. Add a person, or import the department's employees.
              </td>
            </tr>
          ) : (
            fields.map((field, index) => {
              const prefix = `existingPositions.${index}` as const
              const line = `line ${String(index + 1)}`
              return (
                <tr key={field.fieldKey}>
                  <td className="pt-5 pr-1.5 pl-4 align-top text-xs font-medium text-heading sm:pl-6">
                    {index + 1}
                  </td>
                  <td className="px-1 py-3 align-top">
                    <CellControl
                      control={control}
                      name={`${prefix}.employeeId`}
                      render={(props) => (
                        <MpSelect
                          {...props}
                          onChange={(value) => {
                            props.onChange(value)
                            const person = lookups.employees.find((item) => item.id === value)
                            if (person) setValue(`${prefix}.monthlySalary`, String(person.salary))
                          }}
                          aria-label={`Employee, ${line}`}
                          options={employeeOptions}
                          className={cn(cellBoxClass, 'w-[8.5rem]')}
                        />
                      )}
                    />
                  </td>
                  <td className="px-1 py-3 align-top">
                    <ExistingLineFacts
                      control={control}
                      index={index}
                      lookups={lookups}
                      part="position"
                    />
                  </td>
                  <td className="px-1 py-3 align-top">
                    <CellControl
                      control={control}
                      name={`${prefix}.startDate`}
                      render={(props) => (
                        <DateBox
                          {...props}
                          aria-label={`Start date, ${line}`}
                          minDate={range?.startDate}
                          maxDate={range?.endDate}
                          className={cn(cellBoxClass, 'w-[6.9rem]')}
                        />
                      )}
                    />
                  </td>
                  <td className="px-1 py-3 align-top">
                    <CellControl
                      control={control}
                      name={`${prefix}.endDate`}
                      render={(props) => (
                        <DateBox
                          {...props}
                          aria-label={`End date, ${line}`}
                          minDate={range?.startDate}
                          maxDate={range?.endDate}
                          className={cn(cellBoxClass, 'w-[6.9rem]')}
                        />
                      )}
                    />
                  </td>
                  <td className="px-1 py-3 align-top">
                    <ExistingLineFacts
                      control={control}
                      index={index}
                      lookups={lookups}
                      part="department"
                    />
                  </td>
                  <td className="px-1 py-3 align-top">
                    <ExistingLineFacts
                      control={control}
                      index={index}
                      lookups={lookups}
                      part="station"
                    />
                  </td>
                  <td className="px-1 py-3 align-top">
                    <CellControl
                      control={control}
                      name={`${prefix}.monthlySalary`}
                      render={(props) => (
                        <AmountInput
                          {...props}
                          label={`Monthly salary, ${line}`}
                          className="min-w-[5.5rem]"
                        />
                      )}
                    />
                  </td>
                  <td className="px-1 py-3 align-top">
                    <ExistingLineFacts
                      control={control}
                      index={index}
                      lookups={lookups}
                      part="annual"
                    />
                  </td>
                  <td className="px-1 py-3 align-top">
                    <CellControl
                      control={control}
                      name={`${prefix}.totalAllowance`}
                      render={(props) => (
                        <AmountInput
                          {...props}
                          label={`Total allowance, existing ${line}`}
                          className="min-w-[5rem]"
                        />
                      )}
                    />
                  </td>
                  <td className="py-3 pr-4 pl-1.5 align-top sm:pr-5">
                    <button
                      type="button"
                      aria-label={`Remove existing position ${String(index + 1)}`}
                      disabled={readOnly}
                      onClick={() => {
                        onRemove(index)
                      }}
                      className={deleteButton}
                    >
                      <DeleteIcon className="h-[1.055rem] w-[0.9375rem]" />
                    </button>
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
