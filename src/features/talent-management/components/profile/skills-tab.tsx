import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, X } from 'lucide-react'

import { SelectField, TextField } from '@/components/form'
import { Button } from '@/components/ui/button'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { labelOf, SKILL_LEVEL_LABELS, TM_CODES } from '../../constants'
import { useDeleteChild, useEmployeeChildren, useSaveChild } from '../../hooks/use-employees'
import {
  skillFormSchema,
  type SkillFormValues,
  skillToInput,
} from '../../schemas/employee-forms.schema'
import { type Employee, type Skill, SKILL_LEVELS } from '../../types/employees.types'
import { showServerErrors } from '../../utils/form-errors'
import { navyButtonClass, toolbarButtonClass } from '../../utils/styles'
import { FormDialog } from '../shared/form-dialog'
import { ConfirmDelete, EmptyNote, LoadingRows } from '../shared/parts'

/** Add Skills (2423:19155): Skill Title, Skill Level ("Choose Skill Level"), Cancel / Add. */
function SkillDialog({
  employee,
  row,
  onClose,
}: {
  employee: Employee
  row: Skill | null
  onClose: () => void
}) {
  const save = useSaveChild('skills', 'Skill')
  const form = useForm<SkillFormValues>({
    resolver: zodResolver(skillFormSchema),
    defaultValues: {
      skillTitle: row?.skillTitle ?? '',
      skillLevel: SKILL_LEVELS.find((level) => level === row?.skillLevel) ?? '',
    },
  })
  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({
        employeeId: employee.id,
        rowId: row?.id,
        input: { ...skillToInput(values), ...(row ? { rowVersion: row.rowVersion } : {}) },
      })
    } catch (error) {
      showServerErrors(error, form.setError, Object.keys(values))
      return
    }
    onClose()
  })
  return (
    <FormDialog
      title={row ? 'Edit Skill' : 'Add Skills'}
      onClose={onClose}
      onSubmit={submit}
      saving={save.isPending}
      rootError={form.formState.errors.root?.message}
      dirty={form.formState.isDirty}
    >
      <TextField
        control={form.control}
        name="skillTitle"
        label="Skill Title"
        required
        placeholder="Enter Skill Title"
      />
      <SelectField
        control={form.control}
        name="skillLevel"
        label="Skill Level"
        required
        placeholder="Choose Skill Level"
        options={SKILL_LEVELS.map((value) => ({ value, label: SKILL_LEVEL_LABELS[value] }))}
      />
    </FormDialog>
  )
}

/**
 * Skills (2423:18981): the chips (Logo Design, UI UX Design …) and the add button. A chip opens
 * its edit; its × removes it.
 */
export function SkillsTab({ employee }: { employee: Employee }) {
  const canEdit = useCan(TM_CODES.records)
  const skills = useEmployeeChildren(employee.id, 'skills')
  const remove = useDeleteChild('skills', 'Skill')
  const [editing, setEditing] = useState<Skill | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Skill | null>(null)
  const rows = skills.data ?? []

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-medium text-title">Skills</h3>
        {canEdit && (
          <Button
            onClick={() => {
              setEditing('new')
            }}
            className={cn(toolbarButtonClass, navyButtonClass, 'gap-1.5 px-4 text-xs')}
          >
            <Plus aria-hidden="true" className="size-4" />
            Add Skills
          </Button>
        )}
      </div>
      {skills.isPending ? (
        <LoadingRows rows={1} label="skills" />
      ) : skills.isError ? (
        <EmptyNote>The skills could not be loaded.</EmptyNote>
      ) : rows.length === 0 ? (
        <EmptyNote>No skills yet.</EmptyNote>
      ) : (
        <ul aria-label="Skills" className="flex flex-wrap gap-2.5">
          {rows.map((skill) => {
            const level = labelOf(SKILL_LEVEL_LABELS, skill.skillLevel)
            return (
              <li
                key={skill.id}
                className="inline-flex items-center gap-1 rounded-full border border-[#CFCFCF] bg-[#EBEFF8] py-1 pr-1.5 pl-3.5 text-sm text-title dark:border-border dark:bg-muted dark:text-heading"
              >
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(skill)
                    }}
                    title={`${skill.skillTitle} (${level})`}
                    className="rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    {skill.skillTitle}
                    <span className="sr-only">, {level}. Edit</span>
                  </button>
                ) : (
                  <span title={level}>{skill.skillTitle}</span>
                )}
                <span aria-hidden="true" className="text-[0.625rem] text-grey">
                  · {level}
                </span>
                {canEdit && (
                  <button
                    type="button"
                    aria-label={`Remove ${skill.skillTitle}`}
                    onClick={() => {
                      setDeleting(skill)
                    }}
                    className="ml-0.5 flex size-6 items-center justify-center rounded-full text-grey outline-none hover:bg-white hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring/50 dark:hover:bg-card"
                  >
                    <X aria-hidden="true" className="size-3.5" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {editing && (
        <SkillDialog
          employee={employee}
          row={editing === 'new' ? null : editing}
          onClose={() => {
            setEditing(null)
          }}
        />
      )}
      {deleting && (
        <ConfirmDelete
          what={`the skill ${deleting.skillTitle}`}
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
