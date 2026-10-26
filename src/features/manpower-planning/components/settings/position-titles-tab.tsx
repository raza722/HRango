import { useState } from 'react'
import { Link } from '@tanstack/react-router'

import { ErrorState } from '@/components/feedback/error-state'
import { DataTable, type DataTableColumn } from '@/components/layout'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { cn } from '@/lib/utils'

import { DEFAULT_PAGE_SIZE } from '../../constants'
import { usePositionTitles } from '../../hooks/use-manpower'
import type { PositionTitle } from '../../types/manpower.types'
import { stampOf } from '../../utils/format'
import { OptionalStampCell, StampCell } from '../shared/cells'
import { MpListFooter, SearchBox, ShowEntries } from '../shared/controls'
import { accent, headerButton, mpTableClass } from '../shared/mp-styles'
import { CardBody, MpCard } from '../shared/page-shell'
import { SettingsTabs } from './settings-tabs'

/**
 * E-Budget Settings → Position Title: Organisation's job titles with how many employee
 * positions (active ones) and open positions use each. They are added, renamed and removed on
 * Settings → Job Titles, so this tab only lists them.
 */
export function PositionTitlesTab({
  page,
  goTo,
  filtersOpen,
}: {
  page: number
  goTo: (page: number) => void
  filtersOpen: boolean
}) {
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search.trim())
  const list = usePositionTitles({ page, pageSize, q: debounced })
  const offset = (page - 1) * pageSize

  const columns: DataTableColumn<PositionTitle>[] = [
    { id: 'sr', header: 'Sr#', cell: (_row, index) => offset + index + 1 },
    {
      id: 'title',
      header: 'Position Title',
      mobile: 'heading',
      className: 'min-w-[11rem]',
      cell: (row) => row.name,
    },
    {
      id: 'positions',
      header: 'Employee Positions',
      align: 'center',
      cell: (row) => `${String(row.activePositionCount)} of ${String(row.positionCount)} active`,
    },
    {
      id: 'open',
      header: 'Open Positions',
      align: 'center',
      cell: (row) => row.openPositionCount,
    },
    {
      id: 'added',
      header: 'Added On',
      cell: (row) => <StampCell stamp={stampOf(row.createdAt, row.createdByName)} />,
    },
    {
      id: 'modified',
      header: 'Modified On',
      cell: (row) => <OptionalStampCell at={row.updatedAt} byName={null} />,
    },
  ]

  const manageLink = (
    <Link
      to="/settings/control-panel/job-titles"
      className={cn(headerButton, accent.bg, 'min-w-[12.75rem]')}
    >
      Manage Job Titles
    </Link>
  )

  return (
    <MpCard title="Employee Budget Settings" actions={filtersOpen ? undefined : manageLink}>
      {filtersOpen && (
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <ShowEntries
            value={pageSize}
            onChange={(size) => {
              setPageSize(size)
              goTo(1)
            }}
          />
          <div className="flex flex-wrap items-center gap-3.5">
            {manageLink}
            <SearchBox
              label="Search position titles"
              value={search}
              onChange={(value) => {
                setSearch(value)
                goTo(1)
              }}
            />
          </div>
        </CardBody>
      )}
      <div>
        <SettingsTabs current="position-title" />
        {list.isError ? (
          <ErrorState
            message="The position titles could not be loaded."
            onRetry={() => void list.refetch()}
            className="mx-4 shadow-none sm:mx-6"
          />
        ) : (
          <DataTable
            columns={columns}
            data={list.data?.data ?? []}
            getRowId={(row) => row.id}
            caption="Position titles"
            isLoading={list.isPending}
            isFetching={list.isFetching}
            className={mpTableClass}
            emptyState={
              debounced
                ? 'No position title matches your search.'
                : 'No job titles yet. Add them on Settings → Job Titles.'
            }
          />
        )}
      </div>
      <MpListFooter meta={list.data?.meta} disabled={list.isFetching} onPageChange={goTo} />
    </MpCard>
  )
}
