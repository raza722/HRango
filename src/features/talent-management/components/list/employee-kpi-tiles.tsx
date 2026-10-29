import type { ComponentType, SVGProps } from 'react'
import { IdCard, Mars, UsersRound, Venus } from 'lucide-react'

import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import { useEmployeeStats } from '../../hooks/use-employees'
import type { EmployeeStats } from '../../types/employees.types'

/**
 * The four tiles of Employee Record (1091:2428): white 80px cards with 12px corners, the label
 * Poppins Medium 10, the count Medium 24, and the 44px coloured square with its icon (green
 * #0DCD94, blue #3366FF, charcoal #2A2A2A, red #E4393C). The frame's Material icons
 * (supervised_user_circle, face_5, face, badge) are not in any export, so lucide stands in.
 */
const TILES: readonly {
  key: Exclude<keyof EmployeeStats, 'complete'>
  label: string
  colour: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
}[] = [
  { key: 'total', label: 'Total Employees', colour: 'bg-[#0DCD94]', icon: UsersRound },
  { key: 'male', label: 'Male', colour: 'bg-[#3366FF]', icon: Mars },
  { key: 'female', label: 'Female', colour: 'bg-[#2A2A2A] dark:bg-[#4B5563]', icon: Venus },
  { key: 'probation', label: 'On Probation', colour: 'bg-[#E4393C]', icon: IdCard },
]

export function EmployeeKpiTiles() {
  const stats = useEmployeeStats()
  return (
    <div className="grid gap-2">
      <ul
        aria-label="Employees in numbers"
        className="grid gap-4 sm:grid-cols-2 @[56rem]/page:grid-cols-4"
      >
        {TILES.map((tile) => {
          const Icon = tile.icon
          return (
            <li
              key={tile.key}
              className="flex h-20 items-center justify-between gap-3 rounded-xl bg-card px-4 shadow-xs"
            >
              <div className="grid gap-1">
                <span className="text-[0.625rem] leading-[0.9375rem] font-medium text-title">
                  {tile.label}
                </span>
                {stats.isPending ? (
                  <Skeleton className="h-7 w-12" />
                ) : (
                  <span className="text-2xl leading-9 font-medium text-title">
                    {stats.data ? String(stats.data[tile.key]) : '—'}
                  </span>
                )}
              </div>
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-11 shrink-0 items-center justify-center rounded-[6px] text-white',
                  tile.colour,
                )}
              >
                <Icon className="size-6" strokeWidth={1.75} />
              </span>
            </li>
          )
        })}
      </ul>
      {stats.isError && (
        <p role="alert" className="text-xs text-destructive">
          The totals could not be loaded: {stats.error.message}
        </p>
      )}
      {stats.data && !stats.data.complete && (
        <p className="text-xs text-muted-foreground">
          Male and Female count the first 2,000 employees.
        </p>
      )}
    </div>
  )
}
