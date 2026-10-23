import { useMemo } from 'react'
import { type FieldPath, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'

import { ErrorState } from '@/components/feedback/error-state'
import { PageSpinner } from '@/components/feedback/spinner'
import { PageContainer } from '@/components/layout'
import { downloadText, toCsv } from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import { PLAN_STATUS_META } from '../../constants'
import { useManpowerLookups, usePlan, useSavePlan } from '../../hooks/use-manpower'
import {
  EMPTY_PLAN,
  type ExistingLineValues,
  makePlanFormSchema,
  type NewLineValues,
  type PlanFormValues,
  toPlanFormValues,
  toPlanInput,
} from '../../schemas/plan-form.schema'
import type { ManpowerLookups, PlanDetail } from '../../types/manpower.types'
import { formatAmount } from '../../utils/format'
import { amountOr0, existingLineAnnual, planMonthly } from '../../utils/plan-math'
import { Chip } from '../shared/cells'
import { MpField, MpSelect } from '../shared/controls'
import { AddIcon, PublishIcon, RefreshIcon, ShareIcon } from '../shared/mp-icons'
import { accent, boxClass, smallButton } from '../shared/mp-styles'
import { BarTitle, MpCard } from '../shared/page-shell'
import { ExistingPositionsTable, NewPositionsTable } from './plan-lines'

const viewRoute = getRouteApi('/_app/manpower-planning/planning/$planId/')
const editRoute = getRouteApi('/_app/manpower-planning/planning/$planId/edit')

const newKey = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`
const optionsOf = (list: readonly { id: string; name: string }[]) =>
  list.map((item) => ({ value: item.id, label: item.name }))

const footerButton =
  'inline-flex h-9 w-[6.8125rem] items-center justify-center rounded-[5px] text-xs font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-[#7469E8]/35 disabled:opacity-60'
const outlineAction = cn(smallButton, accent.outline, 'h-9 gap-2.5 px-2.5')

/** The form page in its three uses: Add Planning, Edit Planning and a plan's Details. */
function PlanFormPage({ mode, planId }: { mode: 'create' | 'edit' | 'view'; planId?: string }) {
  const lookups = useManpowerLookups()
  const plan = usePlan(planId ?? null)
  const title =
    mode === 'create' ? 'Add Planning' : mode === 'edit' ? 'Edit Planning' : 'Plan Details'

  let body
  if (lookups.isPending || (planId !== undefined && plan.isPending)) {
    body = <PageSpinner label="Loading the plan" />
  } else if (lookups.isError || plan.isError) {
    body = (
      <ErrorState
        message={
          plan.isError ? 'The plan could not be loaded.' : 'The plan options could not be loaded.'
        }
        onRetry={() => {
          void lookups.refetch()
          if (planId) void plan.refetch()
        }}
      />
    )
  } else {
    body = (
      <PlanForm
        key={planId ?? 'new'}
        title={title}
        lookups={lookups.data}
        plan={plan.data}
        readOnly={mode === 'view' || (plan.data?.locked ?? false)}
        lockedNote={mode === 'edit' && (plan.data?.locked ?? false)}
        onRefetchLookups={() => lookups.refetch()}
      />
    )
  }
  // The Add Planning frame has no page title row: the card is the page.
  return <PageContainer>{body}</PageContainer>
}

function PlanForm({
  title,
  lookups,
  plan,
  readOnly,
  lockedNote,
  onRefetchLookups,
}: {
  title: string
  lookups: ManpowerLookups
  plan: PlanDetail | undefined
  readOnly: boolean
  lockedNote: boolean
  onRefetchLookups: () => Promise<unknown>
}) {
  const navigate = useNavigate()
  const save = useSavePlan()
  const schema = useMemo(() => makePlanFormSchema(lookups.durations), [lookups.durations])
  const form = useForm<PlanFormValues>({
    resolver: zodResolver(schema),
    defaultValues: plan ? toPlanFormValues(plan) : EMPTY_PLAN,
  })
  const { control, register, setValue, getValues, handleSubmit, formState, setError } = form
  const newLines = useFieldArray({ control, name: 'newPositions', keyName: 'fieldKey' })
  const existingLines = useFieldArray({ control, name: 'existingPositions', keyName: 'fieldKey' })
  const watched = useWatch({ control })
  const [durationId, divisionId, departmentId] = useWatch({
    control,
    name: ['durationId', 'divisionId', 'departmentId'],
  })
  const duration = lookups.durations.find((item) => item.id === durationId)
  const firstMonth = duration?.startDate.slice(0, 7) ?? ''
  const lastMonth = duration?.endDate.slice(0, 7) ?? ''

  const monthly = planMonthly({
    newPositions: (watched.newPositions ?? []).map((line) => ({
      maxSalary: amountOr0(line.maxSalary),
      totalAllowance: amountOr0(line.totalAllowance),
      fromMonth: line.fromMonth ?? '',
      toMonth: line.toMonth ?? '',
    })),
    existingPositions: (watched.existingPositions ?? []).map((line) => ({
      monthlySalary: amountOr0(line.monthlySalary),
      totalAllowance: amountOr0(line.totalAllowance),
      startDate: line.startDate ?? '',
      endDate: line.endDate ?? '',
    })),
  })

  const departments = lookups.departments.filter(
    (item) => !divisionId || item.divisionId === divisionId,
  )
  const subDepartments = lookups.subDepartments.filter((item) => item.departmentId === departmentId)

  /** A new line takes the plan's own Division, Station, Department… as its start. */
  const blankNewLine = (): NewLineValues => {
    const header = getValues()
    return {
      key: newKey('nl'),
      positionId: '',
      fromMonth: firstMonth,
      toMonth: lastMonth,
      divisionId: header.divisionId,
      stationId: header.stationId,
      departmentId: header.departmentId,
      subDepartmentId: header.subDepartmentId,
      employeeGroupId: header.employeeGroupId,
      minSalary: '',
      maxSalary: '',
      totalAllowance: '0',
    }
  }
  const blankExistingLine = (): ExistingLineValues => ({
    key: newKey('xl'),
    employeeId: '',
    startDate: duration?.startDate ?? '',
    endDate: duration?.endDate ?? '',
    monthlySalary: '',
    totalAllowance: '0',
  })

  /** Import Positions: a line for each active employee position that fits the plan's header. */
  const importPositions = () => {
    const header = getValues()
    const planned = new Set(header.newPositions.map((line) => line.positionId))
    const fits = (wanted: string, value: string | null) => !wanted || wanted === value
    const found = lookups.positions.filter(
      (position) =>
        position.active &&
        !planned.has(position.id) &&
        fits(header.divisionId, position.divisionId) &&
        fits(header.stationId, position.stationId) &&
        fits(header.departmentId, position.departmentId) &&
        fits(header.subDepartmentId, position.subDepartmentId) &&
        fits(header.employeeGroupId, position.employeeGroupId),
    )
    if (found.length === 0) {
      toast.error('No employee positions match the plan’s Division, Station and Department.')
      return
    }
    newLines.append(
      found.map((position) => ({
        ...blankNewLine(),
        positionId: position.id,
        divisionId: position.divisionId ?? '',
        stationId: position.stationId ?? '',
        departmentId: position.departmentId ?? '',
        subDepartmentId: position.subDepartmentId ?? '',
        employeeGroupId: position.employeeGroupId,
        minSalary: String(position.minSalary),
        maxSalary: String(position.maxSalary),
      })),
    )
    toast.success(
      `${String(found.length)} ${found.length === 1 ? 'position' : 'positions'} imported`,
    )
  }

  /** Refresh Positions: reads the employee positions again and their salary ranges. */
  const refreshPositions = async () => {
    const result = (await onRefetchLookups()) as { data?: ManpowerLookups } | undefined
    const fresh = result?.data ?? lookups
    getValues('newPositions').forEach((line, index) => {
      const position = fresh.positions.find((item) => item.id === line.positionId)
      if (!position) return
      setValue(`newPositions.${index}.minSalary`, String(position.minSalary))
      setValue(`newPositions.${index}.maxSalary`, String(position.maxSalary))
    })
    toast.success('Positions refreshed')
  }

  /** Import Existing Employees: the people of the plan's Department (and Station). */
  const importEmployees = () => {
    const header = getValues()
    if (!header.departmentId && !header.stationId) {
      toast.error('Choose the plan’s Department or Station to import its employees.')
      return
    }
    const listed = new Set(header.existingPositions.map((line) => line.employeeId))
    const found = lookups.employees.filter(
      (person) =>
        !listed.has(person.id) &&
        (!header.departmentId || person.departmentId === header.departmentId) &&
        (!header.stationId || person.stationId === header.stationId),
    )
    if (found.length === 0) {
      toast.error('Everyone in that Department and Station is already in the plan.')
      return
    }
    existingLines.append(
      found.map((person) => ({
        ...blankExistingLine(),
        employeeId: person.id,
        monthlySalary: String(person.salary),
      })),
    )
    toast.success(
      `${String(found.length)} ${found.length === 1 ? 'employee' : 'employees'} imported`,
    )
  }

  /** Export Data: the existing positions as a CSV file. */
  const exportExisting = () => {
    const lines = getValues('existingPositions')
    if (lines.length === 0) {
      toast.error('There are no existing positions to export.')
      return
    }
    const rows = lines.map((line) => {
      const person = lookups.employees.find((item) => item.id === line.employeeId)
      return [
        person?.name ?? '',
        person?.jobTitle ?? '',
        line.startDate,
        line.endDate,
        lookups.departments.find((item) => item.id === person?.departmentId)?.name ?? '',
        lookups.stations.find((item) => item.id === person?.stationId)?.name ?? '',
        amountOr0(line.monthlySalary),
        line.startDate && line.endDate
          ? existingLineAnnual({
              monthlySalary: amountOr0(line.monthlySalary),
              totalAllowance: amountOr0(line.totalAllowance),
              startDate: line.startDate,
              endDate: line.endDate,
            })
          : '',
        amountOr0(line.totalAllowance),
      ]
    })
    const name = getValues('title').trim() || 'plan'
    downloadText(
      toCsv(
        [
          'Employee',
          'Position',
          'Start Date',
          'End Date',
          'Department',
          'Station',
          'Monthly Salary',
          'Annual Gross Salary',
          'Total Allowance',
        ],
        rows,
      ),
      `${name} - existing positions.csv`,
    )
  }

  const submit = handleSubmit((values) => {
    save.mutate(
      { id: plan?.id, input: toPlanInput(values) },
      {
        onSuccess: () => {
          void navigate({ to: '/manpower-planning/planning' })
        },
        onError: (error) => {
          const fields = error instanceof ApiError ? Object.entries(error.fieldErrors) : []
          if (fields.length > 0) {
            for (const [path, message] of fields) {
              setError(path as FieldPath<PlanFormValues>, { message })
            }
          } else {
            toast.error(error instanceof ApiError ? error.message : 'The plan could not be saved.')
          }
        },
      },
    )
  })

  const errors = formState.errors
  const linesError = errors.newPositions?.message ?? errors.newPositions?.root?.message

  return (
    <form noValidate onSubmit={(event) => void submit(event)} aria-label={title}>
      <MpCard
        as="h1"
        title={
          <>
            {title}
            {plan && (readOnly || lockedNote) && (
              <Chip {...PLAN_STATUS_META[plan.status]} size="sm" />
            )}
          </>
        }
      >
        {lockedNote && (
          <p
            role="status"
            className="mx-4 rounded-md bg-[#7469E8]/8 px-4 py-3 text-sm text-heading sm:mx-6"
          >
            This plan has approved budgets, so it can no longer be edited.
          </p>
        )}
        <fieldset disabled={readOnly} className="grid min-w-0 gap-8">
          <div className="grid grid-cols-1 gap-x-5 gap-y-6 px-4 sm:px-6 @md:grid-cols-2 @4xl:grid-cols-4">
            <MpField label="Title" error={errors.title?.message}>
              {(a11y) => (
                <input {...a11y} {...register('title')} className={cn(boxClass, 'w-full')} />
              )}
            </MpField>
            <MpField label="Plan Year" error={errors.durationId?.message}>
              {(a11y) => (
                <MpSelect
                  {...a11y}
                  value={durationId}
                  onChange={(value) => {
                    setValue('durationId', value, { shouldValidate: formState.isSubmitted })
                  }}
                  options={lookups.durations.map((item) => ({ value: item.id, label: item.name }))}
                />
              )}
            </MpField>
            <MpField label="Division">
              {(a11y) => (
                <MpSelect
                  {...a11y}
                  value={divisionId}
                  onChange={(value) => {
                    setValue('divisionId', value)
                    const department = lookups.departments.find((item) => item.id === departmentId)
                    if (value && department && department.divisionId !== value) {
                      setValue('departmentId', '')
                      setValue('subDepartmentId', '')
                    }
                  }}
                  noneLabel="ALL"
                  options={optionsOf(lookups.divisions)}
                />
              )}
            </MpField>
            <MpField label="Station">
              {(a11y) => (
                <MpSelect
                  {...a11y}
                  value={watched.stationId ?? ''}
                  onChange={(value) => {
                    setValue('stationId', value)
                  }}
                  noneLabel="ALL"
                  options={optionsOf(lookups.stations)}
                />
              )}
            </MpField>
            <MpField label="Department">
              {(a11y) => (
                <MpSelect
                  {...a11y}
                  value={departmentId}
                  onChange={(value) => {
                    setValue('departmentId', value)
                    setValue('subDepartmentId', '')
                  }}
                  noneLabel="ALL"
                  options={optionsOf(departments)}
                />
              )}
            </MpField>
            <MpField label="Sub-Department">
              {(a11y) => (
                <MpSelect
                  {...a11y}
                  value={watched.subDepartmentId ?? ''}
                  onChange={(value) => {
                    setValue('subDepartmentId', value)
                  }}
                  noneLabel="ALL"
                  disabled={!departmentId}
                  options={optionsOf(subDepartments)}
                />
              )}
            </MpField>
            <MpField label="Employee Group">
              {(a11y) => (
                <MpSelect
                  {...a11y}
                  value={watched.employeeGroupId ?? ''}
                  onChange={(value) => {
                    setValue('employeeGroupId', value)
                  }}
                  noneLabel="ALL"
                  options={optionsOf(lookups.employeeGroups)}
                />
              )}
            </MpField>
            <MpField label="Total Monthly Amount">
              {(a11y) => (
                <output
                  {...a11y}
                  aria-live="polite"
                  className={cn(boxClass, 'flex w-full items-center bg-muted/40')}
                >
                  {formatAmount(monthly)}
                </output>
              )}
            </MpField>
          </div>

          <section aria-labelledby="new-positions" className="grid gap-5">
            <BarTitle
              id="new-positions"
              actions={
                <>
                  <button
                    type="button"
                    onClick={() => void refreshPositions()}
                    className={cn(smallButton, accent.bg, 'gap-1 px-2.5')}
                  >
                    <RefreshIcon aria-hidden="true" className="h-[1.13rem] w-[0.85rem]" />
                    Refresh Positions
                  </button>
                  <button
                    type="button"
                    onClick={importPositions}
                    className={cn(smallButton, accent.bg, 'gap-1 px-2.5')}
                  >
                    <PublishIcon aria-hidden="true" className="size-[0.9375rem]" />
                    Import Positions
                  </button>
                </>
              }
            >
              Plan for New Positions
            </BarTitle>
            <NewPositionsTable
              control={control}
              setValue={setValue}
              fields={newLines.fields}
              lookups={lookups}
              defaultYear={duration ? Number(duration.startDate.slice(0, 4)) : undefined}
              readOnly={readOnly}
              onRemove={newLines.remove}
            />
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-7">
              <p role={linesError ? 'alert' : undefined} className="text-xs text-destructive">
                {linesError}
              </p>
              <button
                type="button"
                onClick={() => {
                  newLines.append(blankNewLine())
                }}
                className={cn(outlineAction, 'w-[11.125rem]')}
              >
                <AddIcon aria-hidden="true" className="size-[0.8125rem]" />
                Add one new position
              </button>
            </div>
          </section>

          <section aria-labelledby="existing-positions" className="grid gap-5">
            <BarTitle
              id="existing-positions"
              actions={
                <>
                  <button
                    type="button"
                    onClick={exportExisting}
                    disabled={false}
                    className={cn(smallButton, accent.bg, 'gap-1.5 px-2.5')}
                  >
                    <ShareIcon aria-hidden="true" className="h-[1.11rem] w-[0.82rem]" />
                    Export Data
                  </button>
                  <button
                    type="button"
                    onClick={importEmployees}
                    className={cn(smallButton, accent.bg, 'gap-1 px-2')}
                  >
                    <PublishIcon aria-hidden="true" className="size-[0.9375rem]" />
                    Import Existing Employees
                  </button>
                </>
              }
            >
              Plan for Existing Positions
            </BarTitle>
            <ExistingPositionsTable
              control={control}
              setValue={setValue}
              fields={existingLines.fields}
              lookups={lookups}
              range={duration}
              readOnly={readOnly}
              onRemove={existingLines.remove}
            />
            <div className="flex justify-end px-4 sm:px-7">
              <button
                type="button"
                onClick={() => {
                  existingLines.append(blankExistingLine())
                }}
                className={cn(outlineAction, 'w-[11.125rem]')}
              >
                <AddIcon aria-hidden="true" className="size-[0.8125rem]" />
                Add existing position
              </button>
            </div>
          </section>

          <section aria-labelledby="plan-description" className="grid gap-4">
            <BarTitle id="plan-description">Description</BarTitle>
            <div className="px-4 sm:pr-7 sm:pl-7">
              <textarea
                aria-labelledby="plan-description"
                aria-invalid={Boolean(errors.description)}
                {...register('description')}
                rows={8}
                className="min-h-[12.25rem] w-full resize-y rounded-[5px] border border-[#EBEFF8] bg-card p-3 text-sm text-heading outline-none focus-visible:border-[#7469E8] focus-visible:ring-[3px] focus-visible:ring-[#7469E8]/20 disabled:bg-muted/40 dark:border-border"
              />
              {errors.description && (
                <p className="mt-1 text-xs text-destructive">{errors.description.message}</p>
              )}
            </div>
          </section>
        </fieldset>

        <div className="flex flex-wrap justify-end gap-4 px-4 sm:px-7">
          {readOnly ? (
            <Link to="/manpower-planning/planning" className={cn(footerButton, accent.outline)}>
              Back
            </Link>
          ) : (
            <>
              <Link to="/manpower-planning/planning" className={cn(footerButton, accent.outline)}>
                Cancel
              </Link>
              <button
                type="submit"
                disabled={save.isPending}
                className={cn(footerButton, accent.bg)}
              >
                {save.isPending ? 'Submitting…' : 'Submit'}
              </button>
            </>
          )}
        </div>
      </MpCard>
    </form>
  )
}

/** Add Planning (`/manpower-planning/planning/new`). */
export function PlanCreatePage() {
  return <PlanFormPage mode="create" />
}

/** Edit Planning (row menu → Edit). A plan with approved budgets opens read-only. */
export function PlanEditPage() {
  const { planId } = editRoute.useParams()
  return <PlanFormPage mode="edit" planId={planId} />
}

/** A plan's Details (the list's Details icon), read-only. */
export function PlanViewPage() {
  const { planId } = viewRoute.useParams()
  return <PlanFormPage mode="view" planId={planId} />
}
