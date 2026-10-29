import { type SyntheticEvent, useState } from 'react'
import { getRouteApi, Link } from '@tanstack/react-router'
import { Info, Mail, Phone, Search } from 'lucide-react'

import { ConfirmDialog } from '@/components/feedback/confirm-dialog'
import { FilterSlidersIcon } from '@/components/icons/attendance-menu-icons'
import {
  type DataTableColumn,
  EmployeeAvatar,
  PaginatedTableCard,
  RowActionsMenu,
  rowMenuItemClass,
} from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useEmployeeLookupSearch } from '@/hooks/use-employee-lookup'
import { useCan } from '@/lib/permissions'
import { cn } from '@/lib/utils'

import { EMPLOYEE_PAGE_SIZES, isInactiveStatus, statusMeta, TM_CODES } from '../../constants'
import { useEmployeeList, useSetEmployeeActive } from '../../hooks/use-employees'
import type { Employee } from '../../types/employees.types'
import { serialOf } from '../../utils/format'
import {
  employeeTableClass,
  headerIconButtonClass,
  navyButtonClass,
  outlineButtonClass,
  pageTitleClass,
  toolbarButtonClass,
} from '../../utils/styles'
import { Chip } from '../shared/parts'
import { type EmployeeFilters, EmployeeFiltersDialog } from './employee-filters-dialog'
import { EmployeeFormDialog } from './employee-form-dialog'
import { EmployeeKpiTiles } from './employee-kpi-tiles'

const routeApi = getRouteApi('/_app/talent-management/employees/')

const ABOUT =
  'Employee Record: every employee of the company with their registration number, department and designation. Open a person for their profile; Add New registers someone.'

