import { useRef, useState } from 'react'
import { toast } from 'sonner'

import { ErrorState } from '@/components/feedback/error-state'
import { DataTable, type DataTableColumn } from '@/components/layout'
import { parseCsv, toNumber } from '@/features/payroll'
import { cn } from '@/lib/utils'

import type { EmployeePositionFilters } from '../../api/manpower.api'
import { ACTIVE_META, DEFAULT_PAGE_SIZE } from '../../constants'
import {
  useDeletePosition,
  useEmployeePositions,
  useImportPositions,
  useManpowerLookups,
  useSetPositionActive,
} from '../../hooks/use-manpower'
import type { EmployeePositionImportRow, EmployeePositionRow } from '../../types/manpower.types'
import { toastError } from '../../utils/errors'
import { formatAmount } from '../../utils/format'
import { Chip, StampCell } from '../shared/cells'
import { MpField, MpListFooter, type MpOption, MpSelect } from '../shared/controls'
import {
  AddIcon,
  CheckIcon,
  CloseIcon,
  DeleteIcon,
  EditIcon,
  RefreshIcon,
  SearchIcon,
  UploadExcelIcon,
} from '../shared/mp-icons'
import { accent, boxClass, mpTableClass, smallButton } from '../shared/mp-styles'
import { MpCard } from '../shared/page-shell'
import { ConfirmPopup } from '../shared/popups'
import { RowMenu } from '../shared/row-menu'
import { EmployeePositionDialog } from './employee-position-dialog'
import { SettingsTabs } from './settings-tabs'

type Filters = Required<{ [K in keyof EmployeePositionFilters]: string }>
const NO_FILTERS: Filters = {
  code: '',
  divisionId: '',
  stationId: '',
  departmentId: '',
  subDepartmentId: '',
  employeeGroupId: '',
  costCenterId: '',
  positionTitleId: '',
  reportsToId: '',
  gradeId: '',
  status: '',
}

const optionsOf = (list: readonly { id: string; name: string }[]): MpOption[] =>
  list.map((item) => ({ value: item.id, label: item.name }))

const toolbarButton =
  'inline-flex h-10 items-center justify-center gap-3 rounded-[6px] px-3 text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-[3px] focus-visible:ring-[#7469E8]/35 disabled:opacity-60'

/** Upload Excel: an Excel sheet saved as CSV, one employee position per line, by names. */
function UploadExcelButton() {
  const input = useRef<HTMLInputElement>(null)
  const upload = useImportPositions()
  return (
    <>
      <button
        type="button"
        disabled={upload.isPending}
        onClick={() => input.current?.click()}
        className={cn(toolbarButton, accent.bg, 'min-w-[9.25rem]')}
      >
        <UploadExcelIcon aria-hidden="true" className="h-[1.375rem] w-[1.24rem]" />
        Upload Excel
      </button>
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv"
        aria-label="Upload employee positions (CSV saved from Excel)"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return
          void file.text().then(async (text) => {
            const rows: EmployeePositionImportRow[] = parseCsv(text, 'position').map((cells) => {
              const min = toNumber(cells[10])
              const max = toNumber(cells[11])
              return {
                code: cells[0] ?? '',
                positionTitle: cells[1] ?? '',
                division: cells[2] ?? '',
                station: cells[3] ?? '',
                department: cells[4] ?? '',
                subDepartment: cells[5] ?? '',
                employeeGroup: cells[6] ?? '',
                costCenter: cells[7] ?? '',
                grade: cells[8] ?? '',
                reportsTo: cells[9] ?? '',
                // A bad amount goes as -1 so the server names the line.
                minSalary: Number.isFinite(min) ? min : -1,
                maxSalary: Number.isFinite(max) ? max : -1,
              }
            })
            if (rows.length === 0) {
              toast.error(
                'The file has no rows. Columns: Position Code, Position Title, Division, Station, Department, Sub-Department, Employee Group, Cost Center, Grade, Reports To, Minimum Salary, Maximum Salary.',
              )
              return
            }
            try {
              const result = await upload.mutateAsync(rows)
              if (result.errors.length > 0) toast.error(result.errors.slice(0, 3).join('\n'))
            } catch {
              toast.error('The file could not be uploaded.')
            }
          })
        }}
      />
    </>
  )
}

