import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { useChangeOwnPassword, useSetPassword } from '../../hooks/use-access'
import {
  changePasswordFormSchema,
  type ChangePasswordFormValues,
  setPasswordFormSchema,
  type SetPasswordFormValues,
} from '../../schemas/password.schema'
import { showServerErrors } from '../../utils/form-errors'
import { possessive } from '../../utils/format'
import { FormDialog } from '../shared/dialogs'
import { PasswordField } from '../shared/password-field'

/**
 * Set Password for someone else (`PUT /access/users/{id}/password`): the new password twice.
 * Saving signs them out everywhere, which the dialog says first.
 */
export function SetPasswordDialog({
  user,
  onClose,
}: {
  user: { id: string; name: string }
  onClose: () => void
}) {
  const save = useSetPassword()
  const form = useForm<SetPasswordFormValues>({
    resolver: zodResolver(setPasswordFormSchema),
    defaultValues: { password: '', confirm: '' },
  })
  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({ id: user.id, password: values.password, name: user.name })
    } catch (error) {
      showServerErrors(error, form.setError, ['password', 'confirm'])
      return
    }
    onClose()
  })
  return (
    <FormDialog
      title={`Set ${possessive(user.name)} password`}
      description={`Saving signs ${user.name} out on every device; they sign in again with the new password.`}
      onClose={onClose}
      onSubmit={submit}
      saving={save.isPending}
      saveLabel="Set Password"
      rootError={form.formState.errors.root?.message}
    >
      <PasswordField
        control={form.control}
        name="password"
        label="New Password"
        required
        showRules
        autoComplete="new-password"
      />
      <PasswordField
        control={form.control}
        name="confirm"
        label="Confirm Password"
        required
        autoComplete="new-password"
      />
    </FormDialog>
  )
}

/**
 * Change Password for the signed-in person (`POST /access/me/password`): the current password,
 * then the new one twice. Their other sessions end; this one stays signed in.
 */
export function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const save = useChangeOwnPassword()
  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordFormSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
  })
  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })
    } catch (error) {
      showServerErrors(error, form.setError, ['currentPassword', 'newPassword', 'confirm'])
      return
    }
    onClose()
  })
  return (
    <FormDialog
      title="Change Password"
      description="Your other sessions end when the password changes; you stay signed in here."
      onClose={onClose}
      onSubmit={submit}
      saving={save.isPending}
      saveLabel="Change Password"
      rootError={form.formState.errors.root?.message}
    >
      <PasswordField
        control={form.control}
        name="currentPassword"
        label="Current Password"
        required
        autoComplete="current-password"
      />
      <PasswordField
        control={form.control}
        name="newPassword"
        label="New Password"
        required
        showRules
        autoComplete="new-password"
      />
      <PasswordField
        control={form.control}
        name="confirm"
        label="Confirm New Password"
        required
        autoComplete="new-password"
      />
    </FormDialog>
  )
}
