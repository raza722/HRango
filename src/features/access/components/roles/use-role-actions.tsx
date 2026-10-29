import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'

import type { RowAction } from '@/components/layout'
import { useCan } from '@/lib/permissions'

import { ACCESS_CODES } from '../../constants'
import { useDeleteRole, useSetRoleRetired } from '../../hooks/use-access'
import type { Role } from '../../types/access.types'
import { plural } from '../../utils/format'
import { ConfirmAction } from '../shared/dialogs'
import { CopyRoleDialog, RoleFormDialog } from './role-dialogs'

interface Pending {
  kind: 'edit' | 'copy' | 'retire' | 'restore' | 'delete'
  role: Role
}

/**
 * Edit, Copy, Retire / Restore and Delete of a role, for the list's ⋮ menu and the role's page.
 * System roles are never retired or deleted (their name is fixed too). A role people hold is
 * not deleted: Delete then explains that and offers Retire instead.
 */
export function useRoleActions({
  onDeleted,
  onEdit,
}: {
  onDeleted?: () => void
  /** Opens Edit elsewhere (the list keeps it in the URL); without it, Edit opens here. */
  onEdit?: (role: Role) => void
} = {}) {
  const navigate = useNavigate()
  const canCreate = useCan(ACCESS_CODES.rolesCreate)
  const canEdit = useCan(ACCESS_CODES.rolesEdit)
  const canDelete = useCan(ACCESS_CODES.rolesDelete)
  const retire = useSetRoleRetired()
  const remove = useDeleteRole()
  const [pending, setPending] = useState<Pending | null>(null)
  const close = () => {
    setPending(null)
  }
  /** Closes a dialog unless another one has taken its place (Retire Instead). */
  const closeIf = (kind: Pending['kind']) => () => {
    setPending((current) => (current?.kind === kind ? null : current))
  }
  const open = (kind: Pending['kind'], role: Role) => {
    setPending({ kind, role })
  }

  const actionsFor = (role: Role): RowAction[] => [
    ...(canEdit
      ? [
          {
            label: 'Edit',
            onSelect: () => {
              if (onEdit) onEdit(role)
              else open('edit', role)
            },
          },
        ]
      : []),
    ...(canCreate
      ? [
          {
            label: 'Copy',
            onSelect: () => {
              open('copy', role)
            },
          },
        ]
      : []),
    ...(canEdit && !role.isSystem
      ? [
          {
            label: role.isActive ? 'Retire' : 'Restore',
            onSelect: () => {
              open(role.isActive ? 'retire' : 'restore', role)
            },
          },
        ]
      : []),
    ...(canDelete && !role.isSystem
      ? [
          {
            label: 'Delete',
            variant: 'destructive' as const,
            onSelect: () => {
              open('delete', role)
            },
          },
        ]
      : []),
  ]

  const dialogs = (() => {
    if (!pending) return null
    const { role } = pending
    const holders = plural(role.userCount, 'person', 'people')
    switch (pending.kind) {
      case 'edit':
        return <RoleFormDialog role={role} onClose={close} />
      case 'copy':
        return (
          <CopyRoleDialog
            role={role}
            onClose={close}
            onCopied={(copy) => {
              close()
              void navigate({
                to: '/settings/user-group-permissions/$roleId',
                params: { roleId: copy.id },
              })
            }}
          />
        )
      case 'retire':
        return (
          <ConfirmAction
            title={`Retire ${role.name}?`}
            description={
              role.userCount > 0
                ? `The ${holders} who hold it lose its permissions until it is restored, and nobody new can be given it. Its history is kept.`
                : 'Nobody can be given it until it is restored. Its history is kept.'
            }
            confirmLabel="Retire Role"
            destructive
            onConfirm={() => {
              retire.mutate({
                id: role.id,
                retired: true,
                rowVersion: role.rowVersion,
                name: role.name,
              })
            }}
            onClose={closeIf('retire')}
          />
        )
      case 'restore':
        return (
          <ConfirmAction
            title={`Restore ${role.name}?`}
            description={
              role.userCount > 0
                ? `The ${holders} who hold it get its permissions back, and it can be given again.`
                : 'It can be given to people again.'
            }
            confirmLabel="Restore Role"
            onConfirm={() => {
              retire.mutate({
                id: role.id,
                retired: false,
                rowVersion: role.rowVersion,
                name: role.name,
              })
            }}
            onClose={closeIf('restore')}
          />
        )
      case 'delete':
        if (role.userCount > 0) {
          return role.isActive ? (
            <ConfirmAction
              title={`${role.name} can’t be deleted`}
              description={`${holders.charAt(0).toUpperCase()}${holders.slice(1)} hold ${role.name}. Take it away from them first, or retire it: a retired role grants nothing and keeps its history.`}
              confirmLabel="Retire Instead"
              onConfirm={() => {
                open('retire', role)
              }}
              onClose={closeIf('delete')}
            />
          ) : (
            <ConfirmAction
              title={`${role.name} can’t be deleted`}
              description={`${holders.charAt(0).toUpperCase()}${holders.slice(1)} still hold ${role.name}. Take it away from them first; it already grants nothing while retired.`}
              confirmLabel="See Who Holds It"
              onConfirm={() => {
                void navigate({
                  to: '/settings/user-group-permissions/$roleId',
                  params: { roleId: role.id },
                  search: { tab: 'users' },
                })
              }}
              onClose={close}
            />
          )
        }
        return (
          <ConfirmAction
            title={`Delete ${role.name}?`}
            description="The role is removed for good. Its history stays in the audit log."
            confirmLabel="Delete Role"
            destructive
            onConfirm={() => {
              remove.mutate(
                { id: role.id, rowVersion: role.rowVersion, name: role.name },
                { onSuccess: onDeleted },
              )
            }}
            onClose={close}
          />
        )
    }
  })()

  return { actionsFor, dialogs, open, canEdit, canCreate, canDelete }
}
