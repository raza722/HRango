import { type SyntheticEvent, useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, Pencil, X } from 'lucide-react'
import { z } from 'zod'

import { TextareaField, TextField } from '@/components/form'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ActionIcon,
  btn,
  NoRecord,
  PayrollDialog,
  SectionTitle,
  toolbarButton,
  TwoWaySwitchField,
} from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import { CHECKLIST_FIELD_TYPE_LABELS } from '../../constants'
import { useChecklist, useSaveChecklist } from '../../hooks/use-offboarding'
import type { OffboardingChecklist } from '../../types/offboarding.types'
import { BinConfirm } from './bin-confirm'
import { ChecklistFieldDialog, type DraftField } from './checklist-field-dialog'

type Mode = 'create' | 'edit' | 'view'

const TITLES: Record<Mode, string> = {
  create: 'Checklist Create',
  edit: 'Checklist Edit',
  view: 'Checklist View',
}

const schema = z.object({
  name: z.string().trim().min(1, 'Enter the name').max(80, 'Keep it under 80 characters'),
  status: z.enum(['inactive', 'active']),
  description: z.string().trim().max(500, 'Keep it under 500 characters'),
})
type Values = z.infer<typeof schema>

/** View draws its boxes grey, not faded white. */
const viewFieldsClass =
  '[&_input:disabled]:border-transparent [&_input:disabled]:bg-[#D9D9D9]/60 [&_input:disabled]:opacity-100 [&_textarea:disabled]:border-transparent [&_textarea:disabled]:bg-[#D9D9D9]/60 [&_textarea:disabled]:opacity-100 dark:[&_input:disabled]:bg-muted dark:[&_textarea:disabled]:bg-muted'

let draftKey = 0
const nextKey = () => {
  draftKey += 1
  return `draft_${String(draftKey)}`
}

type FieldDialog = { mode: 'create' } | { mode: 'edit' | 'view'; field: DraftField } | null

/** "Checklist Create" / Edit / View: name, status, description and its Additional Information fields. */
export function ChecklistDialog({
  id,
  mode,
  onClose,
}: {
  id: string | null
  mode: Mode
  onClose: () => void
}) {
  const checklist = useChecklist(id)
  if (id && !checklist.data) {
    return (
      <PayrollDialog title={TITLES[mode]} onClose={onClose} readOnly className="max-w-3xl">
        <Skeleton className="h-72 w-full" />
      </PayrollDialog>
    )
  }
  return <ChecklistForm checklist={checklist.data} mode={mode} onClose={onClose} />
}

