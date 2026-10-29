import { useState } from 'react'
import { useController, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus } from 'lucide-react'

import { SelectField, TextField } from '@/components/form'
import { Button } from '@/components/ui/button'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import {
  DEPENDENT_RELATION_LABELS,
  DEPENDENT_SIDES,
  type DependentSide,
  labelOf,
  TM_CODES,
} from '../../constants'
import { useDeleteChild, useEmployeeChildren, useSaveChild } from '../../hooks/use-employees'
import {
  dependentFormSchema,
  type DependentFormValues,
  dependentToForm,
  dependentToInput,
  sideOf,
} from '../../schemas/employee-forms.schema'
import type { Dependent, Employee } from '../../types/employees.types'
import { showServerErrors } from '../../utils/form-errors'
import { navyButtonClass, sectionCardClass, toolbarButtonClass } from '../../utils/styles'
import { FormDialog } from '../shared/form-dialog'
import { ConfirmDelete, EditDeleteMenu, EmptyNote, LoadingRows } from '../shared/parts'
import { FemaleDependentIcon, MaleDependentIcon } from '../talent-icons'

const SIDE_LABELS: Record<DependentSide, string> = {
  male: 'Male Dependents',
  female: 'Female Dependents',
}

/** Add Dependents (2423:18644): Male / Female Dependents, Relation, First / Last Name, Occupation. */
function DependentDialog({
  employee,
  row,
  onClose,
}: {
  employee: Employee
  row: Dependent | null
  onClose: () => void
}) {
  const save = useSaveChild('dependents', 'Dependent')
  const form = useForm<DependentFormValues>({
    resolver: zodResolver(dependentFormSchema),
    defaultValues: dependentToForm(row),
  })
  const side = useController({ control: form.control, name: 'side' })
  const relation = useWatch({ control: form.control, name: 'relation' })
  const relations: readonly string[] = DEPENDENT_SIDES[side.field.value]

  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({
        employeeId: employee.id,
        rowId: row?.id,
        input: { ...dependentToInput(values), ...(row ? { rowVersion: row.rowVersion } : {}) },
      })
    } catch (error) {
      showServerErrors(error, form.setError, Object.keys(values))
      return
    }
    onClose()
  })

  return (
    <FormDialog
      title={row ? 'Edit Dependent' : 'Add Dependents'}
      onClose={onClose}
      onSubmit={submit}
      saving={save.isPending}
      rootError={form.formState.errors.root?.message}
      dirty={form.formState.isDirty}
    >
      <div
        role="radiogroup"
        aria-label="Dependent"
        className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
      >
        {(['male', 'female'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={side.field.value === value}
            onClick={() => {
              side.field.onChange(value)
              if (relation && !(DEPENDENT_SIDES[value] as readonly string[]).includes(relation)) {
                form.setValue('relation', '')
              }
            }}
            className={cn(
              'h-10 rounded-md text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              side.field.value === value
                ? 'bg-sidebar text-white dark:bg-primary'
                : 'text-tab hover:text-heading',
            )}
          >
            {SIDE_LABELS[value]}
          </button>
        ))}
      </div>
      <div className="grid gap-4 @md:grid-cols-2">
        <SelectField
          control={form.control}
          name="relation"
          label="Relation"
          required
          placeholder="Select Relation"
          className="@md:col-span-2"
          options={relations.map((value) => ({
            value,
            label: labelOf(DEPENDENT_RELATION_LABELS, value),
          }))}
        />
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
          placeholder="Enter Last Name"
        />
        <TextField
          control={form.control}
          name="occupation"
          label="Occupation"
          placeholder="Enter Occupation"
          className="@md:col-span-2"
        />
      </div>
    </FormDialog>
  )
}

/**
 * Dependents (2423:18475): a card per person ("Ashraf Hussain", "Father | Property Dealer") with
 * the man / woman icon by relation, and the add button. Edit and Delete on each card.
 */
export function DependentsTab({ employee }: { employee: Employee }) {
  const canEdit = useCan(TM_CODES.records)
  const dependents = useEmployeeChildren(employee.id, 'dependents')
  const remove = useDeleteChild('dependents', 'Dependent')
  const [editing, setEditing] = useState<Dependent | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Dependent | null>(null)
  const rows = dependents.data ?? []

  return (
    <div className="@container grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-medium text-title">Dependents</h3>
        {canEdit && (
          <Button
            onClick={() => {
              setEditing('new')
            }}
            className={cn(toolbarButtonClass, navyButtonClass, 'gap-1.5 px-4 text-xs')}
          >
            <Plus aria-hidden="true" className="size-4" />
            Add Dependents
          </Button>
        )}
      </div>
      {dependents.isPending ? (
        <LoadingRows rows={2} label="dependents" />
      ) : dependents.isError ? (
        <EmptyNote>The dependents could not be loaded.</EmptyNote>
      ) : rows.length === 0 ? (
        <EmptyNote>No dependents yet.</EmptyNote>
      ) : (
        <ul aria-label="Dependents" className="grid gap-2.5 @2xl:grid-cols-2">
          {rows.map((row) => {
            const female =
              sideOf(row.relation) === 'female' ||
              (row.relation === 'spouse' && employee.gender === 'male')
            const Icon = female ? FemaleDependentIcon : MaleDependentIcon
            return (
              <li
                key={row.id}
                className={cn(sectionCardClass, 'flex items-center gap-4 px-4 py-3')}
              >
                <Icon
                  className={cn(
                    'h-[1.7rem] w-3 shrink-0',
                    female ? 'text-[#B3261E] dark:text-red-300' : 'text-[#00A2FE]',
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium break-words text-title">{row.name}</p>
                  <p className="text-xs text-grey">
                    {[labelOf(DEPENDENT_RELATION_LABELS, row.relation), row.occupation]
                      .filter(Boolean)
                      .join(' | ')}
                  </p>
                </div>
                {canEdit && (
                  <EditDeleteMenu
                    label={`Actions for ${row.name}`}
                    onEdit={() => {
                      setEditing(row)
                    }}
                    onDelete={() => {
                      setDeleting(row)
                    }}
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}
      {editing && (
        <DependentDialog
          employee={employee}
          row={editing === 'new' ? null : editing}
          onClose={() => {
            setEditing(null)
          }}
        />
      )}
      {deleting && (
        <ConfirmDelete
          what={`the dependent ${deleting.name}`}
          onClose={() => {
            setDeleting(null)
          }}
          onConfirm={() => {
            remove.mutate({
              employeeId: employee.id,
              rowId: deleting.id,
              rowVersion: deleting.rowVersion,
            })
            setDeleting(null)
          }}
        />
      )}
    </div>
  )
}
