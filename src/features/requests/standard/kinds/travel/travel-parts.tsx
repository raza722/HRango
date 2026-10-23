import type { ReactNode } from 'react'
import { format, parse } from 'date-fns'
import { Eye, Pencil, Plus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ActionIcon, btn, NoRecord, SectionTitle } from '@/features/payroll'
import { cn } from '@/lib/utils'

import type { TravelDetailValue } from './travel.types'

/** "September 20, 2024 05:26 PM", as the Details table writes the times. */
const travelStamp = (date: string, time: string) =>
  date && time
    ? format(parse(`${date} ${time}`, 'yyyy-MM-dd HH:mm', new Date()), 'MMMM d, yyyy hh:mm a')
    : '—'

/** A section title with its red required mark and the navy "+ Add" on the right. */
export function TravelSection({
  title,
  required = false,
  addLabel,
  onAdd,
  error,
  children,
}: {
  title: string
  required?: boolean
  /** Leave out for a read-only section. */
  addLabel?: string
  onAdd?: () => void
  error?: string | undefined
  children: ReactNode
}) {
  return (
    <section aria-label={title} className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle>
          {title}
          {required && (
            <span aria-hidden="true" className="ml-1 text-[#E50141]">
              *
            </span>
          )}
        </SectionTitle>
        {onAdd && addLabel && (
          <Button
            type="button"
            aria-label={addLabel}
            onClick={onAdd}
            className={cn('h-8 min-w-24 gap-1 rounded-[4px] px-5 text-xs font-medium', btn.navy)}
          >
            <Plus aria-hidden="true" className="size-3" /> Add
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {children}
    </section>
  )
}

/**
 * "Details": From, To, Expected Departure, Expected Arrivals and the row's
 * actions (Edit, View, Delete in Create and Edit; View only in View), as drawn.
 */
export function TravelDetailsTable({
  details,
  onView,
  onEdit,
  onRemove,
}: {
  details: readonly TravelDetailValue[]
  onView: (index: number) => void
  onEdit?: ((index: number) => void) | undefined
  onRemove?: ((index: number) => void) | undefined
}) {
  if (details.length === 0) return <NoRecord />
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] font-inter text-base text-heading">
        <thead>
          <tr className="bg-[#F5F5F5] dark:bg-muted">
            <th scope="col" className="px-4 py-2.5 text-left font-normal">
              From
            </th>
            <th scope="col" className="px-4 py-2.5 text-left font-normal">
              To
            </th>
            <th scope="col" className="px-4 py-2.5 text-center font-normal">
              Expected Departure
            </th>
            <th scope="col" className="px-4 py-2.5 text-center font-normal">
              Expected Arrivals
            </th>
            <th scope="col" className="px-4 py-2.5 text-center font-normal">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {details.map((detail, index) => {
            const route = `${detail.departureFrom} to ${detail.arrivalAt}`
            return (
              <tr key={detail.id} className="border-b last:border-0">
                <td className="px-4 py-4">{detail.departureFrom}</td>
                <td className="px-4 py-4">{detail.arrivalAt}</td>
                <td className="px-4 py-4 text-center">
                  {travelStamp(detail.fromDate, detail.fromTime)}
                </td>
                <td className="px-4 py-4 text-center">
                  {travelStamp(detail.toDate, detail.toTime)}
                </td>
                <td className="px-4 py-4">
                  <span className="flex items-center justify-center gap-1.5">
                    {onEdit && (
                      <ActionIcon
                        icon={Pencil}
                        label={`Edit ${route}`}
                        tooltip="Edit"
                        colour="bg-[#2CBD4D]"
                        onClick={() => {
                          onEdit(index)
                        }}
                      />
                    )}
                    <ActionIcon
                      icon={Eye}
                      label={`View ${route}`}
                      tooltip="View"
                      colour="bg-[#2F6FED]"
                      onClick={() => {
                        onView(index)
                      }}
                    />
                    {onRemove && (
                      <ActionIcon
                        icon={X}
                        label={`Delete ${route}`}
                        tooltip="Delete"
                        colour="bg-[#E50141]"
                        onClick={() => {
                          onRemove(index)
                        }}
                      />
                    )}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
