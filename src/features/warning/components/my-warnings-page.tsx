import { useQuery } from '@tanstack/react-query'

import { ErrorState } from '@/components/feedback/error-state'
import { DataTable, type DataTableColumn, PageContainer, PageHeader } from '@/components/layout'
import { apiClient } from '@/lib/axios'

import { warningType } from './type-styles'

interface WarningRow {
  id: string
  policyTitle: string
  appliesTo: string
  workDate: string
  minutes: number | null
  occurrenceNo: number | null
  penaltyType: string | null
  penaltyPercentage: number | string | null
  deduction: string | null
}

const label = (value: string) => value.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())

const COLUMNS: DataTableColumn<WarningRow>[] = [
  {
    id: 'date',
    header: 'Date',
    cell: (row) =>
      new Date(`${row.workDate}T00:00:00`).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
  },
  { id: 'policy', header: 'Policy', cell: (row) => row.policyTitle },
  { id: 'for', header: 'For', cell: (row) => label(row.appliesTo) },
  { id: 'minutes', header: 'Minutes', cell: (row) => row.minutes ?? '—' },
  { id: 'no', header: 'Warning No', cell: (row) => row.occurrenceNo ?? '—' },
  {
    id: 'penalty',
    header: 'Penalty',
    cell: (row) =>
      row.penaltyType
        ? `${label(row.penaltyType)}${row.penaltyPercentage ? ` (${String(row.penaltyPercentage)}%)` : ''}`
        : 'None',
  },
]

/** Attendance → My Warnings: the warnings raised on the person's own time sheet, newest first. */
export function MyWarningsPage() {
  const warnings = useQuery({
    queryKey: ['warning', 'my-warnings'],
    queryFn: async ({ signal }) => {
      const res = await apiClient.get<{ data: WarningRow[] }>('/warning/warnings', {
        params: { page: 1, pageSize: 100 },
        signal,
      })
      return res.data.data
    },
  })
  return (
    <PageContainer>
      <PageHeader
        className={warningType.pageHeader}
        title="My Warnings"
        description="Warnings raised from your time sheet, and any penalty that came with them."
      />
      {warnings.isError ? (
        <ErrorState
          message="Could not load your warnings."
          onRetry={() => void warnings.refetch()}
        />
      ) : (
        <DataTable
          caption="My warnings"
          columns={COLUMNS}
          data={warnings.data ?? []}
          getRowId={(row) => row.id}
          isLoading={warnings.isPending}
          emptyState={
            <p className="py-10 text-center text-sm text-grey">You have no warnings. Well done.</p>
          }
        />
      )}
    </PageContainer>
  )
}
