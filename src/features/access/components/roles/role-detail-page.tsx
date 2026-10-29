import { useState } from 'react'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { Lock } from 'lucide-react'

import { ErrorState } from '@/components/feedback/error-state'
import { PageSpinner } from '@/components/feedback/spinner'
import { UnsavedChangesDialog } from '@/components/feedback/unsaved-changes-dialog'
import { PageContainer } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard'
import { ApiError } from '@/lib/api-error'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { ACCESS_CODES } from '../../constants'
import { useCatalogue, useRole, useSaveRolePermissions } from '../../hooks/use-access'
import { ROLE_TABS, type RoleSearch, type RoleTab } from '../../routing'
import { tickErrors } from '../../schemas/access-forms.schema'
import type { PermissionDef, RoleDetail, TickInput } from '../../types/access.types'
import { messageOf } from '../../utils/form-errors'
import { formatStamp, plural } from '../../utils/format'
import { countChanges, type Draft, draftOf, draftToTicks } from '../../utils/permission-tree'
import {
  cardClass,
  detailTabClass,
  navyButtonClass,
  outlineButtonClass,
  pageTitleClass,
  toolbarButtonClass,
} from '../../utils/styles'
import { AuditList } from '../shared/audit-list'
import { ConfirmAction } from '../shared/dialogs'
import { BackLink, Chip, Facts, LoadError, LoadingRows, MockModeNote } from '../shared/parts'
import { PermissionEditor } from './permission-editor'
import { RoleUsersTab } from './role-users-tab'
import { useRoleActions } from './use-role-actions'

const routeApi = getRouteApi('/_app/settings/user-group-permissions/$roleId')

const TAB_LABELS: Record<RoleTab, string> = {
  permissions: 'Permissions',
  users: 'Users',
  history: 'History',
}

/** `branch:<id>` → the unit's name, from the role's saved ticks. */
const unitNamesOf = (role: RoleDetail) =>
  new Map(
    role.permissions.flatMap((tick) =>
      tick.units.map((unit) => [`${unit.unitType}:${unit.unitId}`, unit.unitName ?? unit.unitId]),
    ),
  )

/** Field errors of a refused save (`permissions.3.units`) on the ticks they name. */
function serverTickErrors(error: unknown, sent: readonly TickInput[]): Record<string, string> {
  if (!(error instanceof ApiError)) return {}
  const out: Record<string, string> = {}
  for (const [key, message] of Object.entries(error.fieldErrors)) {
    const match = /^permissions\.(\d+)\./.exec(key)
    const tick = match ? sent[Number(match[1])] : undefined
    if (tick) out[tick.code] = message
  }
  return out
}

/**
 * The Permissions tab: the editor over the draft, and the bar under it with the number of
 * changes, Discard and Save (all ticks at once, `PUT …/permissions` with the rowVersion). A tick
 * the API refuses (or Selected units without units) is marked where it is.
 */
