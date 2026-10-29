import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { TextareaField, TextField } from '@/components/form'

import { useCopyRole, useSaveRole } from '../../hooks/use-access'
import {
  copyRoleFormSchema,
  type CopyRoleFormValues,
  roleFormSchema,
  roleFormToInput,
  type RoleFormValues,
  roleToForm,
} from '../../schemas/access-forms.schema'
import type { Role, RoleDetail } from '../../types/access.types'
import { showServerErrors } from '../../utils/form-errors'
import { FormDialog } from '../shared/dialogs'

/**
 * Add Role / Edit Role: its name and description (the ticks are set on the role's page). A
 * system role keeps its name, so only the description can change.
 */
export function RoleFormDialog({
  role,
  onClose,
  onSaved,
}: {
  role: RoleDetail | Role | null
  onClose: () => void
  onSaved?: (role: RoleDetail) => void
}) {
  const save = useSaveRole()
  const form = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: roleToForm(role),
  })
  const submit = form.handleSubmit(async (values) => {
    try {
      const saved = await save.mutateAsync({
        id: role?.id,
        input: roleFormToInput(values),
        ...(role ? { rowVersion: role.rowVersion } : {}),
      })
      if (onSaved) onSaved(saved)
      else onClose()
    } catch (error) {
      showServerErrors(error, form.setError, ['name', 'description'])
    }
  })
  return (
    <FormDialog
      title={role ? 'Edit Role' : 'Add Role'}
      description={
        role
          ? `Edit ${role.name}.`
          : 'A group of permissions to give people. Tick its permissions after adding it.'
      }
      onClose={onClose}
      onSubmit={submit}
      saving={save.isPending}
      saveLabel={role ? 'Save' : 'Add Role'}
      rootError={form.formState.errors.root?.message}
    >
      <TextField
        control={form.control}
        name="name"
        label="Name"
        required
        disabled={role?.isSystem ?? false}
        placeholder="e.g. Payroll Officer"
        {...(role?.isSystem ? { description: 'A system role keeps its name.' } : {})}
      />
      <TextareaField
        control={form.control}
        name="description"
        label="Description"
        placeholder="Who holds it and what for"
      />
    </FormDialog>
  )
}

/** Copy Role: a new role with the same ticks and scopes, under a new name. */
export function CopyRoleDialog({
  role,
  onClose,
  onCopied,
}: {
  role: Role
  onClose: () => void
  onCopied: (copy: RoleDetail) => void
}) {
  const copy = useCopyRole()
  const form = useForm<CopyRoleFormValues>({
    resolver: zodResolver(copyRoleFormSchema),
    defaultValues: { name: `Copy of ${role.name}` },
  })
  const submit = form.handleSubmit(async (values) => {
    try {
      onCopied(await copy.mutateAsync({ id: role.id, name: values.name }))
    } catch (error) {
      showServerErrors(error, form.setError, ['name'])
    }
  })
  return (
    <FormDialog
      title={`Copy ${role.name}`}
      description={`A new role with ${role.name}’s ${String(role.permissionCount)} permission${role.permissionCount === 1 ? '' : 's'} and their scopes, and nobody holding it yet.`}
      onClose={onClose}
      onSubmit={submit}
      saving={copy.isPending}
      saveLabel="Copy Role"
      rootError={form.formState.errors.root?.message}
    >
      <TextField control={form.control} name="name" label="New Name" required />
    </FormDialog>
  )
}