function ChecklistForm({
  checklist,
  mode,
  onClose,
}: {
  checklist: OffboardingChecklist | undefined
  mode: Mode
  onClose: () => void
}) {
  const formId = useId()
  const readOnly = mode === 'view'
  const save = useSaveChecklist()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: checklist?.name ?? '',
      status: checklist && !checklist.active ? 'inactive' : 'active',
      description: checklist?.description ?? '',
    },
  })
  const [fields, setFields] = useState<DraftField[]>(() =>
    (checklist?.fields ?? []).map((field) => ({ ...field, key: nextKey() })),
  )
  const [fieldDialog, setFieldDialog] = useState<FieldDialog>(null)
  const [deleting, setDeleting] = useState<DraftField | null>(null)

  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({
        id: checklist?.id,
        input: {
          name: values.name,
          active: values.status === 'active',
          description: values.description,
          fields: fields.map(({ key: _key, ...field }) => field),
        },
      })
      onClose()
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors.name) {
        form.setError('name', { message: error.fieldErrors.name })
      } else {
        form.setError('root', {
          message: error instanceof ApiError ? error.message : 'Could not save the checklist.',
        })
      }
    }
  })

  const editing = fieldDialog && fieldDialog.mode !== 'create' ? fieldDialog.field : null

  return (
    <>
      <PayrollDialog
        title={TITLES[mode]}
        onClose={onClose}
        formId={formId}
        readOnly={readOnly}
        pending={save.isPending}
        error={form.formState.errors.root?.message}
        className="max-w-3xl"
      >
        <div className="grid gap-8">
          <form
            id={formId}
            noValidate
            onSubmit={(event: SyntheticEvent) => void submit(event)}
            className={cn('grid gap-5', readOnly && viewFieldsClass)}
          >
            <TextField
              control={form.control}
              name="name"
              label="Name"
              placeholder="Name"
              required={!readOnly}
              disabled={readOnly}
            />
            <TwoWaySwitchField
              control={form.control}
              name="status"
              label="Status"
              ariaLabel="Status"
              options={[
                { value: 'inactive', label: 'Deactive' },
                { value: 'active', label: 'Active' },
              ]}
              disabled={readOnly}
            />
            <TextareaField
              control={form.control}
              name="description"
              label="Description"
              rows={5}
              disabled={readOnly}
            />
          </form>

          <section aria-labelledby={`${formId}-fields`} className="grid gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SectionTitle className="pt-0">
                <span id={`${formId}-fields`}>Additional Information</span>
              </SectionTitle>
              {!readOnly && (
                <Button
                  type="button"
                  onClick={() => {
                    setFieldDialog({ mode: 'create' })
                  }}
                  className={cn(toolbarButton, btn.blue, 'min-w-28')}
                >
                  Create
                </Button>
              )}
            </div>
            {fields.length === 0 ? (
              <NoRecord />
            ) : (
              <div className="-mx-4 scrollbar-thin overflow-x-auto sm:-mx-6">
                <table className="w-full min-w-[26rem] text-left text-sm">
                  <caption className="sr-only">Additional Information</caption>
                  <thead>
                    <tr className="bg-[#17263A]/[0.06] text-sm text-title dark:bg-muted">
                      <th scope="col" className="h-10 px-6 font-medium sm:px-12">
                        Name
                      </th>
                      <th scope="col" className="h-10 px-3 font-medium">
                        Type
                      </th>
                      {!readOnly && (
                        <th scope="col" className="h-10 px-3 font-medium">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field) => (
                      <tr
                        key={field.key}
                        className="border-b font-inter text-field-value last:border-b-0"
                      >
                        <td className="h-12 px-6 sm:px-12">{field.name}</td>
                        <td className="h-12 px-3">{CHECKLIST_FIELD_TYPE_LABELS[field.type]}</td>
                        {!readOnly && (
                          <td className="h-12 px-3">
                            <span className="flex items-center gap-2">
                              <ActionIcon
                                icon={Pencil}
                                label={`Edit, ${field.name}`}
                                tooltip="Edit"
                                colour="bg-[#2CBD4D]"
                                tooltipClassName="font-inter text-base"
                                onClick={() => {
                                  setFieldDialog({ mode: 'edit', field })
                                }}
                              />
                              <ActionIcon
                                icon={Eye}
                                label={`View, ${field.name}`}
                                tooltip="View"
                                colour="bg-[#3B6FF5]"
                                tooltipClassName="font-inter text-base"
                                onClick={() => {
                                  setFieldDialog({ mode: 'view', field })
                                }}
                              />
                              <ActionIcon
                                icon={X}
                                label={`Delete, ${field.name}`}
                                tooltip="Delete"
                                colour="bg-[#E50141]"
                                tooltipClassName="font-inter text-base"
                                onClick={() => {
                                  setDeleting(field)
                                }}
                              />
                            </span>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </PayrollDialog>

      {fieldDialog && (
        <ChecklistFieldDialog
          mode={fieldDialog.mode}
          field={editing}
          takenNames={fields.filter((item) => item.key !== editing?.key).map((item) => item.name)}
          onClose={() => {
            setFieldDialog(null)
          }}
          onSave={(saved) => {
            setFields((current) =>
              editing
                ? current.map((item) =>
                    item.key === editing.key ? { ...saved, key: item.key } : item,
                  )
                : [...current, { ...saved, key: nextKey() }],
            )
            setFieldDialog(null)
          }}
        />
      )}
      <BinConfirm
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title={deleting ? `Delete ${deleting.name}` : 'Delete field'}
        onConfirm={() => {
          if (deleting) setFields((current) => current.filter((item) => item.key !== deleting.key))
          setDeleting(null)
        }}
      />
    </>
  )
}
