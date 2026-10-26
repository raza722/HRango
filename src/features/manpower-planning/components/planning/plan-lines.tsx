import type { ReactNode } from 'react'
import {
  type Control,
  Controller,
  type FieldPathByValue,
  type UseFormSetValue,
  useWatch,
} from 'react-hook-form'

import { EmployeeSearchSelect } from '@/features/payroll'
import type { EmployeeLookupFilters } from '@/hooks/use-employee-lookup'
import { cn } from '@/lib/utils'

import type { PlanFormValues } from '../../schemas/plan-form.schema'
import type { ManpowerLookups } from '../../types/manpower.types'
import { formatAmount } from '../../utils/format'
import { amountOr0, existingLineAnnual, newLineMonthly, toAmount } from '../../utils/plan-math'
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
  placeholder,
  inputMode = 'decimal',
  ...rest
}: {
  value: string
  onChange: (value: string) => void
  label: string
  className?: string
  placeholder?: string
  inputMode?: 'decimal' | 'numeric'
  'aria-invalid': boolean
}) {
  return (
    <input
      {...rest}
      aria-label={label}
      inputMode={inputMode}
      value={value}
      placeholder={placeholder}
      onChange={(event) => {
        onChange(event.target.value)
      }}
      className={cn(
        cellBoxClass,
        'w-full px-2 text-sm placeholder:text-[#818CA3] sm:text-sm',
        className,
      )}
    />
  )
}

const readBox = cn(
  cellBoxClass,
  'flex w-full min-w-[4rem] items-center bg-muted/40 text-sm sm:text-sm',
)

const factText = 'block max-w-[6rem] pt-2 text-xs text-heading'

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

// --- Plan for New Positions ---------------------------------------------------------------------

/** The live Total Salary of a line: (max salary + allowance) x headcount. */
function NewLineTotal({ control, index }: { control: Control<PlanFormValues>; index: number }) {
  const [max, allowance, headcount] = useWatch({
    control,
    name: [
      `newPositions.${index}.maxSalary`,
      `newPositions.${index}.totalAllowance`,
      `newPositions.${index}.headcount`,
    ],
  })
  return (
    <span aria-label={`Total salary, line ${String(index + 1)}`} className={readBox}>
      {formatAmount(
        newLineMonthly({
          maxSalary: amountOr0(max),
          totalAllowance: amountOr0(allowance),
          headcount: amountOr0(headcount),
        }),
      )}
    </span>
  )
}

