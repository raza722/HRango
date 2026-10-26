import type { DataTableColumn } from '@/components/layout'

import { PUNCH_TYPE_LABELS } from '../../constants'
import type { AnyRequest, PunchRequest, ShiftRequest } from '../../types/requests.types'
import { clock, listDate } from '../../utils/request-format'
import { StatusChip } from './request-controls'

type Column<T> = DataTableColumn<T>

const code = <T extends AnyRequest>(): Column<T> => ({
  id: 'code',
  header: 'Code',
  cell: (row) => <span className="whitespace-nowrap">{row.code}</span>,
  mobile: 'heading',
})
const employee = <T extends AnyRequest>(): Column<T> => ({
  id: 'employee',
  header: 'Employee',
  cell: (row) => row.employee.name,
  className: 'min-w-28',
})
/** The request's day (`fromDate`; the details carry it too). */
const date = <T extends PunchRequest | ShiftRequest>(): Column<T> => ({
  id: 'date',
  header: 'Date',
  cell: (row) => (
    <span className="whitespace-nowrap">{row.fromDate ? listDate(row.fromDate) : '—'}</span>
  ),
})
const nextRequestee = <T extends AnyRequest>(): Column<T> => ({
  id: 'next',
  header: 'Next Requestee',
  cell: (row) => row.nextApprover?.name ?? '—',
})
const authority = <T extends AnyRequest>(): Column<T> => ({
  id: 'authority',
  header: 'Approving Authority',
  cell: (row) => row.currentStep?.authority ?? '—',
})
const status = <T extends AnyRequest>(): Column<T> => ({
  id: 'status',
  header: 'Status',
  cell: (row) => <StatusChip status={row.status} />,
  align: 'center',
})

const punchTime: Column<PunchRequest> = {
  id: 'punchTime',
  header: 'Punch Time',
  cell: (row) => <span className="whitespace-nowrap">{clock(row.payload.punchTime)}</span>,
}
const punchType: Column<PunchRequest> = {
  id: 'punchType',
  header: 'Punch Type',
  cell: (row) => PUNCH_TYPE_LABELS[row.payload.punchType],
}

/** Punch Request (Request tab): Code … Next Requestee, Status. */
export const punchRequestColumns: Column<PunchRequest>[] = [
  code(),
  employee(),
  date(),
  punchTime,
  punchType,
  nextRequestee(),
  status(),
]

/** Punch Approval adds the approving authority. */
export const punchApprovalColumns: Column<PunchRequest>[] = [
  code(),
  employee(),
  date(),
  punchTime,
  punchType,
  authority(),
  nextRequestee(),
  status(),
]

const roster: Column<ShiftRequest> = {
  id: 'roster',
  header: 'Time Slot',
  cell: (row) => row.payload.timeSlotName ?? (row.payload.withEmployeeId ? 'Swap' : '—'),
}
const swapFrom: Column<ShiftRequest> = {
  id: 'swapFrom',
  header: 'Swap From',
  cell: (row) => row.payload.fromTimeSlotName ?? '—',
  className: 'min-w-32 whitespace-normal',
}
const swapTo: Column<ShiftRequest> = {
  id: 'swapTo',
  header: 'Swap To',
  cell: (row) => row.payload.withEmployeeName ?? '—',
}
const description: Column<ShiftRequest> = {
  id: 'description',
  header: 'Description',
  cell: (row) => <span className="line-clamp-2">{row.description ?? '—'}</span>,
  className: 'max-w-48 whitespace-normal',
}

export const shiftRequestColumns: Column<ShiftRequest>[] = [
  code(),
  employee(),
  date(),
  roster,
  swapFrom,
  swapTo,
  nextRequestee(),
  status(),
]

/** Shift Approval, as drawn: Code … Description, Status. */
export const shiftApprovalColumns: Column<ShiftRequest>[] = [
  code(),
  employee(),
  date(),
  roster,
  swapFrom,
  swapTo,
  description,
  status(),
]
