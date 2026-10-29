import { useId, useState } from 'react'
import { toast } from 'sonner'

import { ErrorState } from '@/components/feedback/error-state'
import { DataTable, type DataTableColumn } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api-error'
import { useCan } from '@/lib/permissions'
import { useAuthStore } from '@/stores/auth-store'

import { overtimeApi } from '../../api/overtime.api'
import {
  useAllOvertimePolicies,
  useOvertimeBatch,
  useOvertimeRequests,
} from '../../hooks/use-overtime'
import type { OvertimeApplication } from '../../types/overtime.types'
import { clockLabel, dayLabel, serialLabel, spanMinutes } from '../../utils/overtime-format'
import { policyCap, policyOfPeriod } from '../../utils/overtime-policy'
import {
  overtimeNavyButtonClass,
  overtimeTableClass,
  sheetInputClass,
} from '../../utils/overtime-styles'
import { BulkRequestDialog } from './bulk-request-dialog'
import type { OvertimeTabProps } from './overtime-page'
import { OvertimeEmpty, OvertimePersonCell, OvertimeTitleRow } from './overtime-parts'

/** What was typed into a row's two boxes. */
interface RowEdit {
  applied: string
  approved: string
}

/** The sheet reads one large page of pending requests. */
const SHEET_SIZE = 100

const digits = (value: string) => /^\d+$/.test(value.trim())

const errorText = (failure: unknown) =>
  failure instanceof ApiError
    ? (Object.values(failure.fieldErrors)[0] ?? failure.message)
    : failure instanceof Error
      ? failure.message
      : 'Not saved.'

/**
 * Bulk Overtime (frame 2823:12287): the sheet of everyone's pending overtime requests (`GET
 * /requests/overtime?view=all&status=pending`, your own left out), with Applied Overtime Minutes
 * and Approved Minutes to type per row, "+ Create" (Create Bulk Overtime Request) and "Bulk
 * Save". Bulk Save writes changed applied minutes (`PUT /requests/overtime/{id}`, allowed while
 * nobody has acted) and approves the rows given approved minutes: one
 * `POST /requests/approvals/bulk-approve` for rows approving exactly what was applied for, and
 * `POST …/{id}/approve` with `details.approvedMinutes` for the others. The active daily policy
 * caps the approved minutes. What the API refuses is shown on the row.
 */