/** E-Budget Settings → Employee Position: positions with their place and salary range. */
export function EmployeePositionsTab({
  page,
  goTo,
  filtersOpen,
}: {
  page: number
  goTo: (page: number) => void
  filtersOpen: boolean
}) {
  const lookups = useManpowerLookups()
  const [draft, setDraft] = useState<Filters>(NO_FILTERS)
  const [applied, setApplied] = useState<Filters>(NO_FILTERS)
  const [dialog, setDialog] = useState<{ position: EmployeePositionRow | null } | null>(null)
  const [deleting, setDeleting] = useState<EmployeePositionRow | null>(null)
  const remove = useDeletePosition()
  const setActive = useSetPositionActive()
  const list = useEmployeePositions({ page, pageSize: DEFAULT_PAGE_SIZE, ...applied })
  const offset = (page - 1) * DEFAULT_PAGE_SIZE
  const data = lookups.data

  const columns: DataTableColumn<EmployeePositionRow>[] = [
    { id: 'sr', header: 'Sr#', cell: (_row, index) => offset + index + 1 },
    {
      id: 'position',
      header: 'Position',
      mobile: 'heading',
      cell: (row) => (
        <span className="flex flex-col">
          {row.positionTitle}
          <span className="text-xs text-[#707070] dark:text-muted-foreground">{row.code}</span>
        </span>
      ),
    },
    { id: 'min', header: 'Minimum Salary', cell: (row) => formatAmount(row.minSalary) },
    { id: 'max', header: 'Maximum Salary', cell: (row) => formatAmount(row.maxSalary) },
    { id: 'added', header: 'Added On', cell: (row) => <StampCell stamp={row.added} /> },
    { id: 'modified', header: 'Modified On', cell: (row) => <StampCell stamp={row.modified} /> },
    {
      id: 'status',
      header: <span className="sr-only">Status</span>,
      align: 'right',
      cell: (row) => <Chip {...ACTIVE_META[row.active ? 'true' : 'false']} />,
    },
  ]

  const set = (field: keyof Filters) => (value: string) => {
    setDraft((current) => {
      const next = { ...current, [field]: value }
      if (field === 'divisionId') {
        const department = data?.departments.find((item) => item.id === current.departmentId)
        if (value && department && department.divisionId !== value) {
          next.departmentId = ''
          next.subDepartmentId = ''
        }
      }
      if (field === 'departmentId') next.subDepartmentId = ''
      return next
    })
  }
  const select = (field: keyof Filters, label: string, options: readonly MpOption[]) => (
    <MpField label={label}>
      {(a11y) => (
        <MpSelect
          {...a11y}
          value={draft[field]}
          onChange={set(field)}
          noneLabel="Any"
          placeholder=""
          disabled={field === 'subDepartmentId' && !draft.departmentId}
          options={options}
        />
      )}
    </MpField>
  )

  return (
    <MpCard title="Employee Position">
      {filtersOpen && (
        <form
          aria-label="Employee position filters"
          className="grid grid-cols-1 items-end gap-x-5 gap-y-6 px-4 sm:px-6 @md:grid-cols-2 @3xl:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault()
            setApplied(draft)
            goTo(1)
          }}
        >
          <MpField label="Position Code">
            {(a11y) => (
              <input
                {...a11y}
                value={draft.code}
                onChange={(event) => {
                  set('code')(event.target.value)
                }}
                className={cn(boxClass, 'w-full')}
              />
            )}
          </MpField>
          {select('divisionId', 'Division', optionsOf(data?.divisions ?? []))}
          {select('stationId', 'Station', optionsOf(data?.stations ?? []))}
          {select(
            'departmentId',
            'Department',
            optionsOf(
              (data?.departments ?? []).filter(
                (item) => !draft.divisionId || item.divisionId === draft.divisionId,
              ),
            ),
          )}
          {select(
            'subDepartmentId',
            'Sub-Department',
            optionsOf(
              (data?.subDepartments ?? []).filter(
                (item) => item.departmentId === draft.departmentId,
              ),
            ),
          )}
          {select('employeeGroupId', 'Employee Group', optionsOf(data?.employeeGroups ?? []))}
          {select('costCenterId', 'Cost Center', optionsOf(data?.costCenters ?? []))}
          {select(
            'positionTitleId',
            'Position Title',
            (data?.positionTitles ?? []).map((item) => ({ value: item.id, label: item.title })),
          )}
          {select(
            'reportsToId',
            'Reports To',
            (data?.employees ?? []).map((person) => ({ value: person.id, label: person.name })),
          )}
          {select('gradeId', 'Grade', optionsOf(data?.grades ?? []))}
          {select('status', 'Status', [
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ])}
          <div className="flex gap-2.5">
            <button type="submit" className={cn(smallButton, accent.bg, 'flex-1 gap-2.5')}>
              <SearchIcon aria-hidden="true" className="size-[1.055rem]" />
              Search
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(NO_FILTERS)
                setApplied(NO_FILTERS)
                goTo(1)
                void list.refetch()
              }}
              className={cn(smallButton, accent.bg, 'flex-1 gap-2.5')}
            >
              <RefreshIcon aria-hidden="true" className="h-[1.13rem] w-[0.85rem]" />
              Refresh
            </button>
          </div>
        </form>
      )}
      <div>
        <div className="flex flex-wrap items-end justify-between gap-3 pr-4 sm:pr-7">
          <SettingsTabs current="employee-position" />
          <div className="flex flex-wrap gap-2 pb-1 pl-4">
            <UploadExcelButton />
            <button
              type="button"
              disabled={!data}
              onClick={() => {
                setDialog({ position: null })
              }}
              className={cn(toolbarButton, accent.bg, 'min-w-[12.75rem]')}
            >
              <AddIcon aria-hidden="true" className="size-[0.8125rem]" />
              Add Employee Position
            </button>
          </div>
        </div>
        {list.isError ? (
          <ErrorState
            message="The employee positions could not be loaded."
            onRetry={() => void list.refetch()}
            className="mx-4 shadow-none sm:mx-6"
          />
        ) : (
          <DataTable
            columns={columns}
            data={list.data?.data ?? []}
            getRowId={(row) => row.id}
            caption="Employee positions"
            isLoading={list.isPending}
            isFetching={list.isFetching}
            className={mpTableClass}
            emptyState="No employee positions match."
            rowActionsHeader="Action"
            rowActions={(row) => (
              <RowMenu
                label={`Actions for ${row.positionTitle} ${row.code}`}
                items={[
                  {
                    label: 'Edit',
                    icon: EditIcon,
                    disabled: !data,
                    onSelect: () => {
                      setDialog({ position: row })
                    },
                  },
                  {
                    label: row.active ? 'Deactivate' : 'Activate',
                    icon: row.active ? CloseIcon : CheckIcon,
                    onSelect: () => {
                      setActive.mutate(
                        { id: row.id, active: !row.active },
                        { onError: toastError('The employee position could not be changed.') },
                      )
                    },
                  },
                  {
                    label: 'Delete',
                    icon: DeleteIcon,
                    onSelect: () => {
                      setDeleting(row)
                    },
                  },
                ]}
              />
            )}
          />
        )}
      </div>
      <MpListFooter meta={list.data?.meta} disabled={list.isFetching} onPageChange={goTo} />

      {dialog && data && (
        <EmployeePositionDialog
          position={dialog.position}
          lookups={data}
          onClose={() => {
            setDialog(null)
          }}
        />
      )}
      <ConfirmPopup
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title="Delete Employee Position"
        icon={DeleteIcon}
        message="Are you sure you want to Delete this employee position?"
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleting) {
            remove.mutate(deleting.id, {
              onError: toastError('The employee position could not be deleted.'),
            })
          }
        }}
      />
    </MpCard>
  )
}
