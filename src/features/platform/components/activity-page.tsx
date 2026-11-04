import type { DataTableColumn } from '@/components/layout'
import { formatDateTime } from '@/lib/date'

import type { StaffAuditRow } from '../api/platform.api'
import { labelOf } from '../format'
import { useListState, usePlatformList } from '../hooks/use-platform'
import { ListPage } from './shared'

const columns: DataTableColumn<StaffAuditRow>[] = [
  { id: 'when', header: 'When', mobile: 'heading', cell: (row) => formatDateTime(row.createdAt) },
  { id: 'who', header: 'Who', cell: (row) => row.staffName ?? 'System' },
  { id: 'action', header: 'What', cell: (row) => labelOf(row.actionName) },
  { id: 'detail', header: 'Detail', cell: (row) => row.detail ?? '—' },
]

/** Everything staff do, newest first. */
export function PlatformActivityPage() {
  const list = useListState()
  const result = usePlatformList<StaffAuditRow>('audit', {
    page: list.page,
    pageSize: list.pageSize,
  })

  return (
    <ListPage
      title="Activity Log"
      description="Every sign-in and every change staff make."
      caption="All activity"
      columns={columns}
      result={result}
      list={list}
      getRowId={(row) => row.id}
      emptyText="Nothing recorded yet."
    />
  )
}
