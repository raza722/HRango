import { AlertTriangle } from 'lucide-react'

import { cn } from '@/lib/utils'

import { daysSinceSync, formatStamp, plural, STALE_SYNC_DAYS } from '../../utils/device-format'

/** The amber "Not synced for 12 days" chip. */
export function StaleSyncChip({ days, className }: { days: number; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-1 rounded-sm bg-[#FFF3D9] px-1.5 py-0.5 text-[0.625rem] font-medium whitespace-nowrap text-[#8A5A00] dark:bg-amber-500/15 dark:text-amber-200',
        className,
      )}
    >
      <AlertTriangle aria-hidden="true" className="size-3" />
      Not synced for {plural(days, 'day', 'days')}
    </span>
  )
}

/** Last sync time, with the warning when it is old (`now`: when the page opened). */
export function LastSynced({
  lastSyncedAt,
  now,
  className,
}: {
  lastSyncedAt: string | null
  now: number
  className?: string
}) {
  const days = daysSinceSync(lastSyncedAt, now)
  if (!lastSyncedAt || days === null) {
    return <span className={cn('text-muted-foreground', className)}>Never synced</span>
  }
  return (
    <span className={cn('grid justify-items-start gap-1 leading-tight', className)}>
      <span>{formatStamp(lastSyncedAt)}</span>
      {days >= STALE_SYNC_DAYS && <StaleSyncChip days={days} />}
    </span>
  )
}
