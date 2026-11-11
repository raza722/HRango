import { useId, useState } from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'

import { EmployeeAvatar } from '@/components/layout'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import { VISIBILITY_OPTIONS, WORKSPACE_DESCRIPTION_MAX, WORKSPACE_NAME_MAX } from '../../constants'
import {
  useDepartments,
  usePeople,
  usePmLookups,
  usePmTemplates,
  useSaveWorkspaceSettings,
} from '../../hooks/use-pm'
import type { PmAccess } from '../../hooks/use-pm-access'
import type {
  OrganizerFeature,
  PmTemplates,
  StatusesInput,
  TaskStatus,
  ViewsDraft,
  Visibility,
  Workspace,
  WorkspaceDetailsInput,
  WorkspaceSettingsInput,
  WorkspaceSetup,
} from '../../types/pm.types'
import { SetupSummary } from '../create-workspace/customize-step'
import { DetailCloseLabelContext } from '../create-workspace/detail-close-label'
import { EmployeePickerDialog } from '../create-workspace/employee-picker-dialog'
import { OrganizerPage } from '../create-workspace/organizer-page'
import { StatusesPage } from '../create-workspace/statuses-page'
import { TemplatesContext } from '../create-workspace/templates-context'
import { ViewsPage } from '../create-workspace/views-page'
import {
  CancelButton,
  CloseButton,
  DoneButton,
  FormError,
  RadioMark,
} from '../create-workspace/wizard-controls'
import {
  type DetailPage,
  EMPTY_LIBRARY,
  type StatusLibrary,
} from '../create-workspace/wizard-state'
import { wz } from '../create-workspace/wizard-styles'
import { DepartmentField } from '../create-workspace/workflow-step'

const NO_TEMPLATES: PmTemplates = { workflows: [], statusTemplates: [] }
const CLOSE_LABEL = 'Close Workspace Settings'

/** API field names of the settings' errors → the field they belong to. */
const FIELD_OF_API: Record<string, keyof WorkspaceDetailsInput> = {
  name: 'name',
  description: 'description',
  privacy: 'visibility',
  ownerId: 'ownerId',
  departmentId: 'departmentId',
}

/**
 * Workspace Settings: what a workspace was created with, changed afterwards. Details (name,
 * description, owner, department, who can see it), and the wizard's own Default Views, Edit
 * Statuses and Organizer pages. Only what changed is saved (`PUT /workspaces/{id}`,
 * `/statuses`, `/features`, and the views). Admins and HR open it; only a workspace admin may
 * hand the workspace to another owner.
 */
