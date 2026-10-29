import { Ban, ShieldCheck } from 'lucide-react'

import { labelOf, SCOPE_LABELS } from '../../constants'
import { useEffectivePermissions, useOverrides } from '../../hooks/use-access'
import type { EffectivePermission, Override, UserDetail } from '../../types/access.types'
import { plural } from '../../utils/format'
import {
  Chip,
  EmptyNote,
  LoadError,
  LoadingRows,
  SearchBox,
  SectionCard,
  SensitiveChip,
} from '../shared/parts'

type Row =
  { kind: 'held'; permission: EffectivePermission } | { kind: 'denied'; override: Override }

const matches = (text: string, q: string | undefined) =>
  !q || text.toLowerCase().includes(q.trim().toLowerCase())

function SourceChips({ sources }: { sources: readonly string[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {sources.map((source) => (
        <Chip
          key={source}
          tone={source === 'Grant' ? 'green' : source === 'System admin' ? 'violet' : 'navy'}
        >
          {source === 'Grant' ? 'Grant (override)' : source}
        </Chip>
      ))}
    </span>
  )
}

/**
 * What the account may do (`GET /access/users/{id}/permissions`: its roles plus grants minus
 * denials), grouped by module, with where each comes from: a role's name, a grant, system
 * admin. Denials (`GET …/overrides`) show in their module, struck through, with the reason.
 */
export function UserPermissionsTab({
  user,
  q,
  onSearch,
}: {
  user: UserDetail
  q: string | undefined
  onSearch: (q: string | undefined) => void
}) {
  const effective = useEffectivePermissions(user.id)
  const overrides = useOverrides(user.id)

  if (effective.isError || overrides.isError) {
    return (
      <LoadError
        error={effective.error ?? overrides.error}
        what="the permissions"
        onRetry={() => {
          void effective.refetch()
          void overrides.refetch()
        }}
      />
    )
  }
  if (effective.isPending || overrides.isPending) {
    return <LoadingRows label="the permissions" rows={6} />
  }

  const denials = overrides.data.filter((override) => override.effect === 'deny')
  const modules: { module: string; rows: Row[] }[] = []
  const add = (module: string, row: Row) => {
    let group = modules.find((item) => item.module === module)
    if (!group) {
      group = { module, rows: [] }
      modules.push(group)
    }
    group.rows.push(row)
  }
  for (const permission of effective.data) {
    if (matches(`${permission.label} ${permission.code} ${permission.module}`, q)) {
      add(permission.module, { kind: 'held', permission })
    }
  }
  for (const override of denials) {
    if (matches(`${override.label} ${override.code} ${override.module}`, q)) {
      add(override.module, { kind: 'denied', override })
    }
  }

  const moduleCount = new Set(effective.data.map((permission) => permission.module)).size

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {plural(effective.data.length, 'permission')} in {plural(moduleCount, 'module')}
          {denials.length > 0 && ` · ${plural(denials.length, 'denial')}`}
        </p>
        <SearchBox
          key={q ?? ''}
          value={q}
          label="Search permissions"
          placeholder="Screen, action or code"
          onSearch={onSearch}
        />
      </div>
      {user.isSystemAdmin && (
        <p className="flex items-start gap-2 rounded-lg bg-[#EDE7FB] px-3 py-2 text-xs text-[#4B2A91] dark:bg-violet-500/10 dark:text-violet-200">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          System admin: this account holds every permission across the company, whatever its roles;
          only denials take something away.
        </p>
      )}
      {!user.isActive && (
        <p className="rounded-lg bg-muted px-3 py-2 text-xs text-field-foreground">
          The account is disabled: this is what it would hold once enabled.
        </p>
      )}
      {modules.length === 0 ? (
        <EmptyNote>
          {q
            ? 'No permission matches the search.'
            : 'No permissions: give the account a role, or grant one in Overrides.'}
        </EmptyNote>
      ) : (
        modules.map((group) => (
          <SectionCard
            key={group.module}
            as="h3"
            title={group.module}
            actions={
              <span className="text-xs text-muted-foreground">
                {plural(group.rows.filter((row) => row.kind === 'held').length, 'permission')}
              </span>
            }
          >
            <ul aria-label={`${group.module} permissions`} className="divide-y divide-border">
              {group.rows.map((row) =>
                row.kind === 'held' ? (
                  <li
                    key={row.permission.code}
                    className="grid gap-1.5 py-2.5 first:pt-0 last:pb-0 @xl:grid-cols-[minmax(0,1fr)_auto] @xl:items-center"
                  >
                    <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-title">
                      <span className="break-words">{row.permission.label}</span>
                      {row.permission.isSensitive && <SensitiveChip />}
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5 @xl:justify-end">
                      <span className="text-[0.6875rem] text-grey">
                        {row.permission.scopes
                          .map((scope) => labelOf(SCOPE_LABELS, scope))
                          .join(', ')}
                      </span>
                      <span className="sr-only">, from</span>
                      <SourceChips sources={row.permission.sources} />
                    </span>
                  </li>
                ) : (
                  <li
                    key={`deny-${row.override.code}`}
                    className="grid gap-1 py-2.5 first:pt-0 last:pb-0"
                  >
                    <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs">
                      <span className="break-words text-grey line-through">
                        {row.override.label}
                      </span>
                      <Chip
                        tone="red"
                        icon={<Ban aria-hidden="true" className="size-3" strokeWidth={2.2} />}
                      >
                        Denied
                      </Chip>
                    </span>
                    {row.override.reason && (
                      <span className="text-[0.6875rem] text-grey">{row.override.reason}</span>
                    )}
                  </li>
                ),
              )}
            </ul>
          </SectionCard>
        ))
      )}
    </div>
  )
}
