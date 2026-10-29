import { useState } from 'react'
import { getRouteApi, useNavigate } from '@tanstack/react-router'

import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
import {
  DataTable,
  type DataTableColumn,
  type RowAction,
  RowActionsMenu,
  rowMenuItemClass,
} from '@/components/layout'
import { Button } from '@/components/ui/button'
import {
  btn,
  ListFooter,
  PayrollCard,
  payrollTableClass,
  SearchSelect,
  toolbarButton,
} from '@/features/payroll'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { RC_CODES, RC_PAGE_SIZE, SOURCE_LABELS } from '../../constants'
import { useCityOptions } from '../../hooks/use-lookups'
import { useApplicants, useDeleteApplicant } from '../../hooks/use-recruitment'
import type { CandidatesSearch } from '../../routing'
import { type Applicant, SOURCES } from '../../types/recruitment.types'
import { formatDay, labelOf } from '../../utils/format'
import { CandidateCell } from '../shared/fields'
import { FilterBar, FilterField, ListError, SearchBox } from '../shared/list-parts'
import { ApplicantDetailDialog } from './applicant-detail-dialog'
import { ApplicantFormDialog } from './applicant-form-dialog'

const routeApi = getRouteApi('/_app/recruitment/candidates')

const SOURCE_OPTIONS = SOURCES.map((value) => ({ value, label: SOURCE_LABELS[value] }))

/**
 * Candidates: everyone who applied or was added, searchable by name, email or phone and filtered
 * by source and city. A row opens the candidate with their applications; ⋮ has View, Edit,
 * New Application and Delete (only without applications).
 */
