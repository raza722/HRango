import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { CheckboxField, TextareaField, TextField } from '@/components/form'
import type { DataTableColumn } from '@/components/layout'

import { useDeleteResource, useResourceList, useSaveResource } from '../../hooks/use-payroll'
import type { Formula, PayRule } from '../../types/payroll.types'
import { PayrollDialog } from '../shared/payroll-dialog'
import { TwoWaySwitchField } from '../shared/two-way-switch'
import { CreateButton, DeleteConfirm, ExpressionField, SettingsRowMenu } from './settings-common'
import { applyApiError, type DialogState, yesNo } from './settings-helpers'
import { SettingsTable, ViewHeader } from './settings-list'
import { SETTINGS_PAGE_SIZE } from './settings-nav'

const name = z.string().trim().min(1, 'Enter a name').max(80, 'Keep it under 80 characters')
const expression = z.string().trim().min(1, 'Enter an expression').max(500)

const expressionCell = (value: string) => (
  <span className="line-clamp-2 max-w-72 whitespace-normal">{value}</span>
)

// --- Formulas ------------------------------------------------------------------------------------

const formulaSchema = z.object({
  name,
  expression,
  isSalaryDivision: z.enum(['no', 'yes']),
  forIntegration: z.boolean(),
  description: z.string().trim().max(500),
})
type FormulaValues = z.infer<typeof formulaSchema>

/** "Formula Create": Name, Expression, Is Salary Division, For Integration, Description. */
function FormulaDialog({
  state,
  onClose,
}: {
  state: Exclude<DialogState<Formula>, null>
  onClose: () => void
}) {
  const record = state.mode === 'create' ? undefined : state.record
  const readOnly = state.mode === 'view'
  const save = useSaveResource('formulas')
  const [error, setError] = useState<string | null>(null)
  const form = useForm<FormulaValues>({
    resolver: zodResolver(formulaSchema),
    defaultValues: {
      name: record?.name ?? '',
      expression: record?.expression ?? '',
      isSalaryDivision: record?.isSalaryDivision ? 'yes' : 'no',
      forIntegration: record?.forIntegration ?? false,
      description: record?.description ?? '',
    },
  })
  const submit = form.handleSubmit(async (values) => {
    setError(null)
    try {
      await save.mutateAsync({
        id: record?.id,
        input: {
          name: values.name,
          expression: values.expression,
          isSalaryDivision: values.isSalaryDivision === 'yes',
          forIntegration: values.forIntegration,
          // Formulas people add are their own; the seeded ones keep their flag.
          isCustom: record?.isCustom ?? true,
          description: values.description,
        },
      })
      onClose()
    } catch (failure) {
      setError(applyApiError(failure, form.setError, ['name', 'expression']))
    }
  })
  const title =
    state.mode === 'create'
      ? 'Formula Create'
      : state.mode === 'edit'
        ? 'Formula Edit'
        : 'Formula View'
  return (
    <PayrollDialog
      title={title}
      onClose={onClose}
      formId="formula-form"
      readOnly={readOnly}
      pending={save.isPending}
      error={error}
    >
      <form
        id="formula-form"
        noValidate
        onSubmit={(event) => void submit(event)}
        className="grid gap-5"
      >
        <TextField control={form.control} name="name" label="Name" required disabled={readOnly} />
        <ExpressionField control={form.control} name="expression" required disabled={readOnly} />
        <TwoWaySwitchField<FormulaValues, 'no' | 'yes'>
          control={form.control}
          name="isSalaryDivision"
          label="Is Salary Division"
          ariaLabel="Is Salary Division"
          options={[
            { value: 'no', label: 'No' },
            { value: 'yes', label: 'Yes' },
          ]}
          disabled={readOnly}
        />
        <CheckboxField
          control={form.control}
          name="forIntegration"
          label="For Integration"
          disabled={readOnly}
        />
        <TextareaField
          control={form.control}
          name="description"
          label="Description"
          disabled={readOnly}
        />
      </form>
    </PayrollDialog>
  )
}

const formulaColumns: DataTableColumn<Formula>[] = [
  { id: 'name', header: 'Name', cell: (row) => row.name, mobile: 'heading' },
  { id: 'expression', header: 'Expression', cell: (row) => expressionCell(row.expression) },
  { id: 'custom', header: 'Is Custom', cell: (row) => yesNo(row.isCustom) },
]

