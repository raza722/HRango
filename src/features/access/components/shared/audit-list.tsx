import { History } from 'lucide-react'

import { Pagination } from '@/components/layout'

import { useAudit } from '../../hooks/use-access'
import { formatAgo, formatStamp, plural } from '../../utils/format'
import { EmptyNote, LoadError, LoadingRows, SectionCard } from './parts'

const PAGE_SIZE = 10

/** Field names the audit log writes, as people read them. */
const FIELD_LABELS: Record<string, string> = {
  email: 'Email',
  displayName: 'Display name',
  employee: 'Linked employee',
  isSystemAdmin: 'System admin',
  isActive: 'Status',
  companies: 'Companies',
  roles: 'Roles',
  permissions: 'Permissions',
  name: 'Name',
  description: 'Description',
  scope: 'Scope',
  copiedFrom: 'Copied from',
}

/**
 * The audit history of one role or account (`GET /access/audit?entity&entityId`): who changed
 * what and when, newest first, ten at a time.
 */
export function AuditList({
  entity,
  entityId,
  page,
  onPageChange,
}: {
  entity: 'role' | 'user'
  entityId: string
  page: number
  onPageChange: (page: number) => void
}) {
  const audit = useAudit({ entity, entityId, page, pageSize: PAGE_SIZE })
  const meta = audit.data?.meta

  return (
    <SectionCard
      title="History"
      as="h3"
      actions={
        meta && meta.total > 0 ? (
          <span className="text-xs text-muted-foreground">{plural(meta.total, 'change')}</span>
        ) : null
      }
    >
      {audit.isError && !audit.data ? (
        <LoadError error={audit.error} what="the history" onRetry={() => void audit.refetch()} />
      ) : audit.isPending ? (
        <LoadingRows label="the history" rows={4} />
      ) : audit.data.data.length === 0 ? (
        <EmptyNote>No changes recorded yet.</EmptyNote>
      ) : (
        <>
          <ol
            aria-label="Changes"
            className="grid gap-0 divide-y divide-border"
            aria-busy={audit.isFetching}
          >
            {audit.data.data.map((entry) => {
              const field = entry.fieldName
                ? (FIELD_LABELS[entry.fieldName] ?? entry.fieldName)
                : null
              const ago = formatAgo(entry.performedAt)
              return (
                <li key={entry.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-sidebar/[0.08] text-sidebar dark:bg-muted dark:text-heading"
                  >
                    <History className="size-3.5" />
                  </span>
                  <div className="grid min-w-0 gap-0.5 text-xs">
                    <p className="font-medium break-words text-title">
                      {entry.actionName ?? 'Changed'}
                      {field && <span className="font-normal text-grey"> · {field}</span>}
                    </p>
                    {(Boolean(entry.oldValue) || Boolean(entry.newValue)) && (
                      <p className="break-words text-field-foreground">
                        {entry.oldValue && (
                          <>
                            <span className="sr-only">From </span>
                            <span className="line-through decoration-grey/60">
                              {entry.oldValue}
                            </span>
                          </>
                        )}
                        {entry.oldValue && entry.newValue && <span aria-hidden="true"> → </span>}
                        {entry.newValue && (
                          <>
                            {entry.oldValue && <span className="sr-only"> to </span>}
                            <span>{entry.newValue}</span>
                          </>
                        )}
                      </p>
                    )}
                    <p className="text-[0.6875rem] text-grey">
                      {entry.performedByName ?? 'The system'} ·{' '}
                      <time dateTime={entry.performedAt ?? undefined}>
                        {formatStamp(entry.performedAt)}
                      </time>
                      {ago && <span> ({ago})</span>}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
          {meta && meta.totalPages > 1 && (
            <div className="flex justify-center pt-4">
              <Pagination
                page={meta.page}
                totalPages={meta.totalPages}
                onPageChange={onPageChange}
                disabled={audit.isFetching}
              />
            </div>
          )}
        </>
      )}
    </SectionCard>
  )
}
