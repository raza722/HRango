import type { ReactNode } from 'react'

import type { DataTableColumn } from '@/components/layout'
import { Checkbox } from '@/components/ui/checkbox'

import type { TransferRequest } from '../../types/requests.types'
import { listDate } from '../../utils/request-format'
import { TransferPersonCell, TransferStatusChip } from './transfer-parts'

type Column = DataTableColumn<TransferRequest>

/** The tick column: only requests waiting for your decision can be ticked. */
export function selectColumn(
  rows: readonly TransferRequest[],
  selected: ReadonlySet<string>,
  onChange: (next: ReadonlySet<string>) => void,
): Column {
  const tickable = rows.filter((row) => row.actions.includes('decide'))
  const allTicked = tickable.length > 0 && tickable.every((row) => selected.has(row.id))
  return {
    id: 'select',
    header: (
      <Checkbox
        tone="navy"
        aria-label="Select all requests waiting for your decision"
        checked={allTicked}
        disabled={tickable.length === 0}
        onCheckedChange={(checked) => {
          onChange(checked === true ? new Set(tickable.map((row) => row.id)) : new Set())
        }}
      />
    ),
    className: 'w-10',
    mobile: 'hidden',
    cell: (row) => (
      <Checkbox
        tone="navy"
        aria-label={`Select ${row.code}`}
        checked={selected.has(row.id)}
        disabled={!row.actions.includes('decide')}
        onCheckedChange={(checked) => {
          const next = new Set(selected)
          if (checked === true) next.add(row.id)
          else next.delete(row.id)
          onChange(next)
        }}
      />
    ),
  }
}

const nowrap = (content: ReactNode) => <span className="whitespace-nowrap">{content}</span>

const code: Column = {
  id: 'code',
  header: 'Code',
  mobile: 'heading',
  cell: (row) => nowrap(row.code),
}
const employee: Column = {
  id: 'employee',
  header: 'Employee',
  className: 'min-w-36',
  cell: (row) => <TransferPersonCell employee={row.employee} />,
}
const effectiveDate: Column = {
  id: 'effectiveDate',
  header: 'Effective Date',
  cell: (row) => nowrap(row.payload.effectiveDate ? listDate(row.payload.effectiveDate) : '—'),
}
// The design's Requests frame shows dates under Department; it lists the new department.
const department: Column = {
  id: 'department',
  header: 'Department',
  className: 'min-w-28 whitespace-normal',
  cell: (row) => row.payload.departmentName ?? '—',
}
const authority: Column = {
  id: 'authority',
  header: 'Approving Authority',
  cell: (row) => row.currentStep?.authority ?? '—',
}
const nextRequestee: Column = {
  id: 'next',
  header: 'Next Requestee',
  cell: (row) => row.nextApprover?.name ?? '—',
}
const status: Column = {
  id: 'status',
  header: 'Status',
  align: 'center',
  cell: (row) => <TransferStatusChip status={row.status} />,
}

/** Requests: Code, Employee, Effective Date, Department, Status. */
export const transferRequestColumns: Column[] = [code, employee, effectiveDate, department, status]

/** Approvals add the approving authority and the next requestee. */
export const transferApprovalColumns: Column[] = [
  code,
  employee,
  effectiveDate,
  department,
  authority,
  nextRequestee,
  status,
]
