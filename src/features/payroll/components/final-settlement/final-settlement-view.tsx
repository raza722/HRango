import type { ReactNode } from 'react'
import { CalendarDays, ChevronDown, Paperclip, X } from 'lucide-react'

import { AppDialog } from '@/components/feedback/app-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import { SEPARATION_REASON_LABELS } from '../../constants'
import { useFinalSettlement } from '../../hooks/use-payroll'
import { formatDayMonth, formatLong } from '../../utils/format'
import { btn, footerButton } from '../../utils/styles'

const box =
  'flex min-h-10 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-[#D9D9D9]/60 px-3.5 font-inter text-sm text-field-value dark:bg-muted'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 @lg:grid-cols-[9rem_minmax(0,1fr)] @lg:items-center">
      <dt className="font-inter text-base text-heading">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  )
}

/** "Final Settlement View": the separation details, read-only. */
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
        <dl className="grid gap-5">
          <Row label="Employee">
            <span className={box}>
              <span className="inline-flex items-center gap-1.5 rounded-sm bg-heading px-2 py-0.5 text-xs text-white">
                {data.employee.name}
                <X aria-hidden="true" className="size-3" />
              </span>
              <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
            </span>
          </Row>
          <Row label="Reason">
            <span className={box}>
              {SEPARATION_REASON_LABELS[data.reason]}
              <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
            </span>
          </Row>
          <Row label="Resignation Date">
            <span className={box}>
              {formatDayMonth(data.resignationDate)
                .replace(/^(\d+), /, '$1 ')
                .replace(/ (\d{4})$/, ',$1')}
              <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-heading" />
            </span>
          </Row>
          <Row label="Notice Period">
            <Checkbox tone="navy" checked={data.noticePeriod} disabled aria-label="Notice Period" />
          </Row>
          <Row label="Last Working Date">
            <span className={box}>
              {formatLong(data.lastWorkingDate).replace(', ', ',')}
              <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-heading" />
            </span>
          </Row>
          <Row label="Final Settlement">
            <Checkbox
              tone="navy"
              checked={data.finalSettlement}
              disabled
              aria-label="Final Settlement"
            />
          </Row>
          <Row label="Attachment">
            <span className="flex min-h-10 overflow-hidden rounded-md border border-input">
              <span className="flex flex-1 items-center bg-[#D9D9D9]/60 px-3.5 font-inter text-sm text-field-value dark:bg-muted">
                {data.attachmentName ?? ''}
              </span>
              <span className="flex items-center gap-2 bg-[#707070] px-4 font-inter text-sm text-white">
                <Paperclip aria-hidden="true" className="size-4" />
                Attach
              </span>
            </span>
          </Row>
          <Row label="Description">
            <span className={cn(box, 'min-h-24 items-start py-2.5')}>{data.description}</span>
          </Row>
        </dl>
      )}
    </AppDialog>
  )
}
