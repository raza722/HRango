import { useId, useState } from 'react'
import { toast } from 'sonner'

import { DataTable, type DataTableColumn } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  btn,
  footerButton,
  ListFooter,
  NoRecord,
  payrollTableClass,
  SearchSelect,
} from '@/features/payroll'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/utils'

import {
  useFlowAssignments,
  useRequestSettingsLookups,
  useSaveFlowAssignments,
} from '../../hooks/use-request-settings'
import { FLOW_AUTHORITY_LABELS, SETTINGS_PAGE_SIZE } from '../../settings.constants'
import type {
  FlowAssignmentRow,
  FlowAuthority,
  FlowRequestType,
} from '../../types/request-settings.types'
import { AuthorityPicker } from './authority-picker'
import { FLOW_REQUEST_TYPE_OPTIONS, useTicks } from './settings-helpers'
import { PersonWithCode } from './settings-parts'

const ALL = 'all'

/**
 * "Request Flow": the authorities each person's requests of a type go to.
 * Pick the Authority, tick the people, Save (grey until someone is ticked).
 */
export function FlowAssignmentCard({
  type,
  onTypeChange,
}: {
  type: FlowRequestType
  onTypeChange: (type: FlowRequestType) => void
}) {
  const titleId = useId()
  const fieldId = useId()
  const lookups = useRequestSettingsLookups()
  const save = useSaveFlowAssignments()
  const [authorities, setAuthorities] = useState<FlowAuthority[]>([])
  const [employeeId, setEmployeeId] = useState<string>(ALL)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const { ticked, toggle, clear } = useTicks()
  const list = useFlowAssignments({
    page,
    pageSize: SETTINGS_PAGE_SIZE,
    requestType: type,
    employeeId: employeeId === ALL ? undefined : employeeId,
    search: search.trim() || undefined,
  })
  const rows = list.data?.data ?? []

  const reset = () => {
    clear()
    setAuthorities([])
  }
  const submit = () => {
    if (authorities.length === 0) {
      toast.error('Choose the authority first.')
      return
    }
    save.mutate(
      { requestType: type, employeeIds: [...ticked], authorities },
      {
        onSuccess: reset,
        onError: (error) => {
          toast.error(error instanceof ApiError ? error.message : 'The authority was not saved.')
        },
      },
    )
  }

  const columns: DataTableColumn<FlowAssignmentRow>[] = [
    { id: 'code', header: 'ID', cell: (row) => row.employee.code },
    {
      id: 'name',
      header: 'Employee Name',
      mobile: 'heading',
      cell: (row) => <PersonWithCode person={row.employee} />,
    },
    { id: 'branch', header: 'Branch', cell: (row) => row.branch ?? '—' },
    { id: 'designation', header: 'Designation', cell: (row) => row.designation },
    {
      id: 'authority',
      header: 'Authority',
      cell: (row) => row.authorities.map((item) => FLOW_AUTHORITY_LABELS[item]).join(' → '),
    },
    {
      id: 'tick',
      header: 'Actions',
      align: 'center',
      cell: (row) => (
        <Checkbox
          tone="navy"
          aria-label={`Select ${row.employee.name}`}
          checked={ticked.has(row.employee.id)}
          onCheckedChange={(checked) => {
            toggle(row.employee.id, checked === true)
          }}
        />
      ),
    },
  ]

  const people = [
    { value: ALL, label: 'All' },
    ...(lookups.data?.employees ?? []).map((person) => ({
      value: person.id,
      label: person.name,
      hint: person.code,
    })),
  ]
  const row = 'grid gap-2 @xl:grid-cols-[10rem_minmax(0,1fr)] @xl:items-center'

  return (
    <section
      aria-labelledby={titleId}
      className="grid min-w-0 content-start gap-5 rounded-xl bg-card px-4 py-5 shadow-xs sm:px-6 sm:py-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={titleId} className="text-xl font-medium text-title sm:text-2xl">
          Request Flow
        </h2>
        <div className="flex flex-wrap gap-2.5">
          <Button
            type="button"
            disabled={ticked.size === 0 || save.isPending}
            onClick={submit}
            className={cn(
              footerButton,
              'h-9',
              ticked.size === 0 ? 'bg-[#BFC3C9] text-white disabled:opacity-100' : btn.green,
            )}
          >
            Save
          </Button>
          <Button type="button" onClick={reset} className={cn(footerButton, btn.red, 'h-9')}>
            Cancel
          </Button>
        </div>
      </div>

      <div className="@container grid gap-4">
        <div className={row}>
          <label htmlFor={`${fieldId}-type`} className="font-inter text-base text-heading">
            Request Type
          </label>
          <SearchSelect
            id={`${fieldId}-type`}
            value={type}
            onChange={(next) => {
              clear()
              setPage(1)
              onTypeChange((next ?? 'punch') as FlowRequestType)
            }}
            options={FLOW_REQUEST_TYPE_OPTIONS}
            placeholder="Select Request Type"
          />
        </div>
        <div className={row}>
          <label htmlFor={`${fieldId}-authority`} className="font-inter text-base text-heading">
            Authority
          </label>
          <AuthorityPicker
            id={`${fieldId}-authority`}
            value={authorities}
            onChange={setAuthorities}
          />
        </div>
        <div className={row}>
          <label htmlFor={`${fieldId}-employees`} className="font-inter text-base text-heading">
            Employees
          </label>
          <SearchSelect
            id={`${fieldId}-employees`}
            value={employeeId}
            onChange={(next) => {
              setEmployeeId(next ?? ALL)
              setPage(1)
            }}
            options={people}
            placeholder="Select Employee"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xl font-medium text-title sm:text-2xl">All</h3>
        <Input
          type="search"
          aria-label="Search employee"
          placeholder="Search Employee"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
          className="h-9 w-full sm:w-56"
        />
      </div>
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(item) => item.employee.id}
        caption={`Authorities for ${FLOW_REQUEST_TYPE_OPTIONS.find((item) => item.value === type)?.label ?? type}`}
        isLoading={list.isPending}
        isFetching={list.isFetching}
        className={payrollTableClass}
        emptyState={<NoRecord />}
      />
      <ListFooter
        meta={list.data?.meta}
        noun="employees"
        disabled={list.isFetching}
        onPageChange={setPage}
      />
    </section>
  )
}
