import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import { OVERVIEW_TILES } from '../../constants'
import type { DaysOverview } from '../../types/attendance.types'
import { formatDuration } from '../../utils/local-time'

/** "Days Overview This Month": a coloured tile per count of the time-sheet summary, as drawn. */
export function DaysOverviewCard({
  overview,
  personName,
}: {
  overview: DaysOverview | undefined
  /** Whose month it is, when it is not the signed-in person's. */
  personName?: string | undefined
}) {
  return (
    <section
      aria-labelledby="days-overview-title"
      className="min-w-0 flex-1 rounded-xl bg-card px-4 py-4 font-inter shadow-xs sm:px-5"
    >
      <h2
        id="days-overview-title"
        className="border-l-2 border-blue-600 pl-2 text-sm leading-tight text-heading"
      >
        Days Overview This Month
        {personName && <span className="text-muted-foreground"> · {personName}</span>}
      </h2>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-3">
        {OVERVIEW_TILES.map((tile) => (
          <li key={tile.key} className="flex w-16 flex-col items-center gap-1.5 text-center">
            {overview ? (
              <span
                className={cn(
                  'flex h-11 min-w-12 items-center justify-center rounded-md px-1 text-lg font-medium tabular-nums',
                  tile.minutes && 'text-sm',
                  tile.className,
                )}
              >
                {tile.minutes ? formatDuration(tile.value(overview)) : tile.value(overview)}
              </span>
            ) : (
              <Skeleton className="h-11 w-12" />
            )}
            <span className="text-[0.625rem] leading-tight font-medium text-title">
              {tile.label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