/** Pay Components → Formulas: named expressions pay items and benefits use. */
export function FormulasView() {
  const [page, setPage] = useState(1)
  const [dialog, setDialog] = useState<DialogState<Formula>>(null)
  const [deleting, setDeleting] = useState<Formula | null>(null)
  const list = useResourceList('formulas', { page, pageSize: SETTINGS_PAGE_SIZE })
  const remove = useDeleteResource('formulas')
  return (
    <>
      <ViewHeader
        tab="pay-components"
        view="formulas"
        actions={
          <CreateButton
            onClick={() => {
              setDialog({ mode: 'create' })
            }}
          />
        }
      />
      <SettingsTable
        caption="Formulas"
        columns={formulaColumns}
        page={list.data}
        getRowId={(row) => row.id}
        isLoading={list.isPending}
        isFetching={list.isFetching}
        onPageChange={setPage}
        rowActions={(row) => (
          <SettingsRowMenu
            label={`Actions for ${row.name}`}
            onEdit={() => {
              setDialog({ mode: 'edit', record: row })
            }}
            onView={() => {
              setDialog({ mode: 'view', record: row })
            }}
            onDelete={() => {
              setDeleting(row)
            }}
          />
        )}
      />
      {dialog && (
        <FormulaDialog
          state={dialog}
          onClose={() => {
            setDialog(null)
          }}
        />
      )}
      <DeleteConfirm
        record={deleting}
        onClose={() => {
          setDeleting(null)
        }}
        remove={remove}
        idOf={(row) => row.id}
      />
    </>
  )
}

// --- Rules ---------------------------------------------------------------------------------------

const ruleSchema = z.object({ name, expression })
type RuleValues = z.infer<typeof ruleSchema>

/** "Rule Create": Name and Expression. */
function RuleDialog({
  state,
  onClose,
}: {
  state: Exclude<DialogState<PayRule>, null>
  onClose: () => void
}) {
  const record = state.mode === 'create' ? undefined : state.record
  const readOnly = state.mode === 'view'
  const save = useSaveResource('rules')
  const [error, setError] = useState<string | null>(null)
  const form = useForm<RuleValues>({
    resolver: zodResolver(ruleSchema),
    defaultValues: { name: record?.name ?? '', expression: record?.expression ?? '' },
  })
  const submit = form.handleSubmit(async (values) => {
    setError(null)
    try {
      await save.mutateAsync({
        id: record?.id,
        input: { ...values, isCustom: record?.isCustom ?? true },
      })
      onClose()
    } catch (failure) {
      setError(applyApiError(failure, form.setError, ['name', 'expression']))
    }
  })
  const title =
    state.mode === 'create' ? 'Rule Create' : state.mode === 'edit' ? 'Rule Edit' : 'Rule View'
  return (
    <PayrollDialog
      title={title}
      onClose={onClose}
      formId="rule-form"
      readOnly={readOnly}
      pending={save.isPending}
      error={error}
    >
      <form
        id="rule-form"
        noValidate
        onSubmit={(event) => void submit(event)}
        className="grid gap-5"
      >
        <TextField control={form.control} name="name" label="Name" disabled={readOnly} />
        <ExpressionField control={form.control} name="expression" disabled={readOnly} />
      </form>
    </PayrollDialog>
  )
}

const ruleColumns: DataTableColumn<PayRule>[] = [
  { id: 'name', header: 'Name', cell: (row) => row.name, mobile: 'heading' },
  { id: 'expression', header: 'Expression', cell: (row) => expressionCell(row.expression) },
  { id: 'custom', header: 'Is Custom', cell: (row) => yesNo(row.isCustom) },
]

/** Pay Components → Rules. */
export function RulesView() {
  const [page, setPage] = useState(1)
  const [dialog, setDialog] = useState<DialogState<PayRule>>(null)
  const [deleting, setDeleting] = useState<PayRule | null>(null)
  const list = useResourceList('rules', { page, pageSize: SETTINGS_PAGE_SIZE })
  const remove = useDeleteResource('rules')
  return (
    <>
      <ViewHeader
        tab="pay-components"
        view="rules"
        actions={
          <CreateButton
            onClick={() => {
              setDialog({ mode: 'create' })
            }}
          />
        }
      />
      <SettingsTable
        caption="Rules"
        columns={ruleColumns}
        page={list.data}
        getRowId={(row) => row.id}
        isLoading={list.isPending}
        isFetching={list.isFetching}
        onPageChange={setPage}
        rowActions={(row) => (
          <SettingsRowMenu
            label={`Actions for ${row.name}`}
            onEdit={() => {
              setDialog({ mode: 'edit', record: row })
            }}
            onView={() => {
              setDialog({ mode: 'view', record: row })
            }}
            onDelete={() => {
              setDeleting(row)
            }}
          />
        )}
      />
      {dialog && (
        <RuleDialog
          state={dialog}
          onClose={() => {
            setDialog(null)
          }}
        />
      )}
      <DeleteConfirm
        record={deleting}
        onClose={() => {
          setDeleting(null)
        }}
        remove={remove}
        idOf={(row) => row.id}
      />
    </>
  )
}