/** Division, Station, Department, Sub-Department and Group: the chosen position's (read only). */
function PositionFacts({
  control,
  index,
  lookups,
}: {
  control: Control<PlanFormValues>
  index: number
  lookups: ManpowerLookups
}) {
  const positionId = useWatch({ control, name: `newPositions.${index}.positionId` })
  const position = lookups.positions.find((item) => item.id === positionId)
  const line = `line ${String(index + 1)}`
  const facts: [string, string | null | undefined][] = [
    ['Division', position?.divisionName],
    ['Station', position?.branchName],
    ['Department', position?.departmentName],
    ['Sub-Department', position?.subDepartmentName],
    ['Employee group', position?.employeeGroupName],
  ]
  return (
    <>
      {facts.map(([label, value]) => (
        <td key={label} className="px-1 py-3 align-top">
          <span aria-label={`${label}, ${line}`} className={factText}>
            {value ?? '—'}
          </span>
        </td>
      ))}
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
  const optionOf = (position: ManpowerLookups['positions'][number]) => ({
    value: position.id,
    label: `${position.jobTitleName} (${position.code})`,
  })
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[62rem] text-sm">
        <caption className="sr-only">Plan for new positions</caption>
        <TableHead
          heads={[
            { label: 'Sr#', className: 'pl-4 sm:pl-2.5' },
            { label: 'Position' },
            { label: 'Head Count', className: 'max-w-[3.5rem]' },
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
              <td colSpan={14} className="px-4 py-6 text-center text-sm text-[#707070]">
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
                            setValue(
                              `${prefix}.minSalary`,
                              position.minSalary === null ? '' : String(position.minSalary),
                            )
                            setValue(
                              `${prefix}.maxSalary`,
                              position.maxSalary === null ? '' : String(position.maxSalary),
                            )
                          }}
                          aria-label={`Position, ${line}`}
                          // Inactive positions stay listed on the lines that already plan them.
                          options={lookups.positions
                            .filter(
                              (position) =>
                                position.status === 'active' || position.id === props.value,
                            )
                            .map(optionOf)}
                          className={cn(cellBoxClass, 'w-[6.5rem]')}
                        />
                      )}
                    />
                  </td>
                  <td className="px-1 py-3 align-top">
                    <CellControl
                      control={control}
                      name={`${prefix}.headcount`}
                      render={(props) => (
                        <AmountInput
                          {...props}
                          inputMode="numeric"
                          label={`Head count, ${line}`}
                          className="w-[3.5rem]"
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
                  <PositionFacts control={control} index={index} lookups={lookups} />
                  <td className="px-1 py-3 align-top">
                    <CellControl
                      control={control}
                      name={`${prefix}.minSalary`}
                      render={(props) => (
                        <AmountInput
                          {...props}
                          label={`Min salary, ${line}`}
                          placeholder="Band"
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
                          placeholder="Band"
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

/** Annual Gross Salary of a line; blank while its salary is left to Payroll. */
function ExistingLineAnnual({
  control,
  index,
}: {
  control: Control<PlanFormValues>
  index: number
}) {
  const [startDate, endDate, monthlySalary, totalAllowance] = useWatch({
    control,
    name: [
      `existingPositions.${index}.startDate`,
      `existingPositions.${index}.endDate`,
      `existingPositions.${index}.monthlySalary`,
      `existingPositions.${index}.totalAllowance`,
    ],
  })
  const salary = toAmount(monthlySalary)
  return (
    <span aria-label={`Annual gross salary, line ${String(index + 1)}`} className={readBox}>
      {startDate && endDate && Number.isFinite(salary)
        ? formatAmount(
            existingLineAnnual({
              monthlySalary: salary,
              totalAllowance: amountOr0(totalAllowance),
              startDate,
              endDate,
            }),
          )
        : ''}
    </span>
  )
}

/** Position, Department or Station of the line's person (as picked or as saved). */
function ExistingLineFact({
  control,
  index,
  part,
}: {
  control: Control<PlanFormValues>
  index: number
  part: 'jobTitleName' | 'departmentName' | 'branchName'
}) {
  const value = useWatch({ control, name: `existingPositions.${index}.${part}` })
  return <span className={factText}>{value || '—'}</span>
}

export function ExistingPositionsTable({
  control,
  setValue,
  fields,
  employeeFilters,
  range,
  readOnly,
  onRemove,
}: {
  control: Control<PlanFormValues>
  setValue: UseFormSetValue<PlanFormValues>
  fields: readonly { fieldKey: string }[]
  /** Whom the Employee picker searches (`GET /employees/lookup?q`, paged). */
  employeeFilters: EmployeeLookupFilters
  range: { startDate: string; endDate: string } | undefined
  readOnly: boolean
  onRemove: (index: number) => void
}) {
  const lines = useWatch({ control, name: 'existingPositions' })
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
              const current = lines[index]
              // The line's person keeps their name before (or without) the lookup reading them.
              const known = current?.employeeId
                ? [{ value: current.employeeId, label: current.employeeName || current.employeeId }]
                : undefined
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
                        <EmployeeSearchSelect
                          value={props.value || null}
                          aria-invalid={props['aria-invalid']}
                          onChange={(value, person) => {
                            props.onChange(value ?? '')
                            if (!person) return
                            setValue(`${prefix}.employeeName`, person.name)
                            setValue(`${prefix}.jobTitleName`, person.jobTitleName ?? '')
                            setValue(`${prefix}.departmentName`, person.departmentName ?? '')
                            setValue(`${prefix}.branchName`, person.branchName)
                          }}
                          filters={employeeFilters}
                          enabled={!readOnly}
                          known={known}
                          aria-label={`Employee, ${line}`}
                          placeholder="Select"
                          disabled={readOnly}
                          className={cn(cellBoxClass, 'w-[8.5rem]')}
                        />
                      )}
                    />
                  </td>
                  <td className="px-1 py-3 align-top">
                    <ExistingLineFact control={control} index={index} part="jobTitleName" />
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
                    <ExistingLineFact control={control} index={index} part="departmentName" />
                  </td>
                  <td className="px-1 py-3 align-top">
                    <ExistingLineFact control={control} index={index} part="branchName" />
                  </td>
                  <td className="px-1 py-3 align-top">
                    <CellControl
                      control={control}
                      name={`${prefix}.monthlySalary`}
                      render={(props) => (
                        <AmountInput
                          {...props}
                          label={`Monthly salary, ${line}`}
                          placeholder="Current"
                          className="min-w-[5.5rem]"
                        />
                      )}
                    />
                  </td>
                  <td className="px-1 py-3 align-top">
                    <ExistingLineAnnual control={control} index={index} />
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
