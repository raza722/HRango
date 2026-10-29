import { useState } from 'react'

import type { RowAction } from '@/components/layout'
import { useCan } from '@/lib/permissions'

import { ACCESS_CODES } from '../../constants'
import { useMyEmail, useSetUserActive } from '../../hooks/use-access'
import type { User } from '../../types/access.types'
import { possessive } from '../../utils/format'
import { ConfirmAction } from '../shared/dialogs'
import { ChangePasswordDialog, SetPasswordDialog } from './password-dialogs'

type Pending = { kind: 'active' | 'password'; user: User } | { kind: 'own-password' }

/**
 * Enable / Disable (with a confirm that says the sessions end) and Set Password (Change
 * Password on your own account), for the list's ⋮ menu and the account page. You cannot
 * disable yourself, so your own account offers no Disable.
 */
export function useUserActions() {
  const myEmail = useMyEmail()
  const canDisable = useCan(ACCESS_CODES.usersDisable)
  const canPassword = useCan(ACCESS_CODES.usersPassword)
  const setActive = useSetUserActive()
  const [pending, setPending] = useState<Pending | null>(null)

  const isSelf = (user: Pick<User, 'email'>) => user.email.toLowerCase() === myEmail
  const close = () => {
    setPending(null)
  }

  const openPassword = (user: User) => {
    setPending(isSelf(user) ? { kind: 'own-password' } : { kind: 'password', user })
  }
  const openActive = (user: User) => {
    setPending({ kind: 'active', user })
  }

  /** What the ⋮ menu of an account offers (besides View and Edit). */
  const actionsFor = (user: User): RowAction[] => [
    ...(isSelf(user)
      ? [
          {
            label: 'Change Password',
            onSelect: () => {
              openPassword(user)
            },
          },
        ]
      : canPassword
        ? [
            {
              label: 'Set Password',
              onSelect: () => {
                openPassword(user)
              },
            },
          ]
        : []),
    ...(canDisable && !isSelf(user)
      ? [
          {
            label: user.isActive ? 'Disable' : 'Enable',
            variant: user.isActive ? ('destructive' as const) : ('default' as const),
            onSelect: () => {
              openActive(user)
            },
          },
        ]
      : []),
  ]

  const dialogs = (() => {
    if (!pending) return null
    if (pending.kind === 'own-password') return <ChangePasswordDialog onClose={close} />
    const { user } = pending
    if (pending.kind === 'password') return <SetPasswordDialog user={user} onClose={close} />
    return user.isActive ? (
      <ConfirmAction
        title={`Disable ${possessive(user.name)} account?`}
        description={`${user.name} can’t sign in until the account is enabled again, and every session they have open ends now. The account and its history are kept.`}
        confirmLabel="Disable Account"
        destructive
        onConfirm={() => {
          setActive.mutate({
            id: user.id,
            active: false,
            rowVersion: user.rowVersion,
            name: user.name,
          })
        }}
        onClose={close}
      />
    ) : (
      <ConfirmAction
        title={`Enable ${possessive(user.name)} account?`}
        description={`${user.name} can sign in again, with the roles the account has.`}
        confirmLabel="Enable Account"
        onConfirm={() => {
          setActive.mutate({
            id: user.id,
            active: true,
            rowVersion: user.rowVersion,
            name: user.name,
          })
        }}
        onClose={close}
      />
    )
  })()

  return {
    isSelf,
    canDisable,
    canPassword,
    actionsFor,
    openPassword,
    openActive,
    dialogs,
  }
}
