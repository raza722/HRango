import { useState } from 'react'

import { DataTable, type DataTableColumn, Pagination } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { ACCESS_CODES } from '../../constants'
import { useEndSession, useEndUserSessions, useSessions } from '../../hooks/use-access'
import type { Session, UserDetail } from '../../types/access.types'
import { formatAgo, formatStamp, plural, possessive } from '../../utils/format'
import { dangerButtonClass, tableClass, toolbarButtonClass } from '../../utils/styles'
import { ConfirmAction } from '../shared/dialogs'
import { Chip, ChipToggle, LoadError, SectionCard } from '../shared/parts'

const PAGE_SIZE = 10

const deviceOf = (session: Session) => session.device ?? 'Unknown device'

function Stamp({ value }: { value: string | null }) {
  if (!value) return <span className="text-grey">—</span>
  return (
    <span className="grid gap-0.5">
      <time dateTime={value}>{formatStamp(value)}</time>
      <span className="text-[0.625rem] text-grey">{formatAgo(value)}</span>
    </span>
  )
}

/**
 * Where the account is signed in (`GET /access/sessions?userId&activeOnly`): device, IP,
 * signed in, last seen. End signs one device out; End All signs out everywhere. "Ended too"
 * lists the finished sessions as well. On your own account, ending them signs you out here too.
 */
export function UserSessionsTab({
  user,
  isSelf,
  showEnded,
  page,
  onChange,
}: {
  user: UserDetail
  isSelf: boolean
  showEnded: boolean
  page: number
  onChange: (patch: { ended?: true | undefined; sessionsPage?: number }) => void
}) {
  const canEnd = useCan(ACCESS_CODES.usersSessions)
  const sessions = useSessions({
    userId: user.id,
    activeOnly: !showEnded,
    page,
    pageSize: PAGE_SIZE,
  })
  const endOne = useEndSession()
  const endAll = useEndUserSessions()
  const [ending, setEnding] = useState<Session | 'all' | null>(null)
  const meta = sessions.data?.meta

  const columns: DataTableColumn<Session>[] = [
    {
      id: 'device',
      header: 'Device',
      mobile: 'heading',
      className: 'min-w-40 whitespace-normal',
      cell: (row) => (
        <span className="font-medium text-person dark:text-heading">{deviceOf(row)}</span>
      ),
    },
    { id: 'ip', header: 'IP Address', cell: (row) => row.ipAddress ?? '—' },
    {
      id: 'signedIn',
      header: 'Signed In',
      className: 'min-w-32',
      cell: (row) => <Stamp value={row.signedInAt} />,
    },
    {
      id: 'lastSeen',
      header: 'Last Seen',
      className: 'min-w-32',
      cell: (row) => <Stamp value={row.lastSeenAt} />,
    },
    {
      id: 'status',
      header: 'Status',
      className: 'min-w-24',
      cell: (row) =>
        row.isActive ? (
          <Chip tone="green">Signed in</Chip>
        ) : (
          <Chip
            tone="grey"
            title={row.revokedAt ? `Ended ${formatStamp(row.revokedAt)}` : 'Expired'}
          >
            {row.revokedAt ? 'Ended' : 'Expired'}
          </Chip>
        ),
    },
    ...(canEnd
      ? [
          {
            id: 'action',
            header: 'Action',
            align: 'center' as const,
            cell: (row: Session) =>
              row.isActive ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEnding(row)
                  }}
                  aria-label={`End session on ${deviceOf(row)}`}
                  className="h-8 px-2 text-xs text-destructive hover:text-destructive"
                >
                  End
                </Button>
              ) : null,
          },
        ]
      : []),
  ]

  return (
    <SectionCard
      title="Sessions"
      as="h3"
      actions={
        <>
          <ChipToggle
            label="Sessions shown"
            options={[
              { value: undefined, label: 'Signed in now' },
              { value: 'ended', label: 'Ended too' },
            ]}
            value={showEnded ? 'ended' : undefined}
            onChange={(value) => {
              onChange({ ended: value ? true : undefined, sessionsPage: 1 })
            }}
          />
          {canEnd && (
            <Button
              type="button"
              disabled={!showEnded && meta?.total === 0}
              onClick={() => {
                setEnding('all')
              }}
              className={cn(toolbarButtonClass, dangerButtonClass)}
            >
              End All
            </Button>
          )}
        </>
      }
    >
      {sessions.isError && !sessions.data ? (
        <LoadError
          error={sessions.error}
          what="the sessions"
          onRetry={() => void sessions.refetch()}
        />
      ) : (
        <div className="grid gap-3">
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {sessions.isPending
              ? ''
              : showEnded
                ? plural(meta?.total ?? 0, 'session')
                : `${plural(meta?.total ?? 0, 'session')} signed in now`}
          </p>
          <DataTable
            caption={`${possessive(user.name)} sessions`}
            columns={columns}
            data={sessions.data?.data ?? []}
            getRowId={(row) => row.id}
            isLoading={sessions.isPending}
            isFetching={sessions.isFetching}
            className={tableClass}
            loadingRowCount={3}
            emptyState={
              showEnded
                ? 'No sessions recorded for this account.'
                : `${user.name} is not signed in anywhere.`
            }
          />
          {meta && meta.totalPages > 1 && (
            <div className="flex justify-center">
              <Pagination
                page={meta.page}
                totalPages={meta.totalPages}
                onPageChange={(next) => {
                  onChange({ sessionsPage: next })
                }}
                disabled={sessions.isFetching}
              />
            </div>
          )}
        </div>
      )}
      {ending === 'all' && (
        <ConfirmAction
          title={`End all of ${possessive(user.name)} sessions?`}
          description={
            isSelf
              ? 'Every device signs out on its next request, this one included: you will need to sign in again.'
              : `${user.name} is signed out on every device and has to sign in again.`
          }
          confirmLabel="End All Sessions"
          destructive
          onConfirm={() => {
            endAll.mutate({ id: user.id, name: user.name })
          }}
          onClose={() => {
            setEnding(null)
          }}
        />
      )}
      {ending && ending !== 'all' && (
        <ConfirmAction
          title={`End the session on ${deviceOf(ending)}?`}
          description={`${user.name} is signed out of ${deviceOf(ending)}${ending.ipAddress ? ` (${ending.ipAddress})` : ''} on its next request.`}
          confirmLabel="End Session"
          destructive
          onConfirm={() => {
            endOne.mutate({ id: ending.id, device: deviceOf(ending) })
          }}
          onClose={() => {
            setEnding(null)
          }}
        />
      )}
    </SectionCard>
  )
}
