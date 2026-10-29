import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { ErrorState } from '@/components/feedback/error-state'
import { Spinner } from '@/components/feedback/spinner'
import { DatePickerField, SelectField, TextareaField, TextField } from '@/components/form'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { EmployeeSearchSelectField, SearchSelectField } from '@/features/payroll'
import { parseDateValue } from '@/lib/date'
import { useCan } from '@/lib/permissions'
import { useAuthStore } from '@/stores/auth-store'

import { GOAL_STATUS_META, PERF_CODES } from '../../constants'
import {
  useCycleOptions,
  useGoal,
  useGoalList,
  useKpiList,
  useMyEmployeeId,
  useSaveGoal,
} from '../../hooks/use-performance'
import {
  cycleWeightTotal,
  GOAL_FIELD_OF,
  goalFormSchema,
  goalFormToInput,
  type GoalFormValues,
  goalToForm,
} from '../../schemas/performance-forms.schema'
import { GOAL_STATUSES, type GoalDetail } from '../../types/performance.types'
import { showServerErrors } from '../../utils/form-errors'
import { dialogClass, dialogTitleClass } from '../../utils/styles'
import { FormDialog } from '../shared/dialogs'

const FIELDS = Object.keys(goalToForm(null, null))

function GoalForm({ goal, onClose }: { goal: GoalDetail | null; onClose: () => void }) {
  const save = useSaveGoal()
  const myId = useMyEmployeeId()
  const myName = useAuthStore((state) => state.user?.name ?? 'Me')
  const canTeam = useCan(PERF_CODES.goalsTeam)
  const canAll = useCan(PERF_CODES.goalsAll)
  const canPickPeople = canTeam || canAll
  const cycles = useCycleOptions()
  const kpis = useKpiList({ isActive: true, page: 1, pageSize: 100 })
  const form = useForm<GoalFormValues>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: goalToForm(goal, myId),
  })
  const startDate = useWatch({ control: form.control, name: 'startDate' })
  const [employeeId, cycleId, weight] = useWatch({
    control: form.control,
    name: ['employeeId', 'cycleId', 'weight'],
  })
  // The person's other goals in the cycle, to warn when the weights pass 100%.
  const siblings = useGoalList(
    {
      tab: canAll ? 'all' : canTeam ? 'team' : 'my',
      employeeId: employeeId ?? undefined,
      cycleId: cycleId ?? undefined,
      page: 1,
      pageSize: 100,
    },
    employeeId !== null && cycleId !== null,
  )
  const weightTotal =
    employeeId !== null && cycleId !== null && siblings.data
      ? cycleWeightTotal(siblings.data.data, goal?.id ?? null, weight)
      : null

  const cycleOptions = (cycles.data?.data ?? [])
    .filter((cycle) => cycle.status !== 'closed' || cycle.id === goal?.cycleId)
    .map((cycle) => ({ value: cycle.id, label: cycle.name }))
  const kpiRows = kpis.data?.data ?? []
  const kpiOptions = [
    ...(goal?.kpiId && !kpiRows.some((kpi) => kpi.id === goal.kpiId)
      ? [{ value: goal.kpiId, label: goal.kpiName ?? 'KPI' }]
      : []),
    ...kpiRows.map((kpi) => ({ value: kpi.id, label: kpi.name, hint: kpi.keyResultArea ?? '' })),
  ]
  const known = [
    ...(myId ? [{ value: myId, label: myName }] : []),
    ...(goal ? [{ value: goal.employeeId, label: goal.employeeName }] : []),
  ]

  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({ id: goal?.id, input: goalFormToInput(values, goal) })
    } catch (error) {
      showServerErrors(error, form.setError, FIELDS, GOAL_FIELD_OF)
      return
    }
    onClose()
  })

  return (
    <FormDialog
      wide
      title={goal ? 'Edit Goal' : 'Add Goal'}
      description={
        goal ? `Edit “${goal.title}”.` : 'A goal with its due date, weight and, if any, its KPI.'
      }
      onClose={onClose}
      onSubmit={submit}
      saving={save.isPending}
      saveLabel={goal ? 'Save' : 'Add Goal'}
      rootError={form.formState.errors.root?.message}
    >
      <div className="grid gap-4 @md:grid-cols-2">
        <TextField
          control={form.control}
          name="title"
          label="Title"
          required
          placeholder="e.g. Cut time to hire to 30 days"
          className="@md:col-span-2"
        />
        {canPickPeople && (
          <EmployeeSearchSelectField
            control={form.control}
            name="employeeId"
            label="Employee"
            required
            placeholder="Select Employee"
            filters={{ permission: PERF_CODES.goalsCreate }}
            known={known}
          />
        )}
        <SearchSelectField
          control={form.control}
          name="cycleId"
          label="Review Cycle"
          placeholder="No cycle"
          options={cycleOptions}
          clearable
        />
        <SearchSelectField
          control={form.control}
          name="kpiId"
          label="KPI"
          placeholder="No KPI"
          options={kpiOptions}
          clearable
          onValueChange={(value) => {
            const kpi = kpiRows.find((row) => row.id === value)
            if (!kpi) return
            // A KPI brings its target and default weight unless they were already typed.
            if (!form.getValues('targetValue') && kpi.targetValue !== null) {
              form.setValue('targetValue', String(kpi.targetValue))
            }
            if (kpi.defaultWeight !== null && !form.formState.dirtyFields.weight) {
              form.setValue('weight', String(kpi.defaultWeight))
            }
          }}
        />
        <DatePickerField control={form.control} name="startDate" label="Start Date" />
        <DatePickerField
          control={form.control}
          name="dueDate"
          label="Due Date"
          required
          minDate={parseDateValue(startDate)}
        />
        <TextField
          control={form.control}
          name="weight"
          label="Weight (%)"
          required
          inputMode="decimal"
          placeholder="0 – 100"
        />
        <TextField
          control={form.control}
          name="targetValue"
          label="Target Value"
          inputMode="decimal"
          placeholder="e.g. 30"
        />
        {goal && (
          <SelectField
            control={form.control}
            name="status"
            label="Status"
            options={GOAL_STATUSES.map((status) => ({
              value: status,
              label: GOAL_STATUS_META[status].label,
            }))}
          />
        )}
        <TextareaField
          control={form.control}
          name="description"
          label="Description"
          placeholder="How it will be measured, what done looks like"
          className="@md:col-span-2"
        />
      </div>
      {weightTotal !== null && weightTotal > 100 && (
        <p
          role="status"
          className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-500/15 dark:text-amber-200"
        >
          This person’s goals in the cycle add up to {String(Math.round(weightTotal * 100) / 100)}%
          with this one. Weights are compared with each other, so keep the total at 100%.
        </p>
      )}
      {goal && (
        <p className="text-xs text-muted-foreground">
          Progress and the actual value change through Check In, which keeps their history.
        </p>
      )}
    </FormDialog>
  )
}

/** Add Goal, or Edit Goal once the goal (and its row version) has loaded. */
export function GoalFormDialog({
  goalId,
  onClose,
}: {
  goalId: string | null
  onClose: () => void
}) {
  const goal = useGoal(goalId)
  if (goalId === null) return <GoalForm goal={null} onClose={onClose} />
  if (goal.data) return <GoalForm key={goal.data.rowVersion} goal={goal.data} onClose={onClose} />
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className={dialogClass}>
        <DialogTitle className={dialogTitleClass}>Edit Goal</DialogTitle>
        <DialogDescription className="sr-only">Loading the goal.</DialogDescription>
        {goal.error ? (
          <ErrorState
            message={goal.error.message}
            onRetry={() => {
              void goal.refetch()
            }}
            className="shadow-none"
          />
        ) : (
          <div className="flex justify-center py-10">
            <Spinner label="Loading the goal" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