function PermissionsTab({
  role,
  catalogue,
  draft,
  saved,
  setDraft,
  readOnly,
  lockReason,
  search,
  update,
}: {
  role: RoleDetail
  catalogue: readonly PermissionDef[]
  draft: Draft
  saved: Draft
  setDraft: (next: Draft | null) => void
  readOnly: boolean
  lockReason: string | null
  search: RoleSearch
  update: (patch: Partial<RoleSearch>) => void
}) {
  const save = useSaveRolePermissions()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [discarding, setDiscarding] = useState(false)
  const changes = countChanges(saved, draft)

  const submit = () => {
    const ticks = draftToTicks(draft, catalogue)
    const invalid = tickErrors(ticks)
    setErrors(invalid)
    setFailure(null)
    const count = Object.keys(invalid).length
    if (count > 0) {
      setFailure(
        `${plural(count, 'tick')} with Selected units ${count === 1 ? 'needs' : 'need'} at least one unit.`,
      )
      return
    }
    save.mutate(
      { id: role.id, ticks, rowVersion: role.rowVersion },
      {
        onSuccess: () => {
          setDraft(null)
          setErrors({})
        },
        onError: (error) => {
          setErrors(serverTickErrors(error, ticks))
          setFailure(
            error.status === 409 && error.code === 'STALE_ROW'
              ? 'Someone else changed this role while you were editing. Your ticks are kept: Save again to replace theirs, or Discard to see them.'
              : messageOf(error),
          )
        },
      },
    )
  }

  return (
    <div className="grid gap-4">
      {lockReason && (
        <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-field-foreground">
          <Lock aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          {lockReason}
        </p>
      )}
      <PermissionEditor
        catalogue={catalogue}
        draft={draft}
        onChange={(next) => {
          setDraft(next)
          setFailure(null)
        }}
        readOnly={readOnly}
        q={search.q}
        tickedOnly={search.ticked === true}
        onFilter={(patch) => {
          update(patch)
        }}
        errors={errors}
        unitNames={unitNamesOf(role)}
      />
      {!readOnly && (
        <div
          role="region"
          aria-label="Save permissions"
          className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t border-border bg-card px-4 py-3 sm:-mx-6 sm:px-6"
        >
          <p className="mr-auto text-xs text-title" aria-live="polite">
            {changes === 0 ? 'No unsaved changes' : plural(changes, 'unsaved change')}
            <span className="text-grey"> · {plural(draft.size, 'permission')} ticked</span>
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={changes === 0 || save.isPending}
            onClick={() => {
              setDiscarding(true)
            }}
            className={cn(toolbarButtonClass, outlineButtonClass)}
          >
            Discard
          </Button>
          <Button
            type="button"
            disabled={changes === 0 || save.isPending}
            onClick={submit}
            className={cn(toolbarButtonClass, navyButtonClass)}
          >
            Save Permissions
          </Button>
          {failure && (
            <p role="alert" className="basis-full text-xs text-destructive">
              {failure}
            </p>
          )}
        </div>
      )}
      {discarding && (
        <ConfirmAction
          title={`Discard ${plural(changes, 'change')}?`}
          description={`The ticks go back to ${role.name} as saved.`}
          confirmLabel="Discard Changes"
          destructive
          onConfirm={() => {
            setDraft(null)
            setErrors({})
            setFailure(null)
          }}
          onClose={() => {
            setDiscarding(false)
          }}
        />
      )}
    </div>
  )
}