/** The HR team, for the phone button: the people of the HR department. */
function HrContacts() {
  const lookup = useEmployeeLookupSearch({ permission: TM_CODES.view }, { pageSize: 100 })
  const people = lookup.rows.filter((row) => /human resource/i.test(row.departmentName ?? ''))
  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium text-heading">HR contacts</p>
      {lookup.isPending ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : people.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nobody is listed in HR.</p>
      ) : (
        <ul className="grid gap-1.5">
          {people.map((person) => (
            <li key={person.id} className="text-xs leading-snug">
              <span className="font-medium text-sidebar dark:text-heading">{person.name}</span>
              <span className="block text-grey">
                {person.designationName ?? person.jobTitleName}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Staff: the 24px photo, the name (a link to the profile, stretched over the row) and email. */
function StaffCell({ employee }: { employee: Employee }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <EmployeeAvatar
        name={employee.name}
        photoUrl={employee.photoUrl}
        className="size-7 shrink-0"
      />
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-1.5">
          <Link
            to="/talent-management/employees/$employeeId"
            params={{ employeeId: employee.id }}
            className="truncate text-[0.6875rem] font-medium text-person outline-none after:absolute after:inset-0 hover:underline focus-visible:underline dark:text-heading"
          >
            {employee.name}
          </Link>
          {employee.status !== 'active' && <Chip meta={statusMeta(employee.status)} />}
        </span>
        <span className="block truncate text-[0.5625rem] text-grey">{employee.email}</span>
      </span>
    </span>
  )
}

/**
 * Employee Record (frame 1091:2428): the title with "+ Add New" and the mail / phone / info /
 * filter buttons, the four tiles, then the Employees table with Search and its pager. Search,
 * filters, page and the open dialog live in the URL.
 */
export function EmployeeRecordPage() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const canCreate = useCan(TM_CODES.create)
  const canEdit = useCan(TM_CODES.edit)
  const canDeactivate = useCan(TM_CODES.deactivate)
  const [text, setText] = useState(search.q ?? '')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [switching, setSwitching] = useState<Employee | null>(null)
  const setActive = useSetEmployeeActive()

  const list = useEmployeeList({
    q: search.q,
    status: search.status,
    includeInactive: search.includeInactive,
    branchId: search.branchId,
    departmentId: search.departmentId,
    designationId: search.designationId,
    page: search.page,
    pageSize: search.pageSize,
  })

  const update = (patch: Partial<typeof search>) => {
    void navigate({ search: (current) => ({ ...current, ...patch }) })
  }
  const filters: EmployeeFilters = {
    status: search.status,
    branchId: search.branchId,
    departmentId: search.departmentId,
    designationId: search.designationId,
    includeInactive: search.includeInactive,
  }
  const filterCount = Object.values(filters).filter(Boolean).length
  const page = list.data?.meta.page ?? search.page

  const columns: DataTableColumn<Employee>[] = [
    {
      id: 'serial',
      header: 'Sr. #',
      mobile: 'hidden',
      className: 'w-14',
      cell: (_row, index) => serialOf(page, search.pageSize, index),
    },
    {
      id: 'staff',
      header: 'Staff',
      mobile: 'heading',
      className: 'min-w-44',
      cell: (row) => <StaffCell employee={row} />,
    },
    { id: 'code', header: 'Reg. #', cell: (row) => row.code },
    {
      id: 'department',
      header: 'Department',
      className: 'whitespace-normal',
      cell: (row) => row.departmentName ?? '—',
    },
    {
      id: 'designation',
      header: 'Designation',
      className: 'whitespace-normal',
      cell: (row) => row.designationName ?? row.jobTitleName ?? '—',
    },
    {
      id: 'action',
      header: 'Action',
      align: 'center',
      className: 'w-16',
      cell: (row) => (
        <span className="relative z-10 inline-flex">
          <RowActionsMenu
            label={`Actions for ${row.name}`}
            itemClassName={rowMenuItemClass.poppins}
            actions={[
              {
                label: 'View Profile',
                onSelect: () => {
                  void navigate({
                    to: '/talent-management/employees/$employeeId',
                    params: { employeeId: row.id },
                  })
                },
              },
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
              ...(canDeactivate
                ? [
                    {
                      label: isInactiveStatus(row.status) ? 'Reactivate' : 'Deactivate',
                      variant: isInactiveStatus(row.status)
                        ? ('default' as const)
                        : ('destructive' as const),
                      onSelect: () => {
                        setSwitching(row)
                      },
                    },
                  ]
                : []),
            ]}
          />
        </span>
      ),
    },
  ]

  const onSearch = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    update({ q: text.trim() || undefined, page: 1 })
  }
  const mailto = `mailto:?subject=${encodeURIComponent('Employee Record')}&body=${encodeURIComponent(
    typeof window === 'undefined' ? '' : window.location.href,
  )}`

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card px-4 py-4 shadow-xs sm:px-6">
        <h1 className={pageTitleClass}>Employee Record</h1>
        <div className="flex flex-wrap items-center gap-2.5">
          {canCreate && (
            <Button
              onClick={() => {
                update({ dialog: 'add', edit: undefined })
              }}
              className={cn(toolbarButtonClass, navyButtonClass, 'px-5 text-xs')}
            >
              + Add New
            </Button>
          )}
          <a href={mailto} aria-label="Email a link to this page" className={headerIconButtonClass}>
            <Mail aria-hidden="true" strokeWidth={1.75} />
          </a>
          <Popover>
            <PopoverTrigger aria-label="HR contacts" className={headerIconButtonClass}>
              <Phone aria-hidden="true" strokeWidth={1.75} />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64">
              <HrContacts />
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger aria-label="About this page" className={headerIconButtonClass}>
              <Info aria-hidden="true" strokeWidth={1.75} />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 text-xs leading-relaxed text-heading">
              {ABOUT}
            </PopoverContent>
          </Popover>
          {/* No filter icon here: the table's Filter button (with its count) opens the panel. */}
        </div>
      </header>

      <EmployeeKpiTiles />

      <PaginatedTableCard
        title="Employees"
        titleAs="h2"
        caption="Employees"
        className={cn(employeeTableClass, '[&_tbody_tr]:relative [&_ul>li]:relative')}
        toolbar={
          <>
            <form
              role="search"
              onSubmit={onSearch}
              className="flex min-w-0 flex-1 gap-2 sm:max-w-md"
            >
              <Input
                aria-label="Search employees"
                placeholder="Search ..."
                value={text}
                onChange={(event) => {
                  setText(event.target.value)
                }}
                className="h-9 min-w-0 flex-1"
              />
              <Button
                type="submit"
                className={cn(toolbarButtonClass, navyButtonClass, 'gap-2 px-4 text-xs')}
              >
                <Search aria-hidden="true" className="size-4" />
                Search
              </Button>
            </form>
            <Button
              variant="outline"
              onClick={() => {
                setFiltersOpen(true)
              }}
              className={cn(toolbarButtonClass, outlineButtonClass, 'gap-2 px-4')}
            >
              <FilterSlidersIcon aria-hidden="true" className="size-5" />
              Filter
              {filterCount > 0 && (
                <span className="rounded-full bg-sidebar px-1.5 text-[0.6875rem] text-white dark:bg-primary">
                  {filterCount}
                  <span className="sr-only"> in use</span>
                </span>
              )}
            </Button>
          </>
        }
        columns={columns}
        result={list}
        page={search.page}
        pageSize={search.pageSize}
        pageSizeOptions={EMPLOYEE_PAGE_SIZES}
        onPageChange={(next) => {
          update({ page: next })
        }}
        onPageSizeChange={(size) => {
          update({ pageSize: size, page: 1 })
        }}
        getRowId={(row) => row.id}
        emptyState={
          search.q || filterCount > 0
            ? 'No employees match the search or filters.'
            : 'No employees yet. Add New registers the first one.'
        }
      />

      {(search.dialog === 'add' || search.edit) && (
        <EmployeeFormDialog
          employeeId={search.edit ?? null}
          onClose={() => {
            update({ dialog: undefined, edit: undefined })
          }}
        />
      )}
      {filtersOpen && (
        <EmployeeFiltersDialog
          value={filters}
          onApply={(next) => {
            update({ ...next, page: 1 })
          }}
          onClose={() => {
            setFiltersOpen(false)
          }}
        />
      )}
      {switching && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setSwitching(null)
          }}
          title={isInactiveStatus(switching.status) ? 'Reactivate employee' : 'Deactivate employee'}
          description={
            isInactiveStatus(switching.status)
              ? `Reactivate ${switching.name}? Their record becomes active again.`
              : `Deactivate ${switching.name}? Their record is switched off with their sign-in accounts.`
          }
          confirmLabel={isInactiveStatus(switching.status) ? 'Reactivate' : 'Deactivate'}
          variant={isInactiveStatus(switching.status) ? 'default' : 'destructive'}
          onConfirm={() => {
            setActive.mutate({
              employee: switching,
              active: isInactiveStatus(switching.status),
            })
            setSwitching(null)
          }}
        />
      )}
    </>
  )
}
