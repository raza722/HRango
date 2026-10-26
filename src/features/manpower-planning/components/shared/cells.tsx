import { cn } from '@/lib/utils'

import { CHIP_TONE, type ChipTone } from '../../constants'
import type { Stamp } from '../../types/manpower.types'
import { formatStampTime, stampOf } from '../../utils/format'
import { accent } from './mp-styles'

/**
 * The designs' pale status chip: the status colour at 10% behind its text, 7px
 * corners (Poppins Medium 14, or 12 in the plan list).
 */
export function Chip({
  label,
  tone,
  size = 'md',
}: {
  label: string
  tone: ChipTone
  size?: 'sm' | 'md'
}) {
  return (
    <span
      className={cn(
        'relative inline-flex items-center justify-center font-medium whitespace-nowrap before:absolute before:inset-0 before:rounded-[7px] before:opacity-10',
        size === 'md'
          ? 'h-[2.0625rem] min-w-[4.375rem] px-3 text-sm'
          : 'h-[1.625rem] min-w-[4.4375rem] px-1.5 text-xs',
        CHIP_TONE[tone],
      )}
    >
      <span className="relative">{label}</span>
    </span>
  )
}

/**
 * "16 Jan 2024 12:30 PM" over "by Hamza Ashraf" (the name in purple). The API gives
 * the person's name only, so the role the designs draw after it is not shown.
 * `sm` is the plan list's 12px version.
 */
export function StampCell({ stamp, size = 'md' }: { stamp: Stamp; size?: 'sm' | 'md' }) {
  const small = size === 'sm'
  return (
    <span className={cn('flex flex-col', small ? 'text-xs' : 'min-w-[11rem] text-sm')}>
      <span className="whitespace-nowrap text-heading">{formatStampTime(stamp.at)}</span>
      {stamp.byName && (
        <span className="text-xs text-heading">
          by{' '}
          <span className={cn('font-medium', small ? 'text-xs' : 'text-sm', accent.text)}>
            {stamp.byName}
          </span>
        </span>
      )}
    </span>
  )
}

/** A stamp that may be missing (Modified On before any change): "—". */
export function OptionalStampCell({
  at,
  byName,
  size,
}: {
  at: string | null
  byName: string | null
  size?: 'sm' | 'md'
}) {
  if (!at) return <span className="text-sm text-[#707070]">—</span>
  return <StampCell stamp={stampOf(at, byName)} {...(size ? { size } : {})} />
}
