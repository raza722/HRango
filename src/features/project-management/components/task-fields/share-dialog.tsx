import { useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

import { EmployeeAvatar } from '@/components/layout'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

import { usePeople, usePmLookups, useSaveShare, useShare } from '../../hooks/use-pm'
import { pmButton, pmCloseButton } from '../../pm-styles'
import type { ShareAccess, ShareEntity, ShareSettings } from '../../types/pm.types'
import { CloseIcon } from '../comments/comment-icons'
import { SHARE_ACCESS_LABELS, SHARE_PROPERTIES } from './share-options'

export interface ShareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The task, list or workspace being shared. */
  entityType: ShareEntity
  entityId: string
  targetName: string
  /** Saving needs `projects.sharing.edit` and a manager's workspace role; others read it. */
  canEdit?: boolean
}

/** "Sharing & Permissions" of a task or list (`GET` / `PUT /projects/shares`). */
export function ShareDialog({
  open,
  onOpenChange,
  entityType,
  entityId,
  targetName,
  canEdit = true,
}: ShareDialogProps) {
  const share = useShare(entityType, open ? entityId : null)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showClose={false}
        className="max-w-[40rem] gap-0 rounded-[1.125rem] bg-white p-0 text-[#4A4A4A]"
      >
        <header className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
          <div className="min-w-0">
            <DialogTitle className="text-lg font-semibold text-[#393636]">
              Sharing & Permissions
            </DialogTitle>
            <DialogDescription className="truncate text-sm text-[#626262]">
              {targetName}
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={() => {
              onOpenChange(false)
            }}
            aria-label="Close sharing"
            className={pmCloseButton}
          >
            <CloseIcon className="size-3.5" />
          </button>
        </header>
        {share.isPending && <p className="px-6 pb-6 text-sm text-[#626262]">Loading sharing…</p>}
        {share.isError && (
          <p role="alert" className="px-6 pb-6 text-sm text-[#B7192C]">
            Could not load the sharing settings. {share.error.message}
          </p>
        )}
        {share.isSuccess && (
          <ShareForm
            key={entityId}
            initial={share.data}
            canEdit={canEdit}
            onDone={() => {
              onOpenChange(false)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

const email = z.email()
const sectionTitle = 'text-sm font-semibold text-[#4A4A4A]'

function ShareForm({
  initial,
  canEdit,
  onDone,
}: {
  initial: ShareSettings
  canEdit: boolean
  onDone: () => void
}) {
  const save = useSaveShare()
  const lookups = usePmLookups()
  const people = usePeople()
  const [draft, setDraft] = useState<ShareSettings>(initial)
  const [invite, setInvite] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<ShareSettings>) => {
    setDraft((previous) => ({ ...previous, ...patch }))
  }

  const sharedIds = new Set(draft.people.map((entry) => entry.employeeId))
  const candidates = (lookups.data?.employees ?? []).filter(
    (person) =>
      !sharedIds.has(person.id) &&
      search.trim() !== '' &&
      person.name.toLowerCase().includes(search.trim().toLowerCase()),
  )
  // The API's private link has no page yet; it is shown once the settings are saved.
  const link = draft.link ? new URL(draft.link, window.location.origin).href : null
  const everything = SHARE_PROPERTIES.every((property) => draft.properties.includes(property.id))

  const addInvite = () => {
    const value = invite.trim().toLowerCase()
    if (!email.safeParse(value).success) {
      setInviteError('Enter a valid email')
      return
    }
    if (draft.invitedEmails.includes(value)) {
      setInviteError('That email is already invited')
      return
    }
    set({ invitedEmails: [...draft.invitedEmails, value] })
    setInvite('')
    setInviteError(null)
  }

  const submit = () => {
    if (draft.linkEnabled && draft.validFrom && draft.validTo && draft.validFrom > draft.validTo) {
      setError('Expire at must be after Begin at')
      return
    }
    setError(null)
    save.mutate(draft, {
      onSuccess: onDone,
      onError: (failure) => {
        setError(failure.message)
      },
    })
  }

  return (
    <form
      className="flex min-h-0 flex-col"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <div className="flex min-h-0 flex-col gap-5 overflow-y-auto px-6 pb-4">
        <fieldset className="flex flex-col gap-2">
          <legend className={sectionTitle}>Share as</legend>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['list', 'Share as a Single List View'],
                ['page', 'Share as a Whole Page'],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm',
                  draft.scope === value
                    ? 'border-[#7127EA] bg-[#F0E9FD] text-[#7127EA]'
                    : 'border-[#E9E9E9] text-[#4A4A4A]',
                )}
              >
                <input
                  type="radio"
                  name="share-scope"
                  value={value}
                  checked={draft.scope === value}
                  onChange={() => {
                    set({ scope: value })
                  }}
                  className="accent-[#7127EA]"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-2">
          <label htmlFor="share-invite" className={sectionTitle}>
            Invite from email
          </label>
          <div className="flex gap-2">
            <input
              id="share-invite"
              type="email"
              value={invite}
              onChange={(event) => {
                setInvite(event.target.value)
                setInviteError(null)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addInvite()
                }
              }}
              placeholder="Enter email address"
              aria-invalid={inviteError !== null}
              aria-describedby={inviteError ? 'share-invite-error' : undefined}
              className="h-10 min-w-0 flex-1 rounded-xl border border-[#E9E9E9] px-3 text-sm outline-none focus:border-[#7127EA]"
            />
            <button
              type="button"
              onClick={addInvite}
              className={cn(pmButton.primary, 'h-10 rounded-xl px-5 text-sm')}
            >
              Invite
            </button>
          </div>
          {inviteError && (
            <p id="share-invite-error" role="alert" className="text-xs text-[#DC3545]">
              {inviteError}
            </p>
          )}
          {draft.invitedEmails.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Invited emails">
              {draft.invitedEmails.map((address) => (
                <li
                  key={address}
                  className="flex items-center gap-2 rounded-full bg-[#EEE7FF] py-1 pr-1 pl-3 text-xs text-[#4A4A4A]"
                >
                  {address}
                  <button
                    type="button"
                    aria-label={`Remove ${address}`}
                    onClick={() => {
                      set({
                        invitedEmails: draft.invitedEmails.filter((entry) => entry !== address),
                      })
                    }}
                    className="flex size-5 items-center justify-center rounded-full text-[#DC3545] hover:bg-white"
                  >
                    <CloseIcon className="size-2.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <h3 className={sectionTitle}>Share With</h3>
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
            }}
            placeholder="Search employee here..."
            aria-label="Search employee to share with"
            className="h-10 rounded-full px-4 text-xs shadow-[0_0_12.95px_rgba(0,0,0,0.12)] outline-none"
          />
          {candidates.length > 0 && (
            <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-xl border border-[#E9E9E9] p-1">
              {candidates.map((person) => (
                <li key={person.id}>
                  <button
                    type="button"
                    onClick={() => {
                      set({
                        people: [...draft.people, { employeeId: person.id, access: 'limited' }],
                      })
                      setSearch('')
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-[#F0E9FD]"
                  >
                    <EmployeeAvatar
                      name={person.name}
                      photoUrl={person.photoUrl}
                      className="size-7"
                    />
                    <span className="min-w-0 flex-1 truncate">{person.name}</span>
                    <span className="text-xs text-[#9D9D9D]">{person.designation}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <ul className="flex flex-col gap-1" aria-label="People with access">
            {draft.people.length === 0 && (
              <li className="text-xs text-[#9D9D9D]">
                Only the Workspace Owner and Space Creator can see this.
              </li>
            )}
            {draft.people.map((entry) => {
              const person = people.get(entry.employeeId)
              return (
                <li
                  key={entry.employeeId}
                  className="flex items-center gap-2 rounded-xl bg-[#F8F8F8] px-2 py-1.5"
                >
                  <EmployeeAvatar
                    name={person?.name ?? 'Someone'}
                    photoUrl={person?.photoUrl ?? null}
                    className="size-8"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {person?.name ?? entry.employeeId}
                  </span>
                  <label className="sr-only" htmlFor={`access-${entry.employeeId}`}>
                    Access for {person?.name}
                  </label>
                  <select
                    id={`access-${entry.employeeId}`}
                    value={entry.access}
                    onChange={(event) => {
                      const access = event.target.value as ShareAccess
                      set({
                        people: draft.people.map((other) =>
                          other.employeeId === entry.employeeId ? { ...other, access } : other,
                        ),
                      })
                    }}
                    className="h-8 rounded-lg border border-[#E9E9E9] bg-white px-2 text-xs text-[#4A4A4A]"
                  >
                    {Object.entries(SHARE_ACCESS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    aria-label={`Remove ${person?.name ?? 'person'}`}
                    onClick={() => {
                      set({
                        people: draft.people.filter(
                          (other) => other.employeeId !== entry.employeeId,
                        ),
                      })
                    }}
                    className="flex size-7 items-center justify-center rounded-lg text-[#DC3545] hover:bg-[#FDECEE]"
                  >
                    <CloseIcon className="size-2.5" />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-[#E9E9E9] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className={sectionTitle}>Private link</h3>
              <p className="text-xs text-[#9D9D9D]">Only people with access can open it.</p>
            </div>
            <button
              type="button"
              disabled={!link}
              title={link ? undefined : 'Save the sharing settings first'}
              onClick={() => {
                if (!link) return
                void navigator.clipboard
                  .writeText(link)
                  .then(() => toast.success('Private link copied'))
                  .catch(() => toast.error('Could not copy the link'))
              }}
              className={cn(pmButton.back, 'h-9 rounded-xl px-4 text-xs disabled:opacity-50')}
            >
              Copy private link
            </button>
          </div>
          <label className="flex items-center justify-between gap-3 text-sm">
            Share link with anyone
            <Switch
              checked={draft.linkEnabled}
              onCheckedChange={(linkEnabled) => {
                set({ linkEnabled })
              }}
            />
          </label>
          {draft.linkEnabled && (
            <div className="flex flex-col gap-3">
              <fieldset className="grid gap-3 sm:grid-cols-2">
                <legend className="mb-1 text-xs font-semibold text-[#4A4A4A]">
                  Validity Period
                </legend>
                <label className="flex flex-col gap-1 text-xs text-[#626262]">
                  Begin at
                  <input
                    type="datetime-local"
                    value={draft.validFrom ?? ''}
                    onChange={(event) => {
                      set({ validFrom: event.target.value || null })
                    }}
                    className="h-9 rounded-lg border border-[#E9E9E9] px-2 text-sm text-[#4A4A4A]"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-[#626262]">
                  Expire at
                  <input
                    type="datetime-local"
                    value={draft.validTo ?? ''}
                    min={draft.validFrom ?? undefined}
                    onChange={(event) => {
                      set({ validTo: event.target.value || null })
                    }}
                    className="h-9 rounded-lg border border-[#E9E9E9] px-2 text-sm text-[#4A4A4A]"
                  />
                </label>
              </fieldset>
              <label className="flex items-center justify-between gap-3 text-sm">
                Number of Access Allowed
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={draft.maxAccess ?? ''}
                  placeholder="No limit"
                  onChange={(event) => {
                    const value = Number.parseInt(event.target.value, 10)
                    set({ maxAccess: Number.isFinite(value) && value > 0 ? value : null })
                  }}
                  className="h-9 w-28 rounded-lg border border-[#E9E9E9] px-2 text-sm"
                />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm">
                Allow Opening Tasks on Clicks
                <Switch
                  checked={draft.allowOpeningTasks}
                  onCheckedChange={(allowOpeningTasks) => {
                    set({ allowOpeningTasks })
                  }}
                />
              </label>
            </div>
          )}
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className={sectionTitle}>Share Tasks Properties</legend>
          <p className="text-xs text-[#626262]">What do you want to display?</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={everything}
                onCheckedChange={(checked) => {
                  set({
                    properties:
                      checked === true
                        ? SHARE_PROPERTIES.map((property) => property.id)
                        : SHARE_PROPERTIES.filter((property) => property.required).map(
                            (property) => property.id,
                          ),
                  })
                }}
              />
              Everything
            </label>
            {SHARE_PROPERTIES.map((property) => (
              <label key={property.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={property.required || draft.properties.includes(property.id)}
                  disabled={property.required}
                  onCheckedChange={(checked) => {
                    set({
                      properties:
                        checked === true
                          ? [...new Set([...draft.properties, property.id])]
                          : draft.properties.filter((id) => id !== property.id),
                    })
                  }}
                />
                {property.label}
              </label>
            ))}
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="text-sm text-[#DC3545]">
            {error}
          </p>
        )}
      </div>
      <footer className="flex justify-end gap-3 border-t border-[#E9E9E9] px-6 py-4">
        <button
          type="button"
          onClick={onDone}
          className={cn(pmButton.cancel, 'h-11 rounded-xl px-6 text-sm')}
        >
          Cancel
        </button>
        {canEdit && (
          <button
            type="submit"
            disabled={save.isPending}
            className={cn(pmButton.save, 'h-11 px-6')}
          >
            Save
          </button>
        )}
      </footer>
    </form>
  )
}
