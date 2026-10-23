import { EmployeeAvatar } from '@/components/layout'
import { Skeleton } from '@/components/ui/skeleton'

import type { EmployeeCardInfo } from '../../types/offboarding.types'

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-baseline gap-2 font-inter text-sm sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:text-base">
      <dt className="font-semibold text-heading sm:text-[1.0625rem]">{label}:</dt>
      <dd className="break-words text-heading">{value}</dd>
    </div>
  )
}

/**
 * The person at the top of the End of Employment dialogs, as drawn: a large
 * photo, the name and "Designation CODE", then Age, Email, Phone and
 * Experience on the right.
 */
export function EmployeeInfoCard({
  card,
  pending = false,
}: {
  card: EmployeeCardInfo | undefined
  pending?: boolean
}) {
  if (!card) {
    if (pending) {
      return (
        <div className="flex items-center gap-6">
          <Skeleton className="size-28 rounded-full sm:size-36" />
          <div className="grid flex-1 gap-3">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-full max-w-sm" />
          </div>
        </div>
      )
    }
    return (
      <p className="rounded-md bg-muted/60 px-4 py-6 text-center font-inter text-sm text-muted-foreground">
        Choose the employee to see their details.
      </p>
    )
  }
  return (
    <section
      aria-label={`${card.name}, ${card.designation}`}
      className="grid items-center gap-6 @2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
    >
      <div className="flex flex-col items-center gap-5 @md:flex-row @md:gap-8">
        <EmployeeAvatar
          name={card.name}
          photoUrl={card.photoUrl}
          className="size-28 shrink-0 @xl:size-36"
          fallbackClassName="text-3xl"
        />
        <div className="grid gap-2 text-center @md:text-left">
          <p className="font-inter text-xl font-medium text-heading sm:text-2xl">{card.name}</p>
          <p className="font-inter text-sm text-heading sm:text-base">
            {card.designation} {card.code}
          </p>
        </div>
      </div>
      <dl className="grid gap-3.5">
        <Fact label="Age" value={card.age} />
        <Fact label="Email" value={card.email} />
        <Fact label="Phone" value={card.phone} />
        <Fact label="Experience" value={card.experience} />
      </dl>
    </section>
  )
}
