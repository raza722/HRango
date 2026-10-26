import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'

import { DataTable, type DataTableColumn, EmployeeAvatar, Pagination } from '@/components/layout'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { BEN_CODES, ELECTION_STATUS, MISSING_LABELS } from '../../constants'
import { useBenefitEmployees } from '../../hooks/use-benefits'
import type { BenefitEmployee } from '../../types/benefits.types'
import { accent, mediumText, ruledRows, tableClass } from '../shared/benefit-styles'
import { Chip, EmptyList, ListError } from '../shared/list-parts'
import { BenefitsPage } from '../shared/page-frame'
import { UpdateInformationDialog } from './update-information-dialog'

const routeApi = getRouteApi('/_app/benefits/employees')

const PAGE_SIZE = 25

const linkButton = cn(
  mediumText,
  accent.text,
  'rounded-sm whitespace-nowrap outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-[#7469E8]/35',
)

/**
 * Employees (no frame draws this tab): each person, their election in the plan year shown and
 * the benefit details they still miss, with Update for those. "Update missing information" on a
 * plan year opens it with `?missing=true`.
 */
export function BenefitEmployeesPage() {
  const { year, missing } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const [page, setPage] = useState(1)
  const list = useBenefitEmployees({ year, missing, page, pageSize: PAGE_SIZE })
  const canUpdate = useCan(BEN_CODES.profileUpdate)
  const [editing, setEditing] = useState<BenefitEmployee | null>(null)

  const columns: DataTableColumn<BenefitEmployee>[] = [
    {
      id: 'employee',
      header: 'Employee',
      mobile: 'heading',
      cell: (row) => (
        <div className="flex items-center gap-3">
          <EmployeeAvatar name={row.name ?? ''} className="size-8" />
          <div className="grid">
            <span className="font-medium">{row.name}</span>
            <span className="text-xs text-[#707070] dark:text-muted-foreground">
              {[row.code, row.jobTitleName].filter(Boolean).join(' · ')}
            </span>
          </div>
        </div>
      ),
    },
    { id: 'department', header: 'Department', cell: (row) => row.departmentName ?? '—' },
    {
      id: 'election',
      header: 'Election',
      className: 'whitespace-normal',
      cell: (row) =>
        year ? (
          <Chip meta={ELECTION_STATUS[row.electionStatus ?? 'none']} className="h-6 text-xs" />
        ) : (
          <span className="text-xs text-[#707070] dark:text-muted-foreground">
            Choose a plan year
          </span>
        ),
    },
    {
      id: 'missing',
      header: 'Missing Information',
      className: 'whitespace-normal',
      cell: (row) =>
        row.missing.length === 0 ? (
          <span className="text-[#707070] dark:text-muted-foreground">None</span>
        ) : (
          <span className="text-[#C2420B] dark:text-[#FCA5A5]">
            {row.missing.map((key) => MISSING_LABELS[key]).join(', ')}
          </span>
        ),
    },
  ]

  return (
    <BenefitsPage
      tab="employees"
      title="Employees"
      year={year}
      onYearChange={(next) => {
        setPage(1)
        void navigate({ search: (prev) => ({ ...prev, year: next }) })
      }}
    >
      {missing && (
        <div className="mx-4 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[6px] bg-[#EBEFF8] px-4 py-2.5 text-sm text-heading sm:mx-8 dark:bg-[#22304a]">
          <span>Showing the employees who are missing required information.</span>
          <button
            type="button"
            onClick={() => {
              setPage(1)
              void navigate({ search: (prev) => ({ ...prev, missing: undefined }) })
            }}
            className={linkButton}
          >
            Show everyone
          </button>
        </div>
      )}
      {list.isError ? (
        <ListError error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={list.data?.data ?? []}
          getRowId={(row) => row.id}
          caption="Employees and their benefits"
          isLoading={list.isPending}
          isFetching={list.isFetching}
          className={cn(tableClass, ruledRows, '[&_td]:py-3 [&_td]:align-middle')}
          emptyState={
            <EmptyList>
              {missing ? 'Everyone’s information is complete.' : 'There are no employees yet.'}
            </EmptyList>
          }
          rowActionsHeader="Action"
          rowActions={
            canUpdate
              ? (row) =>
                  row.missing.length > 0 ? (
                    <button
                      type="button"
                      aria-label={`Update the information of ${row.name ?? ''}`}
                      onClick={() => {
                        setEditing(row)
                      }}
                      className={linkButton}
                    >
                      Update
                    </button>
                  ) : null
              : undefined
          }
        />
      )}
      {list.data && list.data.meta.totalPages > 1 && (
        <div className="flex justify-end px-4 pt-4 sm:px-8">
          <Pagination
            page={list.data.meta.page}
            totalPages={list.data.meta.totalPages}
            disabled={list.isFetching}
            onPageChange={setPage}
          />
        </div>
      )}
      {editing && (
        <UpdateInformationDialog
          employee={editing}
          onClose={() => {
            setEditing(null)
          }}
        />
      )}
    </BenefitsPage>
  )
}
