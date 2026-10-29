import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { format } from 'date-fns'

import { ErrorState } from '@/components/feedback/error-state'
import { DataTable, type DataTableColumn } from '@/components/layout'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useCan } from '@/lib/permissions'

import { manpowerApi } from '../../api/manpower.api'
import {
  DEFAULT_PAGE_SIZE,
  EXPIRED_POSITION_META,
  MP_CODES,
  OPEN_POSITION_STATUS_META,
} from '../../constants'
import { useOpenPositions, useSetOpenPositionClosed } from '../../hooks/use-manpower'
import type { OpenPosition } from '../../types/manpower.types'
import { toastError } from '../../utils/errors'
import { formatCount, formatDay, stampOf } from '../../utils/format'
import { Chip, StampCell } from '../shared/cells'
import { MpListFooter, SearchBox, ShowEntries } from '../shared/controls'
import { DeleteIcon, DownloadIcon, EditIcon, RefreshIcon } from '../shared/mp-icons'
import { mpTableClass } from '../shared/mp-styles'
import { CardBody, MpCard, MpPage } from '../shared/page-shell'
import { RowMenu } from '../shared/row-menu'
import { OpenPositionDialog } from './open-position-dialog'

const routeApi = getRouteApi('/_app/manpower-planning/open-positions')

const downloadFailed = toastError('The job description could not be downloaded.')

/** The status drawn: an active position past its end date reads "Expired". */
function openPositionStatusMeta(position: Pick<OpenPosition, 'status' | 'endDate'>) {
  const today = format(new Date(), 'yyyy-MM-dd')
  if (position.status === 'active' && position.endDate && position.endDate < today) {
    return EXPIRED_POSITION_META
  }
  return OPEN_POSITION_STATUS_META[position.status]
}

/** Opens a signed link (a fresh one: the list's links expire) as a download. */
function openLink(url: string, name: string) {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.target = '_blank'
  anchor.rel = 'noreferrer'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
}

/** "Download": the position's job description, through a fresh signed link. */
function JdButton({ position, allowed }: { position: OpenPosition; allowed: boolean }) {
  const [busy, setBusy] = useState(false)
  if (!position.jdFile) {
    return <span className="text-xs text-[#707070]">No JD yet</span>
  }
  return (
    <button
      type="button"
      disabled={busy || !allowed}
      aria-label={`Download the JD of ${position.title}`}
      title={position.jdFile.name ?? undefined}
      onClick={() => {
        setBusy(true)
        manpowerApi
          .jobDescription(position.id)
          .then((jd) => {
            openLink(jd.url, jd.name)
          })
          .catch(downloadFailed)
          .finally(() => {
            setBusy(false)
          })
      }}
      className="relative inline-flex h-[2.0625rem] w-[6.0625rem] items-center justify-center gap-1.5 text-xs font-medium text-[#00B3FF] outline-none before:absolute before:inset-0 before:rounded-[7px] before:bg-[#3EB4D9] before:opacity-10 focus-visible:ring-[3px] focus-visible:ring-[#00B3FF]/30 disabled:opacity-60"
    >
      <DownloadIcon aria-hidden="true" className="relative size-[0.9375rem]" />
      <span className="relative">Download</span>
    </button>
  )
}

/**
 * Open Positions ("Positions"): what each approved budget released — the position, how
 * many, until when, who approved it, its JD and status; ⋮ Edit, Close or Reopen.
 */
