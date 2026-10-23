import { EmployeeAvatar } from '@/components/layout'
import { Skeleton } from '@/components/ui/skeleton'

import type { EmployeeProfile } from '../../types/payroll.types'
import { formatJoining } from '../../utils/format'

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-baseline gap-2 font-inter text-sm sm:grid-cols-[9rem_minmax(0,1fr)] @xl:text-base">
      <dt className="font-semibold text-heading @xl:text-[1.0625rem]">{label}:</dt>
      <dd className="truncate text-heading">{value ?? '—'}</dd>
    </div>
  )
}

/**
 * The person at the top of Pay Slip, Salary Revision and Opening Balance
 * dialogs: a large photo, the name, then Location / Department / Job Title
 * beside Employee Code / Branch / Company / Joining Date.
 */
export function EmployeeCard({ profile }: { profile: EmployeeProfile | undefined }) {
  if (!profile) {
    return (
      <div className="flex items-center gap-6">
        <Skeleton className="size-28 rounded-full sm:size-36" />
        <div className="grid flex-1 gap-3">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-full max-w-md" />
          <Skeleton className="h-4 w-full max-w-sm" />
        </div>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center gap-5 @xl:flex-row @xl:items-start @xl:gap-10">
      <EmployeeAvatar
        name={profile.name}
        photoUrl={profile.photoUrl}
        className="size-28 shrink-0 @xl:size-36"
        fallbackClassName="text-3xl"
      />
      <dl className="grid w-full min-w-0 gap-x-10 gap-y-4 pt-2 @3xl:grid-cols-2">
        <div>
          <dt className="sr-only">Name</dt>
          <dd className="text-center font-inter text-xl font-medium text-heading @xl:text-left @xl:text-2xl">
            {profile.name}
          </dd>
        </div>
        <Fact label="Employee Code" value={profile.code} />
        <Fact label="Location" value={profile.location} />
        <Fact label="Branch" value={profile.branch} />
        <Fact label="Department" value={profile.department} />
        <Fact label="Company" value={profile.company} />
        <Fact label="Job Title" value={profile.designation} />
        <Fact
          label="Joining Date"
          value={profile.joiningDate ? formatJoining(profile.joiningDate) : null}
        />
      </dl>
    </div>
  )
}
