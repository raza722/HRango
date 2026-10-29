import { useState } from 'react'
import { Link } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ApiError } from '@/lib/api-error'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { ACCESS_CODES } from '../../constants'
import { useRoleOptions, useSetUserRoles } from '../../hooks/use-access'
import type { UserDetail } from '../../types/access.types'
import { messageOf } from '../../utils/form-errors'
import { plural } from '../../utils/format'
import {
  linkClass,
  navyButtonClass,
  outlineButtonClass,
  toolbarButtonClass,
} from '../../utils/styles'
import { Chip, EmptyNote, LoadError, LoadingRows, SectionCard } from '../shared/parts'

/**
 * The account's roles, edited all at once (`PUT /access/users/{id}/roles`): Edit Roles turns
 * the list into ticks of every role in use (and any retired one the account still has); Save
 * sends them together. A refusal (your own last admin role, a retired role) shows under them.
 */
export function UserRolesTab({ user }: { user: UserDetail }) {
  const canAssign = useCan(ACCESS_CODES.usersRoles)
  const roles = useRoleOptions()
  const save = useSetUserRoles()
  const [draft, setDraft] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const held = new Set(user.roles.map((role) => role.id))

  const start = () => {
    setDraft(user.roles.map((role) => role.id))
    setError(null)
  }
  const cancel = () => {
    setDraft(null)
    setError(null)
  }
  const changed =
    draft !== null && (draft.length !== held.size || draft.some((roleId) => !held.has(roleId)))

  const submit = () => {
    if (!draft) return
    setError(null)
    save.mutate(
      { id: user.id, roleIds: draft, rowVersion: user.rowVersion },
      {
        onSuccess: () => {
          setDraft(null)
        },
        onError: (failure) => {
          setError(
            failure instanceof ApiError
              ? (failure.fieldErrors.roleIds ?? failure.message)
              : messageOf(failure),
          )
        },
      },
    )
  }

  const choices = (roles.data?.data ?? []).filter((role) => role.isActive || held.has(role.id))

  return (
    <SectionCard
      title={`Roles (${String(user.roles.length)})`}
      as="h3"
      actions={
        canAssign &&
        draft === null && (
          <Button onClick={start} className={cn(toolbarButtonClass, navyButtonClass)}>
            Edit Roles
          </Button>
        )
      }
    >
      {draft === null ? (
        user.roles.length === 0 ? (
          <EmptyNote>
            {user.isSystemAdmin
              ? 'No roles: as a system admin this account still holds every permission.'
              : 'No roles yet: this account can sign in but sees almost nothing.'}
          </EmptyNote>
        ) : (
          <ul aria-label="Roles of this account" className="grid gap-2 @xl:grid-cols-2">
            {user.roles.map((role) => {
              const detail = roles.data?.data.find((row) => row.id === role.id)
              return (
                <li key={role.id} className="grid gap-1 rounded-lg border border-border p-3">
                  <span className="flex flex-wrap items-center gap-2">
                    <Link
                      to="/settings/user-group-permissions/$roleId"
                      params={{ roleId: role.id }}
                      className={cn(linkClass, 'text-sm')}
                    >
                      {role.name}
                    </Link>
                    {!role.isActive && <Chip tone="grey">Retired: grants nothing</Chip>}
                  </span>
                  {detail && (
                    <span className="text-xs text-grey">
                      {detail.description ?? 'No description.'} ·{' '}
                      {plural(detail.permissionCount, 'permission')}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )
      ) : roles.isError ? (
        <LoadError error={roles.error} what="the roles" onRetry={() => void roles.refetch()} />
      ) : roles.isPending ? (
        <LoadingRows label="the roles" rows={4} />
      ) : (
        <div className="grid gap-4">
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-xs text-muted-foreground">
              Tick every role the account should have, then save them together.
            </legend>
            <div className="grid gap-2 @xl:grid-cols-2">
              {choices.map((role) => {
                const ticked = draft.includes(role.id)
                return (
                  <label
                    key={role.id}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                      ticked
                        ? 'border-sidebar/40 bg-sidebar/[0.04] dark:border-primary/50'
                        : 'border-border',
                    )}
                  >
                    <Checkbox
                      tone="navy"
                      checked={ticked}
                      onCheckedChange={(next) => {
                        setDraft((current) =>
                          next === true
                            ? [...(current ?? []), role.id]
                            : (current ?? []).filter((roleId) => roleId !== role.id),
                        )
                      }}
                      className="mt-0.5"
                    />
                    <span className="grid min-w-0 gap-0.5">
                      <span className="flex flex-wrap items-center gap-1.5 text-sm text-title">
                        {role.name}
                        {role.isSystem && <Chip tone="navy">System</Chip>}
                        {!role.isActive && <Chip tone="grey">Retired</Chip>}
                      </span>
                      <span className="text-xs text-grey">
                        {role.description ?? 'No description.'} ·{' '}
                        {plural(role.permissionCount, 'permission')}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={cancel}
              className={cn(toolbarButtonClass, outlineButtonClass)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={submit}
              disabled={!changed || save.isPending}
              className={cn(toolbarButtonClass, navyButtonClass)}
            >
              Save Roles
            </Button>
            <span className="text-xs text-muted-foreground" aria-live="polite">
              {plural(draft.length, 'role')} ticked
            </span>
          </div>
        </div>
      )}
    </SectionCard>
  )
}
