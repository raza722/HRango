import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'

import { SwitchField, TextField } from '@/components/form'
import { EmployeeSearchSelectField, MultiSearchSelectField } from '@/features/payroll'
import { companiesQueryOptions } from '@/features/settings'

import { ACCESS_CODES } from '../../constants'
import { useRoleOptions, useSaveUser, useUser } from '../../hooks/use-access'
import {
  createUserFormSchema,
  editUserFormSchema,
  userFormToInput,
  type UserFormValues,
  userToForm,
} from '../../schemas/access-forms.schema'
import type { UserDetail } from '../../types/access.types'
import { showServerErrors } from '../../utils/form-errors'
import { navySwitchClass } from '../../utils/styles'
import { FormDialog } from '../shared/dialogs'
import { LoadError, LoadingRows } from '../shared/parts'
import { PasswordField } from '../shared/password-field'

const FIELDS = Object.keys(userToForm(null, null))

/**
 * Add User / Edit User (`UserIn`): email, display name, the linked employee, an initial password
 * (Add only), Active, companies and roles.
 * `id` loads the account to edit; `null` adds one.
 */
export function UserFormDialog({
  id,
  onClose,
  onSaved,
}: {
  id: string | null
  onClose: () => void
  onSaved?: (user: UserDetail) => void
}) {
  const creating = id === null
  const record = useUser(id)
  const user = id ? (record.data ?? null) : null
  const save = useSaveUser()
  const companies = useQuery(companiesQueryOptions())
  const roles = useRoleOptions()
  const current = companies.data?.find((company) => company.isCurrent)?.id ?? null
  const form = useForm<UserFormValues>({
    resolver: zodResolver(creating ? createUserFormSchema : editUserFormSchema),
    defaultValues: userToForm(null, null),
    // The account once it is read; a new one starts in the current company once that is known.
    values: user
      ? userToForm(user, null)
      : creating && current
        ? userToForm(null, current)
        : undefined,
    resetOptions: { keepDirtyValues: true },
  })
  const companyOptions = [
    ...(user?.companies ?? [])
      .filter((company) => !companies.data?.some((row) => row.id === company.id))
      .map((company) => ({ value: company.id, label: company.name })),
    ...(companies.data ?? []).map((company) => ({ value: company.id, label: company.name })),
  ]
  const heldIds = new Set(user?.roles.map((role) => role.id) ?? [])
  const roleOptions = (roles.data?.data ?? [])
    .filter((role) => role.isActive || heldIds.has(role.id))
    .map((role) => ({
      value: role.id,
      label: role.isActive ? role.name : `${role.name} (retired)`,
      ...(role.description ? { hint: role.description } : {}),
    }))

  const submit = form.handleSubmit(async (values) => {
    try {
      const saved = await save.mutateAsync({
        id: user?.id,
        input: userFormToInput(values, creating),
        ...(user ? { rowVersion: user.rowVersion } : {}),
      })
      // `onSaved` closes the dialog itself (it may open the new account instead).
      if (onSaved) onSaved(saved)
      else onClose()
    } catch (error) {
      showServerErrors(error, form.setError, FIELDS)
    }
  })

  return (
    <>
      <FormDialog
        title={creating ? 'Add User' : 'Edit User'}
        description={
          creating
            ? 'An account that can sign in to the portal, with its roles.'
            : user
              ? `Edit ${user.name}’s account.`
              : 'Loading the account…'
        }
        onClose={onClose}
        onSubmit={submit}
        saving={save.isPending || (!creating && !user)}
        saveLabel={creating ? 'Add User' : 'Save'}
        rootError={form.formState.errors.root?.message}
        className="max-w-[48rem]"
      >
        {!creating && record.isError ? (
          <LoadError
            error={record.error}
            what="the account"
            onRetry={() => void record.refetch()}
          />
        ) : !creating && !user ? (
          <LoadingRows label="the account" rows={5} />
        ) : (
          <div className="grid gap-4 @xl:grid-cols-2">
            <TextField
              control={form.control}
              name="email"
              label="Email"
              required
              type="email"
              autoComplete="off"
              placeholder="name@company.com"
            />
            <TextField
              control={form.control}
              name="displayName"
              label="Display Name"
              placeholder="The employee’s name if blank"
            />
            <EmployeeSearchSelectField
              control={form.control}
              name="employeeId"
              label="Linked Employee"
              placeholder="No employee (a service or admin account)"
              filters={{ permission: ACCESS_CODES.usersCreate }}
              known={
                user?.employeeId
                  ? [{ value: user.employeeId, label: user.name, hint: user.employeeCode ?? '' }]
                  : undefined
              }
              clearable
              className="@xl:col-span-2"
            />
            {creating && (
              <>
                <PasswordField
                  control={form.control}
                  name="password"
                  label="Initial Password"
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
              </>
            )}
            <MultiSearchSelectField
              control={form.control}
              name="companyIds"
              label="Companies"
              required
              options={companyOptions}
              placeholder={companies.isPending ? 'Loading companies…' : 'Choose companies'}
            />
            <MultiSearchSelectField
              control={form.control}
              name="roleIds"
              label="Roles"
              options={roleOptions}
              placeholder={roles.isPending ? 'Loading roles…' : 'No roles yet'}
            />
            <SwitchField
              control={form.control}
              name="isActive"
              label="Active"
              stateLabel={(on) => (on ? 'Active: can sign in' : 'Disabled: cannot sign in')}
              className={navySwitchClass}
            />
          </div>
        )}
        {!creating && (
          <p className="text-xs text-muted-foreground">
            The password is changed with Set Password, which signs the person out everywhere.
          </p>
        )}
      </FormDialog>
    </>
  )
}
