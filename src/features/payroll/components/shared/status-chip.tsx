import { cn } from '@/lib/utils'

/** The designs' small pale status chips (Run, Closed, Released, Pending…): Poppins Medium 10, in the status colour. */
export function StatusChip({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={cn(
        'inline-flex min-w-16 items-center justify-center rounded-[3px] px-2.5 py-1 text-[0.625rem] leading-none font-medium whitespace-nowrap',
        className,
      )}
    >
      {label}
    </span>
  )
}
