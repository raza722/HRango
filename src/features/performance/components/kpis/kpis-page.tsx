import { useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'

import { FormField } from '@/components/form'
import {
  type DataTableColumn,
  PageContainer,
  PaginatedTableCard,
  RowActionsMenu,
  rowMenuItemClass,
} from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SearchSelect } from '@/features/payroll'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { ACTIVE_META, labelOf, MEASURE_LABELS, PERF_CODES, PERF_PAGE_SIZES } from '../../constants'
import { useDeleteKpi, useKpi, useKpiList, useOrgLookup } from '../../hooks/use-performance'
import type { KpisSearch } from '../../routing'
import type { Kpi } from '../../types/performance.types'
import { formatNumber, serialOf, withUnit } from '../../utils/format'
import { navyButtonClass, tableClass, toolbarButtonClass } from '../../utils/styles'
import { FiltersDialog } from '../shared/dialogs'
import { Chip, ConfirmAction, FilterButton, PageHeaderCard, SearchBox } from '../shared/parts'
import { KpiFormDialog } from './kpi-form-dialog'

const routeApi = getRouteApi('/_app/performance/kpis')

type KpiFilters = Pick<KpisSearch, 'keyResultArea' | 'departmentId' | 'active'>
const NO_FILTERS: KpiFilters = {
  keyResultArea: undefined,
  departmentId: undefined,
  active: undefined,
}