/** A role's page once read: header, tabs and the draft of its ticks. */
function RoleView({ role }: { role: RoleDetail }) {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const goTo = useNavigate()
  const catalogue = useCatalogue()
  const canTick = useCan(ACCESS_CODES.rolesPermissions)
  const actions = useRoleActions({
    onDeleted: () => {
      void goTo({ to: '/settings/user-group-permissions' })
    },
  })
  // `null` while nothing is changed: the role as saved shows.
  const [draft, setDraft] = useState<Draft | null>(null)
  const saved = draftOf(role.permissions)
  const current = draft ?? saved
  const changes = draft ? countChanges(saved, draft) : 0
  const guard = useUnsavedChangesGuard(changes > 0)

  const update = (patch: Partial<RoleSearch>) => {
    void navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true })
  }

  // A system role that holds every tick is the administrators' role: copy it to change it.
  const holdsAll =
    role.isSystem && catalogue.data !== undefined && role.permissionCount >= catalogue.data.length
  const lockReason = holdsAll
    ? `${role.name} always holds every permission. Copy it to make a role you can change.`
    : !canTick
      ? 'You can see these ticks but not change them.'
      : null

  return (
    <PageContainer>
      <BackLink to="/settings/user-group-permissions" label="User Group Permissions" />
      <header className={cn(cardClass, '@container grid gap-4 px-4 py-4 sm:px-6')}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid min-w-0 gap-1">
            <h1 className={cn(pageTitleClass, 'break-words')}>{role.name}</h1>
            <span className="flex flex-wrap items-center gap-1.5">
              {role.isSystem && <Chip tone="navy">System role</Chip>}
              {role.isActive ? <Chip tone="green">In use</Chip> : <Chip tone="grey">Retired</Chip>}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {actions.actionsFor(role).map((action) => (
              <Button
                key={action.label}
                variant="outline"
                onClick={action.onSelect}
                className={cn(
                  toolbarButtonClass,
                  outlineButtonClass,
                  action.variant === 'destructive' &&
                    'border-destructive text-destructive hover:bg-destructive/5 dark:border-destructive dark:text-destructive',
                )}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </div>
        <p className="text-sm text-field-foreground">{role.description ?? 'No description.'}</p>
        <Facts
          label="Role"
          items={[
            { label: 'Users', value: plural(role.userCount, 'person', 'people') },
            { label: 'Permissions', value: plural(role.permissionCount, 'permission') },
            { label: 'Code', value: role.code },
            { label: 'Created', value: formatStamp(role.createdAt) },
            { label: 'Updated', value: formatStamp(role.updatedAt) },
          ]}
        />
        {role.isSystem && (
          <p className="text-xs text-muted-foreground">
            System role: its name is fixed, and it can’t be retired or deleted.
          </p>
        )}
        <MockModeNote />
      </header>

      <Tabs
        value={search.tab}
        onValueChange={(next) => {
          const tab = ROLE_TABS.find((item) => item === next)
          if (tab) update({ tab })
        }}
        className="min-w-0 gap-0 rounded-xl bg-card shadow-xs"
      >
        <TabsList
          aria-label="Role details"
          className="relative flex scrollbar-thin h-auto w-full max-w-none justify-start gap-6 overflow-x-auto rounded-none border-b bg-transparent px-4 py-0 sm:px-6"
        >
          {ROLE_TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab} className={detailTabClass}>
              {TAB_LABELS[tab]}
              {tab === 'permissions' && changes > 0 && (
                <span className="ml-1 rounded-full bg-[#D83838] px-1.5 text-[0.625rem] text-white">
                  {changes}
                  <span className="sr-only"> unsaved</span>
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="@container min-w-0 px-4 pt-4 sm:px-6 sm:pt-6">
          <TabsContent value="permissions">
            {catalogue.isError ? (
              <LoadError
                error={catalogue.error}
                what="the permission catalogue"
                onRetry={() => void catalogue.refetch()}
              />
            ) : catalogue.isPending ? (
              <LoadingRows label="the permission catalogue" rows={6} />
            ) : (
              <PermissionsTab
                role={role}
                catalogue={catalogue.data}
                draft={current}
                saved={saved}
                setDraft={setDraft}
                readOnly={lockReason !== null}
                lockReason={lockReason}
                search={search}
                update={update}
              />
            )}
          </TabsContent>
          <TabsContent value="users" className="pb-4 sm:pb-6">
            <RoleUsersTab
              role={role}
              page={search.usersPage}
              onPageChange={(usersPage) => {
                update({ usersPage })
              }}
            />
          </TabsContent>
          <TabsContent value="history" className="pb-4 sm:pb-6">
            <AuditList
              entity="role"
              entityId={role.id}
              page={search.historyPage}
              onPageChange={(historyPage) => {
                update({ historyPage })
              }}
            />
          </TabsContent>
        </div>
      </Tabs>
      {actions.dialogs}
      <UnsavedChangesDialog guard={guard} />
    </PageContainer>
  )
}

/**
 * One role: the header (system badge, users, permissions, Edit, Copy, Retire / Restore,
 * Delete) and the tabs Permissions (the editor), Users and History. Leaving with unsaved ticks
 * asks first. `?tab=`, the catalogue's search and the pages live in the URL.
 */
export function RoleDetailPage() {
  const { roleId } = routeApi.useParams()
  const record = useRole(roleId)
  const back = <BackLink to="/settings/user-group-permissions" label="User Group Permissions" />

  if (record.isPending) {
    return (
      <PageContainer>
        {back}
        <PageSpinner label="Loading the role" />
      </PageContainer>
    )
  }
  if (record.isError) {
    const missing = record.error instanceof ApiError && record.error.isNotFound
    return (
      <PageContainer>
        {back}
        <ErrorState
          title={missing ? 'Role not found' : 'Could not load the role'}
          message={missing ? 'This role does not exist or was deleted.' : record.error.message}
          {...(missing ? {} : { onRetry: () => void record.refetch() })}
        />
      </PageContainer>
    )
  }
  // A new role (after Copy) starts its own draft.
  return <RoleView key={record.data.id} role={record.data} />
}
