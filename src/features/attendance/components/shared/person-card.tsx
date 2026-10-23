import { EmployeeAvatar } from '@/components/layout'
import { Skeleton } from '@/components/ui/skeleton'

import type { AttendanceProfile } from '../../types/attendance.types'
import { formatLongDate } from '../../utils/local-time'

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="grid grid-cols-[8rem_minmax(0,1fr)] items-baseline gap-2 font-inter text-sm text-heading sm:grid-cols-[9rem_minmax(0,1fr)] sm:text-base">
      {/* Figma: labels Inter Semi Bold 17, values Inter Regular 16, both #000. */}
      <dt className="font-semibold sm:text-[1.0625rem]">{label}:</dt>
      <dd className="truncate">{value ?? '—'}</dd>
    </div>
  )
}

/**
 * The person at the top of Time Sheet Edit / View: photo, name, location,
 * department, joining date, employee code, company and designation.
 */
export function PersonCard({ profile }: { profile: AttendanceProfile | undefined }) {
  if (!profile) {
    return (
      <div className="flex items-center gap-6">
        <Skeleton className="size-24 rounded-full sm:size-32" />
        <div className="grid flex-1 gap-3">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-full max-w-md" />
          <Skeleton className="h-4 w-full max-w-sm" />
        </div>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center gap-5 @xl:flex-row @xl:items-start @xl:gap-8">
      <EmployeeAvatar
        name={profile.name}
        photoUrl={profile.photoUrl}
        className="size-28 shrink-0 @xl:size-36"
        fallbackClassName="text-3xl"
      />
      <div className="grid w-full min-w-0 gap-4 pt-1">
        <h3 className="text-center font-inter text-xl font-medium text-heading @xl:text-left @xl:text-2xl">
          {profile.name}
        </h3>
        <dl className="grid gap-x-8 gap-y-3 @3xl:grid-cols-2">
          <Fact label="Location" value={profile.location} />
          <Fact label="Employee Code" value={profile.code} />
          <Fact label="Department" value={profile.department} />
          <Fact label="Company" value={profile.company} />
          <Fact label="Joining Date" value={formatLongDate(profile.joiningDate)} />
          <Fact label="Designation" value={profile.designation} />
        </dl>
      </div>
    </div>
  )
}