export function BulkOvertimeTab({ update }: OvertimeTabProps) {
  const [creating, setCreating] = useState(false)
  const [edits, setEdits] = useState<Record<string, RowEdit>>({})
  const [problems, setProblems] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const errorId = useId()
  const batch = useOvertimeBatch()
  const user = useAuthStore((state) => state.user)
  const canCreate = useCan('requests.overtime.create')
  const canApprove = useCan('requests.approvals.approve')
  const sheet = useOvertimeRequests({
    view: 'all',
    status: 'pending',
    page: 1,
    pageSize: SHEET_SIZE,
  })
  const policies = useAllOvertimePolicies()
  const daily = policyOfPeriod(policies.data?.data ?? [], 'daily')
  const cap = policyCap(daily)
  const rows = (sheet.data?.data ?? []).filter((row) => row.employeeId !== user?.employeeId)
  const editOf = (row: OvertimeApplication): RowEdit =>
    edits[row.id] ?? { applied: String(row.appliedMinutes), approved: '' }
  const setEdit = (row: OvertimeApplication, patch: Partial<RowEdit>) => {
    setEdits((prev) => ({ ...prev, [row.id]: { ...editOf(row), ...patch } }))
    setProblems((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => id !== row.id)))
  }

  /** The row's typed values, or why they cannot be saved. */
  const check = (row: OvertimeApplication): string | null => {
    const edit = editOf(row)
    const span = spanMinutes(row.startTime, row.endTime)
    if (!digits(edit.applied) || Number(edit.applied) <= 0) return 'Enter the applied minutes'
    if (Number(edit.applied) > span) {
      return `At most ${String(span)} applied minutes, the time between the two clocks`
    }
    if (edit.approved.trim() === '') return null
    if (!digits(edit.approved)) return 'Whole minutes only'
    if (Number(edit.approved) <= 0) return 'Approve more than 0 minutes'
    if (Number(edit.approved) > Number(edit.applied)) {
      return 'Approved minutes cannot exceed the applied minutes'
    }
    if (cap !== null && Number(edit.approved) > cap) {
      return `${daily?.name ?? 'The daily policy'} caps a day at ${String(cap)} minutes`
    }
    return null
  }

  const bulkSave = async () => {
    setError(null)
    const found: Record<string, string> = {}
    for (const row of rows) {
      const problem = check(row)
      if (problem) found[row.id] = problem
    }
    setProblems(found)
    if (Object.keys(found).length > 0) {
      setError('Fix the highlighted rows first.')
      return
    }
    const changed = rows.filter((row) => Number(editOf(row).applied) !== row.appliedMinutes)
    const approving = rows.filter((row) => editOf(row).approved.trim() !== '')
    if (changed.length === 0 && approving.length === 0) {
      setError('Change applied minutes or give approved minutes first.')
      return
    }
    setSaving(true)
    const refused: Record<string, string> = {}
    const versions = new Map(rows.map((row) => [row.id, row.rowVersion]))
    let updated = 0
    let approved = 0
    await batch(async () => {
      // 1. The applied minutes (the request's own PUT, rebuilt from the row).
      for (const row of changed) {
        try {
          const saved = await overtimeApi.update(row.id, {
            fromDate: row.date,
            toDate: row.date,
            reason: row.reason,
            attachments: [],
            details: {
              departmentId: row.departmentId ?? '',
              locationId: row.locationId,
              branchId: row.branchId,
              overtimeDate: row.date,
              startTime: row.startTime,
              endTime: row.endTime,
              appliedMinutes: Number(editOf(row).applied),
            },
            rowVersion: row.rowVersion,
          })
          versions.set(row.id, saved.rowVersion)
          updated += 1
        } catch (failure) {
          refused[row.id] = errorText(failure)
        }
      }
      // 2. Approvals: approving exactly what was applied for needs no details (bulk-approve).
      const ready = approving.filter((row) => !refused[row.id])
      const whole = ready.filter((row) => editOf(row).approved === editOf(row).applied)
      const partial = ready.filter((row) => !whole.includes(row))
      if (whole.length > 0) {
        try {
          const results = await overtimeApi.bulkApprove(
            whole.map((row) => ({
              id: row.id,
              rowVersion: versions.get(row.id) ?? row.rowVersion,
            })),
            null,
          )
          for (const result of results) {
            if (result.ok) approved += 1
            else refused[result.id] = result.message ?? 'Not approved.'
          }
        } catch (failure) {
          for (const row of whole) refused[row.id] = errorText(failure)
        }
      }
      for (const row of partial) {
        try {
          await overtimeApi.decide(row.id, 'approve', {
            remarks: null,
            approvedMinutes: Number(editOf(row).approved),
            rowVersion: versions.get(row.id) ?? row.rowVersion,
          })
          approved += 1
        } catch (failure) {
          refused[row.id] = errorText(failure)
        }
      }
    })
    setSaving(false)
    setProblems(refused)
    setEdits((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([id]) => Boolean(refused[id]))),
    )
    const failed = Object.keys(refused).length
    if (updated + approved > 0) {
      toast.success(
        `Bulk Save: ${String(updated)} updated, ${String(approved)} approved${failed ? `, ${String(failed)} refused` : ''}`,
      )
    }
    if (failed > 0) {
      setError(`${String(failed)} row${failed === 1 ? ' was' : 's were'} not saved; see the rows.`)
    }
  }

  const columns: DataTableColumn<OvertimeApplication>[] = [
    {
      id: 'serial',
      header: 'Sr.#',
      mobile: 'hidden',
      cell: (_row, index) => serialLabel(1, SHEET_SIZE, index),
    },
    { id: 'regNo', header: 'Reg No#', cell: (row) => row.code },
    {
      id: 'employee',
      header: 'Employees',
      mobile: 'heading',
      className: 'min-w-32',
      cell: (row) => <OvertimePersonCell name={row.employeeName} code={row.employeeCode} />,
    },
    { id: 'start', header: 'Start Time', cell: (row) => clockLabel(row.startTime) },
    { id: 'end', header: 'End Time', cell: (row) => clockLabel(row.endTime) },
    {
      id: 'date',
      header: 'Date',
      cell: (row) => <span className="whitespace-nowrap">{dayLabel(row.date)}</span>,
    },
    {
      id: 'applied',
      header: 'Applied Overtime Minutes',
      align: 'center',
      className: 'max-w-28 whitespace-normal',
      cell: (row) => (
        <input
          aria-label={`Applied overtime minutes for ${row.employeeName}`}
          aria-invalid={Boolean(problems[row.id])}
          aria-describedby={problems[row.id] ? `${errorId}-${row.id}` : undefined}
          inputMode="numeric"
          value={editOf(row).applied}
          disabled={saving}
          onChange={(event) => {
            setEdit(row, { applied: event.target.value })
          }}
          className={sheetInputClass}
        />
      ),
    },
    {
      id: 'approved',
      header: 'Approved Minutes',
      align: 'center',
      className: 'max-w-28 whitespace-normal',
      cell: (row) => (
        <span className="grid justify-items-center gap-1">
          <input
            aria-label={`Approved minutes for ${row.employeeName}`}
            aria-invalid={Boolean(problems[row.id])}
            inputMode="numeric"
            placeholder="Leave for approval"
            value={editOf(row).approved}
            disabled={saving || !canApprove}
            onChange={(event) => {
              setEdit(row, { approved: event.target.value })
            }}
            className={sheetInputClass}
          />
          {problems[row.id] && (
            <span id={`${errorId}-${row.id}`} className="text-[0.625rem] text-destructive">
              {problems[row.id]}
            </span>
          )}
        </span>
      ),
    },
    {
      id: 'reason',
      header: 'Reason',
      className: 'min-w-28 max-w-40 whitespace-normal',
      cell: (row) => <span className="line-clamp-2">{row.reason ?? '—'}</span>,
    },
    {
      id: 'next',
      header: 'Waits For',
      className: 'min-w-24 whitespace-normal',
      cell: (row) => row.nextApproverName ?? '—',
    },
  ]

  return (
    <>
      <OvertimeTitleRow title="Bulk Overtime" titleId="bulk-overtime-title">
        {canCreate && (
          <Button
            onClick={() => {
              setCreating(true)
            }}
            className={overtimeNavyButtonClass}
          >
            + Create
          </Button>
        )}
        <Button
          disabled={saving || rows.length === 0}
          onClick={() => void bulkSave()}
          className={overtimeNavyButtonClass}
        >
          Bulk Save
        </Button>
      </OvertimeTitleRow>

      {rows.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Rows with approved minutes are approved on Bulk Save (if they wait for you)
          {cap !== null ? `; the daily policy caps a day at ${String(cap)} minutes` : ''}. Leave
          Approved Minutes empty to decide later under Applications.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {sheet.isError ? (
        <ErrorState
          title="Could not load the pending overtime"
          message={sheet.error.message}
          onRetry={() => void sheet.refetch()}
          className="shadow-none"
        />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          getRowId={(row) => row.id}
          caption="Bulk Overtime"
          isLoading={sheet.isPending}
          isFetching={sheet.isFetching && !saving}
          className={overtimeTableClass}
          emptyState={
            <OvertimeEmpty>
              No pending overtime: &quot;+ Create&quot; files requests for several people at once.
            </OvertimeEmpty>
          }
        />
      )}

      {creating && (
        <BulkRequestDialog
          onClose={() => {
            setCreating(false)
          }}
          onCreated={() => {
            update({ tab: 'bulk-overtime' })
          }}
        />
      )}
    </>
  )
}
