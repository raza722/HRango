import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'

import { ErrorState } from '@/components/feedback/error-state'
import { DataTable, type DataTableColumn } from '@/components/layout'
import { downloadText } from '@/features/payroll'
import { useDebouncedValue } from '@/hooks/use-debounced-value'

import { manpowerApi } from '../../api/manpower.api'
import { DEFAULT_PAGE_SIZE, OPEN_POSITION_STATUS_META } from '../../constants'
import { useOpenPositions, useSetOpenPositionClosed } from '../../hooks/use-manpower'
import type { OpenPosition } from '../../types/manpower.types'
import { toastError } from '../../utils/errors'
import { formatCount, formatDay } from '../../utils/format'
import { Chip, StampCell } from '../shared/cells'
import { MpListFooter, SearchBox, ShowEntries } from '../shared/controls'
import { DeleteIcon, DownloadIcon, EditIcon, RefreshIcon } from '../shared/mp-icons'
import { mpTableClass } from '../shared/mp-styles'
import { CardBody, MpCard, MpPage } from '../shared/page-shell'
import { RowMenu } from '../shared/row-menu'
import { OpenPositionDialog } from './open-position-dialog'

const routeApi = getRouteApi('/_app/manpower-planning/open-positions')

const downloadFailed = toastError('The job description could not be downloaded.')

/** "Download": the position's job description as a text file. */
function JdButton({ position }: { position: OpenPosition }) {
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      disabled={busy}
      aria-label={`Download the JD of ${position.title}`}
      onClick={() => {
        setBusy(true)
        manpowerApi
          .jobDescription(position.id)
          .then((jd) => {
            downloadText(jd.text, jd.fileName, 'text/plain;charset=utf-8')
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
 * Open Positions ("Positions"): what each approved budget opened — the position, how
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
  const list = useOpenPositions({ page, pageSize, search: debounced })
  const goTo = (next: number) => {
    void navigate({ search: (prev) => ({ ...prev, page: next }) })
  }
  const offset = (page - 1) * pageSize

  const columns: DataTableColumn<OpenPosition>[] = [
    { id: 'sr', header: 'Sr#', cell: (_row, index) => offset + index + 1 },
    { id: 'title', header: 'Positions', mobile: 'heading', cell: (row) => row.title },
    {
      id: 'total',
      header: 'Total Positions',
      align: 'center',
      cell: (row) => formatCount(row.totalPositions),
    },
    { id: 'end', header: 'End Date', cell: (row) => formatDay(row.endDate) },
    { id: 'approved', header: 'Approved', cell: (row) => <StampCell stamp={row.approved} /> },
    { id: 'jd', header: 'JD’s', align: 'center', cell: (row) => <JdButton position={row} /> },
    {
      id: 'status',
      header: 'Status',
      align: 'center',
      cell: (row) => <Chip {...OPEN_POSITION_STATUS_META[row.status]} />,
    },
  ]

  return (
    <MpPage
      title="Open Positions"
      info="Each approved budget opens its new positions here, with how many there are and until when. Download the job description, change the count or date, or close a position once it is filled."
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
            rowActions={(row) => (
              <RowMenu
                label={`Actions for ${row.title}`}
                items={[
                  {
                    label: 'Edit',
                    icon: EditIcon,
                    onSelect: () => {
                      setEditing(row)
                    },
                  },
                  row.status === 'active'
                    ? {
                        label: 'Close Position',
                        icon: DeleteIcon,
                        onSelect: () => {
                          setClosed.mutate(
                            { id: row.id, closed: true },
                            { onError: toastError('The position could not be closed.') },
                          )
                        },
                      }
                    : {
                        label: 'Reopen Position',
                        icon: RefreshIcon,
                        onSelect: () => {
                          setClosed.mutate(
                            { id: row.id, closed: false },
                            { onError: toastError('The position could not be reopened.') },
                          )
                        },
                      },
                ]}
              />
            )}
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