export function OpenPositionsPage() {
  const { page } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search.trim())
  const [editing, setEditing] = useState<OpenPosition | null>(null)
  const setClosed = useSetOpenPositionClosed()
  const canEdit = useCan(MP_CODES.openEdit)
  const canClose = useCan(MP_CODES.openClose)
  const canReopen = useCan(MP_CODES.openReopen)
  const canDownload = useCan(MP_CODES.openDownload)
  const list = useOpenPositions({ page, pageSize, q: debounced })
  const goTo = (next: number) => {
    void navigate({ search: (prev) => ({ ...prev, page: next }) })
  }
  const offset = (page - 1) * pageSize

  const columns: DataTableColumn<OpenPosition>[] = [
    { id: 'sr', header: 'Sr#', cell: (_row, index) => offset + index + 1 },
    {
      id: 'title',
      header: 'Positions',
      mobile: 'heading',
      cell: (row) => (
        <span className="flex flex-col">
          {row.title}
          {(row.departmentName ?? row.branchName) && (
            <span className="text-xs text-[#707070] dark:text-muted-foreground">
              {[row.departmentName, row.branchName].filter(Boolean).join(', ')}
            </span>
          )}
        </span>
      ),
    },
    {
      id: 'total',
      header: 'Total Positions',
      align: 'center',
      cell: (row) => formatCount(row.totalPositions),
    },
    {
      id: 'end',
      header: 'End Date',
      cell: (row) => (row.endDate ? formatDay(row.endDate) : '—'),
    },
    {
      id: 'approved',
      header: 'Approved',
      cell: (row) => (
        <StampCell stamp={stampOf(row.approvedAt ?? row.createdAt, row.approvedByName)} />
      ),
    },
    {
      id: 'jd',
      header: 'JD’s',
      align: 'center',
      cell: (row) => <JdButton position={row} allowed={canDownload} />,
    },
    {
      id: 'status',
      header: 'Status',
      align: 'center',
      cell: (row) => <Chip {...openPositionStatusMeta(row)} />,
    },
  ]

  const menuFor = (row: OpenPosition) => [
    ...(canEdit
      ? [
          {
            label: 'Edit',
            icon: EditIcon,
            onSelect: () => {
              setEditing(row)
            },
          },
        ]
      : []),
    ...(row.status === 'active' && canClose
      ? [
          {
            label: 'Close Position',
            icon: DeleteIcon,
            onSelect: () => {
              setClosed.mutate(
                { position: row, closed: true },
                { onError: toastError('The position could not be closed.') },
              )
            },
          },
        ]
      : []),
    ...(row.status === 'closed' && canReopen
      ? [
          {
            label: 'Reopen Position',
            icon: RefreshIcon,
            onSelect: () => {
              setClosed.mutate(
                { position: row, closed: false },
                { onError: toastError('The position could not be reopened.') },
              )
            },
          },
        ]
      : []),
  ]

  return (
    <MpPage
      title="Open Positions"
      info="Each approved budget opens its new positions here, with how many there are and until when. Download the job description, change the count, date or JD, or close a position once it is filled."
      filtersOpen={filtersOpen}
      onToggleFilters={() => {
        setFiltersOpen((open) => !open)
      }}
    >
      <MpCard title="Positions">
        {filtersOpen && (
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <ShowEntries
              value={pageSize}
              onChange={(size) => {
                setPageSize(size)
                goTo(1)
              }}
            />
            <SearchBox
              label="Search positions"
              value={search}
              onChange={(value) => {
                setSearch(value)
                goTo(1)
              }}
            />
          </CardBody>
        )}
        {list.isError ? (
          <ErrorState
            message="The open positions could not be loaded."
            onRetry={() => void list.refetch()}
            className="mx-4 shadow-none sm:mx-6"
          />
        ) : (
          <DataTable
            columns={columns}
            data={list.data?.data ?? []}
            getRowId={(row) => row.id}
            caption="Open positions"
            isLoading={list.isPending}
            isFetching={list.isFetching}
            className={mpTableClass}
            emptyState={
              debounced
                ? 'No position matches your search.'
                : 'No open positions. They appear when a budget is approved.'
            }
            rowActionsHeader="Action"
            rowActions={
              canEdit || canClose || canReopen
                ? (row) => {
                    const items = menuFor(row)
                    return items.length > 0 ? (
                      <RowMenu label={`Actions for ${row.title}`} items={items} />
                    ) : null
                  }
                : undefined
            }
          />
        )}
        <MpListFooter meta={list.data?.meta} disabled={list.isFetching} onPageChange={goTo} />
      </MpCard>

      {editing && (
        <OpenPositionDialog
          position={editing}
          onClose={() => {
            setEditing(null)
          }}
        />
      )}
    </MpPage>
  )
}
