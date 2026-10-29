import { AppDialog } from '@/components/feedback/app-dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import { FINAL_SETTLEMENT_STATUS_META, SEPARATION_REASON_LABELS } from '../../constants'
import { useFinalSettlement } from '../../hooks/use-payroll'
import { formatLong, formatRs, formatStamp } from '../../utils/format'
import { btn, footerButton } from '../../utils/styles'
import { ReadOnlyRow } from '../balances/list-parts'

/** A total, or "Not calculated yet" while the settlement is pending (Recalculate works it out). */
const amount = (value: number | null) => (value === null ? 'Not calculated yet' : formatRs(value))

/**
 * "Final Settlement View" (`GET /final-settlements/{id}`): the separation as Off-boarding recorded
 * it, the settlement's totals and the signed letter, read-only.
 */
export function FinalSettlementView({ id, onClose }: { id: string; onClose: () => void }) {
  const record = useFinalSettlement(id)
  const data = record.data
  return (
    <AppDialog
      title="Final Settlement View"
      onRequestClose={onClose}
      className="max-w-3xl"
      footer={
        <Button onClick={onClose} className={cn(footerButton, btn.red)}>
          Cancel
        </Button>
      }
    >
      {!data ? (
        record.isError ? (
          <p role="alert" className="text-sm text-destructive">
            The final settlement could not be loaded.
          </p>
        ) : (
          <Skeleton className="h-80 w-full" />
        )
      ) : (
        <div className="grid gap-4">
          <ReadOnlyRow label="Employee" value={`${data.employeeName} (${data.employeeCode})`} />
          <ReadOnlyRow label="Department" value={data.departmentName ?? '—'} />
          <ReadOnlyRow
            label="Reason"
            value={data.reason ? (SEPARATION_REASON_LABELS[data.reason] ?? data.reason) : '—'}
          />
          <ReadOnlyRow
            label="Resignation Date"
            value={data.resignationDate ? formatLong(data.resignationDate.slice(0, 10)) : '—'}
          />
          <ReadOnlyRow label="Last Working Date" value={formatLong(data.lastWorkingDate)} />
          <ReadOnlyRow label="Status" value={FINAL_SETTLEMENT_STATUS_META[data.status].label} />
          <ReadOnlyRow label="Total Earnings" value={amount(data.totalEarnings)} />
          <ReadOnlyRow label="Total Deductions" value={amount(data.totalDeductions)} />
          <ReadOnlyRow label="Net Payable" value={amount(data.netPayable)} />
          {data.closedAt && <ReadOnlyRow label="Closed At" value={formatStamp(data.closedAt)} />}
          <ReadOnlyRow
            label="Settlement Letter"
            value={
              data.file ? (
                <a
                  href={data.file.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline-offset-2 hover:underline"
                >
                  {data.file.name ?? 'Attachment'}
                </a>
              ) : (
                '—'
              )
            }
          />
          <ReadOnlyRow label="Description" value={data.description ?? '—'} />
        </div>
      )}
    </AppDialog>
  )
}
