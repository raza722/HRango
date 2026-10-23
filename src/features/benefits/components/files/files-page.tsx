import { getRouteApi } from '@tanstack/react-router'

import { DataTable, type DataTableColumn } from '@/components/layout'
import { cn } from '@/lib/utils'

import { categoryMeta } from '../../constants'
import { useBenefitFiles } from '../../hooks/use-benefits'
import type { BenefitFileRow } from '../../types/benefits.types'
import { formatDay, formatSize } from '../../utils/format'
import { ruledRows, tableClass } from '../shared/benefit-styles'
import { EmptyList, ListError } from '../shared/list-parts'
import { BenefitsPage } from '../shared/page-frame'

const routeApi = getRouteApi('/_app/benefits/files')

const columns: DataTableColumn<BenefitFileRow>[] = [
  {
    id: 'file',
    header: 'File Name',
    mobile: 'heading',
    className: 'whitespace-normal',
    cell: (row) => <span className="font-medium break-all">{row.fileName}</span>,
  },
  { id: 'plan', header: 'Plan', cell: (row) => row.planName },
  { id: 'category', header: 'Category', cell: (row) => categoryMeta(row.category).label },
  { id: 'size', header: 'Size', cell: (row) => formatSize(row.size) },
  { id: 'added', header: 'Added On', cell: (row) => formatDay(row.addedOn) },
]

/**
 * Files (no frame draws this tab): the attachments of the plans (Add Plan → Attachment). The
 * mock keeps only their names and sizes, so they cannot be opened here.
 */
export function BenefitFilesPage() {
  const { year } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const list = useBenefitFiles({ year })

  return (
    <BenefitsPage
      tab="files"
      title="Files"
      year={year}
      onYearChange={(next) => {
        void navigate({ search: { year: next } })
      }}
    >
      {list.isError ? (
        <ListError error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={list.data ?? []}
          getRowId={(row) => row.id}
          caption="Plan files"
          isLoading={list.isPending}
          isFetching={list.isFetching}
          loadingRowCount={3}
          className={cn(tableClass, ruledRows)}
          emptyState={
            <EmptyList>
              There are no files yet. A plan’s attachment shows here once it is added.
            </EmptyList>
          }
        />
      )}
    </BenefitsPage>
  )
}
