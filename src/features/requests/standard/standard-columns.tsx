import type { ReactNode } from 'react'

import type { DataTableColumn } from '@/components/layout'
import { Checkbox } from '@/components/ui/checkbox'

import type { StandardKindConfig, StandardRequest } from './standard.types'
import { StandardPersonCell, StandardStatusChip } from './standard-parts'
import { statusLabel } from './standard-styles'

type Column<P> = DataTableColumn<StandardRequest<P>>

/** The tick column: only requests waiting for your decision can be ticked (any request type). */
export function selectColumn<R extends { id: string; code: string; actions: readonly string[] }>(
  rows: readonly R[],
  selected: ReadonlySet<string>,
  onChange: (next: ReadonlySet<string>) => void,
): DataTableColumn<R> {
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

export const nowrap = (content: ReactNode) => <span className="whitespace-nowrap">{content}</span>

/** Columns most types share; a type adds its own with `text`. */
export const standardColumns = {
  code: <P,>(): Column<P> => ({
    id: 'code',
    header: 'Code',
    mobile: 'heading',
    cell: (row) => nowrap(row.code),
  }),
  employee: <P,>(header = 'Employee'): Column<P> => ({
    id: 'employee',
    header,
    className: 'min-w-36',
    cell: (row) => <StandardPersonCell person={row.employee} />,
  }),
  department: <P,>(): Column<P> => ({
    id: 'department',
    header: 'Department',
    className: 'min-w-24 whitespace-normal',
    cell: (row) => row.employee.department,
  }),
  /** "Approving Authority" / "Authority": the step waiting, or the last one. */
  authority: <P,>(header = 'Approving Authority'): Column<P> => ({
    id: 'authority',
    header,
    cell: (row) => row.currentStep?.authority ?? row.flow.at(-1)?.authority ?? '—',
  }),
  /** "Request Flow" / "Next Requestee": who decides next, as a person cell. */
  nextRequestee: <P,>(header = 'Request Flow'): Column<P> => ({
    id: 'next',
    header,
    className: 'min-w-32',
    cell: (row) =>
      row.currentStep ? <StandardPersonCell person={row.currentStep.approver} /> : '—',
  }),
  status: <P,>(config: Pick<StandardKindConfig, 'statusLabels'>): Column<P> => ({
    id: 'status',
    header: 'Status',
    align: 'center',
    cell: (row) => (
      <StandardStatusChip status={row.status} label={statusLabel(config, row.status)} />
    ),
  }),
  text: <P,>(
    id: string,
    header: string,
    value: (row: StandardRequest<P>) => ReactNode,
    className?: string,
  ): Column<P> => ({
    id,
    header,
    ...(className ? { className } : {}),
    cell: (row) => value(row),
  }),
}
