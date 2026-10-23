import { cn } from '@/lib/utils'

/** The pale green "No Record Found" bar of empty tables and sections. */
export function NoRecord({
  children = 'No Record Found',
  className,
}: {
  children?: string
  className?: string
}) {
  return (
    <p
      role="status"
      className={cn(
        'rounded-lg bg-[#D7FFE0] px-6 py-2.5 font-inter text-base font-medium text-heading dark:bg-success/15',
        className,
      )}
    >
      {children}
    </p>
  )
}