export function CandidatesPage() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const goTo = useNavigate()
  const canCreate = useCan(RC_CODES.applicantsCreate)
  const canEdit = useCan(RC_CODES.applicantsEdit)
  const canDelete = useCan(RC_CODES.applicantsDelete)
  const canApply = useCan(RC_CODES.applicationsCreate)
  const cities = useCityOptions(null)
  const [deleting, setDeleting] = useState<Applicant | null>(null)
  const remove = useDeleteApplicant()

  const list = useApplicants({
    q: search.q,
    source: search.source,
    cityId: search.cityId,
    page: search.page,
    pageSize: RC_PAGE_SIZE,
  })
  const update = (patch: Partial<CandidatesSearch>) => {
    void navigate({ search: (prev) => ({ ...prev, ...patch }) })
  }
  const filter = (patch: Partial<CandidatesSearch>) => {
    update({ ...patch, page: 1 })
  }
  const active = [search.q, search.source, search.cityId].filter(Boolean).length
  const closeDialog = () => {
    update({ view: undefined, edit: undefined, dialog: undefined })
  }

  const actionsFor = (applicant: Applicant): RowAction[] => [
    ...(canApply
      ? [
          {
            label: 'New Application',
            onSelect: () => {
              void goTo({
                to: '/recruitment/applications',
                search: { dialog: 'create', applicantId: applicant.id },
              })
            },
          },
        ]
      : []),
    ...(canEdit
      ? [
          {
            label: 'Edit',
            onSelect: () => {
              update({ edit: applicant.id, view: undefined })
            },
          },
        ]
      : []),
    ...(canDelete && applicant.applicationCount === 0
      ? [
          {
            label: 'Delete',
            variant: 'destructive' as const,
            onSelect: () => {
              setDeleting(applicant)
            },
          },
        ]
      : []),
  ]

  const columns: DataTableColumn<Applicant>[] = [
    {
      id: 'name',
      header: 'Candidate',
      mobile: 'heading',
      className: 'min-w-52',
      cell: (row) => (
        <button
          type="button"
          aria-label={`Open ${row.fullName}`}
          onClick={() => {
            update({ view: row.id })
          }}
          className="w-full rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <CandidateCell name={row.fullName} detail={row.email} />
        </button>
      ),
    },
    { id: 'phone', header: 'Phone', cell: (row) => row.phone ?? '—' },
    {
      id: 'role',
      header: 'Current Role',
      className: 'min-w-40 whitespace-normal',
      cell: (row) => [row.currentJobTitle, row.currentEmployer].filter(Boolean).join(' at ') || '—',
    },
    {
      id: 'experience',
      header: 'Experience',
      align: 'center',
      cell: (row) => (row.experienceYears === null ? '—' : `${String(row.experienceYears)} yrs`),
    },
    { id: 'city', header: 'City', cell: (row) => row.cityName ?? '—' },
    { id: 'source', header: 'Source', cell: (row) => labelOf(SOURCE_LABELS, row.source) },
    {
      id: 'applications',
      header: 'Applications',
      align: 'center',
      cell: (row) => row.applicationCount,
    },
    { id: 'added', header: 'Added', cell: (row) => formatDay(row.createdAt) },
  ]

  return (
    <PayrollCard
      title="Candidates"
      actions={
        canCreate && (
          <Button
            onClick={() => {
              update({ dialog: 'create', edit: undefined, view: undefined })
            }}
            className={cn(toolbarButton, btn.navy)}
          >
            + Add Candidate
          </Button>
        )
      }
    >
      <FilterBar
        label="Filter candidates"
        active={active}
        onClear={() => {
          filter({ q: undefined, source: undefined, cityId: undefined })
        }}
      >
        <FilterField label="Search" className="@4xl:col-span-2">
          {(id) => (
            <SearchBox
              key={search.q ?? ''}
              id={id}
              value={search.q}
              label="Search candidates"
              placeholder="Name, email, phone or role"
              onSearch={(q) => {
                filter({ q })
              }}
            />
          )}
        </FilterField>
        <FilterField label="Source">
          {(id) => (
            <SearchSelect
              id={id}
              value={search.source ?? null}
              onChange={(value) => {
                filter({ source: (value as Applicant['source']) ?? undefined })
              }}
              options={SOURCE_OPTIONS}
              placeholder="All sources"
              clearable
            />
          )}
        </FilterField>
        <FilterField label="City">
          {(id) => (
            <SearchSelect
              id={id}
              value={search.cityId ?? null}
              onChange={(value) => {
                filter({ cityId: value ?? undefined })
              }}
              options={cities.options}
              placeholder="All cities"
              clearable
              loading={cities.isPending}
            />
          )}
        </FilterField>
      </FilterBar>

      {list.isError ? (
        <ListError error={list.error} what="candidates" onRetry={() => void list.refetch()} />
      ) : (
        <div className="relative min-w-0 overflow-x-auto">
          <DataTable
            columns={columns}
            data={list.data?.data ?? []}
            getRowId={(row) => row.id}
            caption="Candidates"
            isLoading={list.isPending}
            isFetching={list.isFetching}
            className={payrollTableClass}
            emptyState={
              active > 0
                ? 'No candidates match the search or filters.'
                : 'No candidates yet. Add Candidate registers the first one.'
            }
            rowActionsHeader="Actions"
            rowActions={(row) => (
              <RowActionsMenu
                label={`Actions for ${row.fullName}`}
                itemClassName={rowMenuItemClass.inter}
                actions={[
                  {
                    label: 'View',
                    onSelect: () => {
                      update({ view: row.id })
                    },
                  },
                  ...actionsFor(row),
                ]}
              />
            )}
          />
        </div>
      )}
      <ListFooter
        meta={list.data?.meta}
        noun={list.data?.meta.total === 1 ? 'candidate' : 'candidates'}
        disabled={list.isFetching}
        onPageChange={(page) => {
          update({ page })
        }}
      />

      {search.view && (
        <ApplicantDetailDialog id={search.view} onClose={closeDialog} actionsFor={actionsFor} />
      )}
      {(search.dialog === 'create' || search.edit) && (
        <ApplicantFormDialog
          id={search.edit ?? null}
          onClose={closeDialog}
          onSaved={(saved) => {
            if (search.edit) closeDialog()
            else update({ dialog: undefined, view: saved.id })
          }}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title="Delete candidate"
        description={`Delete ${deleting?.fullName ?? 'this candidate'}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          if (deleting) {
            const target = deleting
            remove.mutate(target, {
              onSuccess: () => {
                if (search.view === target.id) closeDialog()
              },
            })
          }
          setDeleting(null)
        }}
      />
    </PayrollCard>
  )
}