export function WorkspaceSettingsDialog({
  open,
  onOpenChange,
  workspace,
  access,
  onDelete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspace: Workspace
  access: PmAccess
  /** Opens the delete confirmation (shown only to workspace admins). */
  onDelete?: (() => void) | undefined
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={wz.overlay} />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={wz.modal}
          onEscapeKeyDown={(event) => {
            // Escape inside an inline editor (a status name) cancels the edit, not the dialog.
            if (event.target instanceof Element && event.target.closest('[data-escape-local]')) {
              event.preventDefault()
            }
          }}
        >
          <DialogPrimitive.Title asChild>
            <span className="sr-only">Workspace Settings</span>
          </DialogPrimitive.Title>
          {open && (
            <SettingsBody
              workspace={workspace}
              access={access}
              onDelete={onDelete}
              onClose={() => {
                onOpenChange(false)
              }}
            />
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

const sameList = <T,>(a: readonly T[], b: readonly T[]) =>
  a.length === b.length && a.every((value, index) => value === b[index])
const sameSet = <T,>(a: readonly T[], b: readonly T[]) =>
  a.length === b.length && a.every((value) => b.includes(value))
const statusKey = (status: TaskStatus) =>
  `${status.id}|${status.name}|${status.color}|${status.group}`

function SettingsBody({
  workspace,
  access,
  onDelete,
  onClose,
}: {
  workspace: Workspace
  access: PmAccess
  onDelete?: (() => void) | undefined
  onClose: () => void
}) {
  const templates = usePmTemplates()
  const departments = useDepartments()
  const lookups = usePmLookups()
  const people = usePeople()
  const save = useSaveWorkspaceSettings()

  const initial: WorkspaceDetailsInput = {
    name: workspace.name,
    description: workspace.description,
    visibility: workspace.visibility,
    ownerId: workspace.ownerId,
    departmentId: workspace.departmentId ?? '',
  }
  const [details, setDetails] = useState<WorkspaceDetailsInput>(initial)
  const [setup, setSetup] = useState<WorkspaceSetup>(workspace.setup)
  const [library, setLibrary] = useState<StatusLibrary>(EMPTY_LIBRARY)
  const [page, setPage] = useState<DetailPage | null>(null)
  const [returnTo, setReturnTo] = useState<DetailPage | null>(null)
  const [errors, setErrors] = useState<Partial<Record<keyof WorkspaceDetailsInput, string>>>({})
  const [rootError, setRootError] = useState<string | undefined>()
  const [pickingOwner, setPickingOwner] = useState(false)
  const ids = { name: useId(), description: useId(), owner: useId(), visibility: useId() }

  const templateData = templates.data ?? NO_TEMPLATES
  const change = <K extends keyof WorkspaceDetailsInput>(
    key: K,
    value: WorkspaceDetailsInput[K],
  ) => {
    setDetails((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
    setRootError(undefined)
  }
  const closePage = () => {
    setReturnTo(page)
    setPage(null)
  }

  // --- what changed -------------------------------------------------------------------------
  const detailsChanged =
    details.name.trim() !== initial.name ||
    details.description.trim() !== initial.description.trim() ||
    details.visibility !== initial.visibility ||
    details.ownerId !== initial.ownerId ||
    details.departmentId !== initial.departmentId
  const viewsChanged =
    !sameSet(setup.views, workspace.setup.views) ||
    setup.defaultView !== workspace.setup.defaultView
  const statusesChanged =
    setup.statusMode !== workspace.setup.statusMode ||
    !sameList(setup.statuses.map(statusKey), workspace.setup.statuses.map(statusKey))
  const organizerChanged = !sameSet(setup.organizer, workspace.setup.organizer)
  const changed = detailsChanged || viewsChanged || statusesChanged || organizerChanged

  /**
   * The statuses as the API takes them: a status the workspace already has keeps its id; one
   * from a template that matches a current status by name takes that status's id (so its tasks
   * stay in it); any other is new (`st_new_…`, sent without an id).
   */
  const statusesInput = (): StatusesInput => {
    const own = new Set(workspace.setup.statuses.map((status) => status.id))
    const byName = new Map(
      workspace.setup.statuses.map((status) => [status.name.trim().toLowerCase(), status.id]),
    )
    return {
      statusMode: setup.statusMode,
      statusTemplate: setup.statusTemplate,
      statuses: setup.statuses.map((status, index) => ({
        ...status,
        id: own.has(status.id)
          ? status.id
          : (byName.get(status.name.trim().toLowerCase()) ?? `st_new_${String(index)}`),
      })),
    }
  }

  const validate = (): boolean => {
    const next: Partial<Record<keyof WorkspaceDetailsInput, string>> = {}
    const name = details.name.trim()
    if (name.length < 3 || name.length > WORKSPACE_NAME_MAX) {
      next.name = `Use 3 to ${String(WORKSPACE_NAME_MAX)} characters`
    }
    if (!details.ownerId) next.ownerId = 'Choose the workspace owner'
    if (!details.departmentId) next.departmentId = 'Select the department'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const submit = async () => {
    if (!validate()) return
    const input: WorkspaceSettingsInput = {
      ...(detailsChanged ? { details } : {}),
      ...(statusesChanged ? { statuses: statusesInput() } : {}),
      ...(organizerChanged ? { organizer: setup.organizer } : {}),
      ...(viewsChanged
        ? { views: { views: setup.views, defaultView: setup.defaultView } satisfies ViewsDraft }
        : {}),
    }
    try {
      await save.mutateAsync({ workspace, input })
      onClose()
    } catch (error) {
      if (!(error instanceof ApiError)) {
        setRootError('Could not save the settings. Try again.')
        return
      }
      const fieldErrors: typeof errors = {}
      for (const [field, message] of Object.entries(error.fieldErrors)) {
        const key = FIELD_OF_API[field]
        if (key) fieldErrors[key] = message
      }
      setErrors(fieldErrors)
      // A status still in use, a stale version, a refusal: said under the form.
      setRootError(Object.keys(fieldErrors).length > 0 ? undefined : error.message)
    }
  }

  // --- the wizard's pages, over this dialog ----------------------------------------------------
  if (page) {
    return (
      <TemplatesContext value={templateData}>
        <DetailCloseLabelContext value={CLOSE_LABEL}>
          {page === 'views' ? (
            <ViewsPage
              template={workspace.template}
              setup={setup}
              onSave={(draft) => {
                setSetup((current) => ({ ...current, ...draft }))
                closePage()
              }}
              onDiscard={closePage}
              onClose={onClose}
            />
          ) : page === 'statuses' ? (
            <StatusesPage
              template={workspace.template}
              statusMode={setup.statusMode}
              statuses={setup.statuses}
              library={library}
              onSave={(result, nextLibrary) => {
                setLibrary(nextLibrary)
                setSetup((current) => ({ ...current, ...result }))
                closePage()
              }}
              onDiscard={closePage}
              onClose={onClose}
            />
          ) : (
            <OrganizerPage
              template={workspace.template}
              organizer={setup.organizer}
              onSave={(organizer: OrganizerFeature[]) => {
                setSetup((current) => ({ ...current, organizer }))
                closePage()
              }}
              onDiscard={closePage}
              onClose={onClose}
            />
          )}
        </DetailCloseLabelContext>
      </TemplatesContext>
    )
  }

  const owner = people.get(details.ownerId)
  const loading = templates.isPending || departments.isPending || lookups.isPending
  const sectionTitle =
    'text-lg leading-snug font-semibold text-[#262626] sm:text-[1.25rem] sm:leading-[1.875rem]'

  return (
    <TemplatesContext value={templateData}>
      <header className={cn(wz.gutter, 'relative shrink-0 pt-5 pr-14 sm:pt-[1.875rem]')}>
        <h2 className={wz.title}>Workspace Settings</h2>
        <p className={cn(wz.intro, 'mt-1 max-w-[50rem]')}>
          Change how <span className="font-medium">{workspace.name}</span> is set up. Members are
          managed with Invite Members on the workspace page.
        </p>
        <CloseButton
          label={CLOSE_LABEL}
          onClick={onClose}
          className="absolute top-4 right-3 sm:top-[1.9375rem] sm:right-[1.9375rem]"
        />
      </header>

      <div className={cn(wz.body, wz.gutter, wz.scrollbar, 'pt-6 pb-4 sm:pt-8')}>
        {loading ? (
          <div aria-busy="true" aria-label="Loading" className="grid gap-5">
            <Skeleton className="h-16 w-full bg-white" />
            <Skeleton className="h-40 w-full bg-white" />
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            <section aria-labelledby={`${ids.name}-details`} className="flex flex-col gap-5">
              <h3 id={`${ids.name}-details`} className={sectionTitle}>
                Details
              </h3>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="min-w-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <label htmlFor={ids.name} className={wz.label}>
                      Workspace Name
                    </label>
                    <span
                      className={cn(
                        wz.counter,
                        details.name.length >= WORKSPACE_NAME_MAX - 5 && wz.counterFull,
                      )}
                    >
                      {details.name.length}/{WORKSPACE_NAME_MAX}
                    </span>
                  </div>
                  <input
                    id={ids.name}
                    value={details.name}
                    maxLength={WORKSPACE_NAME_MAX}
                    autoComplete="off"
                    aria-invalid={errors.name ? true : undefined}
                    onChange={(event) => {
                      change('name', event.target.value)
                    }}
                    className={cn(
                      wz.field,
                      wz.fieldFocus,
                      wz.value,
                      'mt-2 min-h-[3.5rem] w-full px-5 outline-none',
                      errors.name && wz.fieldInvalid,
                    )}
                  />
                  <FormError message={errors.name} />
                </div>

                <div className="min-w-0">
                  <span id={ids.owner} className={wz.label}>
                    Workspace Owner
                  </span>
                  <button
                    type="button"
                    disabled={!access.changeOwner}
                    aria-labelledby={ids.owner}
                    aria-describedby={access.changeOwner ? undefined : `${ids.owner}-hint`}
                    onClick={() => {
                      setPickingOwner(true)
                    }}
                    className={cn(
                      wz.field,
                      wz.fieldFocus,
                      'mt-2 flex min-h-[3.5rem] w-full items-center gap-3 px-4 text-left outline-none disabled:cursor-not-allowed disabled:opacity-80',
                      errors.ownerId && wz.fieldInvalid,
                    )}
                  >
                    {owner && (
                      <EmployeeAvatar
                        name={owner.name}
                        photoUrl={owner.photoUrl}
                        className="size-9"
                        fallbackClassName="bg-[#7127EA] text-[#C9BCFF]"
                      />
                    )}
                    <span className={cn(wz.value, 'min-w-0 flex-1 truncate')}>
                      {owner?.name ?? workspace.ownerName ?? 'Choose the owner'}
                    </span>
                    {access.changeOwner && (
                      <span className="text-sm font-medium text-[#7127EA]">Change</span>
                    )}
                  </button>
                  {!access.changeOwner && (
                    <p id={`${ids.owner}-hint`} className="mt-1.5 text-xs text-[#707070]">
                      Only a workspace admin can hand the workspace to another owner.
                    </p>
                  )}
                  <FormError message={errors.ownerId} />
                  <EmployeePickerDialog
                    open={pickingOwner}
                    onOpenChange={setPickingOwner}
                    title="Choose Workspace Owner"
                    showTitle
                    confirmLabel="Select Owner"
                    employees={lookups.data?.employees ?? []}
                    multiple={false}
                    selected={details.ownerId ? [details.ownerId] : []}
                    onConfirm={(chosen) => {
                      if (chosen[0]) change('ownerId', chosen[0])
                    }}
                  />
                </div>

                <div className="min-w-0 md:col-span-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <label htmlFor={ids.description} className={wz.label}>
                      Description (Optional)
                    </label>
                    <span
                      className={cn(
                        wz.counter,
                        details.description.length >= WORKSPACE_DESCRIPTION_MAX - 20 &&
                          wz.counterFull,
                      )}
                    >
                      {details.description.length}/{WORKSPACE_DESCRIPTION_MAX}
                    </span>
                  </div>
                  <textarea
                    id={ids.description}
                    value={details.description}
                    rows={3}
                    maxLength={WORKSPACE_DESCRIPTION_MAX}
                    placeholder="What this workspace is for"
                    onChange={(event) => {
                      change('description', event.target.value)
                    }}
                    className={cn(
                      wz.field,
                      wz.fieldFocus,
                      wz.value,
                      'mt-2 w-full resize-none px-5 py-3 outline-none',
                    )}
                  />
                </div>

                <div className="min-w-0 md:col-span-2">
                  <DepartmentField
                    departments={departments.data ?? []}
                    value={details.departmentId || null}
                    error={errors.departmentId}
                    onChange={(id) => {
                      change('departmentId', id)
                    }}
                    title="Department"
                    titleClassName={wz.label}
                  />
                </div>

                <fieldset className="min-w-0 md:col-span-2">
                  <legend id={ids.visibility} className={wz.label}>
                    Who can see this workspace
                  </legend>
                  <div
                    role="radiogroup"
                    aria-labelledby={ids.visibility}
                    className="mt-2 grid gap-3 lg:grid-cols-3"
                  >
                    {VISIBILITY_OPTIONS.map((option) => {
                      const checked = details.visibility === option.value
                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="radio"
                          aria-checked={checked}
                          onClick={() => {
                            change('visibility', option.value satisfies Visibility)
                          }}
                          className={cn(
                            'flex items-start gap-3 rounded-[1.125rem] border border-transparent bg-white p-4 text-left outline-none hover:bg-[#FAF8FF] focus-visible:ring-2 focus-visible:ring-[#A181FF]',
                            checked && 'border-[#7127EA] bg-[#F5F0FE] hover:bg-[#F5F0FE]',
                          )}
                        >
                          <span className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className={wz.optionTitle}>{option.title}</span>
                            <span className="text-sm leading-snug text-[#5D5D5D]">
                              {option.text}
                            </span>
                          </span>
                          <RadioMark checked={checked} className="mt-0.5" />
                        </button>
                      )
                    })}
                  </div>
                </fieldset>
              </div>
            </section>

            <section aria-labelledby={`${ids.name}-workflow`} className="flex flex-col gap-4">
              <div>
                <h3 id={`${ids.name}-workflow`} className={sectionTitle}>
                  Workflow
                </h3>
                <p className="mt-1 text-sm text-[#5D5D5D]">
                  Based on the {workspace.templateName || 'chosen'} template. A status that tasks
                  still use cannot be removed until they move to another one.
                </p>
              </div>
              <SetupSummary
                setup={setup}
                onOpenPage={(next) => {
                  setPage(next)
                  setRootError(undefined)
                }}
                returnTo={returnTo}
              />
            </section>

            {onDelete && (
              <section
                aria-labelledby={`${ids.name}-danger`}
                className="flex flex-wrap items-center justify-between gap-4 rounded-[1.125rem] border border-[#F5C2C7] bg-white p-5"
              >
                <div className="min-w-0">
                  <h3 id={`${ids.name}-danger`} className="text-base font-semibold text-[#B7192C]">
                    Delete this workspace
                  </h3>
                  <p className="mt-1 text-sm text-[#5D5D5D]">
                    Deletes the workspace with its folders, lists, tasks, docs and comments, for
                    everyone.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onDelete}
                  className="inline-flex h-10 items-center rounded-xl border border-[#B7192C] px-4 text-sm font-semibold text-[#B7192C] hover:bg-[#FDECEE]"
                >
                  Delete Workspace
                </button>
              </section>
            )}
          </div>
        )}
      </div>

      <footer className={cn(wz.gutter, 'shrink-0')}>
        <FormError message={rootError} />
        <div className={wz.footer}>
          <CancelButton onClick={onClose} />
          <DoneButton
            disabled={!changed || save.isPending || loading}
            aria-busy={save.isPending || undefined}
            onClick={() => {
              void submit()
            }}
            className="disabled:cursor-not-allowed disabled:opacity-60"
          >
            {save.isPending ? 'Saving…' : 'Save Changes'}
          </DoneButton>
        </div>
      </footer>
    </TemplatesContext>
  )
}