/** Key Result Area, Department and Active / Inactive. */
function KpiFiltersDialog({
  value,
  onApply,
  onClose,
}: {
  value: KpiFilters
  onApply: (filters: KpiFilters) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<KpiFilters>(value)
  const departments = useOrgLookup('departments')
  return (
    <FiltersDialog
      onApply={() => {
        onApply(draft)
      }}
      onReset={() => {
        onApply(NO_FILTERS)
      }}
      onClose={onClose}
    >
      <FormField label="Key Result Area">
        {(a11y) => (
          <Input
            {...a11y}
            value={draft.keyResultArea ?? ''}
            placeholder="e.g. Recruitment"
            onChange={(event) => {
              setDraft((current) => ({
                ...current,
                keyResultArea: event.target.value.trim() || undefined,
              }))
            }}
          />
        )}
      </FormField>
      <FormField label="Department">
        {(a11y) => (
          <SearchSelect
            {...a11y}
            value={draft.departmentId ?? null}
            onChange={(next) => {
              setDraft((current) => ({ ...current, departmentId: next ?? undefined }))
            }}
            options={(departments.data ?? []).map((row) => ({ value: row.id, label: row.name }))}
            placeholder="All Departments"
            clearable
          />
        )}
      </FormField>
      <FormField label="Status">
        {(a11y) => (
          <SearchSelect
            {...a11y}
            value={draft.active ?? null}
            onChange={(next) => {
              setDraft((current) => ({
                ...current,
                active: next === 'yes' || next === 'no' ? next : undefined,
              }))
            }}
            options={[
              { value: 'yes', label: 'Active' },
              { value: 'no', label: 'Inactive' },
            ]}
            placeholder="Active and Inactive"
            clearable
          />
        )}
      </FormField>
    </FiltersDialog>
  )
}

/**
 * The KPI library: every measure goals and appraisal criteria can link to, with its key
 * result area, measure, target, default weight and department. Add / Edit / Delete (a KPI in
 * use can only be made inactive). Search, filters, page and the open popup live in the URL.
 */
export function KpisPage() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const canCreate = useCan(PERF_CODES.kpisCreate)
  const canEdit = useCan(PERF_CODES.kpisEdit)
  const canDelete = useCan(PERF_CODES.kpisDelete)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [deleting, setDeleting] = useState<Kpi | null>(null)
  const remove = useDeleteKpi()

  const update = (patch: Partial<KpisSearch>) => {
    void navigate({ search: (current) => ({ ...current, ...patch }) })
  }
  const list = useKpiList({
    q: search.q,
    keyResultArea: search.keyResultArea,
    departmentId: search.departmentId,
    isActive: search.active === undefined ? undefined : search.active === 'yes',
    page: search.page,
    pageSize: search.pageSize,
  })
  const filters: KpiFilters = {
    keyResultArea: search.keyResultArea,
    departmentId: search.departmentId,
    active: search.active,
  }
  const filterCount = Object.values(filters).filter(Boolean).length
  const page = list.data?.meta.page ?? search.page
  const detail = useKpi(search.edit ?? null)
  const editing = search.edit
    ? (list.data?.data.find((kpi) => kpi.id === search.edit) ?? detail.data ?? null)
    : null

  const columns: DataTableColumn<Kpi>[] = [
    {
      id: 'serial',
      header: 'Sr. #',
      mobile: 'hidden',
      className: 'w-14',
      cell: (_row, index) => serialOf(page, search.pageSize, index),
    },
    {
      id: 'kpi',
      header: 'KPI',
      mobile: 'heading',
      className: 'min-w-52 whitespace-normal',
      cell: (row) => (
        <span className="grid gap-0.5">
          <span className="font-medium text-person dark:text-heading">{row.name}</span>
          {row.description && (
            <span className="text-[0.625rem] leading-snug text-grey">{row.description}</span>
          )}
        </span>
      ),
    },
    { id: 'area', header: 'Key Result Area', cell: (row) => row.keyResultArea ?? '—' },
    { id: 'measure', header: 'Measure', cell: (row) => labelOf(MEASURE_LABELS, row.measureType) },
    { id: 'target', header: 'Target', cell: (row) => withUnit(row.targetValue, row.unit) },
    {
      id: 'weight',
      header: 'Default Weight',
      align: 'right',
      cell: (row) => (row.defaultWeight === null ? '—' : `${formatNumber(row.defaultWeight)}%`),
    },
    {
      id: 'department',
      header: 'Department',
      className: 'whitespace-normal',
      cell: (row) => row.departmentName ?? 'Every department',
    },
    {
      id: 'inUse',
      header: 'In Use',
      align: 'right',
      cell: (row) => formatNumber(row.inUse),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <Chip meta={row.isActive ? ACTIVE_META.active : ACTIVE_META.inactive} />,
    },
    ...(canEdit || canDelete
      ? [
          {
            id: 'action',
            header: 'Action',
            align: 'center' as const,
            className: 'w-16',
            cell: (row: Kpi) => (
              <RowActionsMenu
                label={`Actions for ${row.name}`}
                itemClassName={rowMenuItemClass.poppins}
                actions={[
                  ...(canEdit
                    ? [
                        {
                          label: 'Edit',
                          onSelect: () => {
                            update({ edit: row.id, dialog: undefined })
                          },
                        },
                      ]
                    : []),
                  ...(canDelete
                    ? [
                        {
                          label: 'Delete',
                          variant: 'destructive' as const,
                          onSelect: () => {
                            setDeleting(row)
                          },
                        },
                      ]
                    : []),
                ]}
              />
            ),
          },
        ]
      : []),
  ]

  return (
    <PageContainer>
      <PageHeaderCard
        title="KPIs"
        description="The library of key performance indicators goals and appraisal criteria measure against."
        actions={
          canCreate && (
            <Button
              onClick={() => {
                update({ dialog: 'add', edit: undefined })
              }}
              className={cn(toolbarButtonClass, navyButtonClass, 'px-5 text-xs')}
            >
              + Add KPI
            </Button>
          )
        }
      />
      <PaginatedTableCard
        title="KPI Library"
        titleAs="h2"
        caption="KPI Library"
        className={tableClass}
        toolbar={
          <>
            <SearchBox
              key={search.q ?? ''}
              value={search.q}
              label="Search KPIs"
              onSearch={(q) => {
                update({ q, page: 1 })
              }}
            />
            <FilterButton
              count={filterCount}
              onClick={() => {
                setFiltersOpen(true)
              }}
            />
          </>
        }
        columns={columns}
        result={list}
        page={search.page}
        pageSize={search.pageSize}
        pageSizeOptions={PERF_PAGE_SIZES}
        onPageChange={(next) => {
          update({ page: next })
        }}
        onPageSizeChange={(size) => {
          update({ pageSize: size, page: 1 })
        }}
        getRowId={(row) => row.id}
        emptyState={
          search.q || filterCount > 0
            ? 'No KPIs match the search or filters.'
            : 'The library is empty. + Add KPI adds the first one.'
        }
      />

      {(search.dialog === 'add' || editing) && (
        <KpiFormDialog
          key={editing?.rowVersion ?? 'new'}
          kpi={editing}
          onClose={() => {
            update({ dialog: undefined, edit: undefined })
          }}
        />
      )}
      {filtersOpen && (
        <KpiFiltersDialog
          value={filters}
          onApply={(next) => {
            update({ ...next, page: 1 })
          }}
          onClose={() => {
            setFiltersOpen(false)
          }}
        />
      )}
      {deleting && (
        <ConfirmAction
          title="Delete KPI"
          description={
            deleting.inUse > 0
              ? `${deleting.name} is used by ${String(deleting.inUse)} goals or criteria, so it can't be deleted. Make it inactive instead.`
              : `Delete ${deleting.name} from the library?`
          }
          confirmLabel="Delete"
          destructive
          onConfirm={() => {
            remove.mutate({ id: deleting.id, rowVersion: deleting.rowVersion, name: deleting.name })
          }}
          onClose={() => {
            setDeleting(null)
          }}
        />
      )}
    </PageContainer>
  )
}
