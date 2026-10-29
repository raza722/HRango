import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { SelectField, SwitchField, TextareaField, TextField } from '@/components/form'
import { SearchSelectField } from '@/features/payroll'

import { MEASURE_LABELS } from '../../constants'
import { useOrgLookup, useSaveKpi } from '../../hooks/use-performance'
import {
  kpiFormSchema,
  kpiFormToInput,
  type KpiFormValues,
  kpiToForm,
} from '../../schemas/performance-forms.schema'
import { type Kpi, MEASURE_TYPES } from '../../types/performance.types'
import { showServerErrors } from '../../utils/form-errors'
import { navySwitchClass } from '../../utils/styles'
import { FormDialog } from '../shared/dialogs'

const FIELDS = Object.keys(kpiToForm(null))

/** Add / Edit KPI: the library entry goals and appraisal criteria link to. */
export function KpiFormDialog({ kpi, onClose }: { kpi: Kpi | null; onClose: () => void }) {
  const save = useSaveKpi()
  const departments = useOrgLookup('departments')
  const jobTitles = useOrgLookup('job-titles')
  const form = useForm<KpiFormValues>({
    resolver: zodResolver(kpiFormSchema),
    defaultValues: kpiToForm(kpi),
  })
  const options = (
    rows: readonly { id: string; name: string }[] | undefined,
    own: { id: string | null; name: string | null },
  ) => [
    ...(own.id && own.name && !rows?.some((row) => row.id === own.id)
      ? [{ value: own.id, label: own.name }]
      : []),
    ...(rows ?? []).map((row) => ({ value: row.id, label: row.name })),
  ]

  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({ id: kpi?.id, input: kpiFormToInput(values, kpi) })
    } catch (error) {
      showServerErrors(error, form.setError, FIELDS)
      return
    }
    onClose()
  })

  return (
    <FormDialog
      wide
      title={kpi ? 'Edit KPI' : 'Add KPI'}
      description={kpi ? `Edit ${kpi.name}.` : 'A measure goals and appraisal criteria can use.'}
      onClose={onClose}
      onSubmit={submit}
      saving={save.isPending}
      saveLabel={kpi ? 'Save' : 'Add KPI'}
      rootError={form.formState.errors.root?.message}
    >
      <div className="grid gap-4 @md:grid-cols-2 @3xl:grid-cols-3">
        <TextField
          control={form.control}
          name="name"
          label="Name"
          required
          placeholder="e.g. Time to Hire"
          className="@md:col-span-2 @3xl:col-span-2"
        />
        <TextField
          control={form.control}
          name="keyResultArea"
          label="Key Result Area"
          placeholder="e.g. Recruitment"
        />
        <SelectField
          control={form.control}
          name="measureType"
          label="Measure"
          required
          options={MEASURE_TYPES.map((value) => ({ value, label: MEASURE_LABELS[value] }))}
        />
        <TextField
          control={form.control}
          name="targetValue"
          label="Target Value"
          inputMode="decimal"
          placeholder="e.g. 30"
        />
        <TextField
          control={form.control}
          name="unit"
          label="Unit"
          placeholder="e.g. days, %, PKR"
        />
        <TextField
          control={form.control}
          name="defaultWeight"
          label="Default Weight (%)"
          inputMode="decimal"
          placeholder="0 – 100"
        />
        <SearchSelectField
          control={form.control}
          name="departmentId"
          label="Department"
          placeholder="Every department"
          options={options(departments.data, {
            id: kpi?.departmentId ?? null,
            name: kpi?.departmentName ?? null,
          })}
          clearable
        />
        <SearchSelectField
          control={form.control}
          name="jobTitleId"
          label="Job Title"
          placeholder="Every job title"
          options={options(jobTitles.data, {
            id: kpi?.jobTitleId ?? null,
            name: kpi?.jobTitleName ?? null,
          })}
          clearable
        />
        <TextareaField
          control={form.control}
          name="description"
          label="Description"
          placeholder="What it measures and how"
          className="@md:col-span-2 @3xl:col-span-3"
        />
        <SwitchField
          control={form.control}
          name="isActive"
          label="Active"
          stateLabel={(on) => (on ? 'Active: goals can use it' : 'Inactive: kept for history')}
          className={navySwitchClass}
        />
      </div>
    </FormDialog>
  )
}
