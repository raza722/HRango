import { cn } from '@/lib/utils'

import type { TaskStatus } from '../../types/pm.types'
import { StatusRingIcon } from './field-icons'

/**
 * A status as the cells and lists draw it ("To Do Status"): the status radio in its colour on a
 * white square, then the name, on #F6F4FF.
 */
export function StatusChip({
  status,
  className,
}: {
  status: TaskStatus | undefined
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex h-[1.9rem] max-w-full min-w-0 shrink-0 items-center gap-2 rounded-md bg-[#F6F4FF] pr-2.5 pl-1.5 text-[0.8125rem] font-medium text-[#626262]',
        className,
      )}
    >
      <StatusIconBox color={status?.color ?? '#979797'} />
      <span className="truncate">{status?.name ?? 'No status'}</span>
    </span>
  )
}

/** "Status Icon Button": a white rounded square with the status radio. */
export function StatusIconBox({ color, className }: { color: string; className?: string }) {
  return (
    <span
      className={cn(
        'flex size-[1.05rem] shrink-0 items-center justify-center rounded-[0.23rem] bg-white',
        className,
      )}
    >
      <StatusRingIcon className="size-[0.7rem]" style={{ color }} />
    </span>
  )
}
